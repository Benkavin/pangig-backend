const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

// ── SUBMIT REVIEW BY CONTRACTOR EMAIL ────────────
router.post('/by-email', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ error: 'Only clients can submit reviews' });
    }
    const { contractor_email, rating, comment } = req.body;
    if (!contractor_email || !rating) {
      return res.status(400).json({ error: 'contractor_email and rating are required' });
    }
    // Find contractor by email
    const { data: contractor } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('email', contractor_email.toLowerCase())
      .eq('role', 'contractor')
      .single();
    if (!contractor) {
      return res.status(404).json({ error: 'No contractor found with that email address' });
    }
    // Get client name
    const { data: client } = await supabase
      .from('users')
      .select('name')
      .eq('id', req.user.id)
      .single();
    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        contractor_id: contractor.id,
        client_id: req.user.id,
        client_name: client?.name || 'Anonymous',
        rating: parseInt(rating),
        comment: comment || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    // Update contractor average rating
    const { data: reviews } = await supabase
      .from('reviews').select('rating').eq('contractor_id', contractor.id);
    if (reviews?.length) {
      const avg = reviews.reduce((a, b) => a + b.rating, 0) / reviews.length;
      await supabase.from('users')
        .update({ avg_rating: parseFloat(avg.toFixed(2)), review_count: reviews.length })
        .eq('id', contractor.id);
    }
    res.status(201).json({ review });
  } catch (err) {
    console.error('Review by email error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── SUBMIT A REVIEW BY CONTRACTOR ID ─────────────
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ error: 'Only clients can submit reviews' });
    }
    const { contractor_id, rating, comment } = req.body;
    if (!contractor_id || !rating) {
      return res.status(400).json({ error: 'contractor_id and rating are required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Get client name
    const { data: client } = await supabase
      .from('users')
      .select('name')
      .eq('id', req.user.id)
      .single();

    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        contractor_id,
        client_id: req.user.id,
        client_name: client?.name || 'Anonymous',
        rating: parseInt(rating),
        comment: comment || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update contractor's average rating
    const { data: reviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('contractor_id', contractor_id);

    if (reviews?.length) {
      const avg = reviews.reduce((a, b) => a + b.rating, 0) / reviews.length;
      await supabase
        .from('users')
        .update({ avg_rating: parseFloat(avg.toFixed(2)), review_count: reviews.length })
        .eq('id', contractor_id);
    }

    res.status(201).json({ review });
  } catch (err) {
    console.error('Review error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET REVIEWS FOR A CONTRACTOR ─────────────────
router.get('/contractor/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('contractor_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ reviews: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
