require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ── TRUST PROXY (required for Railway / reverse proxies) ──
app.set('trust proxy', 1);

// ── SECURITY ─────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const allowedOrigins = [
  'https://www.pangig.com',
  'https://pangig.com',
  'https://pangig.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'null' // allow file:// for local testing
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow any vercel.app subdomain
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

// Rate limiting — 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Stricter limit on auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please try again later.' }
});
app.use('/api/auth/', authLimiter);

// ── BODY PARSING ─────────────────────────────────
// Stripe webhook needs raw body — must come BEFORE express.json()
app.use('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// ── ROUTES ───────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/auth',     require('./routes/password'));
app.use('/api/jobs',     require('./routes/jobs'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/reviews',  require('./routes/reviews'));
app.use('/api/profile',  require('./routes/profile'));

// ── CONTACT FORM ──────────────────────────────────
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields required' });
    }
    const { sendEmail } = require('./config/email');

    // Send to info@pangig.com (the main inbox)
    // Also CC to admin notify email as backup
    const recipients = ['info@pangig.com'];
    const backupEmail = process.env.ADMIN_NOTIFY_EMAIL;
    if (backupEmail && backupEmail !== 'info@pangig.com') {
      recipients.push(backupEmail);
    }

    for (const recipient of recipients) {
      try {
        await sendEmail(recipient, 'contactForm', { name, email, subject, message });
        console.log(`[Contact] Email sent to ${recipient} from ${name} (${email})`);
      } catch(e) {
        console.error(`[Contact] Failed to send to ${recipient}:`, e.message);
      }
    }

    res.json({ success: true });
  } catch(err) {
    console.error('[Contact] Error:', err);
    res.status(500).json({ error: 'Could not send message. Please try again.' });
  }
});

// ── HEALTH CHECK ─────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Pangig API', timestamp: new Date().toISOString() });
});

// ── 404 ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── ERROR HANDLER ────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── START ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Pangig API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
