import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '../src/App';

vi.mock('@clerk/react', () => {
  return {
    SignIn: () => <div>Sign In</div>,
    SignUp: () => <div>Sign Up</div>,
    useAuth: () => ({
      getToken: vi.fn().mockResolvedValue('test-token'),
      isLoaded: true,
      isSignedIn: true,
    }),
    useClerk: () => ({
      signOut: vi.fn(),
    }),
    useUser: () => ({
      user: { id: 'user_1', fullName: 'Test User', imageUrl: '' }
    })
  };
});

describe('App Component', () => {
  it('renders the foundation text', () => {
    render(<App />);
    expect(screen.getByText('Welcome to Real-Time Chat')).toBeInTheDocument();
  });
});
