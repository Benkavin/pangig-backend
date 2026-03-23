const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ── CREATE INVOICE ───────────────────────────────
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'contractor') {
      return res.status(403).json({ error: 'Only contractors can create invoices' });
    }
    const { client_name, client_email, job_description, items } = req.body;
    if (!client_name || !items?.length) {
      return res.status(400).json({ error: 'client_name and items are required' });
    }

    const total = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * (parseInt(item.qty) || 1), 0);

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        contractor_id: req.user.id,
        client_name,
        client_email: client_email || null,
        job_description: job_description || null,
        items,
        total,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ invoice: data });
  } catch (err) {
    console.error('Create invoice error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET MY INVOICES ──────────────────────────────
router.get('/', async (req, res) => {
  try {
    let query = supabase.from('invoices').select('*').order('created_at', { ascending: false });
    if (req.user.role === 'contractor') query = query.eq('contractor_id', req.user.id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ invoices: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── MARK INVOICE PAID ────────────────────────────
router.patch('/:id/paid', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ invoice: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
