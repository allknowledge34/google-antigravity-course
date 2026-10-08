import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClerk } from '@clerk/react';
import { getCurrentUser, updateProfile } from '../services/api/users.api.js';

const ProfilePage = () => {
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  
  const { data: user, isLoading, isError, error } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['currentUser'], updatedUser);
      setSuccessMsg('Profile updated successfully');
      setEditMode(false);
    },
    onError: (err) => {
      setLocalError(err.response?.data?.message || 'Failed to update profile');
    }
  });

  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ username: '', displayName: '', bio: '' });
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        displayName: user.displayName || '',
        bio: user.bio || '',
      });
    }
  }, [user]);

  if (isLoading) return <div>Loading profile...</div>;
  if (isError) return <div>Error loading profile: {error.message}</div>;

  const handleSubmit = (e) => {
    e.preventDefault();
    setLocalError('');
    setSuccessMsg('');
    mutation.mutate(formData);
  };

  return (
    <div>
      <h2>User Profile</h2>
      {localError && <div style={{ color: 'red' }}>{localError}</div>}
      {successMsg && <div style={{ color: 'green' }}>{successMsg}</div>}
      
      {!editMode ? (
        <div>
          {user?.avatar && <img src={user.avatar} alt="Avatar" width="100" />}
          <p><strong>Username:</strong> {user?.username}</p>
          <p><strong>Display Name:</strong> {user?.displayName}</p>
          <p><strong>Bio:</strong> {user?.bio}</p>
          <button onClick={() => setEditMode(true)}>Edit Profile</button>
          <button onClick={() => signOut()}>Sign Out</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div>
            <label>Username:</label>
            <input 
              type="text" 
              value={formData.username} 
              onChange={e => setFormData({ ...formData, username: e.target.value })} 
              required
              minLength={3}
              maxLength={30}
            />
          </div>
          <div>
            <label>Display Name:</label>
            <input 
              type="text" 
              value={formData.displayName} 
              onChange={e => setFormData({ ...formData, displayName: e.target.value })} 
              required
              minLength={1}
              maxLength={50}
            />
          </div>
          <div>
            <label>Bio:</label>
            <textarea 
              value={formData.bio} 
              onChange={e => setFormData({ ...formData, bio: e.target.value })}
              maxLength={500}
            />
          </div>
          <button type="submit" disabled={mutation.isPending}>Save</button>
          <button type="button" onClick={() => setEditMode(false)}>Cancel</button>
        </form>
      )}
    </div>
  );
};

export default ProfilePage;
