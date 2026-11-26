import { mkdir, cp } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { list, copy, del, put } from '@vercel/blob';
import { prefix, adminFile, change, privateRead, privateOptions } from '../lib/album.js';

await mkdir('dist', {recursive:true});
for (const name of ['index.html','inicio.js','album.js','fotos']) {
  await cp(name, 'dist/' + name, {recursive:true});
}
if (process.env.VERCEL_ENV === 'production') {
  if (!await privateRead(adminFile)) {
    await put(adminFile, randomBytes(32).toString('hex'), { ...privateOptions(), contentType:'text/plain', addRandomSuffix:false });
  }

  const retired = [
        "009321f0-a621-4de8-9995-b28c14ce0e08.jpg",
        "a121a611-844f-429e-9067-a3ed261e6984.jpg",
        "b7d900c5-e5d5-4987-be9f-300470708205.jpg",
        "ceecc02d-5c1b-4d94-8d57-07867e66e24a.jpg"
];
  await del(retired.map(name => prefix + name));
  // Migrate the remaining public captions and preserve existing owner keys.
  const legacy = [];
  let cursor;
  do {
    const page = await list({ prefix:prefix + 'v2/', cursor });
    legacy.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  for (const blob of legacy) {
    const [,id,digest,filename] = blob.pathname.slice(prefix.length).split('/');
    if (!/^[\da-f-]{36}$/.test(id) || !/^[\da-f]{64}$/.test(digest) || !filename?.endsWith('.jpg')) throw new Error('Unexpected photo path');
    const message = Buffer.from(filename.slice(0,-4),'base64url').toString('utf8');
    await change(s => { s.captions[id] = message; });
    await copy(blob.url, prefix + 'v3/' + id + '/' + digest + '/recuerdo.jpg', {access:'public', allowOverwrite:true, cacheControlMaxAge:60});
    await del(blob.url);
  }
  await change(() => {});
}
