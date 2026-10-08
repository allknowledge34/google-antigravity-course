import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConversationsPage from '../src/pages/ConversationsPage.jsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../src/services/api/conversations.api.js', () => ({
  getConversations: vi.fn().mockResolvedValue([
    { _id: '1', type: 'direct', name: 'User B', members: [] },
    { _id: '2', type: 'group', name: 'Test Group', members: [] }
  ]),
  getConversationDetails: vi.fn().mockResolvedValue({
    _id: '1', type: 'direct', name: 'User B', members: []
  }),
  createConversation: vi.fn(),
  leaveConversation: vi.fn(),
}));

vi.mock('../src/services/api/messages.api.js', () => ({
  getMessages: vi.fn().mockResolvedValue({ data: [], meta: {} }),
  createMessage: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
}));

vi.mock('../src/services/api/users.api.js', () => ({
  searchUsers: vi.fn().mockResolvedValue([{ _id: 'user_2', displayName: 'User B' }]),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('@clerk/react', () => ({
  useAuth: () => ({
    userId: 'user_1',
    getToken: vi.fn().mockResolvedValue('test-token'),
  }),
  useUser: () => ({
    user: { id: 'user_1', fullName: 'Test User', imageUrl: '' }
  }),
  useClerk: () => ({
    signOut: vi.fn()
  })
}));

describe('ConversationsPage Component', () => {
  it('renders conversation list', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ConversationsPage />
      </QueryClientProvider>
    );

    expect(screen.getByText('Messages')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('User B')).toBeInTheDocument();
      expect(screen.getByText('Test Group')).toBeInTheDocument();
    });
  });
});
