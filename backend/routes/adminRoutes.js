const express = require('express');
const router = express.Router();
const User = require('../models/User');
const MissingPerson = require('../models/MissingPerson');
const SearchLog = require('../models/SearchLog');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// GET /api/admin/stats
router.get('/stats', protect, async (req, res) => {
  try {
    const [totalCases, activeCases, foundCases, totalOfficers, totalSearches] = await Promise.all([
      MissingPerson.countDocuments(),
      MissingPerson.countDocuments({ status: 'active' }),
      MissingPerson.countDocuments({ status: 'found' }),
      User.countDocuments({ role: 'officer' }),
      SearchLog.countDocuments()
    ]);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const recentCases = await MissingPerson.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
    res.json({ totalCases, activeCases, foundCases, totalOfficers, totalSearches, recentCases });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/users
router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', protect, adminOnly, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
