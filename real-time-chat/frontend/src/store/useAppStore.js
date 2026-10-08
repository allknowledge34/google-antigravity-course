import { create } from 'zustand';

export const useAppStore = create((set) => ({
  isInitialized: false,
  setInitialized: (status) => set({ isInitialized: status }),
}));
