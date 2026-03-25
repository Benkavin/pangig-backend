// ══════════════════════════════════════════════
// PANGIG EMAIL SERVICE — powered by Resend
// ══════════════════════════════════════════════

// Send from verified Resend domain until pangig.com DNS is set up
const FROM = process.env.EMAIL_VERIFIED === 'true'
  ? 'Pangig <notifications@pangig.com>'
  : 'Pangig <onboarding@resend.dev>';
const SITE = process.env.FRONTEND_URL || 'https://www.pangig.com';

// ── Base HTML wrapper ─────────────────────────
function baseTemplate(content) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Pangig</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'DM Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <!-- Header -->
      <tr>
        <td style="background:#0a0c10;padding:28px 40px;border-radius:14px 14px 0 0;text-align:center;">
          <span style="font-family:Arial,sans-serif;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-1px;">Pan<span style="color:#f4a623;">gig</span></span>
          <div style="font-size:11px;color:#7a8499;letter-spacing:2px;margin-top:4px;text-transform:uppercase;">Global Contractor Marketplace</div>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="background:#ffffff;padding:40px;border-radius:0 0 14px 14px;">
          ${content}
          <!-- Footer -->
          <div style="margin-top:40px;padding-top:24px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="font-size:12px;color:#9ca3af;margin:0;">You're receiving this because you have an account on <a href="${SITE}" style="color:#f4a623;text-decoration:none;">Pangig</a>.</p>
            <p style="font-size:12px;color:#9ca3af;margin:8px 0 0;">&copy; ${new Date().getFullYear()} Pangig. All rights reserved.</p>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function btn(text, url) {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${url}" style="background:#f4a623;color:#000000;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;display:inline-block;">${text}</a>
  </div>`;
}

function h1(text) {
  return `<h1 style="font-size:24px;font-weight:800;color:#0a0c10;margin:0 0 8px;">${text}</h1>`;
}

function p(text) {
  return `<p style="font-size:15px;color:#374151;line-height:1.7;margin:12px 0;">${text}</p>`;
}

function highlight(label, value) {
  return `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:12px 0;display:flex;justify-content:space-between;">
    <span style="font-size:13px;color:#6b7280;">${label}</span>
    <span style="font-size:13px;font-weight:700;color:#0a0c10;">${value}</span>
  </div>`;
}

// ══════════════════════════════════════════════
// EMAIL TEMPLATES
// ══════════════════════════════════════════════

const templates = {

  // ── Client Welcome ─────────────────────────
  clientWelcome: ({ name }) => ({
    subject: 'Welcome to Pangig — Post your first job today',
    html: baseTemplate(`
      ${h1(`Welcome to Pangig, ${name.split(' ')[0]}! 👋`)}
      ${p('You\'re now part of the global contractor marketplace. Finding trusted professionals for any job has never been easier.')}
      ${p('Here\'s how it works:')}
      <ul style="font-size:15px;color:#374151;line-height:2;padding-left:20px;">
        <li>Post your job for free — takes under 2 minutes</li>
        <li>Up to 7 verified contractors will reach out to you</li>
        <li>Compare quotes and hire with confidence</li>
        <li>Pay securely through the platform</li>
      </ul>
      ${btn('Post Your First Job', `${SITE}`)}
      ${p('If you have any questions, just reply to this email. We\'re here to help.')}
    `)
  }),

  // ── Contractor Welcome ─────────────────────
  contractorWelcome: ({ name }) => ({
    subject: 'Welcome to Pangig — Start finding leads today',
    html: baseTemplate(`
      ${h1(`Welcome to Pangig, ${name.split(' ')[0]}! 🎉`)}
      ${p('Your contractor account is ready. You now have access to a global marketplace of clients actively looking for professionals like you.')}
      ${p('Here\'s how to get started:')}
      <ul style="font-size:15px;color:#374151;line-height:2;padding-left:20px;">
        <li>Buy credits to unlock client leads</li>
        <li>Browse jobs that match your services</li>
        <li>Contact clients directly once you unlock a lead</li>
        <li>Use the built-in invoicing tool to get paid</li>
      </ul>
      <div style="background:#fffbeb;border:1px solid #f4a623;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;font-size:14px;color:#92400e;"><strong>💡 Tip:</strong> Only 7 contractors can unlock each lead — act fast when you see a job that matches your skills.</p>
      </div>
      ${btn('Browse Available Leads', `${SITE}`)}
    `)
  }),

  // ── Job Posted ─────────────────────────────
  jobPosted: ({ name, jobTitle, jobType, location, budget }) => ({
    subject: `Your job "${jobTitle}" has been posted on Pangig`,
    html: baseTemplate(`
      ${h1('Your job is live! 🚀')}
      ${p(`Hi ${name.split(' ')[0]}, your job has been successfully posted and contractors in your area are already being notified.`)}
      ${highlight('Job Title', jobTitle)}
      ${highlight('Service Type', jobType)}
      ${location ? highlight('Location', location) : ''}
      ${budget ? highlight('Budget', budget) : ''}
      ${p('Up to <strong>7 qualified contractors</strong> can unlock your contact details and reach out to you. You\'ll hear from them soon!')}
      <div style="background:#f0fdf4;border:1px solid #22c55e;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;font-size:14px;color:#166534;"><strong>✅ What happens next?</strong> Contractors who are interested will unlock your job and contact you directly. Compare their quotes and choose the best fit.</p>
      </div>
      ${btn('View My Job', `${SITE}`)}
    `)
  }),

  // ── Lead Unlocked (Client notification) ────
  leadUnlocked: ({ clientName, contractorName, jobTitle }) => ({
    subject: `A contractor is interested in your job — ${jobTitle}`,
    html: baseTemplate(`
      ${h1('A contractor wants to help! 🔔')}
      ${p(`Hi ${clientName.split(' ')[0]}, great news — <strong>${contractorName}</strong> has unlocked your job listing and will be reaching out to you soon.`)}
      ${highlight('Job', jobTitle)}
      ${highlight('Contractor', contractorName)}
      ${p('They have your contact information and will be in touch shortly. Feel free to reach out to them directly as well.')}
      <div style="background:#fffbeb;border:1px solid #f4a623;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;font-size:14px;color:#92400e;"><strong>💡 Remember:</strong> Up to 7 contractors can unlock your job. The more who do, the more quotes you can compare.</p>
      </div>
      ${btn('View My Jobs', `${SITE}`)}
    `)
  }),

  // ── Credits Purchased ──────────────────────
  creditsPurchased: ({ name, packageName, credits, amountPaid }) => ({
    subject: `${credits} credits added to your Pangig account`,
    html: baseTemplate(`
      ${h1('Payment successful! ✅')}
      ${p(`Hi ${name.split(' ')[0]}, your credit purchase was successful. Your credits have been added to your account and you can start unlocking leads right now.`)}
      ${highlight('Package', packageName)}
      ${highlight('Credits Added', `${credits} credits`)}
      ${highlight('Amount Paid', `$${amountPaid}`)}
      ${p('Your credits never expire — use them whenever you find the right lead.')}
      ${btn('Browse Leads Now', `${SITE}`)}
    `)
  }),

  // ── New Job Alert (Contractor notification) ─
  newJobAlert: ({ contractorName, jobTitle, jobType, location, budget, jobCount }) => ({
    subject: `New lead available: ${jobTitle}`,
    html: baseTemplate(`
      ${h1('New job matching your services! 🔍')}
      ${p(`Hi ${contractorName.split(' ')[0]}, a new job has been posted that matches your services. Be quick — only 7 contractors can unlock each lead.`)}
      ${highlight('Job Title', jobTitle)}
      ${highlight('Service Type', jobType)}
      ${location ? highlight('Location', location) : ''}
      ${budget ? highlight('Budget', budget) : ''}
      <div style="background:#fff1f2;border:1px solid #ef4444;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;font-size:14px;color:#991b1b;"><strong>⚡ Act fast!</strong> There ${jobCount===1?'is 1 lead':'are '+jobCount+' leads'} available right now. First 7 contractors to unlock win the lead.</p>
      </div>
      ${btn('Unlock This Lead', `${SITE}`)}
    `)
  }),

  // ── Admin New Signup ───────────────────────
  adminNewSignup: ({ userName, userEmail, userRole }) => ({
    subject: `New ${userRole} signup: ${userName}`,
    html: baseTemplate(`
      ${h1(`New ${userRole} signed up 👤`)}
      ${highlight('Name', userName)}
      ${highlight('Email', userEmail)}
      ${highlight('Role', userRole.charAt(0).toUpperCase() + userRole.slice(1))}
      ${highlight('Time', new Date().toLocaleString())}
      ${btn('View in Admin Panel', `${SITE}`)}
    `)
  }),

  // ── Admin New Payment ──────────────────────
  adminNewPayment: ({ userName, packageName, credits, amountPaid, paymentMethod }) => ({
    subject: `New payment received: $${amountPaid} from ${userName}`,
    html: baseTemplate(`
      ${h1('New payment received 💰')}
      ${highlight('From', userName)}
      ${highlight('Package', packageName)}
      ${highlight('Credits', `${credits} credits`)}
      ${highlight('Amount', `$${amountPaid}`)}
      ${highlight('Method', paymentMethod)}
      ${highlight('Time', new Date().toLocaleString())}
      ${btn('View Transactions', `${SITE}`)}
    `)
  }),

  // ── Verification Request (Admin) ──────────
  verificationRequest: ({ contractorName, contractorEmail, companyName, licenseNumber, yearsExperience }) => ({
    subject: `Verification request: ${contractorName} — ${companyName}`,
    html: baseTemplate(`
      ${h1('New verification request 🛡️')}
      ${highlight('Contractor', contractorName)}
      ${highlight('Email', contractorEmail)}
      ${highlight('Company', companyName)}
      ${highlight('License #', licenseNumber)}
      ${highlight('Years Experience', yearsExperience + ' years')}
      ${highlight('Time', new Date().toLocaleString())}
      <div style="display:flex;gap:12px;margin-top:20px;">
        <a href="${SITE}" style="background:#22c55e;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">✅ Approve</a>
        <a href="${SITE}" style="background:#ef4444;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">❌ Reject</a>
      </div>
      ${p('Log into the admin panel to approve or reject this verification request.')}
    `)
  }),

  // ── Verification Approved ──────────────────
  verificationApproved: ({ name }) => ({
    subject: 'Your Pangig account is now verified! ✅',
    html: baseTemplate(`
      ${h1('You\'re verified! 🎉')}
      ${p(`Congratulations ${name.split(' ')[0]}! Your contractor account has been verified on Pangig.`)}
      <div style="background:#f0fdf4;border:1px solid #22c55e;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
        <div style="font-size:2rem">✅</div>
        <div style="font-size:16px;font-weight:700;color:#166534;margin-top:8px;">Verified Contractor</div>
        <div style="font-size:13px;color:#166534;margin-top:4px;">Your profile now shows a verified badge</div>
      </div>
      ${p('Your profile now displays a verified badge on all your lead listings. Verified contractors receive significantly more responses from clients.')}
      ${btn('Browse Leads Now', SITE)}
    `)
  }),

  // ── Verification Rejected ─────────────────
  verificationRejected: ({ name }) => ({
    subject: 'Pangig verification update',
    html: baseTemplate(`
      ${h1('Verification update')}
      ${p(`Hi ${name.split(' ')[0]}, unfortunately we were unable to verify your account with the information provided.`)}
      ${p('This may be because:')}
      <ul style="font-size:15px;color:#374151;line-height:2;padding-left:20px;">
        <li>The license number could not be verified</li>
        <li>The uploaded document was unclear or invalid</li>
        <li>The business name did not match our records</li>
      </ul>
      ${p('Please log in and resubmit your verification with accurate information. If you believe this is an error, contact us at <a href="mailto:info@pangig.com" style="color:#f4a623;">info@pangig.com</a>.')}
      ${btn('Resubmit Verification', SITE)}
    `)
  }),

  // ── Password Reset ─────────────────────────
  passwordReset: ({ name, resetLink, expiryHours }) => ({
    subject: 'Reset your Pangig password',
    html: baseTemplate(`
      ${h1('Reset your password 🔐')}
      ${p(`Hi ${name.split(' ')[0]}, we received a request to reset your Pangig password.`)}
      ${p('Click the button below to set a new password. This link expires in <strong>${expiryHours} hours</strong>.'.replace('${expiryHours}', expiryHours))}
      ${btn('Reset My Password', resetLink)}
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;font-size:13px;color:#6b7280;">If you didn't request a password reset, you can safely ignore this email. Your password will not change.</p>
      </div>
      ${p('For security, this link will expire in ' + expiryHours + ' hours.')}
    `)
  }),

  // ── Contact Form ───────────────────────────
  contactForm: ({ name, email, subject, message }) => ({
    subject: `New contact form message: ${subject}`,
    html: baseTemplate(`
      ${h1('New contact form message 📬')}
      ${highlight('From', name)}
      ${highlight('Email', email)}
      ${highlight('Subject', subject)}
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:12px 0;">
        <div style="font-size:13px;color:#6b7280;margin-bottom:8px;">Message:</div>
        <div style="font-size:14px;color:#0a0c10;line-height:1.7;">${message.replace(/\n/g, '<br>')}</div>
      </div>
      ${highlight('Time', new Date().toLocaleString())}
      <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject)}" style="background:#f4a623;color:#000000;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:20px;">Reply to ${name}</a>
    `)
  }),

};

// ══════════════════════════════════════════════
// SEND FUNCTION
// ══════════════════════════════════════════════
async function sendEmail(to, templateName, data) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] RESEND_API_KEY not set — skipping email to ${to}`);
    return;
  }
  const template = templates[templateName];
  if (!template) {
    console.error(`[Email] Unknown template: ${templateName}`);
    return;
  }

  // When domain is not verified, Resend only allows sending to
  // the account owner's email. Route all emails there for now.
  const domainVerified = process.env.EMAIL_VERIFIED === 'true';
  const actualTo = domainVerified ? to : (process.env.RESEND_TEST_EMAIL || to);

  const { subject, html } = template(data);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: actualTo, subject, html }),
    });
    const result = await res.json();
    if (!res.ok) {
      console.error(`[Email] Failed to send ${templateName} to ${actualTo}:`, result);
    } else {
      console.log(`[Email] Sent ${templateName} to ${actualTo} — id: ${result.id}`);
    }
  } catch (err) {
    console.error(`[Email] Error sending ${templateName}:`, err.message);
  }
}

module.exports = { sendEmail };
