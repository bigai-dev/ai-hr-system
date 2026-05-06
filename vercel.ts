import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  crons: [
    // Daily at 03:00 UTC: hard-delete rejected applicants > 90 days, prune rate-limit events.
    { path: '/api/cron/cleanup', schedule: '0 3 * * *' },
  ],
  functions: {
    // Background screening can take ~10–30s; allow extra headroom in case of large PDFs.
    'src/app/api/applications/route.ts': { maxDuration: 90 },
  },
};

export default config;
