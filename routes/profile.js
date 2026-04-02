const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { sendEmail } = require('../config/email');

// ── UPDATE PROFILE ───────────────────────────────
router.put('/', authMiddleware, async (req, res) => {
  try {
    const {
      name, bio, phone, location, website, services, password,
      business_email, address, country, service_areas,
      years_experience, availability, logo_url, portfolio
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (bio !== undefined) updates.bio = bio;
    if (phone !== undefined) updates.phone = phone;
    if (location !== undefined) updates.location = location;
    if (website !== undefined) updates.website = website;
    if (services !== undefined) updates.services = services;
    if (business_email !== undefined) updates.business_email = business_email;
    if (address !== undefined) updates.address = address;
    if (country !== undefined) updates.country = country;
    if (service_areas !== undefined) updates.service_areas = service_areas;
    if (years_experience !== undefined) updates.years_experience = years_experience ? parseInt(years_experience) : null;
    if (availability !== undefined) updates.availability = availability;

    // Handle logo_url — warn if too large but still save
    if (logo_url !== undefined) {
      if (logo_url && logo_url.length > 1000000) {
        return res.status(400).json({ error: 'Profile photo is too large. Please use a smaller image (under 500KB).' });
      }
      updates.logo_url = logo_url;
    }

    // Handle portfolio — validate size
    if (portfolio !== undefined) {
      if (Array.isArray(portfolio)) {
        const totalSize = JSON.stringify(portfolio).length;
        if (totalSize > 4000000) {
          return res.status(400).json({ error: 'Portfolio photos are too large. Please use smaller images or fewer photos.' });
        }
        updates.portfolio = portfolio;
      }
    }

    // Allow password change
    if (password !== undefined && password.length >= 8) {
      const bcrypt = require('bcryptjs');
      updates.password = await bcrypt.hash(password, 12);
    }

    if (Object.keys(updates).length === 0) {
      return res.json({ user: req.user });
    }

    console.log('[Profile] Updating fields:', Object.keys(updates).filter(k => k !== 'logo_url' && k !== 'portfolio'));

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, name, email, role, phone, location, services, credits, bio, website, verified, verification_status, avg_rating, review_count, company_name, license_number, years_experience, business_email, address, country, service_areas, availability, logo_url, portfolio, created_at')
      .single();

    if (error) {
      console.error('[Profile] Supabase error:', error.message, error.code);
      if (error.code === '42703') {
        return res.status(500).json({ error: 'Database column missing. Please run the latest database migration in Supabase.' });
      }
      return res.status(500).json({ error: 'Could not save profile. Please try again.' });
    }

    res.json({ user });
  } catch (err) {
    console.error('[Profile] Server error:', err.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── SUBMIT VERIFICATION ──────────────────────────
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'contractor') {
      return res.status(403).json({ error: 'Only contractors can submit verification' });
    }
    const { company_name, license_number, years_experience } = req.body;
    if (!company_name || !license_number || !years_experience) {
      return res.status(400).json({ error: 'All verification fields are required' });
    }

    const { data: contractor } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', req.user.id)
      .single();

    const { error } = await supabase
      .from('users')
      .update({
        company_name,
        license_number,
        years_experience: parseInt(years_experience),
        verification_status: 'pending'
      })
      .eq('id', req.user.id);

    if (error) {
      console.error('[Verify] Error:', error.message);
      return res.status(500).json({ error: 'Could not submit verification. Please try again.' });
    }

    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
    if (adminEmail) {
      sendEmail(adminEmail, 'verificationRequest', {
        contractorName: contractor?.name || 'Unknown',
        contractorEmail: contractor?.email || req.user.email,
        companyName: company_name,
        licenseNumber: license_number,
        yearsExperience: years_experience
      });
    }

    res.json({ success: true, message: 'Verification submitted successfully' });
  } catch (err) {
    console.error('[Verify] Server error:', err.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── ADMIN: APPROVE / REJECT VERIFICATION ─────────
router.patch('/verify/:userId', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const { action } = req.body;
    const isApproved = action === 'approve';

    const { data: contractor } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', req.params.userId)
      .single();

    const { error } = await supabase
      .from('users')
      .update({
        verified: isApproved,
        verification_status: isApproved ? 'verified' : 'rejected'
      })
      .eq('id', req.params.userId);

    if (error) {
      console.error('[AdminVerify] Error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    if (contractor?.email) {
      sendEmail(contractor.email, isApproved ? 'verificationApproved' : 'verificationRejected', {
        name: contractor.name
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
