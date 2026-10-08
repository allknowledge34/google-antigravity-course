import { apiClient } from './client.js';

export const getConversations = async () => {
  const { data } = await apiClient.get('/conversations');
  return data.data;
};

export const getConversationDetails = async (conversationId) => {
  const { data } = await apiClient.get(`/conversations/${conversationId}`);
  return data.data;
};

export const createConversation = async (payload) => {
  const { data } = await apiClient.post('/conversations', payload);
  return data.data;
};

export const addConversationMember = async ({ conversationId, memberId }) => {
  const { data } = await apiClient.post(`/conversations/${conversationId}/members`, { memberId });
  return data.data;
};

export const removeConversationMember = async ({ conversationId, userId }) => {
  const { data } = await apiClient.delete(`/conversations/${conversationId}/members/${userId}`);
  return data.data;
};

export const leaveConversation = async (conversationId) => {
  const { data } = await apiClient.post(`/conversations/${conversationId}/leave`);
  return data;
};
