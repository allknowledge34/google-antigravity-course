import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { useUIStore } from '../../store/uiStore.js';
import { usePresenceStore } from '../../store/presenceStore.js';
import { useTypingStore } from '../../store/typingStore.js';
import { getConversationDetails, leaveConversation } from '../../services/api/conversations.api.js';
import { getMessages, createMessage, editMessage, deleteMessage, uploadFile, addReaction, removeReaction } from '../../services/api/messages.api.js';
import { apiClient } from '../../services/api/client.js';
import { socketService } from '../../services/socket/socket.js';
import { EVENTS } from '../../services/socket/events.js';

export const ChatPanel = () => {
  const selectedConversationId = useUIStore(state => state.selectedConversationId);
  
  if (!selectedConversationId) {
    return (
      <div className="chat-panel">
        <div className="empty-state">
          <svg width="64" height="64" fill="none" stroke="var(--primary)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: '1rem', opacity: 0.8 }}>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          <h3>Welcome to Real-Time Chat</h3>
          <p>Select a conversation from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  return <ActiveChat conversationId={selectedConversationId} />;
};

const ActiveChat = ({ conversationId }) => {
  const queryClient = useQueryClient();
  const setSelectedConversationId = useUIStore(state => state.setSelectedConversationId);
  const onlineUsers = usePresenceStore(state => state.onlineUsers);
  const typingUsersByConversation = useTypingStore(state => state.typingUsersByConversation);
  const { userId } = useAuth();

  const [showGroupMembers, setShowGroupMembers] = useState(false);

  const { data: conversation, isLoading, isError } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversationDetails(conversationId),
  });

  useEffect(() => {
    if (conversation?.members) {
      const userIds = conversation.members.map(m => m._id);
      socketService.socket?.emit(EVENTS.PRESENCE_GET, { userIds });
    }
  }, [conversation]);
  
  // Listen for receipt updates
  useEffect(() => {
    const handleReceiptUpdated = (data) => {
      if (data.conversationId !== conversationId) return;
      queryClient.setQueryData(['conversation', conversationId], (old) => {
        if (!old) return old;
        const newMembers = old.members.map(m => {
          if (m._id === data.userId || m.clerkId === data.userId) { // handle if data.userId is _id or clerkId, assuming _id
            return {
              ...m,
              lastReadMessageId: data.lastReadMessageId || m.lastReadMessageId,
              lastDeliveredMessageId: data.lastDeliveredMessageId || m.lastDeliveredMessageId
            };
          }
          return m;
        });
        return { ...old, members: newMembers };
      });
    };

    socketService.on(EVENTS.RECEIPT_UPDATED, handleReceiptUpdated);
    return () => socketService.off(EVENTS.RECEIPT_UPDATED, handleReceiptUpdated);
  }, [conversationId, queryClient]);

  const leaveMutation = useMutation({
    mutationFn: () => leaveConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries(['conversations']);
      setSelectedConversationId(null);
    }
  });

  const addMemberMutation = useMutation({
    mutationFn: async (memberId) => {
      const { data } = await apiClient.post(`/conversations/${conversationId}/members`, { memberId });
      return data.data;
    },
    onSuccess: () => queryClient.invalidateQueries(['conversation', conversationId])
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (targetUserId) => {
      const { data } = await apiClient.delete(`/conversations/${conversationId}/members/${targetUserId}`);
      return data.data;
    },
    onSuccess: () => queryClient.invalidateQueries(['conversation', conversationId])
  });

  const handleAddMember = async () => {
    const username = prompt("Enter the exact username of the person to add:");
    if (!username) return;
    try {
      const { data: users } = await apiClient.get(`/users/search?q=${username}`);
      const targetUser = users?.data?.find(u => u.username === username);
      if (targetUser) {
        addMemberMutation.mutate(targetUser._id);
      } else {
        alert("User not found!");
      }
    } catch (e) {
      alert("Error finding user");
    }
  };

  if (isLoading) {
    return (
      <div className="chat-panel">
        <div className="chat-header">
          <div className="skeleton skeleton-avatar"></div>
          <div style={{ flex: 1, marginLeft: '1rem' }}>
            <div className="skeleton skeleton-line"></div>
          </div>
        </div>
        <div className="messages-container">
          <div className="skeleton skeleton-bubble" style={{ alignSelf: 'flex-start' }}></div>
          <div className="skeleton skeleton-bubble" style={{ alignSelf: 'flex-end', marginTop: '1rem' }}></div>
        </div>
      </div>
    );
  }

  if (isError || !conversation) {
    return (
      <div className="chat-panel">
        <div className="empty-state text-danger">
          <p>Failed to load conversation details.</p>
        </div>
      </div>
    );
  }

  // Header Logic
  const isGroup = conversation.type === 'group';
  let headerTitle = conversation.name || 'Unnamed Conversation';
  
  const currentUserRole = conversation.currentUserRole || conversation.members?.find(m => m.clerkId === userId)?.role;
  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin';
  
  let headerSubtitle = isGroup ? `${conversation.members?.length} members` : 'Offline';
  
  let avatarUrl = conversation.avatar;

  if (!isGroup && conversation.members) {
    const otherMember = conversation.members.find(m => m.clerkId !== userId) || conversation.members[0];
    if (otherMember) {
      headerTitle = otherMember.displayName || otherMember.username || 'Unknown User';
      headerSubtitle = onlineUsers.has(otherMember._id) ? 'Online' : 'Offline';
      avatarUrl = otherMember.avatar;
    }
  }

  // Typing Logic
  const activeTypingUserIds = Array.from(typingUsersByConversation[conversationId] || []);
  let typingDisplay = null;
  if (activeTypingUserIds.length > 0) {
    const typingNames = activeTypingUserIds
      .map(id => {
        const m = conversation.members.find(member => member._id === id);
        return m ? (m.displayName || m.username || 'User') : null;
      })
      .filter(Boolean);
    if (typingNames.length === 1) typingDisplay = `${typingNames[0]} is typing...`;
    else if (typingNames.length === 2) typingDisplay = `${typingNames[0]} and ${typingNames[1]} are typing...`;
    else if (typingNames.length > 2) typingDisplay = `Several people are typing...`;
  }

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <button className="back-btn" onClick={() => setSelectedConversationId(null)}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"></path>
            </svg>
          </button>
          <div className="avatar-container">
            {avatarUrl ? (
              <img src={avatarUrl} alt={headerTitle} className="avatar-image" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div className="avatar">{headerTitle.charAt(0).toUpperCase()}</div>
            )}
            {!isGroup && headerSubtitle === 'Online' && <div className="status-dot online"></div>}
          </div>
          <div className="header-text" onClick={() => isGroup && setShowGroupMembers(!showGroupMembers)} style={{ cursor: isGroup ? "pointer" : "default", position: 'relative' }}>
            <h3>{headerTitle}</h3>
            {typingDisplay ? (
              <p className="typing-indicator" style={{ margin: 0, minHeight: 'auto' }}>{typingDisplay}</p>
            ) : (
              <p className="header-status">{headerSubtitle}</p>
            )}

          {isGroup && showGroupMembers && (
            <div className="group-members-popover" onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, backgroundColor: 'var(--bg-panel)', border: '1px solid var(--bg-border)', borderRadius: '8px', padding: '1rem', zIndex: 50, width: '300px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)' }}>Group Members</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '300px', overflowY: 'auto' }}>
                {conversation.members?.map(m => (
                  <li key={m._id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div className="avatar-container" style={{ width: '32px', height: '32px' }}>
                      {m.avatar ? (
                        <img src={m.avatar} alt={m.displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div className="avatar" style={{ width: '100%', height: '100%', fontSize: '0.9rem' }}>{m.displayName?.charAt(0).toUpperCase() || 'U'}</div>
                      )}
                      {onlineUsers.has(m._id) && <div className="status-dot online"></div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-main)', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.displayName || m.username}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: '4px' }}>{m.role}</span>
                      </div>
                      {canManageMembers && m.role !== 'owner' && m.clerkId !== userId && (
                        <button onClick={() => removeMemberMutation.mutate(m._id)} style={{ fontSize: '0.7rem', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '2px' }}>Remove</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {canManageMembers && (
                <button onClick={handleAddMember} disabled={addMemberMutation.isPending} style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}>
                  {addMemberMutation.isPending ? 'Adding...' : 'Add Member'}
                </button>
              )}
            </div>
          )}

          </div>
        </div>
        <div className="chat-header-actions">
          {isGroup && (
            <button className="action-btn" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending} title="Leave Group">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"></path>
              </svg>
            </button>
          )}
        </div>
      </div>

      <MessageContainer conversation={conversation} userId={userId} />
    </div>
  );
};

const ReactionPicker = ({ onSelect, onClose }) => {
  const emojis = ['👍', '❤️', '😂', '😮', '😢'];
  return (
    <div className="reaction-picker">
      {emojis.map(e => (
        <span key={e} onClick={() => { onSelect(e); onClose(); }} className="reaction-emoji">{e}</span>
      ))}
    </div>
  );
};

const MessageContainer = ({ conversation, userId }) => {
  const conversationId = conversation._id;
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [socketError, setSocketError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [hoverMessageId, setHoverMessageId] = useState(null);
  const [reactionPickerId, setReactionPickerId] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  
  const clearTypingForConversation = useTypingStore(state => state.clearTypingForConversation);
  const typingTimeoutRef = useRef(null);
  const typingSentAtRef = useRef(0);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && lightboxImage) setLightboxImage(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage]);

  // Room Subscription
  useEffect(() => {
    if (conversationId) {
      socketService.joinConversation(conversationId);
    }
    return () => {
      if (conversationId) {
        socketService.socket?.emit(EVENTS.TYPING_STOP, { conversationId });
        clearTypingForConversation(conversationId);
        socketService.leaveConversation(conversationId);
      }
    };
  }, [conversationId, clearTypingForConversation]);

  // Handle incoming real-time events
  useEffect(() => {
    const handleNewMessage = (msg) => {
      if (msg.conversationId !== conversationId) return;
      queryClient.setQueryData(['messages', conversationId], (oldData) => {
        if (!oldData) return oldData;
        const messages = oldData.data || [];
        
        // If we already have the optimistic one, replace it
        const index = messages.findIndex(m => m.clientMessageId === msg.clientMessageId || m._id === msg._id);
        if (index !== -1) {
          const newMessages = [...messages];
          newMessages[index] = msg; // Replace optimistic with real
          return { ...oldData, data: newMessages };
        }
        
        return { ...oldData, data: [...messages, msg] };
      });
      queryClient.invalidateQueries(['conversations']);

      // Read Receipts: emit delivered
      if (msg.senderId?.clerkId !== userId) {
        socketService.socket?.emit(EVENTS.MESSAGE_DELIVERED, { conversationId, messageId: msg._id });
      }
    };

    const handleUpdatedMessage = (msg) => {
      if (msg.conversationId !== conversationId) return;
      queryClient.setQueryData(['messages', conversationId], (oldData) => {
        if (!oldData) return oldData;
        return { ...oldData, data: (oldData.data || []).map(m => m._id === msg._id ? msg : m) };
      });
    };

    const handleDeletedMessage = (msg) => {
      if (msg.conversationId !== conversationId) return;
      queryClient.setQueryData(['messages', conversationId], (oldData) => {
        if (!oldData) return oldData;
        return { ...oldData, data: (oldData.data || []).map(m => m._id === msg._id ? msg : m) };
      });
    };

    const handleMessageError = (err) => {
      setSocketError(err.message);
      setTimeout(() => setSocketError(null), 5000);
    };

    const handleReactionAdd = ({ messageId, reaction }) => {
      queryClient.setQueryData(['messages', conversationId], (old) => {
        if (!old) return old;
        return {
          ...old,
          data: (old.data || []).map(m => m._id === messageId ? { ...m, reactions: [...(m.reactions || []), reaction] } : m)
        };
      });
    };

    const handleReactionRemove = ({ messageId, userId: rUserId, emoji }) => {
      queryClient.setQueryData(['messages', conversationId], (old) => {
        if (!old) return old;
        return {
          ...old,
          data: (old.data || []).map(m => {
            if (m._id === messageId) {
              return { ...m, reactions: (m.reactions || []).filter(r => !(r.userId === rUserId && r.emoji === emoji)) };
            }
            return m;
          })
        };
      });
    };

    socketService.on(EVENTS.MESSAGE_NEW, handleNewMessage);
    socketService.on(EVENTS.MESSAGE_UPDATED, handleUpdatedMessage);
    socketService.on(EVENTS.MESSAGE_DELETED, handleDeletedMessage);
    socketService.on(EVENTS.MESSAGE_ERROR, handleMessageError);
    socketService.on(EVENTS.REACTION_ADD, handleReactionAdd);
    socketService.on(EVENTS.REACTION_REMOVE, handleReactionRemove);

    return () => {
      socketService.off(EVENTS.MESSAGE_NEW, handleNewMessage);
      socketService.off(EVENTS.MESSAGE_UPDATED, handleUpdatedMessage);
      socketService.off(EVENTS.MESSAGE_DELETED, handleDeletedMessage);
      socketService.off(EVENTS.MESSAGE_ERROR, handleMessageError);
      socketService.off(EVENTS.REACTION_ADD, handleReactionAdd);
      socketService.off(EVENTS.REACTION_REMOVE, handleReactionRemove);
    };
  }, [conversationId, queryClient, userId]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => getMessages(conversationId, 50),
  });

  const messages = useMemo(() => data?.data || [], [data]);

  const emitRead = useCallback(() => {
    if (!messages.length) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.senderId?.clerkId !== userId) {
      socketService.socket?.emit(EVENTS.MESSAGE_READ, { conversationId, messageId: lastMsg._id });
    }
  }, [messages, userId, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    emitRead(); // emit read on new messages arriving if we are here
  }, [data, emitRead]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 50) {
       emitRead();
    }
  };

  const createMutation = useMutation({
    mutationFn: async (newMsg) => {
      // Optimistic update
      const optimisticMsg = {
        _id: 'temp-' + newMsg.clientMessageId,
        clientMessageId: newMsg.clientMessageId,
        content: newMsg.content,
        type: newMsg.type,
        attachment: newMsg.attachment,
        senderId: { clerkId: userId, displayName: 'You' }, // mock sender
        createdAt: new Date().toISOString(),
        pending: true
      };

      queryClient.setQueryData(['messages', conversationId], (old) => {
        if (!old) return { data: [optimisticMsg] };
        return { ...old, data: [...(old.data || []), optimisticMsg] };
      });

      const sent = socketService.sendMessage({ conversationId, ...newMsg });
      if (!sent) return createMessage(conversationId, newMsg);
      return null;
    },
    onSuccess: (res) => {
      if (res) {
        queryClient.invalidateQueries(['messages', conversationId]);
        queryClient.invalidateQueries(['conversations']);
      }
      setContent('');
    },
    onError: () => {
      // Revert optimistic update on hard error (though socket usually handles retries)
      queryClient.invalidateQueries(['messages', conversationId]);
    }
  });

  const editMutation = useMutation({
    mutationFn: ({ id, text }) => editMessage(id, text),
    onSuccess: () => {
      setEditingMessageId(null);
      setContent('');
    }
  });



  const deleteMutation = useMutation({
    mutationFn: (id) => deleteMessage(id)
  });

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
      // Reset height after submit
      if (e.target) {
        e.target.style.height = 'auto';
      }
    }
  };

  const handleContentChange = (e) => {
    setContent(e.target.value);
    
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
    
    if (e.target.value.trim().length > 0) {
      const now = Date.now();
      if (now - typingSentAtRef.current > 2000) {
        socketService.socket?.emit(EVENTS.TYPING_START, { conversationId });
        typingSentAtRef.current = now;
      }
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketService.socket?.emit(EVENTS.TYPING_STOP, { conversationId });
        typingSentAtRef.current = 0;
      }, 3000);
    } else {
      socketService.socket?.emit(EVENTS.TYPING_STOP, { conversationId });
      typingSentAtRef.current = 0;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadFile(file);
      const isImage = file.type.startsWith('image/');
      createMutation.mutate({
        clientMessageId: crypto.randomUUID(),
        content: result.url,
        type: isImage ? 'image' : 'file',
        attachment: {
          url: result.url,
          format: result.format,
          size: result.size,
          publicId: result.publicId
        }
      });
    } catch (err) {
      console.error(err);
      setSocketError('Failed to upload file');
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!content.trim()) return;

    if (editingMessageId) {
      editMutation.mutate({ id: editingMessageId, text: content });
    } else {
      createMutation.mutate({
        clientMessageId: crypto.randomUUID(),
        content: content.trim(),
        type: 'text'
      });
    }

    socketService.socket?.emit(EVENTS.TYPING_STOP, { conversationId });
    typingSentAtRef.current = 0;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleToggleReaction = async (msgId, emoji, hasReacted) => {
    try {
      if (hasReacted) {
        await removeReaction(msgId, emoji);
      } else {
        await addReaction(msgId, emoji);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <style>{`
        .reaction-picker {
          position: absolute;
          bottom: 100%;
          right: 0;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 4px;
          display: flex;
          gap: 4px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          z-index: 10;
        }
        .reaction-emoji {
          cursor: pointer;
          font-size: 1.25rem;
          padding: 4px;
          border-radius: 4px;
          transition: background 0.2s;
        }
        .reaction-emoji:hover {
          background: var(--bg-hover);
        }
        .message-reactions {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 4px;
        }
        .reaction-badge {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 2px 6px;
          font-size: 0.75rem;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .reaction-badge.active {
          background: var(--primary-light, rgba(0, 122, 255, 0.1));
          border-color: var(--primary);
        }
        .msg-ticks {
          font-size: 0.7rem;
          margin-left: 4px;
        }
        .msg-ticks.read { color: #34b7f1; }
        .msg-ticks.delivered { color: #888; }
        .msg-ticks.sent { color: #888; }
        .message-row { position: relative; }
        .add-reaction-btn {
          opacity: 0;
          transition: opacity 0.2s;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 4px;
        }
        .message-row:hover .add-reaction-btn {
          opacity: 1;
        }
      `}</style>
      <div className="messages-container" ref={messagesContainerRef} onScroll={handleScroll}>
        {socketError && (
          <div className="text-danger" style={{ textAlign: 'center', marginBottom: '1rem' }}>
            {socketError}
          </div>
        )}
        
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
             <div className="skeleton skeleton-bubble" style={{ alignSelf: 'flex-start' }}></div>
             <div className="skeleton skeleton-bubble" style={{ alignSelf: 'flex-end', width: '40%' }}></div>
          </div>
        ) : isError ? (
          <div className="empty-state text-danger">Error loading messages.</div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" fill="none" stroke="var(--primary)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: '1rem', opacity: 0.8 }}>
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map(msg => {
            const isSentByMe = msg.senderId?.clerkId === userId;
            
            // Calculate read/delivered status
            let tickStatus = '';
            let readByList = [];
            if (isSentByMe && !msg.deletedAt) {
              const otherMembers = conversation.members.filter(m => m.clerkId !== userId);
              const readers = otherMembers.filter(m => m.lastReadMessageId && m.lastReadMessageId >= msg._id);
              const deliverers = otherMembers.filter(m => m.lastDeliveredMessageId && m.lastDeliveredMessageId >= msg._id);
              
              if (conversation.type === 'group') {
                 if (readers.length === otherMembers.length && otherMembers.length > 0) tickStatus = 'read';
                 else if (deliverers.length === otherMembers.length && otherMembers.length > 0) tickStatus = 'delivered';
                 else tickStatus = 'sent';
                 readByList = readers.map(m => m.displayName || m.username || 'User');
              } else {
                 if (readers.length > 0) tickStatus = 'read';
                 else if (deliverers.length > 0) tickStatus = 'delivered';
                 else tickStatus = 'sent';
              }
            }

            // Group reactions
            const reactionsCounts = (msg.reactions || []).reduce((acc, r) => {
              if (!acc[r.emoji]) acc[r.emoji] = { count: 0, me: false };
              acc[r.emoji].count += 1;
              const rUserId = typeof r.userId === 'object' ? r.userId.clerkId : r.userId;
              if (rUserId === userId) acc[r.emoji].me = true;
              return acc;
            }, {});

            return (
              <div 
                key={msg._id} 
                className={`message-row ${isSentByMe ? 'sent' : 'received'}`}
                onMouseEnter={() => setHoverMessageId(msg._id)}
                onMouseLeave={() => setHoverMessageId(null)}
              >
                {!isSentByMe && (
                  <div className="message-sender-name">
                    {msg.senderId?.displayName}
                  </div>
                )}
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: isSentByMe ? 'row-reverse' : 'row' }}>
                  <div className={`message-bubble ${msg.deletedAt ? 'deleted' : ''}`} style={{ opacity: msg.pending ? 0.7 : 1 }}>
                    {msg.deletedAt ? 'This message was deleted' : (() => {
                      const isImageFormat = msg.type === 'image' || (msg.type === 'file' && ['jpg','jpeg','png','gif','webp'].includes(msg.attachment?.format));
                      const imageUrl = msg.attachment?.url || (msg.type === 'image' && msg.content?.startsWith('https://res.cloudinary.com/') ? msg.content : null);
                      
                      if (isImageFormat && imageUrl) {
                        return (
                          <img 
                            src={imageUrl} 
                            alt="attachment" 
                            style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '4px', cursor: 'zoom-in', objectFit: 'contain' }} 
                            onClick={() => setLightboxImage(imageUrl)}
                          />
                        );
                      }
                      if (msg.type === 'image') {
                        return <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Image unavailable</span>;
                      }
                      if (msg.type === 'file' && msg.attachment?.url) {
                        return (
                          <a href={msg.attachment.url} target="_blank" rel="noreferrer" className="file-attachment" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'inherit', textDecoration: 'none', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Attachment</span>
                              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{((msg.attachment.size || 0) / 1024).toFixed(1)} KB</span>
                            </div>
                          </a>
                        );
                      }
                      if (msg.type === 'file') {
                         return <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>File unavailable</span>;
                      }
                      
                      return msg.content;
                    })()}
                  </div>

                  {hoverMessageId === msg._id && !msg.deletedAt && (
                    <div style={{ position: 'relative' }}>
                      <button className="add-reaction-btn" onClick={() => setReactionPickerId(reactionPickerId === msg._id ? null : msg._id)}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
                        
                      </button>
                      {reactionPickerId === msg._id && (
                        <ReactionPicker 
                          onSelect={(emoji) => handleToggleReaction(msg._id, emoji, false)} 
                          onClose={() => setReactionPickerId(null)} 
                        />
                      )}
                    </div>
                  )}
                </div>

                {!msg.deletedAt && Object.keys(reactionsCounts).length > 0 && (
                  <div className="message-reactions" style={{ justifyContent: isSentByMe ? 'flex-end' : 'flex-start' }}>
                    {Object.entries(reactionsCounts).map(([emoji, {count, me}]) => (
                      <span 
                        key={emoji} 
                        className={`reaction-badge ${me ? 'active' : ''}`}
                        onClick={() => handleToggleReaction(msg._id, emoji, me)}
                      >
                        {emoji} {count}
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="message-meta">
                  <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.editedAt && <span>(edited)</span>}
                  
                  {tickStatus === 'read' && <span className="msg-ticks read" style={{color: 'var(--primary)', marginLeft: '4px', letterSpacing: '-1px'}}>✓✓</span>}
                  {tickStatus === 'delivered' && <span className="msg-ticks delivered" style={{color: '#9ba1a6', marginLeft: '4px', letterSpacing: '-1px'}}>✓✓</span>}
                  {tickStatus === 'sent' && <span className="msg-ticks sent" style={{color: '#9ba1a6', marginLeft: '4px'}}>✓</span>}
                  {conversation.type === 'group' && readByList.length > 0 && tickStatus !== 'read' && (
                    <span className="msg-read-by" title={readByList.join(', ')} style={{fontSize: '0.75rem', color: '#9ba1a6', marginLeft: '4px', cursor: 'pointer'}}>
                      (Read by {readByList.length})
                    </span>
                  )}

                  {!msg.deletedAt && isSentByMe && (
                    <div className="message-actions">
                      <button className="action-btn" onClick={() => { setEditingMessageId(msg._id); setContent(msg.content); }} disabled={editingMessageId === msg._id || msg.type === 'file'}>Edit</button>
                      <button className="action-btn danger" onClick={() => deleteMutation.mutate(msg._id)}>Delete</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="composer-wrapper">
        <form onSubmit={handleSubmit} className="composer-form">
          <button 
            type="button" 
            className="action-btn" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || createMutation.isPending}
            title="Attach File"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            hidden 
            onChange={handleFileSelect} 
            disabled={uploading}
          />
          <textarea 
            className="composer-input"
            value={content} 
            onChange={handleContentChange} 
            onKeyDown={handleKeyDown}
            onFocus={emitRead}
            placeholder={uploading ? "Uploading..." : "Type a message..."}
            disabled={createMutation.isPending || editMutation.isPending || uploading}
            rows={1}
          />
          <button 
            type="submit" 
            className="btn-send"
            disabled={!content.trim() || createMutation.isPending || editMutation.isPending || uploading}
          >
            {editingMessageId ? (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>
            ) : (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            )}
          </button>
          {editingMessageId && (
            <button 
              type="button" 
              className="action-btn" 
              onClick={() => { setEditingMessageId(null); setContent(''); }} 
              style={{ marginLeft: '0.5rem' }}
            >
              Cancel
            </button>
          )}
        </form>
      </div>

      {lightboxImage && (
        <div 
          className="lightbox-overlay"
          onClick={() => setLightboxImage(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <button 
            onClick={() => setLightboxImage(null)}
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '8px' }}
          >
            <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          <img 
            src={lightboxImage} 
            alt="lightbox" 
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </>
  );
};
