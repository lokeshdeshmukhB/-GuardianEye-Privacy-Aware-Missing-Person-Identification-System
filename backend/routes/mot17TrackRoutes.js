const express = require('express');
const axios = require('axios');

const router = express.Router();
const ML_URL = () => process.env.FASTAPI_BASE_URL || 'http://127.0.0.1:8001';

function frameBaseUrl() {
  const u = ML_URL().replace(/\/$/, '');
  return `${u}/mot17-crops`;
}

function silhouetteFrameBaseUrl() {
  const u = ML_URL().replace(/\/$/, '');
  return `${u}/mot17-silhouettes`;
}

router.get('/status', async (req, res) => {
  try {
    const { data } = await axios.get(`${ML_URL()}/mot17-track-reid/status`, { timeout: 15000 });
    res.json({ ...data, frame_base_url: frameBaseUrl(), silhouette_frame_base_url: silhouetteFrameBaseUrl() });
  } catch (err) {
    res.status(502).json({
      ok: false,
      error: err.message,
      frame_base_url: frameBaseUrl(),
      silhouette_frame_base_url: silhouetteFrameBaseUrl(),
    });
  }
});

router.get('/tracks', async (req, res) => {
  try {
    const { data } = await axios.get(`${ML_URL()}/mot17-track-reid/tracks`, { timeout: 15000 });
    res.json({ ...data, frame_base_url: frameBaseUrl(), silhouette_frame_base_url: silhouetteFrameBaseUrl() });
  } catch (err) {
    res.status(502).json({
      message: err.message,
      tracks: [],
      frame_base_url: frameBaseUrl(),
      silhouette_frame_base_url: silhouetteFrameBaseUrl(),
    });
  }
});

router.get('/match', async (req, res) => {
  try {
    const { query_track: qt, top_k } = req.query;
    if (!qt) return res.status(400).json({ message: 'query_track is required' });
    const { data } = await axios.get(`${ML_URL()}/mot17-track-reid/match`, {
      params: { query_track: qt, top_k: top_k || 5 },
      timeout: 60000,
    });
    res.json({ ...data, frame_base_url: frameBaseUrl(), silhouette_frame_base_url: silhouetteFrameBaseUrl() });
  } catch (err) {
    const status = err.response?.status || 502;
    const detail = err.response?.data?.detail || err.message;
    res.status(status).json({ message: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  }
});

module.exports = router;
