import { apiClient } from './client.js';

export const getCurrentUser = async () => {
  const { data } = await apiClient.get('/users/me');
  return data.data;
};

export const updateProfile = async (updateData) => {
  const { data } = await apiClient.patch('/users/me', updateData);
  return data.data;
};

export const searchUsers = async (query) => {
  const { data } = await apiClient.get(`/users/search?q=${encodeURIComponent(query)}`);
  return data.data;
};
