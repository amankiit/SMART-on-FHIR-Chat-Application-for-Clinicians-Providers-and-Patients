import React, { useEffect, useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api';
import { getSocket } from '../socket';

function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleString();
}

export default function PatientChat() {
  const { conversationId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const joinCode = searchParams.get('code');
  const [conversation, setConversation] = useState(location.state?.conversation || null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const convoResponse = conversation
          ? { conversation }
          : await apiFetch(`/api/conversations/${conversationId}?joinCode=${joinCode}`);
        if (!mounted) return;
        setConversation(convoResponse.conversation);

        const messagesResponse = await apiFetch(
          `/api/messages?conversationId=${conversationId}&joinCode=${joinCode}`
        );
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
  }, [conversationId, joinCode]);

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

  const handleSend = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;

    try {
      await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversationId,
          text,
          joinCode
        })
      });
      setText('');
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card">Loading chat...</div>
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
      <div className="card chat-window">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>Chat with {conversation?.providerName}</h2>
            <p className="subtitle">Patient: {conversation?.patientName}</p>
          </div>
          <span className="pill">Join code: {conversation?.joinCode}</span>
        </div>

        <div className="message-list" style={{ marginTop: '16px' }}>
          {messages.map((message) => (
            <div key={message._id} className={`message ${message.senderType}`}>
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
    </div>
  );
}
