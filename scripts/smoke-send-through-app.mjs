// End-to-end test through the same flow the app uses: call Resend exactly
// like src/lib/email.ts does, and write a matching row to outgoing_emails.
// Run with: node --env-file=.env.local scripts/smoke-send-through-app.mjs
import { createClient } from '@libsql/client';
import { randomUUID } from 'node:crypto';

const TO = 'jtpk2168@gmail.com';
const FROM = process.env.EMAIL_FROM_ADDRESS ?? 'onboarding@resend.dev';
const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.error('✗ RESEND_API_KEY missing'); process.exit(1);
}

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const id = randomUUID();
const stamp = new Date().toLocaleString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
  timeZone: 'Asia/Kuala_Lumpur',
});
const subject = `Recruit.AI integration test — ${stamp}`;
const body =
  `Hi there,\n\nThis is a smoke test exercising the same path as sendEmail() — Resend send + outgoing_emails insert.\n\n— Recruit.AI`;

console.log(`→ from ${FROM} to ${TO}`);
const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: FROM, to: TO, subject, text: body }),
});

let providerId = null;
let status = 'sent';
let error = null;
if (!res.ok) {
  status = 'failed';
  error = `${res.status} ${(await res.text()).slice(0, 300)}`;
} else {
  const data = await res.json();
  providerId = data.id ?? null;
}

await turso.execute({
  sql: `INSERT INTO outgoing_emails
          (id, to_email, subject, body, category, applicant_id, job_id,
           delivery_status, provider_id, error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [id, TO, subject, body, 'other', null, null, status, providerId, error],
});

console.log(`✓ outgoing_emails row written:`);
console.log(`  id:          ${id}`);
console.log(`  status:      ${status}`);
console.log(`  provider_id: ${providerId ?? '(none)'}`);
if (error) console.log(`  error:       ${error}`);
console.log(`Open /settings/outgoing-emails to see it at the top of the list.`);
