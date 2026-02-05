import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';

export default function Login({ onAuth }) {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      setError(err.replace(/_/g, ' '));
    }
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/launch');
      window.location.href = data.authUrl;
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card stack fade-in">
        <div>
          <h1 className="title">Secure SMART on FHIR Chat</h1>
          <p className="subtitle">
            Sign in with your SMART on FHIR provider credentials to start a real-time chat with patients. All
            messages are stored in MongoDB.
          </p>
        </div>
        {error && <div className="notice">Login error: {error}</div>}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="button" onClick={handleLogin} disabled={loading}>
            {loading ? 'Redirecting...' : 'Login with SMART on FHIR'}
          </button>
          <a className="button secondary" href="/patient">
            Join as Patient
          </a>
        </div>
        <div className="pill">Uses PKCE + OAuth2 with your configured SMART endpoints.</div>
      </div>
    </div>
  );
}
