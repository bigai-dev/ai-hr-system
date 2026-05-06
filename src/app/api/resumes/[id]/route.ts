import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { turso } from '@/lib/turso';

const VERCEL_BLOB_HOST_SUFFIX = '.private.blob.vercel-storage.com';

function pathnameFromOurBlobUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !u.hostname.endsWith(VERCEL_BLOB_HOST_SUFFIX)) {
      return null;
    }
    return u.pathname.replace(/^\//, '');
  } catch {
    return null;
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

  const pathname = pathnameFromOurBlobUrl(resumeUrl);
  if (!pathname) {
    return new NextResponse('Resume URL is not a recognized blob', { status: 502 });
  }

  let stream: ReadableStream<Uint8Array>;
  try {
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200) {
      return new NextResponse('Failed to fetch resume', { status: 502 });
    }
    stream = result.stream;
  } catch {
    return new NextResponse('Failed to fetch resume', { status: 502 });
  }

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename="resume-${id}.pdf"`,
    },
  });
}
