import { del, list, put } from '@vercel/blob';
import { prefix, adminFile, state, change, reserve, privateRead } from '../lib/album.js';
import sharp from 'sharp';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const isAdmin = req.headers.authorization?.startsWith('Bearer ');
  const enabled = Boolean(token);
  if (req.method === 'GET') {
    if (!enabled) return res.json({ enabled, photos: [] });
    try {
      const retired = new Set([
        "009321f0-a621-4de8-9995-b28c14ce0e08.jpg",
        "a121a611-844f-429e-9067-a3ed261e6984.jpg",
        "b7d900c5-e5d5-4987-be9f-300470708205.jpg",
        "ceecc02d-5c1b-4d94-8d57-07867e66e24a.jpg"
].map(name => prefix + name));
      const photos = [];
      const { value } = await state();
      const captions = {};
      let cursor;
      do {
        const page = await list({ token, prefix, cursor });
        for (const blob of page.blobs) {
          if (retired.has(blob.pathname)) continue;
          photos.push(blob.url);
          const parts = blob.pathname.slice(prefix.length).split('/');
          if (parts[0] === 'v3') captions[blob.url] = value.captions[parts[1]] || '';
          if (parts[0] === 'v2' && parts.length === 4) {
            captions[blob.url] = Buffer.from(parts[3].slice(0, -4), 'base64url').toString('utf8');
          }
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      res.setHeader('Vercel-CDN-Cache-Control','public, s-maxage=5');
      return res.json({ enabled, photos, captions });
    } catch {
      return res.status(503).json({ enabled, error: 'ALBUM_UNAVAILABLE' });
    }
  }
  if (req.headers.origin && req.headers.origin !== 'https://' + req.headers.host) return res.status(403).end();
  if (req.method === 'DELETE') {
    if (!enabled) return res.status(503).end();
    const { path, key } = req.body || {};
    const ownedPath = typeof path === 'string' && /^v[23]\/[0-9a-f-]{36}\/[a-f0-9]{64}\/[A-Za-z0-9_-]{0,640}\.jpg$/.test(path);
    const legacyPath = typeof path === 'string' && /^[0-9a-f-]{36}\.jpg$/.test(path);
    if (!ownedPath && !legacyPath) return res.status(403).end();
    try {
      if (isAdmin) {
        const admin = await privateRead(adminFile);
        const supplied = req.headers.authorization.slice(7);
        if (!admin || !/^[a-f0-9]{64}$/.test(supplied) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(admin.text.trim()))) return res.status(403).end();
      } else {
        if (!ownedPath || typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) return res.status(403).end();
        const digest = createHash('sha256').update(key).digest();
        if (!timingSafeEqual(digest, Buffer.from(path.split('/')[2], 'hex'))) return res.status(403).end();
      }
      await del(prefix + path, { token });
      if (path.startsWith('v3/')) await change(s => {delete s.captions[path.split('/')[1]];});
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
  const id = randomUUID();
  const path = 'v3/' + id + '/' + digest + '/recuerdo.jpg';
  const data = req.body?.foto;
  if (typeof data !== 'string' || data.length > 3500000) return res.status(400).end();
  let foto;
  try {
    const bytes = Buffer.from(data, 'base64');
    if (bytes[0] !== 255 || bytes[1] !== 216) return res.status(415).end();
    const ip = req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    try { await reserve(String(ip).split(',')[0].trim()); }
    catch (error) {
      if (error.status === 429) res.setHeader('Retry-After','600');
      return res.status(error.status === 429 ? 429 : 503).end();
    }
    foto = await sharp(bytes, { limitInputPixels: 8000000 }).rotate()
      .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 }).toBuffer();
  } catch { return res.status(422).end(); }
  try {
    if (message.trim()) await change(s => {s.captions[id] = message.trim();});
    const blob = await put(prefix + path, foto, { token, access: 'public', cacheControlMaxAge:60, contentType: 'image/jpeg' });
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