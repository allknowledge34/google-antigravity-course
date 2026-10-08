import { create } from 'zustand';

export const useUIStore = create((set) => ({
  selectedConversationId: null,
  setSelectedConversationId: (id) => set({ selectedConversationId: id }),
}));
