const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');
const { authMiddleware, contractorOnly } = require('../middleware/auth');
const { sendEmail } = require('../config/email');

const CREDIT_PACKAGES = [
  { id: 'starter', credits: 10, price_usd: 15, label: 'Starter' },
  { id: 'pro',     credits: 50, price_usd: 60, label: 'Pro' },
  { id: 'elite',   credits: 100, price_usd: 100, label: 'Elite' },
];

// ── GET CREDIT PACKAGES ──────────────────────────
router.get('/packages', (req, res) => {
  res.json({ packages: CREDIT_PACKAGES });
});

// ── CREATE PAYMENT INTENT (in-app card payment) ──
router.post('/stripe/payment-intent', authMiddleware, contractorOnly, async (req, res) => {
  try {
    const { package_id } = req.body;
    const pkg = CREDIT_PACKAGES.find(p => p.id === package_id);
    if (!pkg) return res.status(400).json({ error: 'Invalid package' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: (pkg.price_usd || pkg.price) * 100, // cents
      currency: 'usd',
      metadata: {
        user_id: req.user.id,
        package_id: pkg.id,
        credits: pkg.credits.toString(),
        package_name: pkg.label
      },
      description: `Pangig ${pkg.label} — ${pkg.credits} credits`,
    });

    res.json({
      client_secret: paymentIntent.client_secret,
      amount: pkg.price_usd || pkg.price,
      credits: pkg.credits,
      package_name: pkg.label
    });
  } catch (err) {
    console.error('Payment intent error:', err);
    res.status(500).json({ error: 'Could not initialize payment. Please try again.' });
  }
});

// ── CONFIRM PAYMENT & ADD CREDITS ─────────────────
router.post('/stripe/confirm', authMiddleware, contractorOnly, async (req, res) => {
  try {
    const { payment_intent_id, package_id } = req.body;
    const pkg = CREDIT_PACKAGES.find(p => p.id === package_id);
    if (!pkg) return res.status(400).json({ error: 'Invalid package' });

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed. Please try again.' });
    }

    // Check not already processed
    const { data: existing } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('stripe_payment_intent_id', payment_intent_id)
      .single();
    if (existing) {
      return res.status(400).json({ error: 'This payment has already been processed.' });
    }

    // Get current user credits
    const { data: user } = await supabase
      .from('users')
      .select('credits, name, email')
      .eq('id', req.user.id)
      .single();

    const newCredits = (user.credits || 0) + pkg.credits;

    // Add credits
    await supabase.from('users')
      .update({ credits: newCredits })
      .eq('id', req.user.id);

    // Log transaction
    await supabase.from('credit_transactions').insert({
      user_id: req.user.id,
      type: 'purchase',
      credits: pkg.credits,
      amount_paid: pkg.price_usd || pkg.price,
      description: `${pkg.label} package — ${pkg.credits} credits`,
      stripe_payment_intent_id: payment_intent_id,
      payment_method: 'stripe',
      created_at: new Date().toISOString()
    });

    // Notify admin
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
    if (adminEmail) {
      sendEmail(adminEmail, 'adminNewPayment', {
        userName: user.name,
        packageName: pkg.label,
        credits: pkg.credits,
        amountPaid: pkg.price_usd || pkg.price,
        paymentMethod: 'Stripe'
      });
    }

    console.log(`[Payment] ${user.name} purchased ${pkg.credits} credits ($${pkg.price_usd})`);
    res.json({ success: true, new_balance: newCredits, credits_added: pkg.credits });

  } catch (err) {
    console.error('Confirm payment error:', err);
    res.status(500).json({ error: 'Could not confirm payment.' });
  }
});

