const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const multer = require('multer');
const SearchHistory = require('../models/SearchHistory');
const GaitRecord = require('../models/GaitRecord');
const { analyzeGaitResults } = require('../services/groqAnalysis');

const upload = multer({ dest: path.join(__dirname, '../uploads/') });
const ML_URL = () => process.env.FASTAPI_BASE_URL || 'http://127.0.0.1:8001';

// POST /api/gait/match — match gait from uploaded silhouette frames
router.post('/match', upload.array('frames', 50), async (req, res) => {
  const start = Date.now();
  try {
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ message: 'Silhouette frames required' });

    const form = new FormData();
    for (const file of req.files) {
      form.append('frames', fs.createReadStream(file.path), file.originalname || file.filename);
    }

    const mlRes = await axios.post(`${ML_URL()}/gait/match`, form, {
      headers: form.getHeaders(),
      timeout: 60000,
    });

    const { matches, frames_received, embedding_dim } = mlRes.data;

    // Groq analysis
    let aiAnalysis = null;
    try {
      aiAnalysis = await analyzeGaitResults(matches, frames_received);
    } catch (groqErr) {
      console.warn('[Groq] Gait analysis skipped:', groqErr.message);
    }

    await SearchHistory.create({
      searchType: 'gait',
      results: matches.map((m) => ({
        personId: m.person_id,
        similarity: m.similarity,
        imagePath: '',
      })),
      aiAnalysis,
      processingTime: Date.now() - start,
    });

    res.json({ matches, frames_received, embedding_dim, aiAnalysis, processingTime: Date.now() - start });
  } catch (err) {
    console.error('[Gait] Match error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/gait/add — register gait for a person
router.post('/add', upload.array('frames', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ message: 'frames required' });
    if (!req.body.person_id)
      return res.status(400).json({ message: 'person_id required' });

    const form = new FormData();
    for (const file of req.files) {
      form.append('frames', fs.createReadStream(file.path), file.originalname || file.filename);
    }
    form.append('person_id', req.body.person_id);

    const mlRes = await axios.post(`${ML_URL()}/gait/add`, form, {
      headers: form.getHeaders(),
      timeout: 60000,
    });

    await GaitRecord.create({
      personId: req.body.person_id,
      embeddingIndex: mlRes.data.embedding_index,
      condition: req.body.condition || 'nm',
      frameCount: req.files.length,
    });

    res.json(mlRes.data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
