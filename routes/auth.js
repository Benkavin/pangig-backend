const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { sendEmail } = require('../config/email');

// ── SIGN UP ──────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, phone, role, service, location } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!['client', 'contractor'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if email exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        phone: phone || null,
        role,
        location: location || null,
        credits: 0,
        services: service ? [service] : [],
        created_at: new Date().toISOString()
      })
      .select('id, name, email, role, phone, location, services, credits')
      .single();

    if (error) throw error;

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Send welcome email (non-blocking)
    if (role === 'client') {
      sendEmail(user.email, 'clientWelcome', { name: user.name });
    } else {
      sendEmail(user.email, 'contractorWelcome', { name: user.name });
    }

    // Notify admin of new signup (non-blocking)
    if (process.env.ADMIN_EMAIL) {
      sendEmail(process.env.ADMIN_EMAIL, 'adminNewSignup', {
        userName: user.name,
        userEmail: user.email,
        userRole: role
      });
    }

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// ── LOGIN ────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check admin first (stored in env, not DB)
    if (email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase()) {
      const match = password === process.env.ADMIN_PASSWORD;
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign(
        { id: 'admin', email: process.env.ADMIN_EMAIL, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({
        user: { id: 'admin', name: 'Admin', email: process.env.ADMIN_EMAIL, role: 'admin' },
        token
      });
    }

    // Regular user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ── GET CURRENT USER ─────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.json({ user: { id: 'admin', name: 'Admin', email: req.user.email, role: 'admin' } });
    }
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, phone, location, services, credits, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
