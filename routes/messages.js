const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

// ── GET MESSAGES FOR A JOB/CONVERSATION ──────────
router.get('/:jobId/:otherUserId', authMiddleware, async (req, res) => {
  try {
    const { jobId, otherUserId } = req.params;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('job_id', jobId)
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ messages: data || [] });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── SEND A MESSAGE ────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { job_id, recipient_id, content } = req.body;
    if (!job_id || !recipient_id || !content?.trim()) {
      return res.status(400).json({ error: 'job_id, recipient_id and content are required' });
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        job_id,
        sender_id: req.user.id,
        recipient_id,
        content: content.trim(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: data });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
