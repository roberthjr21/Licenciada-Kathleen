import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
import { createHmac } from 'node:crypto';

export const prefix = 'licenciada-kathleen/album/';
export const adminFile = 'seguridad/clave-moderacion.txt';
const stateFile = 'seguridad/album.json';
export function privateOptions() {
  const token = process.env.KATHLEEN_READ_WRITE_TOKEN;
  if (!token) throw new Error('Missing private store');
  return { token, access: 'private' };
}
export async function privateRead(path) {
  const blob = await get(path, { ...privateOptions(), useCache: false });
  if (!blob) return null;
  return { text: await new Response(blob.stream).text(), etag: blob.blob.etag };
}
export async function state() {
  const data = await privateRead(stateFile);
  return { value: data ? JSON.parse(data.text) : { captions: {} }, etag: data?.etag };
}
export async function change(edit) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { value, etag } = await state();
    edit(value);
    try {
      await put(stateFile, JSON.stringify(value), { ...privateOptions(), ...(etag ? { allowOverwrite:true, ifMatch:etag } : {}), contentType:'application/json' });
      return;
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError) && !(!etag && /already exists/i.test(error.message))) throw error;
      await new Promise(resolve => setTimeout(resolve, 45 + Math.random() * 100));
    }
  }
  throw new Error('Concurrent updates');
}
export function reserve(ip) {
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0,10);
  const hash = createHmac('sha256', privateOptions().token).update(day + ':' + ip).digest('hex');
  return change(s => {
    if (s.day !== day) Object.assign(s, {day, total:0, networks:{}});
    const recent = (s.networks[hash] || []).filter(t => t > now - 600000);
    if (s.total >= 200 || recent.length >= 10) throw Object.assign(new Error('Upload limit'), {status:429});
    recent.push(now); s.networks[hash] = recent; s.total++;
  });
}