export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Optional server-side cut-out.
 *
 * Set CUTOUT_API_URL and CUTOUT_API_KEY to point at a background-removal
 * provider that accepts a multipart `image_file` and returns a PNG — remove.bg
 * and Photoroom both match that shape. Without them the client falls back to
 * its own flood fill.
 */
export async function POST(request: Request) {
  const endpoint = process.env.CUTOUT_API_URL;
  const key = process.env.CUTOUT_API_KEY;
  if (!endpoint || !key) {
    return Response.json(
      {
        error: 'not_configured',
        message: 'No cut-out provider is configured on the server.',
      },
      { status: 501 },
    );
  }

  const incoming = await request.formData();
  const image = incoming.get('image');
  if (!(image instanceof Blob)) {
    return Response.json({ error: 'bad_request', message: 'No image supplied' }, { status: 400 });
  }

  const body = new FormData();
  body.append('image_file', image, 'item.jpg');
  body.append('size', 'auto');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'X-Api-Key': key },
    body,
  });

  if (!response.ok) {
    return Response.json(
      { error: 'provider_failed', message: `Cut-out provider returned ${response.status}` },
      { status: 502 },
    );
  }

  return new Response(await response.arrayBuffer(), {
    headers: { 'content-type': 'image/png' },
  });
}
