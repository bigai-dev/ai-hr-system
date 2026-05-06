import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso';

const VERCEL_BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com';

function isOurBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.endsWith(VERCEL_BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const { rows } = await turso.execute({
    sql: 'SELECT resume_url FROM applicants WHERE id = ?',
    args: [id],
  });
  if (rows.length === 0) {
    return new NextResponse('Not found', { status: 404 });
  }

  const resumeUrl = rows[0].resume_url as string | null;
  if (!resumeUrl) {
    return new NextResponse('No resume on file', { status: 404 });
  }

  if (!isOurBlobUrl(resumeUrl)) {
    return new NextResponse('Resume URL is not a recognized blob', { status: 502 });
  }

  const upstream = await fetch(resumeUrl);
  if (!upstream.ok || !upstream.body) {
    return new NextResponse('Failed to fetch resume', { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename="resume-${id}.pdf"`,
    },
  });
}
