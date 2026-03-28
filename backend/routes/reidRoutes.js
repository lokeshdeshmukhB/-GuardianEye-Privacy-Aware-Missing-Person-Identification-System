const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const multer = require('multer');
const SearchHistory = require('../models/SearchHistory');
const Person = require('../models/Person');
const { analyzeReidResults } = require('../services/groqAnalysis');

const upload = multer({ dest: path.join(__dirname, '../uploads/') });

const ML_URL = () => process.env.FASTAPI_BASE_URL || 'http://127.0.0.1:8001';

// POST /api/reid/search — proxy to FastAPI, save history, run Groq analysis
router.post('/search', upload.single('image'), async (req, res) => {
  const start = Date.now();
  try {
    if (!req.file) return res.status(400).json({ message: 'image file required' });

    const filePath = req.file.path;
    const topK = parseInt(req.body.top_k) || 5;

    const form = new FormData();
    form.append('image', fs.createReadStream(filePath));
    form.append('top_k', String(topK));

    const mlRes = await axios.post(`${ML_URL()}/reid/search`, form, {
      headers: form.getHeaders(),
      timeout: 30000,
    });

    const { matches, query_dim } = mlRes.data;

    // Groq AI analysis of Re-ID results
    let aiAnalysis = null;
    try {
      aiAnalysis = await analyzeReidResults(matches);
    } catch (groqErr) {
      console.warn('[Groq] Re-ID analysis skipped:', groqErr.message);
    }

    // Save to history
    await SearchHistory.create({
      queryImage: `/uploads/${req.file.filename}`,
      searchType: 'reid',
      results: matches.map((m) => ({
        personId: m.person_id,
        similarity: m.similarity,
        imagePath: m.image_path,
      })),
      aiAnalysis,
      processingTime: Date.now() - start,
    });

    res.json({
      matches,
      query_dim,
      aiAnalysis,
      processingTime: Date.now() - start,
    });
  } catch (err) {
    console.error('[Reid] Search error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/reid/gallery — proxy to FastAPI to add image to Re-ID gallery, and save to MongoDB
router.post('/gallery', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'image file required' });
    const personId = req.body.personId || req.body.person_id;
    if (!personId) return res.status(400).json({ message: 'personId required' });

    const form = new FormData();
    form.append('image', fs.createReadStream(req.file.path));
    form.append('person_id', personId);
    form.append('image_path', `/uploads/${req.file.filename}`);

    const mlRes = await axios.post(`${ML_URL()}/reid/add-to-gallery`, form, {
      headers: form.getHeaders(),
      timeout: 30000,
    });

    let person = await Person.findOne({ personId });
    if (!person) {
      person = new Person({
        personId,
        name: req.body.name || personId,
        galleryImages: [],
      });
    }
    person.galleryImages.push(mlRes.data.image_path);
    person.embeddingIndex = mlRes.data.embedding_index;
    person.attributes = { ...person.attributes, gender: req.body.gender, age: req.body.age };
    await person.save();

    res.json(mlRes.data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reid/gallery
router.get('/gallery', async (req, res) => {
  try {
    const persons = await Person.find({ embeddingIndex: { $gte: 0 } }).sort({ createdAt: -1 });
    const formatted = persons.map(p => ({
      personId: p.personId,
      name: p.name,
      gender: p.attributes?.gender,
      age: p.attributes?.age,
      photoUrl: p.galleryImages[0],
      embedding: true,
      embeddingCount: p.galleryImages.length,
      createdAt: p.createdAt
    }));
    res.json({ persons: formatted });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/reid/gallery/:personId
router.delete('/gallery/:personId', async (req, res) => {
  try {
    await Person.deleteOne({ personId: req.params.personId });
    res.json({ message: 'Deleted from gallery' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
