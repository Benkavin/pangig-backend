const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

// ── REDEEM A PROMO CODE (Contractor) ─────────────
router.post('/redeem', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'contractor') {
      return res.status(403).json({ error: 'Only contractors can redeem promo codes' });
    }
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    // Find the code
    const { data: promo, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .single();

    if (error || !promo) {
      return res.status(400).json({ error: 'Invalid promo code. Please check and try again.' });
    }

    // Check if already used
    if (promo.used_by) {
      return res.status(400).json({ error: 'This code has already been used.' });
    }

    // Check expiry
    if (new Date(promo.expiry_date) < new Date()) {
      return res.status(400).json({ error: 'This promo code has expired.' });
    }

    // Check if this contractor already used a promo code
    const { data: existing } = await supabase
      .from('promo_codes')
      .select('id')
      .eq('used_by', req.user.id)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'You have already redeemed a promo code. Only one per account.' });
    }

    // Get contractor info
    const { data: contractor } = await supabase
      .from('users')
      .select('name, credits')
      .eq('id', req.user.id)
      .single();

    const newBalance = (contractor.credits || 0) + promo.credits;

    // Mark code as used and add credits atomically
    await supabase
      .from('promo_codes')
      .update({
        used_by: req.user.id,
        used_by_name: contractor.name,
        used_at: new Date().toISOString()
      })
      .eq('id', promo.id);

    await supabase
      .from('users')
      .update({ credits: newBalance })
      .eq('id', req.user.id);

    // Log credit transaction
    await supabase.from('credit_transactions').insert({
      user_id: req.user.id,
      type: 'promo',
      credits: promo.credits,
      description: `Promo code redeemed: ${code}`,
      created_at: new Date().toISOString()
    });

    res.json({
      success: true,
      credits_added: promo.credits,
      new_balance: newBalance,
      message: `${promo.credits} free credits added to your account!`
    });

  } catch (err) {
    console.error('Promo redeem error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

module.exports = router;
