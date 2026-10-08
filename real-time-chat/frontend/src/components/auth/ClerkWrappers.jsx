import { useAuth } from '@clerk/react';

const FullScreenLoader = () => (
  <div className="chat-app-root" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
      <div className="skeleton skeleton-avatar" style={{ width: '64px', height: '64px' }}></div>
      <p>Loading application...</p>
    </div>
  </div>
);

export const SignedIn = ({ children }) => {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return <FullScreenLoader />;
  if (!isSignedIn) return null;
  return <>{children}</>;
};

export const SignedOut = ({ children }) => {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return <FullScreenLoader />;
  if (isSignedIn) return null;
  return <>{children}</>;
};
