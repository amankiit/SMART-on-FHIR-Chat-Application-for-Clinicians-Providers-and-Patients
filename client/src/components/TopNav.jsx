import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

export default function TopNav({ user }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await apiFetch('/api/logout', { method: 'POST' });
      navigate('/');
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <nav className="navbar">
      <Link to="/" className="link brand">
        SMART Chat
      </Link>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {user?.name && <span className="badge">{user.name}</span>}
        <Link to="/patient" className="button ghost">
          Patient Portal
        </Link>
        {user?.name && (
          <button className="button secondary" onClick={handleLogout}>
            Log out
          </button>
        )}
      </div>
    </nav>
  );
}
