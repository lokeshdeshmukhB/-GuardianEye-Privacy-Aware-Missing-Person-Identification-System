import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const api = axios.create({ baseURL: API_BASE });

export const getMot17Status = () => api.get('/mot17-track-reid/status').then((r) => r.data);

export const getMot17Tracks = () => api.get('/mot17-track-reid/tracks').then((r) => r.data);

export const matchMot17Track = (queryTrack, topK = 5) =>
  api.get('/mot17-track-reid/match', { params: { query_track: queryTrack, top_k: topK } }).then((r) => r.data);
