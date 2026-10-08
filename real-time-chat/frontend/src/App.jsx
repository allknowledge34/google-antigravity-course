import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { SignedIn, SignedOut } from './components/auth/ClerkWrappers.jsx';
import { useEffect } from 'react';
import { apiClient } from './services/api/client.js';

import './chat.css';

// Pages
const HealthCheck = () => <div>Frontend is running</div>;

import ProfilePage from './pages/ProfilePage.jsx';
import ConversationsPage from './pages/ConversationsPage.jsx';
import SignInPage from './pages/SignInPage.jsx';
import SignUpPage from './pages/SignUpPage.jsx';

const Landing = () => (
  <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
    <div style={{ textAlign: 'center', maxWidth: '400px', padding: '2rem' }}>
      <h1 style={{ color: 'var(--text-main)', fontSize: '2.5rem', marginBottom: '1rem', fontWeight: '700' }}>Real-Time Chat</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '2.5rem', lineHeight: '1.5' }}>
        Connect. Chat. Stay in real time.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <a href="/sign-in" className="primary-btn" style={{ textDecoration: 'none', textAlign: 'center', minWidth: '120px', display: 'inline-block' }}>
          Sign In
        </a>
        <a href="/sign-up" className="primary-btn" style={{ textDecoration: 'none', textAlign: 'center', minWidth: '120px', display: 'inline-block', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--bg-border)', color: 'var(--text-main)' }} onMouseOver={(e) => e.target.style.backgroundColor = 'var(--bg-panel-hover)'} onMouseOut={(e) => e.target.style.backgroundColor = 'var(--bg-panel)'}>
          Sign Up
        </a>
      </div>
    </div>
  </div>
);

const queryClient = new QueryClient();

// Auth setup component to attach token interceptor dynamically
const AuthInterceptor = ({ children }) => {
  const { getToken, signOut } = useAuth();

  useEffect(() => {
    const requestInterceptor = apiClient.interceptors.request.use(async (config) => {
      try {
        const token = await getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (err) {
        console.warn('Failed to get token before request', err);
      }
      return config;
    });

    const responseInterceptor = apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          console.warn('401 Unauthorized encountered from API. Not signing out globally to prevent race condition logouts.');
          // If Clerk session is genuinely invalid, Clerk's own components will handle the redirect.
          // We just reject the promise so React Query can handle the error state.
        }
        return Promise.reject(error);
      }
    );

    return () => {
      apiClient.interceptors.request.eject(requestInterceptor);
      apiClient.interceptors.response.eject(responseInterceptor);
    };
  }, [getToken, signOut]);

  return children;
};

import { socketService } from './services/socket/socket.js';
import { EVENTS } from './services/socket/events.js';
import { usePresenceStore } from './store/presenceStore.js';
import { useUIStore } from './store/uiStore.js';
import { useTypingStore } from './store/typingStore.js';

