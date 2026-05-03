const fetch = require('node-fetch');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { commandClient } = require('./redis');

let oidcConfig = null;

async function getOidcConfig() {
  if (oidcConfig) return oidcConfig;
  const response = await fetch('https://accounts.google.com/.well-known/openid-configuration');
  oidcConfig = await response.json();
  return oidcConfig;
}

function generateSignature(cookieValue, secret) {
  return crypto.createHmac('sha256', secret).update(cookieValue).digest('hex');
}

function setSignedCookie(res, name, value, secret) {
  const signature = generateSignature(value, secret);
  const signedValue = `${value}.${signature}`;
  res.cookie(name, signedValue, {
    httpOnly: true, secure: true, sameSite: 'none',
    maxAge: 24 * 60 * 60 * 1000
  });
}

function getSignedCookie(req, name, secret) {
  const signedValue = req.cookies[name];
  if (!signedValue) return null;
  const parts = signedValue.split('.');
  if (parts.length !== 2) return null;
  const [value, signature] = parts;
  const expectedSignature = generateSignature(value, secret);
  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return value;
  }
  return null;
}

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    let parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });

  return list;
}

function getSignedCookieFromHeader(cookieHeader, name, secret) {
    const cookies = parseCookies(cookieHeader);
    const signedValue = cookies[name];
    if (!signedValue) return null;
    const parts = signedValue.split('.');
    if (parts.length !== 2) return null;
    const [value, signature] = parts;
    const expectedSignature = generateSignature(value, secret);
    
    if (Buffer.from(signature).length !== Buffer.from(expectedSignature).length) return null;

    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return value;
    }
    return null;
}

const authRoutes = require('express').Router();

authRoutes.get('/login', async (req, res) => {
  try {
    const config = await getOidcConfig();
    const state = crypto.randomBytes(16).toString('hex');
    
    await commandClient.set(`oidc:state:${state}`, '1', 'EX', 300);
    
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL,
      response_type: 'code',
      scope: 'openid email profile',
      state: state
    });

    res.redirect(`${config.authorization_endpoint}?${params.toString()}`);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Authentication setup failed');
  }
});

authRoutes.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send(`Auth error: ${error}`);
  }

  if (!code || !state) {
    return res.status(400).send('Missing code or state');
  }

  try {
    const stateExists = await commandClient.get(`oidc:state:${state}`);
    if (!stateExists) {
      return res.status(400).send('Invalid or expired state');
    }
    await commandClient.del(`oidc:state:${state}`);

    const config = await getOidcConfig();

    const tokenResponse = await fetch(config.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
        console.error('Token fetch error:', tokenData);
        return res.status(400).send('Failed to exchange token');
    }

    const { id_token } = tokenData;
    
    const payloadBase64Url = id_token.split('.')[1];
    const payloadBase64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);

    const { sub, email, name, picture } = payload;
    
    const sessionId = uuidv4();
    const sessionData = JSON.stringify({ sub, email, name, picture });
    
    await commandClient.set(`session:${sessionId}`, sessionData, 'EX', 24 * 60 * 60);

    setSignedCookie(res, process.env.COOKIE_NAME, sessionId, process.env.SESSION_SECRET);

    res.redirect('/');
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).send('Authentication callback failed');
  }
});

authRoutes.get('/logout', async (req, res) => {
  const sessionId = getSignedCookie(req, process.env.COOKIE_NAME, process.env.SESSION_SECRET);
  if (sessionId) {
    await commandClient.del(`session:${sessionId}`);
  }
  res.clearCookie(process.env.COOKIE_NAME);
  res.redirect('/');
});

async function sessionMiddleware(req, res, next) {
  const sessionId = getSignedCookie(req, process.env.COOKIE_NAME, process.env.SESSION_SECRET);
  req.user = null;

  if (sessionId) {
    const sessionData = await commandClient.get(`session:${sessionId}`);
    if (sessionData) {
      try {
        req.user = JSON.parse(sessionData);
      } catch (e) {
        console.error('Failed to parse session:', e);
      }
    }
  }
  
  next();
}

module.exports = {
  authRoutes,
  sessionMiddleware,
  getSignedCookieFromHeader
};
