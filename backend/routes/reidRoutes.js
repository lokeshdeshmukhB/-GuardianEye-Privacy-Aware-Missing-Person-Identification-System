const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const multer = require('multer');
const SearchHistory = require('../models/SearchHistory');
const Person = require('../models/Person');
const { analyzeMultimodalMatches, analyzeMultimodalResults } = require('../services/groqAnalysis');
const { resolveGalleryImagePath } = require('../utils/galleryImageResolver');

const upload = multer({ dest: path.join(__dirname, '../uploads/') });

// GET /api/reid/image?path=datasets/0000001.jpg — serve gallery file for Re-ID UI thumbnails
router.get('/image', (req, res) => {
  try {
    const rel = req.query.path;
    if (!rel || typeof rel !== 'string') {
      return res.status(400).json({ message: 'path query required' });
    }
    if (rel.includes('..')) {
      return res.status(400).json({ message: 'invalid path' });
    }
    const abs = resolveGalleryImagePath(rel);
    if (!abs) {
      return res.status(404).end();
    }
    res.sendFile(path.resolve(abs), (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ message: e.message });
  }
});

const ML_URL = () => process.env.FASTAPI_BASE_URL || 'http://127.0.0.1:8001';

// POST /api/reid/search — proxy to FastAPI, save history, run Groq analysis
router.post('/search', upload.single('image'), async (req, res) => {
  const start = Date.now();
  try {
    if (!req.file) return res.status(400).json({ message: 'image file required' });

    const filePath = req.file.path;
    const topK = parseInt(req.body.top_k) || 5;
    const wReid = req.body.w_reid != null && req.body.w_reid !== '' ? parseFloat(req.body.w_reid) : 0.55;
    const wAttr = req.body.w_attr != null && req.body.w_attr !== '' ? parseFloat(req.body.w_attr) : 0.45;

    const form = new FormData();
    form.append('image', fs.createReadStream(filePath));
    form.append('top_k', String(topK));
    form.append('w_reid', String(Number.isFinite(wReid) ? wReid : 0.55));
    form.append('w_attr', String(Number.isFinite(wAttr) ? wAttr : 0.45));

    const mlRes = await axios.post(`${ML_URL()}/reid/multimodal-search`, form, {
      headers: form.getHeaders(),
      timeout: 60000,
    });

    const {
      matches: rawMatches,
      query_dim,
      query_structured_attributes,
      query_raw_probabilities,
      fusion_weights,
      gait_note,
      gallery_total,
    } = mlRes.data;
    const matches = rawMatches || [];

    let aiAnalysis = null;
    if (matches.length > 0) {
      try {
        aiAnalysis = await analyzeMultimodalMatches(matches, query_structured_attributes);
      } catch (groqErr) {
        console.warn('[Groq] Multimodal Re-ID analysis skipped:', groqErr.message);
      }
    }

    await SearchHistory.create({
      queryImage: `/uploads/${req.file.filename}`,
      searchType: 'multimodal',
      results: matches.map((m) => ({
        personId: m.person_id,
        similarity: m.fusion_score ?? m.similarity,
        imagePath: m.image_path,
        reidScore: m.reid_score,
        attributeScore: m.attribute_score,
      })),
      aiAnalysis,
      processingTime: Date.now() - start,
    });

    res.json({
      matches,
      query_dim,
      query_structured_attributes,
      query_raw_probabilities,
      fusion_weights,
      gait_note,
      gallery_total,
      aiAnalysis,
      processingTime: Date.now() - start,
    });
  } catch (err) {
    console.error('[Reid] Search error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/reid/multimodal-search — proxy to FastAPI multimodal fusion search
router.post('/multimodal-search', upload.single('image'), async (req, res) => {
  const start = Date.now();
  try {
    if (!req.file) return res.status(400).json({ message: 'image file required' });

    const topK = parseInt(req.body.top_k, 10) || 5;
    const candidatePool = parseInt(req.body.candidate_pool, 10) || 10;
    const wReid = req.body.w_reid != null && req.body.w_reid !== '' ? Number(req.body.w_reid) : 0.5;
    const wAttr = req.body.w_attr != null && req.body.w_attr !== '' ? Number(req.body.w_attr) : 0.3;
    const wGait = req.body.w_gait != null && req.body.w_gait !== '' ? Number(req.body.w_gait) : 0.2;

    const form = new FormData();
    form.append('image', fs.createReadStream(req.file.path));
    form.append('top_k', String(topK));
    form.append('candidate_pool', String(candidatePool));
    form.append('w_reid', String(wReid));
    form.append('w_attr', String(wAttr));
    form.append('w_gait', String(wGait));

    const mlRes = await axios.post(`${ML_URL()}/multimodal/search`, form, {
      headers: form.getHeaders(),
      timeout: 120000,
    });

    const { matches, query, weights, fusion_note } = mlRes.data;

    let aiAnalysis = null;
    if (typeof analyzeMultimodalResults === 'function') {
      try {
        aiAnalysis = await analyzeMultimodalResults(
          matches,
          query?.structured_attributes || null
        );
      } catch (groqErr) {
        console.warn('[Groq] Multimodal analysis skipped:', groqErr.message);
      }
    }

    await SearchHistory.create({
      queryImage: `/uploads/${req.file.filename}`,
      searchType: 'multimodal',
      results: (matches || []).map((m) => ({
        personId: m.person_id,
        similarity: m.fusion_score != null ? m.fusion_score : m.similarity,
        imagePath: m.image_path,
      })),
      aiAnalysis,
      processingTime: Date.now() - start,
    });

    res.json({
      matches,
      query,
      weights,
      fusion_note,
      aiAnalysis,
      processingTime: Date.now() - start,
    });
  } catch (err) {
    console.error('[Reid] Multimodal search error:', err.message);
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
