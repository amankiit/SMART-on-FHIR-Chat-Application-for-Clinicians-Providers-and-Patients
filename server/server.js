require('dotenv').config();
const express = require('express');
const http = require('http');
const axios = require('axios');
const cors = require('cors');
const session = require('express-session');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const { generateJoinCode } = require('./utils/joinCode');
const {config,
  generatePKCE,
  getCurrentFhirUser,
  normalizeFhirUser,
  makeFHIRRequest
} = require('./utils/smart');

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-chat';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    credentials: true
  }
});

const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
});

app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(sessionMiddleware);

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.on('connection', (socket) => {
  socket.on('join', ({ conversationId }) => {
    if (conversationId) {
      socket.join(conversationId);
    }
  });
});

app.set('io', io);

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err.message));

function requireAuth(req, res, next) {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return next();
}

async function getSessionUser(req) {
  if (req.session.user) {
    return req.session.user;
  }
  if (!req.session.accessToken) {
    return null;
  }

  const userResource = await getCurrentFhirUser(req.session.accessToken, req.session.idToken);
  const normalized = normalizeFhirUser(userResource);
  if (normalized) {
    req.session.user = normalized;
  }
  return normalized;
}

app.get('/launch', (req, res) => {
  const state = require('crypto').randomBytes(16).toString('hex');
  const { codeVerifier, codeChallenge } = generatePKCE();

  req.session.state = state;
  req.session.codeVerifier = codeVerifier;

  const authUrl = new URL(config.authorizationEndpoint);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', config.clientId);
  authUrl.searchParams.append('redirect_uri', config.redirectUri);
  authUrl.searchParams.append('scope', config.scope);
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('aud', config.fhirBaseUrl);
  authUrl.searchParams.append('code_challenge', codeChallenge);
  authUrl.searchParams.append('code_challenge_method', 'S256');

  res.json({ authUrl: authUrl.toString() });
});

app.get('/redirect', async (req, res) => {
  const { code, state } = req.query;

  if (!state || state !== req.session.state) {
    return res.redirect(`${CLIENT_ORIGIN}?error=invalid_state`);
  }

  try {
    const tokenResponse = await axios.post(
      config.tokenEndpoint,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code_verifier: req.session.codeVerifier
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, scope, id_token } = tokenResponse.data;

    req.session.accessToken = access_token;
    req.session.refreshToken = refresh_token;
    req.session.grantedScope = scope;
    req.session.idToken = id_token;
    req.session.user = null;

    delete req.session.state;
    delete req.session.codeVerifier;

    res.redirect(`${CLIENT_ORIGIN}?auth=success`);
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    res.redirect(`${CLIENT_ORIGIN}?error=token_exchange_failed`);
  }
});

app.get('/api/auth/status', (req, res) => {
  res.json({
    authenticated: !!req.session.accessToken,
    scope: req.session.grantedScope || null,
    hasIdToken: !!req.session.idToken
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/user/me', requireAuth, async (req, res) => {
  try {
    const user = await getSessionUser(req);
    res.json({
      authenticated: true,
      user
    });
  } catch (e) {
    console.error('Error in /api/user/me:', e.message);
    res.status(500).json({ error: 'Failed to load user profile' });
  }
});

app.get('/api/patients', requireAuth, async (req, res) => {
  try {
    const data = await makeFHIRRequest(req.session.accessToken, 'Patient', { _count: 50 });
    res.json(data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch patients',
      details: error.response?.data
    });
  }
});

app.get('/api/patient/:id/vitals', requireAuth, async (req, res) => {
  try {
    const data = await makeFHIRRequest(req.session.accessToken, 'Observation', {
      patient: req.params.id,
      category: 'vital-signs',
      _count: 20,
      _sort: '-date'
    });
    res.json(data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch vitals',
      details: error.response?.data
    });
  }
});

app.get('/api/patient/:id/labs', requireAuth, async (req, res) => {
  try {
    const data = await makeFHIRRequest(req.session.accessToken, 'Observation', {
      patient: req.params.id,
      category: 'laboratory',
      _count: 20,
      _sort: '-date'
    });
    res.json(data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch labs',
      details: error.response?.data
    });
  }
});

