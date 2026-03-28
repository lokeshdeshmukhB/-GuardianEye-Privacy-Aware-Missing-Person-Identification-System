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

export const getGallery = async () => {
  const res = await api.get('/reid/gallery');
  return res.data;
};

export const addPerson = async (formData) => {
  const res = await api.post('/reid/gallery', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const deleteGalleryPerson = async (personId) => {
  const res = await api.delete(`/reid/gallery/${personId}`);
  return res.data;
};
