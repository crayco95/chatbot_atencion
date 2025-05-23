import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const register = async (email, password, rol) => {
  const response = await api.post('/auth/register', { email, password, rol });
  return response.data;
};

export const sendMessage = async (message, businessId) => {
  const response = await api.post('/chat', { message, businessId });
  return response.data;
};

export const getStats = async () => {
  const response = await api.get('/admin/stats');
  return response.data;
};

export const getConversations = async () => {
  const response = await api.get('/admin/conversations');
  return response.data;
};

export default api;