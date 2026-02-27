import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:5001/api' });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const login = (data) => API.post('/auth/login', data);
export const register = (data) => API.post('/auth/register', data);
export const getMe = () => API.get('/auth/me');

// Cases
export const getCases = (params) => API.get('/cases', { params });
export const getCase = (id) => API.get(`/cases/${id}`);
export const createCase = (formData) => API.post('/cases', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateCaseStatus = (id, status) => API.patch(`/cases/${id}/status`, { status });
export const deleteCase = (id) => API.delete(`/cases/${id}`);

// Search
export const searchPersons = (formData) => API.post('/search', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getSearchLogs = () => API.get('/search/logs');

// Admin
export const getStats = () => API.get('/admin/stats');
export const getUsers = () => API.get('/admin/users');
export const deleteUser = (id) => API.delete(`/admin/users/${id}`);
