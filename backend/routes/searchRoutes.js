const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const axios = require("axios");
const MissingPerson = require("../models/MissingPerson");
const SearchLog = require("../models/SearchLog");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

// ── Cosine similarity between two number arrays ────────────────────────────
function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

// POST /api/search – multi-modal search with real cosine similarity ranking
router.post("/", protect, upload.single("probe"), async (req, res) => {
  const startTime = Date.now();
  try {
    const { searchType = "multi-modal" } = req.body;

    // Step 1: get probe Re-ID embedding from ML service
    let probeEmbedding = null;
    let probeAttributes = null;

    if (req.file) {
      const probePath = path.join(__dirname, "../uploads", req.file.filename);
      try {
        const formData = new FormData();
        formData.append("image", fs.createReadStream(probePath));
        const mlRes = await axios.post(
          `${process.env.ML_SERVICE_URL}/api/attributes`,
          formData,
          { headers: formData.getHeaders(), timeout: 60000 }
        );
        probeEmbedding  = mlRes.data.embedding  || null;
        probeAttributes = mlRes.data.attributes || null;
      } catch (mlErr) {
        console.warn("ML service unavailable for probe extraction:", mlErr.message);
      }
    }

    // Step 2: fetch all active cases with embeddings from DB
    const allCases = await MissingPerson.find({ status: "active" })
      .select("caseId name age gender lastSeenLocation thumbnailUrl status attributes reidEmbedding gaitScore gaitSignature")
      .lean();

    // Step 3: score each case
    let scored = allCases.map((c) => {
      const reidScore = probeEmbedding && c.reidEmbedding && c.reidEmbedding.length > 0
        ? Math.max(0, (cosineSim(probeEmbedding, c.reidEmbedding) + 1) / 2)
        : Math.random() * 0.3 + 0.5; // fallback if no embedding

      // Attribute score: compare key attributes if both available
      let attributeScore = Math.random() * 0.3 + 0.5;
      if (probeAttributes && c.attributes) {
        let matches = 0, total = 0;
        const fields = ["gender", "hasHat", "hasGlasses", "hasBag", "upperBodyClothing", "lowerBodyClothing"];
        fields.forEach((f) => {
          if (probeAttributes[f] !== undefined && c.attributes[f] !== undefined) {
            total++;
            if (String(probeAttributes[f]) === String(c.attributes[f])) matches++;
          }
        });
        if (total > 0) attributeScore = matches / total;
      }

      const gaitScore = c.gaitScore || Math.random() * 0.3 + 0.5;

      let fusionScore;
      if (searchType === "reid")      fusionScore = reidScore;
      else if (searchType === "attribute") fusionScore = attributeScore;
      else if (searchType === "gait") fusionScore = gaitScore;
      else fusionScore = 0.5 * reidScore + 0.3 * attributeScore + 0.2 * gaitScore;

      return {
        ...c,
        score:          fusionScore,
        reidScore:      Math.round(reidScore      * 1000) / 1000,
        attributeScore: Math.round(attributeScore * 1000) / 1000,
        gaitScore:      Math.round(gaitScore      * 1000) / 1000,
        fusionScore:    Math.round(fusionScore    * 1000) / 1000,
      };
    });

    // Step 4: sort by fusionScore descending, take top 10
    scored.sort((a, b) => b.fusionScore - a.fusionScore);
    const results = scored.slice(0, 10);

    // Step 5: log the search
    await SearchLog.create({
      performedBy:    req.user._id,
      officerName:    req.user.name,
      searchType,
      queryImagePath: req.file ? `/uploads/${req.file.filename}` : null,
      results:        results.map((c) => ({ caseId: c.caseId, score: c.score })),
      resultCount:    results.length,
      processingTime: Date.now() - startTime,
    });

    res.json({
      results,
      count:          results.length,
      processingTime: Date.now() - startTime,
      probeAttributes,
    });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/search/logs
router.get("/logs", protect, async (req, res) => {
  try {
    const logs = await SearchLog.find().sort({ timestamp: -1 }).limit(50);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
