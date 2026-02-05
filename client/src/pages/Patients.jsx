import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

function formatPatientName(resource) {
  if (!resource?.name?.length) return 'Unknown Patient';
  const n = resource.name[0];
  const given = n.given ? n.given.join(' ') : '';
  const family = n.family || '';
  return `${given} ${family}`.trim() || 'Unknown Patient';
}

export default function Patients({ user }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    apiFetch('/api/patients')
      .then((data) => {
        if (!mounted) return;
        const entries = data?.entry || [];
        setPatients(entries.map((entry) => entry.resource));
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const patientCards = useMemo(() => {
    return patients.map((patient) => {
      const name = formatPatientName(patient);
      return {
        id: patient.id,
        name,
        gender: patient.gender || 'unknown',
        birthDate: patient.birthDate || 'unknown'
      };
    });
  }, [patients]);

  const handleOpenChat = async (patient) => {
    try {
      const response = await apiFetch('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({
          patientId: patient.id,
          patientName: patient.name
        })
      });

      const conversation = response.conversation;
      navigate(`/chat/${conversation._id}`, { state: { conversation } });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      <div className="stack">
        <div className="card">
          <h2 className="title">Welcome back{user?.name ? `, ${user.name}` : ''}</h2>
          <p className="subtitle">
            Select a patient to open a persistent chat room. A join code is generated to invite the patient.
          </p>
        </div>

        {error && <div className="notice">{error}</div>}

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Patients</h3>
            <span className="pill">{patientCards.length} loaded</span>
          </div>
          {loading ? (
            <p className="subtitle">Loading patients from FHIR...</p>
          ) : (
            <div className="grid" style={{ marginTop: '16px' }}>
              {patientCards.map((patient) => (
                <div key={patient.id} className="patient-card fade-in">
                  <div>
                    <strong>{patient.name}</strong>
                    <div className="patient-meta">FHIR ID: {patient.id}</div>
                  </div>
                  <div className="patient-meta">
                    {patient.gender} · {patient.birthDate}
                  </div>
                  <button className="button" onClick={() => handleOpenChat(patient)}>
                    Open Chat
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
