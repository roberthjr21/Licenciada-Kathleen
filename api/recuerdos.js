import { put } from '@vercel/blob';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const enabled = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  if (req.method === 'GET') return res.json({ enabled });
  if (req.method !== 'POST') return res.status(405).end();
  if (!enabled) return res.status(503).end();
  if (req.headers['content-type'] !== 'application/json') return res.status(415).end();
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
    await put('pendientes/' + randomUUID() + '.jpg', foto, { access: 'private', contentType: 'image/jpeg' });
    return res.status(201).json({ recibida: true });
  } catch { return res.status(503).end(); }
}