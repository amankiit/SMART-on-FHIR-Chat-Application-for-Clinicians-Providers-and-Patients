import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

export default function PatientJoin() {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleJoin = async (event) => {
    event.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch(`/api/conversations/by-code/${code.trim()}`);
      navigate(`/patient/chat/${response.conversation._id}?code=${code.trim()}`, {
        state: { conversation: response.conversation }
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card stack fade-in">
        <h2 className="title">Patient Portal</h2>
        <p className="subtitle">Enter the join code provided by your care team to access the chat.</p>
        {error && <div className="notice">{error}</div>}
        <form className="form-row" onSubmit={handleJoin}>
          <input
            type="text"
            placeholder="Enter join code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="button" type="submit" disabled={loading}>
            {loading ? 'Joining...' : 'Join Chat'}
          </button>
        </form>
      </div>
    </div>
  );
}
