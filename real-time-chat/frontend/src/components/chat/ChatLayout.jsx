import { useUIStore } from '../../store/uiStore.js';
import { ChatSidebar } from './ChatSidebar.jsx';
import { ChatPanel } from './ChatPanel.jsx';

export const ChatLayout = () => {
  const selectedConversationId = useUIStore(state => state.selectedConversationId);

  return (
    <div className="chat-app-root">
      <div className={`chat-container ${selectedConversationId ? 'conversation-active' : ''}`}>
        <ChatSidebar />
        <ChatPanel />
      </div>
    </div>
  );
};