app.get('/api/patient/:id/conditions', requireAuth, async (req, res) => {
  try {
    const data = await makeFHIRRequest(req.session.accessToken, 'Condition', {
      patient: req.params.id,
      _count: 20,
      _sort: '-recorded-date'
    });
    res.json(data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch conditions',
      details: error.response?.data
    });
  }
});

app.get('/api/patient/:id/medications', requireAuth, async (req, res) => {
  try {
    const data = await makeFHIRRequest(req.session.accessToken, 'MedicationRequest', {
      patient: req.params.id,
      _count: 20,
      _sort: '-authoredon'
    });
    res.json(data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch medications',
      details: error.response?.data
    });
  }
});

app.get('/api/patient/:id/diagnostic-reports', requireAuth, async (req, res) => {
  try {
    const data = await makeFHIRRequest(req.session.accessToken, 'DiagnosticReport', {
      patient: req.params.id,
      _count: 20,
      _sort: '-date'
    });
    res.json(data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch diagnostic reports',
      details: error.response?.data
    });
  }
});

app.post('/api/conversations', requireAuth, async (req, res) => {
  const { patientId, patientName } = req.body || {};
  if (!patientId || !patientName) {
    return res.status(400).json({ error: 'patientId and patientName are required' });
  }

  try {
    const provider = await getSessionUser(req);
    if (!provider) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let conversation = await Conversation.findOne({ patientId, providerId: provider.id });
    if (!conversation) {
      let joinCode = generateJoinCode();
      let attempts = 0;
      while (attempts < 5) {
        const existing = await Conversation.findOne({ joinCode });
        if (!existing) break;
        joinCode = generateJoinCode();
        attempts += 1;
      }

      conversation = await Conversation.create({
        patientId,
        patientName,
        providerId: provider.id,
        providerName: provider.name,
        joinCode
      });
    }

    res.json({ conversation });
  } catch (error) {
    console.error('Create conversation error:', error.message);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

app.get('/api/conversations/patient/:patientId', requireAuth, async (req, res) => {
  try {
    const provider = await getSessionUser(req);
    if (!provider) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const conversation = await Conversation.findOne({
      patientId: req.params.patientId,
      providerId: provider.id
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ conversation });
  } catch (error) {
    console.error('Fetch conversation error:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

app.get('/api/conversations/by-code/:code', async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ joinCode: req.params.code });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(200);

    res.json({ conversation, messages });
  } catch (error) {
    console.error('Fetch conversation by code error:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

app.get('/api/conversations/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (req.session.accessToken) {
      const provider = await getSessionUser(req);
      if (!provider || provider.id !== conversation.providerId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      return res.json({ conversation });
    }

    if (req.query.joinCode && req.query.joinCode === conversation.joinCode) {
      return res.json({ conversation });
    }

    return res.status(401).json({ error: 'Not authenticated' });
  } catch (error) {
    console.error('Fetch conversation error:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

app.get('/api/messages', async (req, res) => {
  const { conversationId, joinCode } = req.query || {};
  if (!conversationId) {
    return res.status(400).json({ error: 'conversationId is required' });
  }

  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (req.session.accessToken) {
      const provider = await getSessionUser(req);
      if (!provider || provider.id !== conversation.providerId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else if (!joinCode || joinCode !== conversation.joinCode) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(200);

    res.json({ messages });
  } catch (error) {
    console.error('Fetch messages error:', error.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/messages', async (req, res) => {
  const { conversationId, text, joinCode } = req.body || {};
  if (!conversationId || !text) {
    return res.status(400).json({ error: 'conversationId and text are required' });
  }

  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    let senderType;
    let senderName;

    if (req.session.accessToken) {
      const provider = await getSessionUser(req);
      if (!provider || provider.id !== conversation.providerId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      senderType = 'provider';
      senderName = provider.name;
    } else if (joinCode && joinCode === conversation.joinCode) {
      senderType = 'patient';
      senderName = conversation.patientName || 'Patient';
    } else {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      patientId: conversation.patientId,
      providerId: conversation.providerId,
      senderType,
      senderName,
      text: String(text).slice(0, 2000)
    });

    req.app.get('io').to(conversationId).emit('message:new', message);

    res.json({ message });
  } catch (error) {
    console.error('Send message error:', error.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