// ══════════════════════════════════════════════════
// STRIPE CHECKOUT
// ══════════════════════════════════════════════════
router.post('/stripe/create-checkout', authMiddleware, contractorOnly, async (req, res) => {
  try {
    const { package_id } = req.body;
    const pkg = CREDIT_PACKAGES.find(p => p.id === package_id);
    if (!pkg) return res.status(400).json({ error: 'Invalid package' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Pangig ${pkg.label} Credits`,
            description: `${pkg.credits} credits for unlocking contractor leads`,
          },
          unit_amount: (pkg.price_usd || pkg.price) * 100, // cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}?payment=success&credits=${pkg.credits}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}?payment=cancelled`,
      metadata: {
        user_id: req.user.id,
        package_id: pkg.id,
        credits: pkg.credits.toString(),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: 'Could not create checkout session' });
  }
});

// ── STRIPE WEBHOOK ───────────────────────────────
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { user_id, package_id, credits } = session.metadata;
    const creditsToAdd = parseInt(credits);
    const amountPaid = (session.amount_total / 100).toFixed(2);

    try {
      // Get current user
      const { data: user } = await supabase
        .from('users')
        .select('credits, name, email')
        .eq('id', user_id)
        .single();

      // Add credits
      await supabase
        .from('users')
        .update({ credits: (user?.credits || 0) + creditsToAdd })
        .eq('id', user_id);

      // Record purchase
      await supabase.from('credit_transactions').insert({
        user_id,
        action: `Purchased ${package_id} pack via Stripe`,
        credits: creditsToAdd,
        amount_paid: amountPaid,
        currency: 'usd',
        payment_method: 'stripe',
        stripe_session_id: session.id,
        created_at: new Date().toISOString()
      });

      // Email contractor confirmation (non-blocking)
      if (user?.email) {
        sendEmail(user.email, 'creditsPurchased', {
          name: user.name || 'there',
          packageName: package_id.charAt(0).toUpperCase() + package_id.slice(1),
          credits: creditsToAdd,
          amountPaid
        });
      }

      // Email admin about payment (non-blocking)
      if (process.env.ADMIN_EMAIL) {
        sendEmail(process.env.ADMIN_EMAIL, 'adminNewPayment', {
          userName: user?.name || 'Unknown',
          packageName: package_id,
          credits: creditsToAdd,
          amountPaid,
          paymentMethod: 'Stripe'
        });
      }

      console.log(`Credits added: ${creditsToAdd} for user ${user_id}`);
    } catch (err) {
      console.error('Error updating credits after Stripe payment:', err);
    }
  }

  res.json({ received: true });
});

// ══════════════════════════════════════════════════
// PAYSTACK (for Nigeria, Ghana, Kenya etc.)
// ══════════════════════════════════════════════════
router.post('/paystack/initialize', authMiddleware, contractorOnly, async (req, res) => {
  try {
    const { package_id, email } = req.body;
    const pkg = CREDIT_PACKAGES.find(p => p.id === package_id);
    if (!pkg) return res.status(400).json({ error: 'Invalid package' });

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email || req.user.email,
        amount: pkg.price_usd * 100, // Paystack uses kobo/cents
        currency: 'USD',
        callback_url: `${process.env.FRONTEND_URL}/payment-success`,
        metadata: {
          user_id: req.user.id,
          package_id: pkg.id,
          credits: pkg.credits,
          custom_fields: [
            { display_name: 'Package', variable_name: 'package', value: pkg.label }
          ]
        }
      })
    });

    const data = await response.json();
    if (!data.status) return res.status(400).json({ error: data.message });

    res.json({ url: data.data.authorization_url, reference: data.data.reference });
  } catch (err) {
    console.error('Paystack init error:', err);
    res.status(500).json({ error: 'Could not initialize Paystack payment' });
  }
});

// ── PAYSTACK WEBHOOK ─────────────────────────────
router.post('/paystack/webhook', express.json(), async (req, res) => {
  const crypto = require('crypto');
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  if (event.event === 'charge.success') {
    const { user_id, package_id, credits } = event.data.metadata;
    const creditsToAdd = parseInt(credits);

    try {
      const { data: user } = await supabase
        .from('users')
        .select('credits')
        .eq('id', user_id)
        .single();

      await supabase
        .from('users')
        .update({ credits: (user?.credits || 0) + creditsToAdd })
        .eq('id', user_id);

      await supabase.from('credit_transactions').insert({
        user_id,
        action: `Purchased ${package_id} pack via Paystack`,
        credits: creditsToAdd,
        amount_paid: event.data.amount / 100,
        currency: event.data.currency,
        payment_method: 'paystack',
        paystack_reference: event.data.reference,
        created_at: new Date().toISOString()
      });

      console.log(`Paystack credits added: ${creditsToAdd} for user ${user_id}`);
    } catch (err) {
      console.error('Error updating credits after Paystack payment:', err);
    }
  }

  res.json({ received: true });
});

// ── VERIFY PAYSTACK PAYMENT ──────────────────────
router.get('/paystack/verify/:reference', authMiddleware, async (req, res) => {
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${req.params.reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
