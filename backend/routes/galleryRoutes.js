const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const multer = require('multer');
const Person = require('../models/Person');
const GalleryEntry = require('../models/GalleryEntry');

const upload = multer({ dest: path.join(__dirname, '../uploads/') });
const ML_URL = () => process.env.FASTAPI_BASE_URL || 'http://127.0.0.1:8001';

// GET /api/gallery — paginated list of all persons
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const [persons, total] = await Promise.all([
      Person.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Person.countDocuments(),
    ]);

    res.json({ persons, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/gallery/add — add a new person with up to 5 images
router.post('/add', upload.array('images', 5), async (req, res) => {
  try {
    const { name, personId, notes } = req.body;
    if (!name || !personId) return res.status(400).json({ message: 'name and personId required' });

    const imagePaths = (req.files || []).map((f) => `/uploads/${f.filename}`);

    // Add first image to Re-ID gallery (.npy)
    let embeddingIndex = -1;
    if (req.files && req.files.length > 0) {
      try {
        const form = new FormData();
        form.append('image', fs.createReadStream(req.files[0].path));
        form.append('person_id', personId);
        form.append('image_path', imagePaths[0]);
        const mlRes = await axios.post(`${ML_URL()}/reid/add-to-gallery`, form, {
          headers: form.getHeaders(),
          timeout: 30000,
        });
        embeddingIndex = mlRes.data.embedding_index ?? -1;
      } catch (mlErr) {
        console.warn('[Gallery] FastAPI add-to-gallery failed:', mlErr.message);
      }
    }

    const person = await Person.create({
      personId,
      name,
      notes: notes || '',
      galleryImages: imagePaths,
      embeddingIndex,
    });

    // Track gallery entries
    for (const [i, filePath] of imagePaths.entries()) {
      await GalleryEntry.create({
        personId,
        imagePath: filePath,
        embeddingIndex: i === 0 ? embeddingIndex : -1,
      });
    }

    res.status(201).json(person);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'personId already exists' });
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/gallery/:personId
router.delete('/:personId', async (req, res) => {
  try {
    const person = await Person.findOneAndDelete({ personId: req.params.personId });
    if (!person) return res.status(404).json({ message: 'Person not found' });

    await GalleryEntry.deleteMany({ personId: req.params.personId });
    res.json({ message: 'Deleted', personId: req.params.personId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/gallery/:personId — single person details
router.get('/:personId', async (req, res) => {
  try {
    const person = await Person.findOne({ personId: req.params.personId }).lean();
    if (!person) return res.status(404).json({ message: 'Not found' });
    res.json(person);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
