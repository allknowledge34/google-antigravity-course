import { create } from 'zustand';

export const usePresenceStore = create((set) => ({
  onlineUsers: new Set(),
  
  setOnlineUsers: (updater) => set((state) => {
    const newIds = typeof updater === 'function' ? updater(state.onlineUsers) : updater;
    return { onlineUsers: new Set(newIds) };
  }),

  addOnlineUser: (userId) => set((state) => {
    const newSet = new Set(state.onlineUsers);
    newSet.add(userId);
    return { onlineUsers: newSet };
  }),

  removeOnlineUser: (userId) => set((state) => {
    const newSet = new Set(state.onlineUsers);
    newSet.delete(userId);
    return { onlineUsers: newSet };
  })
}));
