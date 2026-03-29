const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const axios   = require('axios');
const fs      = require('fs');
const path    = require('path');
const MissingPerson = require('../models/MissingPerson');
const { protect }   = require('../middleware/authMiddleware');
const upload        = require('../middleware/uploadMiddleware');

// GET /api/cases – paginated list
router.get('/', protect, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = status ? { status } : {};
    const cases = await MissingPerson.find(query)
      .populate('reportedBy', 'name email badge')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await MissingPerson.countDocuments(query);
    res.json({ cases, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/cases/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const c = await MissingPerson.findOne({ caseId: req.params.id }).populate('reportedBy', 'name email badge');
    if (!c) return res.status(404).json({ message: 'Case not found' });
    c.accessLog.push({ officer: req.user.name, timestamp: new Date(), action: 'view' });
    await c.save();
    res.json(c);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/cases – create new case + fire-and-forget ML extraction
router.post('/', protect, upload.array('photos', 5), async (req, res) => {
  try {
    const { name, age, gender, height, weight, lastSeenDate, lastSeenLocation, lastSeenLat, lastSeenLng, description } = req.body;
    const caseId = `MP-${new Date().getFullYear()}-${uuidv4().split('-')[0].toUpperCase()}`;
    const photos = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];

    // Parse coordinates if provided
    const lastSeenCoordinates = (lastSeenLat && lastSeenLng)
      ? { lat: parseFloat(lastSeenLat), lng: parseFloat(lastSeenLng) }
      : undefined;

    const newCase = await MissingPerson.create({
      caseId, name, age, gender, height, weight,
      lastSeenDate, lastSeenLocation, lastSeenCoordinates, description,
      reportedBy: req.user._id,
      photos,
      thumbnailUrl: photos[0] || null,
    });

    // Fire-and-forget: extract attributes + Re-ID + gait from first photo
    if (photos.length > 0) {
      const absPath = path.join(__dirname, '../uploads', path.basename(photos[0]));
      _extractMLFeatures(newCase._id, absPath).catch(e =>
        console.warn('[ML] Feature extraction failed:', e.message)
      );
    }

    res.status(201).json(newCase);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── ML feature extraction (attributes + osnet reid) ───────────────────────
async function _extractMLFeatures(docId, imagePath) {
  const ML_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8001';
  const FormData = require('form-data');

  const updates = {};

  // 1) PA-100K Attributes
  try {
    const attrForm = new FormData();
    attrForm.append('image', fs.createReadStream(imagePath));
    const attrRes = await axios.post(`${ML_URL}/attributes/predict`, attrForm, {
      headers: attrForm.getHeaders(),
      timeout: 60000,
    });

    const mlAttrs = attrRes.data.attributes || {};

    updates.attributes = {
      gender: mlAttrs.gender || 'Unknown',
      age: mlAttrs.age || 'Unknown',
      upperBodyClothing: mlAttrs.upperBodyClothing || 'Unknown',
      lowerBodyClothing: mlAttrs.lowerBodyClothing || 'Unknown',
      upperBodyColor: mlAttrs.upperBodyPattern || 'Unknown',
      lowerBodyColor: mlAttrs.lowerBodyPattern || 'Unknown',
      hasBag: mlAttrs.hasBag || false,
      hasHat: mlAttrs.hasHat || false,
      hasGlasses: mlAttrs.hasGlasses || false,
      hairLength: mlAttrs.orientation || 'Unknown',
      bodyShape: mlAttrs.wearingBoots ? 'Boots' : 'Regular',
      confidence: mlAttrs.confidence || 0,
      raw: attrRes.data.raw_predictions || mlAttrs.raw || {},
    };

    console.log(`[ML] Attributes extracted: gender=${updates.attributes.gender}, confidence=${updates.attributes.confidence}`);
  } catch (attrErr) {
    console.warn('[ML] Attribute extraction error:', attrErr.message);
  }

  // 2) OSNet Re-ID embedding (512-dim)
  try {
    const reidForm = new FormData();
    reidForm.append('image', fs.createReadStream(imagePath));
    const reidRes = await axios.post(`${ML_URL}/reid/extract`, reidForm, {
      headers: reidForm.getHeaders(),
      timeout: 30000,
    });
    if (reidRes.data.embedding && reidRes.data.embedding.length > 0) {
      updates.reidEmbedding = reidRes.data.embedding;
      console.log(`[ML] OSNet Re-ID embedding extracted (${reidRes.data.dim}-dim)`);
    }
  } catch (reidErr) {
    console.warn('[ML] Re-ID extraction error:', reidErr.message);
  }

  // 3) Gait — currently returns unavailable (future scope: needs video)
  // Not calling gait endpoint since it requires video input

  if (Object.keys(updates).length > 0) {
    await MissingPerson.findByIdAndUpdate(docId, updates);
    console.log(`[ML] Features saved for case docId=${docId}`);
  }
}

// PATCH /api/cases/:id/status
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const c = await MissingPerson.findOneAndUpdate(
      { caseId: req.params.id },
      { status, updatedAt: new Date() },
      { new: true }
    );
    if (!c) return res.status(404).json({ message: 'Case not found' });
    res.json(c);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/cases/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const c = await MissingPerson.findOneAndDelete({ caseId: req.params.id });
    if (!c) return res.status(404).json({ message: 'Case not found' });
    res.json({ message: 'Case deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
