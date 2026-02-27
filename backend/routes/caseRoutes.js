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
    const { name, age, gender, height, weight, lastSeenDate, lastSeenLocation, description } = req.body;
    const caseId = `MP-${new Date().getFullYear()}-${uuidv4().split('-')[0].toUpperCase()}`;
    const photos = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];

    const newCase = await MissingPerson.create({
      caseId, name, age, gender, height, weight,
      lastSeenDate, lastSeenLocation, description,
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

// ── ML feature extraction (attributes + reid + gait) ──────────────────────
async function _extractMLFeatures(docId, imagePath) {
  const ML_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
  const FormData = require('form-data');

  // 1) Attributes + Re-ID embedding
  const attrForm = new FormData();
  attrForm.append('image', fs.createReadStream(imagePath));
  const attrRes = await axios.post(`${ML_URL}/api/attributes`, attrForm, {
    headers: attrForm.getHeaders(),
    timeout: 60000,
  });

  const updates = {};
  if (attrRes.data.attributes) updates.attributes    = attrRes.data.attributes;
  if (attrRes.data.embedding)  updates.reidEmbedding = attrRes.data.embedding;

  // 2) Gait signature
  try {
    const gaitForm = new FormData();
    gaitForm.append('image', fs.createReadStream(imagePath));
    const gaitRes = await axios.post(`${ML_URL}/api/gait`, gaitForm, {
      headers: gaitForm.getHeaders(),
      timeout: 30000,
    });
    if (gaitRes.data.gaitSignature) updates.gaitSignature = gaitRes.data.gaitSignature;
    if (gaitRes.data.gaitScore)     updates.gaitScore     = gaitRes.data.gaitScore;
  } catch (e) {
    console.warn('[ML] Gait extraction error:', e.message);
  }

  await MissingPerson.findByIdAndUpdate(docId, updates);
  console.log(`[ML] Features saved for case docId=${docId}`);
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
