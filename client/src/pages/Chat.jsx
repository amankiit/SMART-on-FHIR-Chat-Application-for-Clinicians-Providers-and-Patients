import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { apiFetch } from '../api';
import { getSocket } from '../socket';

function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleString();
}

function formatNumber(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'number' || Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

function formatQuantity(quantity) {
  if (!quantity) return '';
  const valueText = formatNumber(quantity.value);
  const unit = quantity.unit || quantity.code || '';
  if (valueText && unit) return `${valueText} ${unit}`;
  if (valueText) return valueText;
  return unit || '';
}

function getObservationLabel(observation) {
  return (
    observation?.code?.text ||
    observation?.code?.coding?.[0]?.display ||
    'Observation'
  );
}

function hasObservationValue(observation) {
  return (
    observation?.valueQuantity ||
    observation?.valueString ||
    observation?.valueBoolean !== undefined ||
    observation?.valueInteger !== undefined ||
    observation?.valueCodeableConcept ||
    observation?.component?.length ||
    observation?.dataAbsentReason
  );
}

function shouldShowObservation(observation) {
  if (!observation) return false;
  if (observation.hasMember?.length && !hasObservationValue(observation)) return false;
  return true;
}

function findComponent(components, code) {
  return components?.find((component) =>
    component.code?.coding?.some((coding) => coding.code === code)
  );
}

function formatComponent(component) {
  if (!component) return '';
  const label =
    component.code?.text ||
    component.code?.coding?.[0]?.display ||
    'Component';
  const value =
    formatQuantity(component.valueQuantity) ||
    component.valueString ||
    component.valueCodeableConcept?.text ||
    component.valueCodeableConcept?.coding?.[0]?.display ||
    '';
  if (!value) return '';
  return `${label}: ${value}`;
}

function formatObservationValue(observation) {
  if (!observation) return '';
  if (observation.valueQuantity) {
    const quantity = formatQuantity(observation.valueQuantity);
    if (quantity) return quantity;
  }
  if (observation.valueString) return observation.valueString;
  if (observation.valueBoolean !== undefined) return observation.valueBoolean ? 'Yes' : 'No';
  if (observation.valueInteger !== undefined) return String(observation.valueInteger);
  if (observation.valueCodeableConcept) {
    const valueText =
      observation.valueCodeableConcept.text ||
      observation.valueCodeableConcept.coding?.[0]?.display ||
      '';
    if (valueText) return valueText;
  }

  if (observation.component?.length) {
    const systolic = findComponent(observation.component, '8480-6');
    const diastolic = findComponent(observation.component, '8462-4');
    if (systolic?.valueQuantity && diastolic?.valueQuantity) {
      const unit =
        systolic.valueQuantity.unit ||
        systolic.valueQuantity.code ||
        diastolic.valueQuantity.unit ||
        diastolic.valueQuantity.code ||
        '';
      const unitSuffix = unit ? ` ${unit}` : '';
      const sysValue = formatNumber(systolic.valueQuantity.value);
      const diaValue = formatNumber(diastolic.valueQuantity.value);
      if (sysValue && diaValue) {
        return `${sysValue}/${diaValue}${unitSuffix}`;
      }
    }

    if (observation.component.length === 1) {
      const component = observation.component[0];
      const componentValue =
        formatQuantity(component.valueQuantity) ||
        component.valueString ||
        component.valueCodeableConcept?.text ||
        component.valueCodeableConcept?.coding?.[0]?.display ||
        '';
      const componentLabel =
        component.code?.text ||
        component.code?.coding?.[0]?.display ||
        '';
      const observationLabel = getObservationLabel(observation);
      if (componentValue && (!componentLabel || componentLabel === observationLabel)) {
        return componentValue;
      }
    }

    const components = observation.component
      .map((component) => formatComponent(component))
      .filter(Boolean);
    if (components.length) return components.join(' · ');
  }

  if (observation.dataAbsentReason) {
    return (
      observation.dataAbsentReason.text ||
      observation.dataAbsentReason.coding?.[0]?.display ||
      'Unknown'
    );
  }

  if (observation.hasMember?.length) return 'Panel';
  return 'No value';
}

export default function Chat() {
  const { conversationId } = useParams();
  const location = useLocation();
  const [conversation, setConversation] = useState(location.state?.conversation || null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const convoResponse = conversation
          ? { conversation }
          : await apiFetch(`/api/conversations/${conversationId}`);
        if (!mounted) return;
        setConversation(convoResponse.conversation);

        const messagesResponse = await apiFetch(`/api/messages?conversationId=${conversationId}`);
        if (!mounted) return;
        setMessages(messagesResponse.messages || []);
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        setError(err.message);
        setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [conversationId]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('join', { conversationId });

    const handleNewMessage = (message) => {
      if (String(message.conversationId) !== conversationId) return;
      setMessages((prev) => [...prev, message]);
    };

    socket.on('message:new', handleNewMessage);
    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [conversationId]);

  useEffect(() => {
    if (!snapshotOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSnapshotOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [snapshotOpen]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;

    try {
      await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversationId,
          text
        })
      });
      setText('');
    } catch (err) {
      setError(err.message);
    }
  };

  const loadSnapshot = async () => {
    if (!conversation?.patientId) return;
    setLoadingSnapshot(true);
    try {
      const [vitals, labs, conditions, medications, reports] = await Promise.all([
        apiFetch(`/api/patient/${conversation.patientId}/vitals`),
        apiFetch(`/api/patient/${conversation.patientId}/labs`),
        apiFetch(`/api/patient/${conversation.patientId}/conditions`),
        apiFetch(`/api/patient/${conversation.patientId}/medications`),
        apiFetch(`/api/patient/${conversation.patientId}/diagnostic-reports`)
      ]);

      setSnapshot({
        vitals: vitals.entry || [],
        vitalsMeta: vitals.meta || null,
        labs: labs.entry || [],
        conditions: conditions.entry || [],
        medications: medications.entry || [],
        reports: reports.entry || []
      });
      setSnapshotOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const vitalsToShow = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.vitals.filter((entry) => shouldShowObservation(entry.resource));
  }, [snapshot]);

  if (loading) {
    return (
      <div className="container">
        <div className="card">Loading conversation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="notice">{error}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="chat-layout">
        <div className="card chat-window">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0 }}>{conversation?.patientName || 'Patient Chat'}</h2>
              <p className="subtitle">Provider: {conversation?.providerName}</p>
            </div>
            <span className="pill">Join code: {conversation?.joinCode}</span>
          </div>

          <div className="message-list" style={{ marginTop: '16px' }}>
            {messages.map((message) => (
              <div
                key={message._id}
                className={`message ${message.senderType}`}
              >
                <div className="message-meta">
                  {message.senderName} · {formatDate(message.createdAt)}
                </div>
                <div>{message.text}</div>
              </div>
            ))}
          </div>

          <form className="form-row" onSubmit={handleSend}>
            <input
              type="text"
              placeholder="Type your message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="button" type="submit">
              Send
            </button>
          </form>
        </div>

        <div className="stack">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Invite the patient</h3>
            <p className="subtitle">Share this join code with the patient to enter the chat:</p>
            <div className="pill" style={{ marginTop: '12px' }}>{conversation?.joinCode}</div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Patient snapshot</h3>
            <p className="subtitle">Load recent vitals, labs, conditions, and medications from FHIR.</p>
            <div className="snapshot-actions">
              <button className="button secondary" onClick={loadSnapshot} disabled={loadingSnapshot}>
                {loadingSnapshot ? 'Loading...' : snapshot ? 'Refresh Snapshot' : 'Load Snapshot'}
              </button>
              {snapshot && (
                <button className="button ghost" onClick={() => setSnapshotOpen(true)}>
                  View Snapshot
                </button>
              )}
            </div>
            {snapshot && (
              <div className="snapshot-metrics">
                <div className="snapshot-metric">
                  <span>Vitals</span>
                  <strong>{snapshot.vitals.length}</strong>
                </div>
                <div className="snapshot-metric">
                  <span>Labs</span>
                  <strong>{snapshot.labs.length}</strong>
                </div>
                <div className="snapshot-metric">
                  <span>Conditions</span>
                  <strong>{snapshot.conditions.length}</strong>
                </div>
                <div className="snapshot-metric">
                  <span>Medications</span>
                  <strong>{snapshot.medications.length}</strong>
                </div>
                <div className="snapshot-metric">
                  <span>Reports</span>
                  <strong>{snapshot.reports.length}</strong>
                </div>
                {snapshot.vitalsMeta?.lastUpdated && (
                  <div className="snapshot-updated">
                    Updated {formatDate(snapshot.vitalsMeta.lastUpdated)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {snapshot && snapshotOpen && (
        <div className="modal-backdrop" onClick={() => setSnapshotOpen(false)}>
          <div
            className="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="snapshot-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 id="snapshot-title" style={{ margin: 0 }}>Patient snapshot</h3>
                <p className="subtitle">Recent vitals, labs, conditions, and medications.</p>
              </div>
              <button className="button ghost" onClick={() => setSnapshotOpen(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="snapshot-grid">
                <section className="snapshot-section snapshot-section-wide">
                  <div className="modal-section-header">
                    <strong>Vitals</strong>
                    <span className="snapshot-tag">{vitalsToShow.length} entries</span>
                  </div>
                  {vitalsToShow.length ? (
                    <ul className="snapshot-list">
                      {vitalsToShow.map((entry) => {
                        const observation = entry.resource;
                        const label = getObservationLabel(observation);
                        const value = formatObservationValue(observation);
                        const normalizedValue = String(value).trim().toLowerCase();
                        const valueMuted =
                          normalizedValue === 'unknown' ||
                          normalizedValue === 'no value' ||
                          normalizedValue === 'panel';
                        const effectiveTime =
                          observation.effectiveDateTime || observation.issued || '';
                        return (
                          <li key={observation.id} className="snapshot-row">
                            <div className="snapshot-row-main">
                              <span className="snapshot-label">{label}</span>
                              <span className={valueMuted ? 'snapshot-muted' : 'snapshot-value'}>
                                {value}
                              </span>
                            </div>
                            {effectiveTime && (
                              <div className="snapshot-sub">{formatDate(effectiveTime)}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="snapshot-empty">No vitals found.</div>
                  )}
                  {snapshot.vitalsMeta?.lastUpdated && (
                    <div className="snapshot-sub" style={{ marginTop: '6px' }}>
                      Updated {formatDate(snapshot.vitalsMeta.lastUpdated)}
                    </div>
                  )}
                </section>
                <section className="snapshot-section">
                  <div className="modal-section-header">
                    <strong>Labs</strong>
                    <span className="snapshot-tag">{snapshot.labs.length} entries</span>
                  </div>
                  {snapshot.labs.length ? (
                    <ul className="snapshot-list">
                      {snapshot.labs.map((entry) => (
                        <li key={entry.resource.id} className="snapshot-row">
                          {entry.resource.code?.text || entry.resource.code?.coding?.[0]?.display || 'Lab'}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="snapshot-empty">No labs found.</div>
                  )}
                </section>
                <section className="snapshot-section">
                  <div className="modal-section-header">
                    <strong>Conditions</strong>
                    <span className="snapshot-tag">{snapshot.conditions.length} entries</span>
                  </div>
                  {snapshot.conditions.length ? (
                    <ul className="snapshot-list">
                      {snapshot.conditions.map((entry) => (
                        <li key={entry.resource.id} className="snapshot-row">
                          {entry.resource.code?.text || entry.resource.code?.coding?.[0]?.display || 'Condition'}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="snapshot-empty">No conditions found.</div>
                  )}
                </section>
                <section className="snapshot-section">
                  <div className="modal-section-header">
                    <strong>Medications</strong>
                    <span className="snapshot-tag">{snapshot.medications.length} entries</span>
                  </div>
                  {snapshot.medications.length ? (
                    <ul className="snapshot-list">
                      {snapshot.medications.map((entry) => (
                        <li key={entry.resource.id} className="snapshot-row">
                          {entry.resource.medicationCodeableConcept?.text ||
                            entry.resource.medicationCodeableConcept?.coding?.[0]?.display ||
                            'Medication'}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="snapshot-empty">No medications found.</div>
                  )}
                </section>
                <section className="snapshot-section">
                  <div className="modal-section-header">
                    <strong>Diagnostic Reports</strong>
                    <span className="snapshot-tag">{snapshot.reports.length} entries</span>
                  </div>
                  {snapshot.reports.length ? (
                    <ul className="snapshot-list">
                      {snapshot.reports.map((entry) => (
                        <li key={entry.resource.id} className="snapshot-row">
                          {entry.resource.code?.text || entry.resource.code?.coding?.[0]?.display || 'Report'}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="snapshot-empty">No diagnostic reports found.</div>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
