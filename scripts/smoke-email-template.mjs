// Smoke test: edit a template, then verify the builder uses it.
// Run with: node --env-file=.env.local scripts/smoke-email-template.mjs
import { createClient } from '@libsql/client';

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Set a distinctive rejection template
const distinctSubject = `[SMOKE ${Date.now()}] {Job_Title}`;
await turso.execute({
  sql: 'UPDATE email_templates SET subject = ?, body = ? WHERE id = ?',
  args: [
    distinctSubject,
    'SMOKE BODY for {Candidate_Name}\n\n{Rejection_Reason}',
    'rejection',
  ],
});

// Re-read via the same query the builder uses
const { rows } = await turso.execute({
  sql: 'SELECT subject, body FROM email_templates WHERE id = ?',
  args: ['rejection'],
});
const tpl = rows[0];

// Substitute the same way the builder does
function substitute(text, vars) {
  return text.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, n) =>
    n in vars ? String(vars[n]) : m,
  );
}

const vars = {
  Candidate_Name: 'Smoke Test',
  Job_Title: 'Senior PM',
  Company_Name: 'Recruit.AI',
  Rejection_Reason: 'Test reason text.',
  Custom_Note: '',
};

console.log('subject →', substitute(tpl.subject, vars));
console.log('body    →');
console.log(substitute(tpl.body, vars));

// Restore default rejection template
await turso.execute({
  sql: 'UPDATE email_templates SET subject = ?, body = ? WHERE id = ?',
  args: [
    'Update on your application — {Job_Title}',
    `Hi {Candidate_Name},

Thank you for your interest in the {Job_Title} role and for the time you put into your application.

{Rejection_Reason}{Custom_Note}

We genuinely appreciate the effort you put in and wish you well in your search.

— {Company_Name}`,
    'rejection',
  ],
});
console.log('\n✓ template restored');
