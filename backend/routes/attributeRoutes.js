const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const multer = require('multer');
const { analyzeAttributes } = require('../services/groqAnalysis');

const upload = multer({ dest: path.join(__dirname, '../uploads/') });
const ML_URL = () => process.env.FASTAPI_BASE_URL || 'http://127.0.0.1:8001';

// POST /api/attributes/predict
router.post('/predict', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'image file required' });

    const form = new FormData();
    form.append('image', fs.createReadStream(req.file.path));

    const mlRes = await axios.post(`${ML_URL()}/attributes/predict`, form, {
      headers: form.getHeaders(),
      timeout: 30000,
    });

    const result = mlRes.data;

    // Groq: plain-language summary of predicted attributes
    let aiSummary = null;
    try {
      aiSummary = await analyzeAttributes(result.attributes);
    } catch (groqErr) {
      console.warn('[Groq] Attribute analysis skipped:', groqErr.message);
    }

    res.json({ ...result, aiSummary });
  } catch (err) {
    console.error('[Attributes] Predict error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
