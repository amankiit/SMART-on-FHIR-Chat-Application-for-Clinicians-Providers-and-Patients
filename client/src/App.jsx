import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { apiFetch } from './api';
import TopNav from './components/TopNav.jsx';
import Login from './pages/Login.jsx';
import Patients from './pages/Patients.jsx';
import Chat from './pages/Chat.jsx';
import PatientJoin from './pages/PatientJoin.jsx';
import PatientChat from './pages/PatientChat.jsx';

function RequireAuth({ user, children }) {
  if (!user) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiFetch('/api/user/me')
      .then((data) => {
        if (!mounted) return;
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="container">
        <div className="card">Checking session...</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopNav user={user} />
      <Routes>
        <Route path="/" element={user ? <Navigate to="/patients" replace /> : <Login />} />
        <Route
          path="/patients"
          element={
            <RequireAuth user={user}>
              <Patients user={user} />
            </RequireAuth>
          }
        />
        <Route
          path="/chat/:conversationId"
          element={
            <RequireAuth user={user}>
              <Chat />
            </RequireAuth>
          }
        />
        <Route path="/patient" element={<PatientJoin />} />
        <Route path="/patient/chat/:conversationId" element={<PatientChat />} />
      </Routes>
    </div>
  );
}
