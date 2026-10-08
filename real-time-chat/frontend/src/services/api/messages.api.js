import { apiClient } from './client.js';

export const getMessages = async (conversationId, limit, before) => {
  const params = {};
  if (limit) params.limit = limit;
  if (before) params.before = before;

  const { data } = await apiClient.get(`/conversations/${conversationId}/messages`, { params });
  return data; // returns { success, data, meta }
};

export const createMessage = async (conversationId, payload) => {
  const { data } = await apiClient.post(`/conversations/${conversationId}/messages`, payload);
  return data.data;
};

export const editMessage = async (messageId, content) => {
  const { data } = await apiClient.patch(`/messages/${messageId}`, { content });
  return data.data;
};

export const deleteMessage = async (messageId) => {
  const { data } = await apiClient.delete(`/messages/${messageId}`);
  return data.data;
};

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post(`/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data.data;
};

export const addReaction = async (messageId, emoji) => {
  const { data } = await apiClient.post(`/messages/${messageId}/reactions`, { emoji });
  return data.data;
};

export const removeReaction = async (messageId, emoji) => {
  const { data } = await apiClient.delete(`/messages/${messageId}/reactions`, { data: { emoji } });
  return data.data;
};
