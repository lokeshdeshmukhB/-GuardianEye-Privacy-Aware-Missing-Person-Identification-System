const express = require('express');
const router = express.Router();
const axios = require('axios');
const Person = require('../models/Person');
const SearchHistory = require('../models/SearchHistory');

const ML_URL = () => process.env.FASTAPI_BASE_URL || 'http://127.0.0.1:8001';

// GET /api/stats — dashboard stats
router.get('/', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalPersons, totalSearches, searchesToday, byType, mlHealth] = await Promise.all([
      Person.countDocuments(),
      SearchHistory.countDocuments(),
      SearchHistory.countDocuments({ createdAt: { $gte: today } }),
      SearchHistory.aggregate([
        { $group: { _id: '$searchType', count: { $sum: 1 } } },
      ]),
      axios.get(`${ML_URL()}/`).then((r) => r.data).catch(() => null),
    ]);

    const recentSearches = await SearchHistory.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.json({
      totalPersons,
      totalSearches,
      searchesToday,
      byType: Object.fromEntries(byType.map((b) => [b._id, b.count])),
      mlService: mlHealth
        ? { status: 'online', models: mlHealth.models, device: mlHealth.device }
        : { status: 'offline' },
      recentSearches,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
