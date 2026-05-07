// Smoke test: verify RESEND_API_KEY works end-to-end.
// Run with: node --env-file=.env.local scripts/smoke-resend.mjs
const TO = 'jtpk2168@gmail.com';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error('✗ RESEND_API_KEY not set in .env.local');
  process.exit(1);
}
const from = process.env.EMAIL_FROM_ADDRESS ?? 'onboarding@resend.dev';

console.log(`→ Sending test email`);
console.log(`  from: ${from}`);
console.log(`  to:   ${TO}`);

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from,
    to: TO,
    subject: `Recruit.AI Resend smoke test — ${new Date().toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Kuala_Lumpur',
    })}`,
    text:
      `If you're reading this, your RESEND_API_KEY works.\n\n` +
      `Sent from scripts/smoke-resend.mjs at ${new Date().toString()}.`,
  }),
});

const bodyText = await res.text();
let body;
try { body = JSON.parse(bodyText); } catch { body = bodyText; }

if (!res.ok) {
  console.error(`✗ HTTP ${res.status}`);
  console.error(body);
  process.exit(1);
}

console.log(`✓ Accepted by Resend`);
console.log(`  provider id: ${body.id}`);
console.log(`Check ${TO} (and the Resend dashboard → Emails) to confirm delivery.`);
