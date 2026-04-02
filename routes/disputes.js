const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { sendEmail } = require('../config/email');

// ── SUBMIT A DISPUTE ─────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { job_id, reason } = req.body;
    if (!job_id || !reason?.trim()) {
      return res.status(400).json({ error: 'job_id and reason are required' });
    }

    // Get job details
    const { data: job } = await supabase
      .from('jobs')
      .select('title, client_id')
      .eq('id', job_id)
      .single();

    // Get user details
    const { data: user } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', req.user.id)
      .single();

    const { data: dispute, error } = await supabase
      .from('disputes')
      .insert({
        job_id,
        filed_by: req.user.id,
        reason: reason.trim(),
        status: 'open',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Notify admin
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendEmail(adminEmail, 'disputeFiled', {
        userName: user?.name || 'Unknown',
        userEmail: user?.email || '',
        jobTitle: job?.title || 'Unknown Job',
        reason: reason.trim()
      });
    }

    res.status(201).json({ dispute, message: 'Dispute filed. Our team will review within 24 hours.' });
  } catch (err) {
    console.error('Dispute error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET ALL DISPUTES (Admin) ──────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { data, error } = await supabase
      .from('disputes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ disputes: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── RESOLVE A DISPUTE (Admin) ─────────────────────
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { resolution, status } = req.body;
    await supabase
      .from('disputes')
      .update({ status: status || 'resolved', resolution, resolved_at: new Date().toISOString() })
      .eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
