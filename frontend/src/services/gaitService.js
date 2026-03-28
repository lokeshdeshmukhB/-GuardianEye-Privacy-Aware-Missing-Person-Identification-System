import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const api = axios.create({ baseURL: API_BASE });

export const matchGait = async (formData) => {
  const res = await api.post('/gait/match', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const addGait = async (formData) => {
  const res = await api.post('/gait/add', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const getGallery = async (page = 1, limit = 12) => {
  const res = await api.get(`/gallery?page=${page}&limit=${limit}`);
  return res.data;
};

export const addPerson = async (formData) => {
  const res = await api.post('/gallery/add', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const deletePerson = async (personId) => {
  const res = await api.delete(`/gallery/${personId}`);
  return res.data;
};

export const getStats = async () => {
  const res = await api.get('/stats');
  return res.data;
};
