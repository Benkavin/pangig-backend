const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { sendEmail } = require('../config/email');

const SITE = process.env.FRONTEND_URL || 'https://www.pangig.com';
const TOKEN_EXPIRY_HOURS = 24; // increased to 24 hours

// ── FORGOT PASSWORD ──────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    // Always return success to prevent email enumeration
    res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });

    // Find user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (userError || !user) {
      console.log('[Password Reset] No user found for:', email);
      return;
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    // Delete any existing token for this user first
    await supabase
      .from('password_resets')
      .delete()
      .eq('user_id', user.id);

    // Insert fresh token
    const { error: insertError } = await supabase
      .from('password_resets')
      .insert({
        user_id: user.id,
        token,
        expires_at: expiresAt,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('[Password Reset] Failed to save token:', insertError);
      return;
    }

    console.log('[Password Reset] Token saved for user:', user.email);

    // Send reset email
    const resetLink = `${SITE}?token=${token}&type=reset`;
    await sendEmail(user.email, 'passwordReset', {
      name: user.name,
      resetLink,
      expiryHours: TOKEN_EXPIRY_HOURS
    });

    console.log('[Password Reset] Email sent to:', user.email);

  } catch (err) {
    console.error('[Password Reset] Error:', err);
  }
});

// ── RESET PASSWORD ───────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    console.log('[Reset Password] Attempt with token:', token ? token.substring(0, 10) + '...' : 'none');

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Find token - no expiry check yet, just find it first
    const { data: reset, error } = await supabase
      .from('password_resets')
      .select('id, user_id, expires_at, token')
      .eq('token', token.trim())
      .single();

    console.log('[Reset Password] Token lookup result:', reset ? 'found' : 'not found', error ? error.message : '');

    if (error || !reset) {
      return res.status(400).json({ 
        error: 'Invalid reset link. Please request a new password reset.' 
      });
    }

    // Now check expiry
    const now = new Date();
    const expiry = new Date(reset.expires_at);
    console.log('[Reset Password] Token expiry:', expiry.toISOString(), 'Now:', now.toISOString(), 'Expired:', expiry < now);

    if (expiry < now) {
      await supabase.from('password_resets').delete().eq('id', reset.id);
      return res.status(400).json({ 
        error: 'Reset link has expired. Please request a new one — links are valid for 24 hours.' 
      });
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(password, 12);

    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', reset.user_id);

    if (updateError) {
      console.error('[Reset Password] Failed to update password:', updateError);
      return res.status(500).json({ error: 'Could not update password. Please try again.' });
    }

    // Delete used token
    await supabase.from('password_resets').delete().eq('id', reset.id);

    console.log('[Reset Password] Password updated successfully for user:', reset.user_id);
    res.json({ success: true, message: 'Password updated successfully. You can now sign in.' });

  } catch (err) {
    console.error('[Reset Password] Server error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

module.exports = router;
