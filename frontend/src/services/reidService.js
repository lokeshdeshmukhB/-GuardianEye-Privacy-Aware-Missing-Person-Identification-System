import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const api = axios.create({ baseURL: API_BASE });

// Re-ID
export const searchReid = async (formData) => {
  const res = await api.post('/reid/search', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const searchMultimodal = async (formData) => {
  const res = await api.post('/reid/multimodal-search', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const getStats = async () => {
  const res = await api.get('/stats');
  return res.data;
};
