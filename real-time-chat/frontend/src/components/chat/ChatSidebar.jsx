import { useState, useEffect } from 'react';
import { useAuth, useUser, useClerk } from '@clerk/react';
import { socketService } from '../../services/socket/socket.js';
import { EVENTS } from '../../services/socket/events.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getConversations, createConversation } from '../../services/api/conversations.api.js';
import { searchUsers } from '../../services/api/users.api.js';
import { useUIStore } from '../../store/uiStore.js';
import { usePresenceStore } from '../../store/presenceStore.js';
import { CreateConversation } from './CreateConversation.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';

export const ChatSidebar = () => {
  const queryClient = useQueryClient();
  const selectedConversationId = useUIStore(state => state.selectedConversationId);
  const setSelectedConversationId = useUIStore(state => state.setSelectedConversationId);
  const onlineUsers = usePresenceStore(state => state.onlineUsers);
  const { userId } = useAuth();
  
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' or 'contacts' (contacts not fully implemented, just for UI ref)

  const { data: conversations, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
    staleTime: 60000,
  });

  useEffect(() => {
    if (conversations && socketService.socket?.connected) {
      const userIds = new Set();
      conversations.forEach(conv => {
        if (conv.members) {
          conv.members.forEach(m => {
            if (m.clerkId !== userId && m._id) userIds.add(m._id.toString());
          });
        }
      });
      if (userIds.size > 0) {
        socketService.socket.emit(EVENTS.PRESENCE_GET, { userIds: Array.from(userIds) });
      }
    }
  }, [conversations, userId]);

  const createDirectMutation = useMutation({
    mutationFn: (targetUserId) => createConversation({ type: 'direct', memberId: targetUserId }),
    onSuccess: (newConv) => {
      queryClient.invalidateQueries(['conversations']);
      setSelectedConversationId(newConv._id);
      setActiveTab('chats');
    },
    onError: (err) => {
      console.error('Failed to create/open conversation', err);
    }
  });

  const handleSelectContact = (contact) => {
    if (conversations) {
      const existingDirect = conversations.find(c => 
        c.type === 'direct' && c.members?.some(m => m._id === contact._id)
      );
      if (existingDirect) {
        setSelectedConversationId(existingDirect._id);
        setActiveTab('chats');
        return;
      }
    }
    createDirectMutation.mutate(contact._id);
  };

  return (
    <div className="chat-sidebar">
      <div className="sidebar-header">
        <h2>
          Messages
          <button className="action-btn" onClick={() => setShowCreate(!showCreate)} title="New Chat">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"></path>
            </svg>
          </button>
        </h2>
        <div className="sidebar-actions">
          <button 
            className={`tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveTab('chats')}
          >
            Chats
          </button>
          <button 
            className={`tab-btn ${activeTab === 'contacts' ? 'active' : ''}`}
            onClick={() => setActiveTab('contacts')}
          >
            Contacts
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateConversation 
          onCancel={() => setShowCreate(false)}
          onSuccess={(id) => {
            setShowCreate(false);
            setSelectedConversationId(id);
            queryClient.invalidateQueries(['conversations']);
          }} 
        />
      )}

      {activeTab === 'chats' ? (
        <div className="conversation-list">
          {isLoading && (
            <div style={{ padding: '1rem' }}>
              <div className="skeleton skeleton-line"></div>
              <div className="skeleton skeleton-line" style={{ width: '80%' }}></div>
              <div className="skeleton skeleton-line" style={{ width: '40%' }}></div>
            </div>
          )}
          
          {isError && (
            <div className="empty-state text-danger" style={{ padding: '1rem' }}>
              <p>Error: {error.message}</p>
              <button className="primary-btn" onClick={() => refetch()} style={{ marginTop: '0.5rem' }}>Retry</button>
            </div>
          )}

          {!isLoading && !isError && conversations?.length === 0 && (
            <div className="empty-state">
              <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: '1rem', opacity: 0.5, color: 'var(--text-muted)' }}>
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              <p>No conversations found.<br/>Start a new chat!</p>
            </div>
          )}

          {conversations?.slice().sort((a, b) => new Date(b.lastMessageAt || b.updatedAt) - new Date(a.lastMessageAt || a.updatedAt)).map(conv => {
            const isGroup = conv.type === 'group';
            let displayName = conv.name || 'Unnamed Conversation';
            let initials = isGroup ? 'G' : '?';
            let isOnline = false;
            let avatarUrl = null;

            if (!isGroup && conv.members) {
              const otherMember = conv.members.find(m => m.clerkId !== userId) || conv.members[0];
              if (otherMember) {
                displayName = otherMember.displayName || otherMember.username || 'Unknown User';
                initials = displayName.charAt(0).toUpperCase();
                isOnline = onlineUsers.has(otherMember._id);
                avatarUrl = otherMember.imageUrl;
              }
            } else if (isGroup && conv.name) {
              initials = conv.name.charAt(0).toUpperCase();
            }

            // Simple mock unread logic: e.g. if last message wasn't read. Just styling it as requested.
            const isUnread = conv.unreadCount > 0;

            return (
              <div 
                key={conv._id} 
                className={`conversation-item ${selectedConversationId === conv._id ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
                onClick={() => setSelectedConversationId(conv._id)}
              >
                <div className="avatar-container">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="avatar-image" />
                  ) : (
                    <div className="avatar">{initials}</div>
                  )}
                  {isOnline && !isGroup && <div className="status-dot online"></div>}
                </div>
                <div className="conversation-meta">
                  <div className="conversation-meta-header">
                    <h3 className="conversation-title">{displayName}</h3>
                    {conv.lastMessageAt && (
                      <span className="conversation-time">
                        {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="conversation-meta-footer">
                    <p className="conversation-preview">
                      {conv.lastMessage ? conv.lastMessage.content : 'No messages yet'}
                    </p>
                    {isUnread && <div className="unread-badge" style={{ background: 'var(--accent)', color: '#fff', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '12px', fontWeight: 'bold' }}>{conv.unreadCount > 99 ? '99+' : conv.unreadCount}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ContactsTab 
          onSelectContact={handleSelectContact} 
          isCreating={createDirectMutation.isPending} 
        />
      )}

      {/* Profile Footer */}
      <SidebarProfile />
    </div>
  );
};

const ContactsTab = ({ onSelectContact, isCreating }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 400);
  const onlineUsers = usePresenceStore(state => state.onlineUsers);

  const { data: contacts, isLoading, isError, error } = useQuery({
    queryKey: ['contacts', 'search', debouncedQuery],
    queryFn: () => searchUsers(debouncedQuery),
    enabled: debouncedQuery.trim().length > 0,
  });

  // Track presence for contacts if they appear
  useEffect(() => {
    if (contacts && contacts.length > 0 && socketService.socket?.connected) {
      const userIds = contacts.map(c => c._id.toString());
      socketService.socket.emit(EVENTS.PRESENCE_GET, { userIds });
    }
  }, [contacts]);

  return (
    <div className="contacts-tab" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '0.75rem 1rem' }}>
        <div style={{ position: 'relative' }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder="Search people..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-main)' }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.5rem' }}>
        {debouncedQuery.trim().length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>Search for people by name or username to start a conversation.</p>
          </div>
        ) : isLoading ? (
          <div style={{ padding: '1rem' }}>
            <div className="skeleton skeleton-line"></div>
            <div className="skeleton skeleton-line" style={{ width: '80%' }}></div>
          </div>
        ) : isError ? (
          <div className="empty-state text-danger" style={{ padding: '1rem' }}>
            <p>Error searching users: {error.message}</p>
          </div>
        ) : contacts?.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <p>No contacts found.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {contacts?.map(contact => {
              const initials = (contact.displayName || contact.username || '?').charAt(0).toUpperCase();
              const isOnline = onlineUsers.has(contact._id);
              
              return (
                <div 
                  key={contact._id} 
                  className="contact-item"
                  onClick={() => !isCreating && onSelectContact(contact)}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', 
                    borderRadius: '8px', cursor: isCreating ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s',
                    opacity: isCreating ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => { if(!isCreating) e.currentTarget.style.backgroundColor = 'var(--bg-surface)' }}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div className="avatar-container" style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                    {contact.avatar ? (
                      <img src={contact.avatar} alt={contact.displayName} className="avatar-image" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div className="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {initials}
                      </div>
                    )}
                    {isOnline && <div className="status-dot online"></div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {contact.displayName || contact.username}
                      </h4>
                    </div>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      @{contact.username}
                    </p>
                  </div>
                  <div style={{ opacity: 0.6 }}>
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const SidebarProfile = () => {
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/sign-in';
  };

  return (
    <div className="sidebar-profile-container" style={{ position: 'relative' }}>
      {menuOpen && (
        <>
          <div className="profile-menu-overlay" onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 100 }}></div>
          <div className="profile-menu-dropdown" style={{ position: 'absolute', bottom: '100%', left: '1rem', right: '1rem', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--bg-border)', borderRadius: '0.5rem', padding: '0.5rem', marginBottom: '0.5rem', zIndex: 101, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
            <button className="profile-menu-item" onClick={() => { setMenuOpen(false); openUserProfile(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', borderRadius: '0.25rem', textAlign: 'left' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              Manage Account
            </button>
            <div style={{ height: '1px', backgroundColor: 'var(--bg-border)', margin: '0.25rem 0' }}></div>
            <button className="profile-menu-item danger" onClick={handleSignOut} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', borderRadius: '0.25rem', textAlign: 'left' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Sign Out
            </button>
          </div>
        </>
      )}

      <div 
        className="sidebar-profile-btn"
        onClick={() => setMenuOpen(!menuOpen)}
        style={{ padding: '1rem', borderTop: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'background-color 0.2s' }}
      >
        <div className="avatar-container" style={{ width: '40px', height: '40px' }}>
          <img src={user.imageUrl} alt={user.fullName} className="avatar-image" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          <div className="status-dot online"></div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.fullName || user.username || 'User'}</h4>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Online</p>
        </div>
        <div className="profile-menu-chevron" style={{ color: 'var(--text-muted)' }}>
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M6 9l6 6 6-6"></path>
          </svg>
        </div>
      </div>
    </div>
  );
};

