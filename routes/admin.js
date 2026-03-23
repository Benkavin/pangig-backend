const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(authMiddleware, adminOnly);

// ── OVERVIEW STATS ───────────────────────────────
router.get('/overview', async (req, res) => {
  try {
    const [users, jobs, transactions] = await Promise.all([
      supabase.from('users').select('id, role, created_at'),
      supabase.from('jobs').select('id, status, unlocked_by, created_at'),
      supabase.from('credit_transactions').select('credits, amount_paid, payment_method, created_at')
    ]);

    const contractors = (users.data || []).filter(u => u.role === 'contractor');
    const clients = (users.data || []).filter(u => u.role === 'client');
    const revenue = (transactions.data || [])
      .filter(t => t.amount_paid)
      .reduce((sum, t) => sum + (t.amount_paid || 0), 0);

    res.json({
      total_contractors: contractors.length,
      total_clients: clients.length,
      total_jobs: (jobs.data || []).length,
      total_revenue: revenue.toFixed(2),
      total_unlocks: (jobs.data || []).reduce((sum, j) => sum + (j.unlocked_by?.length || 0), 0),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── ALL USERS ────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, phone, location, services, credits, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ users: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── ALL JOBS ─────────────────────────────────────
router.get('/jobs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ jobs: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── ALL TRANSACTIONS ─────────────────────────────
router.get('/transactions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*, users(name, email)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ transactions: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET PRICING ──────────────────────────────────
router.get('/pricing', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pricing')
      .select('*')
      .order('service_id');
    if (error) throw error;
    res.json({ pricing: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── UPDATE PRICING ───────────────────────────────
router.put('/pricing/:service_id', async (req, res) => {
  try {
    const { credits } = req.body;
    if (!credits || isNaN(credits)) {
      return res.status(400).json({ error: 'Valid credits value required' });
    }
    const { data, error } = await supabase
      .from('pricing')
      .upsert({ service_id: req.params.service_id, credits: parseInt(credits) })
      .select()
      .single();
    if (error) throw error;
    res.json({ pricing: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── SUSPEND / ACTIVATE USER ──────────────────────
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or suspended' });
    }
    const { data, error } = await supabase
      .from('users')
      .update({ status })
      .eq('id', req.params.id)
      .select('id, name, email, status')
      .single();
    if (error) throw error;
    res.json({ user: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