const SocketManager = ({ children }) => {
  const { getToken, isSignedIn } = useAuth();
  const { addOnlineUser, removeOnlineUser } = usePresenceStore();
  const { addTypingUser, removeTypingUser } = useTypingStore();

  useEffect(() => {
    if (isSignedIn) {
      socketService.init(getToken);
      socketService.connect(() => {
        // Optional: on reconnect, ask for sync or wait for events
      });

      // Presence handlers
      const handleOnline = ({ userId }) => addOnlineUser(userId?.toString());
      const handleOffline = ({ userId }) => removeOnlineUser(userId?.toString());
      const handlePresenceSync = ({ onlineUsers, queriedUsers }) => {
        usePresenceStore.getState().setOnlineUsers((prev) => {
          const newSet = new Set(prev);
          if (queriedUsers && Array.isArray(queriedUsers)) {
            queriedUsers.forEach(id => newSet.delete(id.toString()));
          }
          if (onlineUsers && Array.isArray(onlineUsers)) {
            onlineUsers.forEach(id => newSet.add(id.toString()));
          }
          return newSet;
        });
      };

      // Typing handlers
      const handleTypingStart = ({ conversationId, userId }) => {
        addTypingUser(conversationId, userId);
      };
      const handleTypingStop = ({ conversationId, userId }) => {
        removeTypingUser(conversationId, userId);
      };

      const handleGlobalUnread = ({ conversationId, content, createdAt, type, senderId }) => {
        // If this conversation is currently open in ChatPanel, DO NOT increment unread!
        // We rely on ChatPanel calling emitRead() which resets it!
        // But to be safe, if we get a background unread event:
        
        const currentConvId = useUIStore.getState().selectedConversationId;
        
        queryClient.setQueryData(['conversations'], (oldData) => {
          if (!oldData) return oldData;
          return oldData.map(conv => {
            if (conv._id === conversationId) {
              const isActive = currentConvId === conversationId;
              return {
                ...conv,
                unreadCount: isActive ? 0 : (conv.unreadCount || 0) + 1,
                lastMessage: { content, type, createdAt, senderId },
                lastMessageAt: createdAt
              };
            }
            return conv;
          });
        });
      };

      const handleGlobalRead = ({ conversationId }) => {
        queryClient.setQueryData(['conversations'], (oldData) => {
          if (!oldData) return oldData;
          return oldData.map(conv => {
            if (conv._id === conversationId) {
              return { ...conv, unreadCount: 0 };
            }
            return conv;
          });
        });
      };

      socketService.on('conversation:unread', handleGlobalUnread);
      socketService.on('conversation:read', handleGlobalRead);


      socketService.on(EVENTS.PRESENCE_ONLINE, handleOnline);
      socketService.on(EVENTS.PRESENCE_OFFLINE, handleOffline);
      socketService.on(EVENTS.PRESENCE_SYNC, handlePresenceSync);
      
      socketService.on(EVENTS.TYPING_START, handleTypingStart);
      socketService.on(EVENTS.TYPING_STOP, handleTypingStop);

      return () => {
        socketService.off(EVENTS.PRESENCE_ONLINE, handleOnline);
        socketService.off(EVENTS.PRESENCE_OFFLINE, handleOffline);
        socketService.off(EVENTS.PRESENCE_SYNC, handlePresenceSync);
        
        socketService.off(EVENTS.TYPING_START, handleTypingStart);
        socketService.off(EVENTS.TYPING_STOP, handleTypingStop);
        socketService.off('conversation:unread', handleGlobalUnread);
        socketService.off('conversation:read', handleGlobalRead);
        
        socketService.disconnect();
      };
    } else {
      socketService.disconnect();
    }
  }, [isSignedIn, getToken, addOnlineUser, removeOnlineUser, addTypingUser, removeTypingUser]);

  return children;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInterceptor>
        <SocketManager>
          <BrowserRouter>
            <Routes>
              <Route 
                path="/" 
                element={
                  <>
                    <SignedIn>
                      <Navigate to="/conversations" replace />
                    </SignedIn>
                    <SignedOut>
                      <Landing />
                    </SignedOut>
                  </>
                } 
              />
              <Route path="/health" element={<HealthCheck />} />
              <Route path="/sign-in/*" element={<SignInPage />} />
              <Route path="/sign-up/*" element={<SignUpPage />} />
              <Route 
                path="/conversations" 
                element={
                  <>
                    <SignedIn>
                      <ConversationsPage />
                    </SignedIn>
                    <SignedOut>
                      <Navigate to="/sign-in" />
                    </SignedOut>
                  </>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <>
                    <SignedIn>
                      <ProfilePage />
                    </SignedIn>
                    <SignedOut>
                      <Navigate to="/sign-in" />
                    </SignedOut>
                  </>
                } 
              />
            </Routes>
          </BrowserRouter>
        </SocketManager>
      </AuthInterceptor>
    </QueryClientProvider>
  );
}

export default App;
