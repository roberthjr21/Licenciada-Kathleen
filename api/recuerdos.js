import { del, list, put } from '@vercel/blob';
import sharp from 'sharp';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const prefix = 'licenciada-kathleen/album/';
  const enabled = Boolean(token);
  if (req.method === 'GET') {
    if (!enabled) return res.json({ enabled, photos: [] });
    try {
      const photos = [];
      const captions = {};
      let cursor;
      do {
        const page = await list({ token, prefix, cursor });
        for (const blob of page.blobs) {
          photos.push(blob.url);
          const parts = blob.pathname.slice(prefix.length).split('/');
          if (parts[0] === 'v2' && parts.length === 4) {
            captions[blob.url] = Buffer.from(parts[3].slice(0, -4), 'base64url').toString('utf8');
          }
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return res.json({ enabled, photos, captions });
    } catch {
      return res.status(503).json({ enabled, error: 'ALBUM_UNAVAILABLE' });
    }
  }
  if (req.method === 'DELETE') {
    if (!enabled) return res.status(503).end();
    const { path, key } = req.body || {};
    if (typeof path !== 'string' || !/^v2\/[0-9a-f-]{36}\/[0-9a-f]{64}\/[A-Za-z0-9_-]{0,640}\.jpg$/.test(path)
        || typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) return res.status(403).end();
    const digest = createHash('sha256').update(key).digest();
    if (!timingSafeEqual(digest, Buffer.from(path.split('/')[2], 'hex'))) return res.status(403).end();
    try {
      await del(prefix + path, { token });
      return res.status(204).end();
    } catch { return res.status(503).end(); }
  }
  if (req.method !== 'POST') return res.status(405).end();
  if (!enabled) return res.status(503).end();
  if (req.headers['content-type'] !== 'application/json') return res.status(415).end();
  if (req.body?.publicar !== true) return res.status(409).json({ error: 'RELOAD_TO_PUBLISH' });
  const { key, message = '' } = req.body;
  if (typeof message !== 'string' || message.length > 120) return res.status(400).end();
  if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) return res.status(409).json({ error: 'RELOAD_TO_PUBLISH' });
  const digest = createHash('sha256').update(key).digest('hex');
  const caption = Buffer.from(message.trim()).toString('base64url');
  const path = 'v2/' + randomUUID() + '/' + digest + '/' + caption + '.jpg';
  const data = req.body?.foto;
  if (typeof data !== 'string' || data.length > 3500000) return res.status(400).end();
  let foto;
  try {
    const bytes = Buffer.from(data, 'base64');
    if (bytes[0] !== 255 || bytes[1] !== 216) return res.status(415).end();
    foto = await sharp(bytes, { limitInputPixels: 8000000 }).rotate()
      .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 }).toBuffer();
  } catch { return res.status(422).end(); }
  try {
    const blob = await put(prefix + path, foto, { token, access: 'public', contentType: 'image/jpeg' });
    return res.status(201).json({ recibida: true, url: blob.url });
  } catch (error) {
    const message = String(error?.message || '');
    let reason = 'BLOB_WRITE_FAILED';
    if (/private.{0,80}public|public.{0,80}private/i.test(message)) reason = 'BLOB_ACCESS_MODE';
    else if (/unauthorized|forbidden|denied|token/i.test(message)) reason = 'BLOB_PERMISSION';
    else if (/quota|limit|suspended/i.test(message)) reason = 'BLOB_LIMIT';
    console.error('Upload failed', reason, error?.name);
    return res.status(503).json({ error: reason });
  }
}