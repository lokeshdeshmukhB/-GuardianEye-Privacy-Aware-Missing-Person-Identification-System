import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const api = axios.create({ baseURL: API_BASE });

export const predictAttributes = async (formData) => {
  const res = await api.post('/attributes/predict', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};
