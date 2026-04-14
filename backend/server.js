const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

// CORS: allow Vite dev on localhost or 127.0.0.1 (any port). Optional extra origins via CORS_ORIGINS (comma-separated).
const extraOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (extraOrigins.includes(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

// Middleware
app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Existing routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/cases', require('./routes/caseRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// ── Re-ID System routes ──────────────────────────────────────────────────────
app.use('/api/reid', require('./routes/reidRoutes'));
app.use('/api/attributes', require('./routes/attributeRoutes'));
app.use('/api/gait', require('./routes/gaitRoutes'));
app.use('/api/gallery', require('./routes/galleryRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Missing Person Backend', time: new Date().toISOString() });
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(process.env.PORT, () => {
      console.log(`🚀 Backend running on port ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

module.exports = app;
