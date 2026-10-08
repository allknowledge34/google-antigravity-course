import { create } from 'zustand';

export const useTypingStore = create((set, get) => ({
  // conversationId -> Set of userIds
  typingUsersByConversation: {},
  // conversationId -> userId -> timeoutId
  typingTimeouts: {},

  addTypingUser: (conversationId, userId) => set((state) => {
    const currentSet = state.typingUsersByConversation[conversationId] || new Set();
    const newSet = new Set(currentSet);
    newSet.add(userId);

    // Clear existing timeout if any
    const existingTimeout = state.typingTimeouts[conversationId]?.[userId];
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout to auto-clear typing status after 3000ms
    const timeoutId = setTimeout(() => {
      get().removeTypingUser(conversationId, userId);
    }, 3000);

    const newTimeoutsForConv = { ...state.typingTimeouts[conversationId], [userId]: timeoutId };

    return {
      typingUsersByConversation: { ...state.typingUsersByConversation, [conversationId]: newSet },
      typingTimeouts: { ...state.typingTimeouts, [conversationId]: newTimeoutsForConv }
    };
  }),

  removeTypingUser: (conversationId, userId) => set((state) => {
    const currentSet = state.typingUsersByConversation[conversationId];
    if (!currentSet) return state;

    const newSet = new Set(currentSet);
    newSet.delete(userId);

    const existingTimeout = state.typingTimeouts[conversationId]?.[userId];
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    const newTimeoutsForConv = { ...state.typingTimeouts[conversationId] };
    delete newTimeoutsForConv[userId];

    return {
      typingUsersByConversation: { ...state.typingUsersByConversation, [conversationId]: newSet },
      typingTimeouts: { ...state.typingTimeouts, [conversationId]: newTimeoutsForConv }
    };
  }),

  clearTypingForConversation: (conversationId) => set((state) => {
    const timeouts = state.typingTimeouts[conversationId] || {};
    Object.values(timeouts).forEach(clearTimeout);

    const newTypingUsers = { ...state.typingUsersByConversation };
    delete newTypingUsers[conversationId];
    
    const newTimeouts = { ...state.typingTimeouts };
    delete newTimeouts[conversationId];

    return {
      typingUsersByConversation: newTypingUsers,
      typingTimeouts: newTimeouts
    };
  }),
}));
