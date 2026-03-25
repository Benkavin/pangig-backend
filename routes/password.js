const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { sendEmail } = require('../config/email');

const SITE = process.env.FRONTEND_URL || 'https://www.pangig.com';
const TOKEN_EXPIRY_HOURS = 2;

// ── FORGOT PASSWORD ──────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    // Always return success to prevent email enumeration
    res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });

    // Find user (async, non-blocking)
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('email', email.toLowerCase())
      .single();

    if (!user) return; // silently do nothing

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    // Store token in DB
    await supabase.from('password_resets').upsert({
      user_id: user.id,
      token,
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    // Send reset email
    const resetLink = `${SITE}?token=${token}&type=reset`;
    await sendEmail(user.email, 'passwordReset', {
      name: user.name,
      resetLink,
      expiryHours: TOKEN_EXPIRY_HOURS
    });

  } catch (err) {
    console.error('Forgot password error:', err);
    // Already sent success response above
  }
});

// ── RESET PASSWORD ───────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    // Find valid token
    const { data: reset, error } = await supabase
      .from('password_resets')
      .select('user_id, expires_at')
      .eq('token', token)
      .single();

    if (error || !reset) return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });

    // Check expiry
    if (new Date(reset.expires_at) < new Date()) {
      await supabase.from('password_resets').delete().eq('token', token);
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password
    await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', reset.user_id);

    // Delete used token
    await supabase.from('password_resets').delete().eq('token', token);

    res.json({ success: true, message: 'Password updated successfully.' });

  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

module.exports = router;
