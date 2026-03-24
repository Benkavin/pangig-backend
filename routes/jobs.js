const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware, contractorOnly } = require('../middleware/auth');
const { sendEmail } = require('../config/email');

// ── GET ALL JOBS (contractors see all, clients see own) ──
router.get('/', authMiddleware, async (req, res) => {
  try {
    let query = supabase.from('jobs').select('*').order('created_at', { ascending: false });

    if (req.user.role === 'client') {
      query = query.eq('client_id', req.user.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Hide client contact info from contractors unless they've unlocked
    if (req.user.role === 'contractor') {
      const sanitized = data.map(job => {
        const unlocked = (job.unlocked_by || []).includes(req.user.id);
        return {
          ...job,
          client_email: unlocked ? job.client_email : null,
          client_phone: unlocked ? job.client_phone : null,
          is_unlocked: unlocked,
          is_full: (job.unlocked_by || []).length >= 7
        };
      });
      return res.json({ jobs: sanitized });
    }

    res.json({ jobs: data });
  } catch (err) {
    console.error('Get jobs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST A JOB (clients only) ────────────────────
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ error: 'Only clients can post jobs' });
    }

    const { type, title, description, location, budget } = req.body;
    if (!type || !title || !description) {
      return res.status(400).json({ error: 'type, title and description are required' });
    }

    // Get client contact info
    const { data: client } = await supabase
      .from('users')
      .select('email, phone')
      .eq('id', req.user.id)
      .single();

    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        type,
        title,
        description,
        location: location || null,
        budget: budget || null,
        client_id: req.user.id,
        client_email: client?.email,
        client_phone: client?.phone,
        unlocked_by: [],
        status: 'open',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Send job posted confirmation to client (non-blocking)
    if (client?.email) {
      sendEmail(client.email, 'jobPosted', {
        name: req.user.name || 'there',
        jobTitle: title,
        jobType: type,
        location: location || null,
        budget: budget || null
      });
    }

    // Notify contractors whose services match this job type (non-blocking)
    supabase
      .from('users')
      .select('name, email, services')
      .eq('role', 'contractor')
      .then(({ data: contractors }) => {
        if (!contractors) return;
        const matched = contractors.filter(c => (c.services || []).includes(type));
        matched.forEach(c => {
          sendEmail(c.email, 'newJobAlert', {
            contractorName: c.name,
            jobTitle: title,
            jobType: type,
            location: location || null,
            budget: budget || null,
            jobCount: 1
          });
        });
      });

    res.status(201).json({ job });
  } catch (err) {
    console.error('Post job error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── UNLOCK A LEAD (contractors only) ────────────
router.post('/:id/unlock', authMiddleware, contractorOnly, async (req, res) => {
  try {
    const jobId = req.params.id;

    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) return res.status(404).json({ error: 'Job not found' });
    if ((job.unlocked_by || []).includes(req.user.id)) {
      return res.status(400).json({ error: 'Already unlocked' });
    }
    if ((job.unlocked_by || []).length >= 7) {
      return res.status(400).json({ error: 'Lead is full (7/7)' });
    }

    // Get job type credit cost
    const { data: pricing } = await supabase
      .from('pricing')
      .select('credits')
      .eq('service_id', job.type)
      .single();

    const cost = pricing?.credits || 5;

    // Get contractor credits
    const { data: contractor } = await supabase
      .from('users')
      .select('credits')
      .eq('id', req.user.id)
      .single();

    if ((contractor?.credits || 0) < cost) {
      return res.status(400).json({ error: 'Not enough credits' });
    }

    // Deduct credits
    await supabase
      .from('users')
      .update({ credits: contractor.credits - cost })
      .eq('id', req.user.id);

    // Add contractor to unlocked_by
    const newUnlocked = [...(job.unlocked_by || []), req.user.id];
    await supabase
      .from('jobs')
      .update({ unlocked_by: newUnlocked })
      .eq('id', jobId);

    // Record transaction
    await supabase.from('credit_transactions').insert({
      user_id: req.user.id,
      action: `Unlocked Lead: ${job.title}`,
      credits: -cost,
      created_at: new Date().toISOString()
    });

    // Notify client that a contractor unlocked their lead (non-blocking)
    if (job.client_email) {
      // Get contractor name
      supabase.from('users').select('name').eq('id', req.user.id).single()
        .then(({ data: con }) => {
          sendEmail(job.client_email, 'leadUnlocked', {
            clientName: 'there',
            contractorName: con?.name || 'A contractor',
            jobTitle: job.title
          });
        });
    }

    res.json({
      success: true,
      client_email: job.client_email,
      client_phone: job.client_phone,
      credits_remaining: contractor.credits - cost
    });
  } catch (err) {
    console.error('Unlock error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
