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
    if (logo_url !== undefined) updates.logo_url = logo_url;
    if (portfolio !== undefined) updates.portfolio = portfolio;

    // Allow password change
    if (password !== undefined && password.length >= 8) {
      const bcrypt = require('bcryptjs');
      updates.password = await bcrypt.hash(password, 12);
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, name, email, role, phone, location, services, credits, bio, website, verified, verification_status, avg_rating, review_count, company_name, license_number, years_experience, business_email, address, country, service_areas, availability, logo_url, portfolio')
      .single();

    if (error) throw error;
    res.json({ user });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Server error' });
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

    // Get contractor info
    const { data: contractor } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', req.user.id)
      .single();

    // Update user with verification data
    await supabase
      .from('users')
      .update({
        company_name,
        license_number,
        years_experience: parseInt(years_experience),
        verification_status: 'pending'
      })
      .eq('id', req.user.id);

    // Notify admin
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
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── ADMIN: APPROVE / REJECT VERIFICATION ─────────
router.patch('/verify/:userId', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const { action } = req.body; // 'approve' or 'reject'
    const isApproved = action === 'approve';

    const { data: contractor } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', req.params.userId)
      .single();

    await supabase
      .from('users')
      .update({
        verified: isApproved,
        verification_status: isApproved ? 'verified' : 'rejected'
      })
      .eq('id', req.params.userId);

    // Notify contractor
    if (contractor?.email) {
      sendEmail(contractor.email, isApproved ? 'verificationApproved' : 'verificationRejected', {
        name: contractor.name
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
