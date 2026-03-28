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
const { analyzeSearchResults, distanceLabel } = require("../services/groqAnalysis");

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

// ── Haversine distance (km) between two lat/lng points ─────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Convert distance to a 0-1 score (closer = higher score) ───────────────
function coordinateScore(dist) {
  // 0 km → 1.0, 5 km → ~0.5, 50 km → ~0.09
  if (dist == null || isNaN(dist)) return 0;
  return 1 / (1 + dist / 5);
}

// POST /api/search – multi-modal search with real cosine similarity ranking
router.post("/", protect, upload.single("probe"), async (req, res) => {
  const startTime = Date.now();
  try {
    const { searchType = "multi-modal", searchLat, searchLng } = req.body;

    // Step 1: get probe features from ML service
    let probeEmbedding = null;
    let probeAttributes = null;

    if (req.file) {
      const probePath = path.join(__dirname, "../uploads", req.file.filename);

      // Extract PA-100K attributes
      try {
        const formData = new FormData();
        formData.append("image", fs.createReadStream(probePath));
        const attrRes = await axios.post(
          `${process.env.FASTAPI_BASE_URL}/attributes/predict`,
          formData,
          { headers: formData.getHeaders(), timeout: 60000 }
        );
        probeAttributes = attrRes.data.structured_attributes || null;
      } catch (mlErr) {
        console.warn("ML service unavailable for attribute extraction:", mlErr.message);
      }

      // Extract OSNet Re-ID embedding (512-dim)
      try {
        const reidForm = new FormData();
        reidForm.append("image", fs.createReadStream(probePath));
        const reidRes = await axios.post(
          `${process.env.FASTAPI_BASE_URL}/reid/extract`,
          reidForm,
          { headers: reidForm.getHeaders(), timeout: 30000 }
        );
        probeEmbedding = reidRes.data.embedding || null;
      } catch (reidErr) {
        console.warn("ML service unavailable for Re-ID extraction:", reidErr.message);
      }
    }

    // Parse search coordinates if provided
    const queryLat = searchLat ? parseFloat(searchLat) : null;
    const queryLng = searchLng ? parseFloat(searchLng) : null;
    const hasQueryCoords = queryLat != null && queryLng != null && !isNaN(queryLat) && !isNaN(queryLng);

    // Step 2: fetch all active cases with embeddings from DB
    const allCases = await MissingPerson.find({ status: "active" })
      .select("caseId name age gender lastSeenLocation lastSeenCoordinates thumbnailUrl status attributes reidEmbedding")
      .lean();

    // Step 3: score each case
    let scored = allCases.map((c) => {
      // Re-ID score (OSNet 512-dim cosine similarity)
      let reidScore = 0;
      if (probeEmbedding && c.reidEmbedding && c.reidEmbedding.length > 0) {
        // For L2-normalized vectors, cosine similarity is just the dot product
        // Map from [-1, 1] to [0, 1]
        reidScore = Math.max(0, (cosineSim(probeEmbedding, c.reidEmbedding) + 1) / 2);
      }

      // Attribute score: weighted comparison of PA-100K attributes
      let attributeScore = 0;
      if (probeAttributes && c.attributes) {
        const weightedFields = [
          { field: "gender", weight: 2.0 },
          { field: "age", weight: 1.5 },
          { field: "hasHat", weight: 1.0 },
          { field: "hasGlasses", weight: 1.0 },
          { field: "hasBag", weight: 1.0 },
          { field: "hasBackpack", weight: 1.0 },
          { field: "hasShoulderBag", weight: 1.0 },
          { field: "hasHandBag", weight: 1.0 },
          { field: "holdingObjects", weight: 0.5 },
          { field: "upperBodyClothing", weight: 1.5 },
          { field: "lowerBodyClothing", weight: 1.5 },
          { field: "upperBodyPattern", weight: 0.8 },
          { field: "lowerBodyPattern", weight: 0.8 },
          { field: "wearingBoots", weight: 0.5 },
          { field: "orientation", weight: 0.3 },
        ];
        let weightedMatches = 0, totalWeight = 0;
        weightedFields.forEach(({ field, weight }) => {
          const pv = probeAttributes[field];
          const cv = c.attributes[field] ?? c.attributes?.raw?.[field];
          if (pv !== undefined && cv !== undefined) {
            totalWeight += weight;
            if (String(pv) === String(cv)) weightedMatches += weight;
          }
        });

        // Also compare raw predictions if available (cosine similarity on probability vectors)
        if (probeAttributes.raw && c.attributes.raw) {
          const probeRaw = Object.values(probeAttributes.raw);
          const caseRaw = Object.values(c.attributes.raw);
          if (probeRaw.length === caseRaw.length && probeRaw.length > 0) {
            const rawSim = cosineSim(probeRaw, caseRaw);
            const fieldScore = totalWeight > 0 ? weightedMatches / totalWeight : 0.5;
            attributeScore = 0.6 * fieldScore + 0.4 * ((rawSim + 1) / 2);
          } else if (totalWeight > 0) {
            attributeScore = weightedMatches / totalWeight;
          }
        } else if (totalWeight > 0) {
          attributeScore = weightedMatches / totalWeight;
        }
      }

      // Coordinate score (Haversine distance-based)
      let locScore = 0;
      let distanceKm = null;
      if (hasQueryCoords && c.lastSeenCoordinates?.lat != null && c.lastSeenCoordinates?.lng != null) {
        distanceKm = haversineKm(queryLat, queryLng, c.lastSeenCoordinates.lat, c.lastSeenCoordinates.lng);
        locScore = coordinateScore(distanceKm);
      }

      // Fusion score based on search type
      let fusionScore;
      if (searchType === "reid") fusionScore = reidScore;
      else if (searchType === "attribute") fusionScore = attributeScore;
      else if (searchType === "location") fusionScore = locScore;
      else {
        // Multi-modal fusion: 0.4 * reid + 0.3 * attribute + 0.3 * coordinate
        fusionScore = 0.4 * reidScore + 0.3 * attributeScore + 0.3 * locScore;
      }

      return {
        ...c,
        score:          fusionScore,
        reidScore:      Math.round(reidScore      * 1000) / 1000,
        attributeScore: Math.round(attributeScore * 1000) / 1000,
        locationScore:  Math.round(locScore        * 1000) / 1000,
        distanceKm:     distanceKm != null ? Math.round(distanceKm * 10) / 10 : null,
        fusionScore:    Math.round(fusionScore    * 1000) / 1000,
        locationLabel:  distanceLabel(distanceKm != null ? Math.round(distanceKm * 10) / 10 : null),
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

// POST /api/search/analyze – AI-powered result analysis via Groq LLM
router.post("/analyze", protect, async (req, res) => {
  try {
    const { probeAttributes, results } = req.body;
    console.log("[AI Analyze] Request received:", results?.length, "results");
    if (!results || results.length === 0) {
      return res.json({ analysis: [], message: "No results to analyze" });
    }
    const analysis = await analyzeSearchResults(probeAttributes, results);
    console.log("[AI Analyze] Success:", analysis.length, "verdicts");
    res.json({ analysis });
  } catch (err) {
    console.error("[AI Analyze] Error:", err.message, err.stack);
    res.status(500).json({ message: "AI analysis failed: " + err.message });
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
