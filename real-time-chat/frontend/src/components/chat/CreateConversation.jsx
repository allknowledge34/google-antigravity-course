import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { searchUsers } from '../../services/api/users.api.js';
import { uploadFile } from '../../services/api/messages.api.js';
import { createConversation } from '../../services/api/conversations.api.js';

export const CreateConversation = ({ onSuccess, onCancel }) => {
  const [type, setType] = useState('direct');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupAvatar, setGroupAvatar] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchError, setSearchError] = useState('');

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ['usersSearch', searchQuery],
    queryFn: () => searchUsers(searchQuery),
    enabled: searchQuery.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: createConversation,
    onSuccess: (data) => {
      onSuccess(data._id);
    },
    onError: (error) => {
      setSearchError(error.response?.data?.message || 'Failed to create conversation');
    }
  });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setSearchError('');
    try {
      const result = await uploadFile(file);
      setGroupAvatar(result.url);
    } catch (err) {
      setSearchError('Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };
  
  const handleSelectUser = (user) => {
    if (type === 'direct') {
      createMutation.mutate({ type: 'direct', memberId: user._id });
    } else {
      if (!selectedUsers.find(u => u._id === user._id)) {
        setSelectedUsers([...selectedUsers, user]);
      }
      setSearchQuery('');
    }
  };

  const handleCreateGroup = () => {
    if (!groupName.trim()) {
      setSearchError('Group name is required');
      return;
    }
    if (selectedUsers.length === 0) {
      setSearchError('Select at least one member');
      return;
    }
    createMutation.mutate({
      type: 'group',
      name: groupName,
      memberIds: selectedUsers.map(u => u._id),
      avatar: groupAvatar
    });
  };

  return (
    <div style={{ padding: '1rem', borderBottom: '1px solid var(--bg-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>New Chat</h3>
        <button onClick={onCancel} className="action-btn">✕</button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button 
          className={`tab-btn ${type === 'direct' ? 'active' : ''}`}
          onClick={() => { setType('direct'); setSelectedUsers([]); setSearchError(''); }}
        >
          Direct
        </button>
        <button 
          className={`tab-btn ${type === 'group' ? 'active' : ''}`}
          onClick={() => { setType('group'); setSelectedUsers([]); setSearchError(''); }}
        >
          Group
        </button>
      </div>

      {type === 'group' && (
        <div style={{ marginBottom: '1rem' }}>
          <input 
            type="text" 
            placeholder="Group Name" 
            value={groupName} 
            onChange={e => setGroupName(e.target.value)} 
            className="search-input"
          />
        </div>
      )}

      {type === 'group' && (
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {groupAvatar && <img src={groupAvatar} alt="Group Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />}
          <label className="secondary-btn" style={{ cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-main)', display: 'inline-block' }}>
            {uploading ? 'Uploading...' : 'Upload Avatar'}
            <input type="file" hidden accept="image/*" onChange={handleAvatarUpload} disabled={uploading} />
          </label>
        </div>
      )}

      {type === 'group' && selectedUsers.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Selected Members:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {selectedUsers.map(u => (
              <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--bg-surface)', padding: '0.25rem 0.5rem', borderRadius: '12px', fontSize: '0.8rem', border: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-main)' }}>{u.displayName}</span>
                <button 
                  onClick={() => setSelectedUsers(selectedUsers.filter(su => su._id !== u._id))}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 0.25rem', display: 'flex', alignItems: 'center' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <input 
          type="text" 
          placeholder="Search users..." 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)} 
          className="search-input"
        />
        {isFetching && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Searching...</div>}
      </div>

      {searchError && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '1rem' }}>{searchError}</div>}

      {searchResults && searchResults.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem 0', maxHeight: '150px', overflowY: 'auto' }}>
          {searchResults.map(user => (
            <li key={user._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{user.displayName}</span>
              <button className="primary-btn" style={{ padding: '0.25rem 0.5rem', width: 'auto', fontSize: '0.8rem' }} onClick={() => handleSelectUser(user)}>
                {type === 'direct' ? 'Chat' : 'Add'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {type === 'group' && (
        <button className="primary-btn" onClick={handleCreateGroup} disabled={createMutation.isPending}>
          Create Group
        </button>
      )}
    </div>
  );
};
