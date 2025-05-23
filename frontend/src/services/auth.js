import api from './api';

export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', { email, password });
    const { token } = response.data;
    localStorage.setItem('token', token);
    return response.data;
  } catch (error) {
    throw new Error('Error en la autenticación');
  }
};

export const register = async (email, password, rol = 'usuario') => {
  try {
    const response = await api.post('/auth/register', { email, password, rol });
    return response.data;
  } catch (error) {
    throw new Error('Error en el registro');
  }
};

export const logout = () => {
  localStorage.removeItem('token');
};

export const getToken = () => {
  return localStorage.getItem('token');
};

export const isAuthenticated = () => {
  const token = getToken();
  return !!token;
};