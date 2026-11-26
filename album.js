
function polvo(letter) {
  const p = document.createElement('b');
  p.className = 'polvo';
  letter.append(p);
  p.animate([{opacity:.7, transform:'scale(.4)'}, {opacity:0, transform:'scale(2.4)'}], {duration:500, easing:'ease-out'}).onfinish = () => p.remove();
}
function assembleTitle() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if ((reduced.matches && location.hash !== '#animar') || !Element.prototype.animate) return;
  const title = document.querySelector('h1');
  const words = title.textContent.trim().split(/\s+/);
  title.setAttribute('aria-label', words.join(' '));
  title.replaceChildren();
  const letters = [];
  for (const word of words) {
    const row = document.createElement('span');
    row.className = 'title-word';
    row.setAttribute('aria-hidden', 'true');
    title.append(row);
    for (const character of word) {
      const letter = document.createElement('i');
      letter.className = 'letter';
      letter.textContent = character;
      row.append(letter);
      letters.push(letter);
    }
  }
  const faces = ['👧🏽','👦🏻','👧🏿','👦🏽','👧🏻','👦🏾','🧒🏼','👧🏾'];
  const shirts = ['#977692','#61948a','#c37e54','#7089ac','#b8657a'];
  let fin = 0;
  letters.forEach((letter, index) => {
    const actor = document.createElement('i');
    actor.className = 'carrier';
    actor.style.setProperty('--shirt', shirts[index % shirts.length]);
    actor.innerHTML = '<b class="face"></b><b class="shirt"></b><b class="shoes"></b>';
    actor.firstElementChild.textContent = faces[(index * 3) % faces.length];
    letter.append(actor);
    const rect = letter.getBoundingClientRect();
    const distance = index % 2 ? innerWidth - rect.left + 32 : -rect.right - 32;
    const duration = 1000 + Math.random() * 250;
    const delay = index * 110 + Math.random() * 60;
    fin = Math.max(fin, delay + duration);
    // La letra viaja, rebota con cada paso del niño y aterriza con un pequeño "plop".
    const travel = letter.animate([
      {transform:'translate(' + distance + 'px,30px)', opacity:0, easing:'cubic-bezier(.2,.7,.3,1)'},
      {opacity:1, offset:.12},
      {transform:'translate(0,3px)', offset:.8, easing:'ease-out'},
      {transform:'translate(0,-6px) scale(.97,1.05)', offset:.9, easing:'ease-in'},
      {transform:'translate(0,0) scale(1.05,.95)', offset:.96, easing:'ease-out'},
      {transform:'translate(0,0) scale(1,1)'}
    ], {duration, delay, fill:'backwards'});
    letter.animate([{translate:'0 0'}, {translate:'0 -5px'}, {translate:'0 0'}],
      {duration:260, delay, iterations:Math.max(1, Math.floor(duration * .8 / 260)), easing:'ease-in-out'});
    // Al aterrizar: deja la letra, saluda y se va corriendo por donde llegó.
    travel.onfinish = () => {
      actor.classList.add('para', 'saluda');
      polvo(letter);
      setTimeout(() => actor.classList.remove('para', 'saluda'), 750);
      actor.animate([
        {transform:'translateX(-50%)', opacity:1},
        {transform:'translate(' + distance + 'px,32px)', opacity:0}
      ], {duration:600, delay:750, easing:'ease-in'}).onfinish = () => actor.remove();
    };
  });
  // El sobre aparece justo cuando termina el título.
  document.documentElement.style.setProperty('--espera', Math.round(fin + 300) + 'ms');
  reduced.addEventListener('change', () => {
    if (reduced.matches) { document.getAnimations().forEach(a => a.cancel()); document.querySelectorAll('.carrier,.polvo').forEach(e => e.remove()); }
  }, {once:true});
}
// Espera a la tipografía para medir bien las letras y evitar el parpadeo del título.
Promise.race([document.fonts ? document.fonts.load('1em Baskervville') : 0, new Promise(r => setTimeout(r, 1200))])
  .then(assembleTitle).catch(() => {})
  .finally(() => document.documentElement.classList.add('titulo-listo'));

const scene=document.getElementById('scene'),envWrap=document.getElementById('envWrap'),cartaWrap=document.getElementById('cartaWrap'),env=scene.querySelector('.env');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
let temporizador;
function abrir(){
  clearTimeout(temporizador);
  scene.classList.add('open');env.setAttribute('aria-expanded','true');
  if(!reduce)petalos();
  temporizador=setTimeout(()=>{
    scene.classList.add('read');envWrap.inert=true;
    cartaWrap.inert=false;cartaWrap.removeAttribute('aria-hidden');
    cartaWrap.focus({preventScroll:true});
  },reduce?0:1400);
}
function cerrar(){
  clearTimeout(temporizador);
  scene.classList.remove('read');envWrap.inert=false;
  cartaWrap.inert=true;cartaWrap.setAttribute('aria-hidden','true');
  env.setAttribute('aria-expanded','false');
  temporizador=setTimeout(()=>scene.classList.remove('open'),reduce?0:700);
  env.focus({preventScroll:true});
}
// Toda la zona del sobre abre la carta; se ignoran toques repetidos mientras anima.
envWrap.addEventListener('click',()=>{if(!scene.classList.contains('open'))abrir()});
document.getElementById('guardar').addEventListener('click',cerrar);
function petalos(){
  for(let i=0;i<16;i++){
    const p=document.createElement('i');p.className='petalo';
    p.style.left=Math.random()*100+'vw';
    p.style.setProperty('--s',(.6+Math.random()*.6)+'rem');
    p.style.setProperty('--x',(Math.random()*12-6)+'rem');
    p.style.setProperty('--d',(6+Math.random()*4)+'s');
    p.style.setProperty('--r',Math.random()*1.8+'s');
    document.body.append(p);setTimeout(()=>p.remove(),11000);
  }
}

const moderation = location.hash === '#moderar';
const aporte = document.getElementById('aporte');

aporte.addEventListener('submit', async event => {
  event.preventDefault();
  const picker = aporte.querySelector('input');
  const button = aporte.querySelector('button');
  const status = aporte.querySelector('[role=status]');
  const file = picker.files[0];
  if (!file || button.disabled) return;
  button.disabled = picker.disabled = true;
  const message = document.getElementById('dedicatoria').value.trim();
  let bitmap;
  let sending = false;
  try {
    status.textContent = 'Preparando tu foto…';
    bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const foto = canvas.toDataURL('image/jpeg', .82).split(',')[1];
    const key = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join('');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
    try { localStorage.setItem('kathleen-owner-' + hash, key); }
    catch { status.textContent = 'Permite guardar datos en este navegador para poder retirar tu foto después.'; return; }
    sending = true;
    status.textContent = 'Enviando tu recuerdo…';
    const response = await fetch('/api/recuerdos', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ foto, publicar: true, key, message })});
    if (response.status === 429) { status.textContent = 'Se alcanzó el límite de subidas. Inténtalo más tarde.'; return; }
    if (!response.ok) throw new Error('upload');
    const published = await response.json();
    addPhoto(published.url, 'Recuerdo compartido', message, true);
    aporte.reset();
    status.textContent = '¡Tu foto ya aparece en el álbum de todos!';
  } catch {
    status.textContent = sending ? 'No pudimos confirmar el envío. Inténtalo de nuevo.' : 'No pudimos abrir esa imagen. Prueba con una foto JPG o PNG.';
  } finally {
    bitmap?.close();
    button.disabled = picker.disabled = false;
  }
});
const photos = [];
const gallery = document.getElementById('photos');
const viewer = document.getElementById('viewer');
const fullPhoto = viewer.querySelector('img');
let selected = 0;
function showPhoto(index) {
  selected = (index + photos.length) % photos.length;
  fullPhoto.src = photos[selected].src;
  const photo = photos[selected];
  fullPhoto.alt = photo.alt;
  document.getElementById('photo-message').textContent = photo.message;
  const download = document.getElementById('download-photo');
  download.href = photo.shared ? photo.src + '?download=1' : photo.src;
  document.getElementById('remove-photo').hidden = !(ownerKey(photo) || (moderation && photo.shared));
  document.getElementById('remove-photo').textContent = moderation ? 'Moderar: eliminar foto' : 'Retirar mi foto';
  document.getElementById('photo-feedback').textContent = '';
  for (const id of ['previous','next']) document.getElementById(id).hidden = photos.length < 2;
}
function ownerKey(photo) {
  if (!photo.shared) return null;
  const parts = new URL(photo.src).pathname.split('/');
  if (!['v2','v3'].includes(parts.at(-4))) return null;
  try { return localStorage.getItem('kathleen-owner-' + parts.at(-2)); } catch { return null; }
}
function removeFromGallery(photo) {
  const current = photos[selected];
  const index = photos.indexOf(photo);
  if (index < 0) return;
  photos.splice(index, 1);
  photo.tile.remove();
  if (viewer.open && current === photo) viewer.close();
  selected = Math.max(0, photos.indexOf(current));
}
document.getElementById('remove-photo').onclick = () => withdrawPhoto(photos[selected]);
async function withdrawPhoto(photo) {
  const key = ownerKey(photo);
  if ((!key && !moderation) || !confirm('¿Retirar esta foto y su mensaje del álbum de todos?')) return;
  try {
    const path = new URL(photo.src).pathname.split('/licenciada-kathleen/album/')[1];
    const headers = {'Content-Type':'application/json'};
    if (moderation && !key) {
      const secret = prompt('Clave privada de moderación del álbum');
      if (!secret) return;
      headers.Authorization = 'Bearer ' + secret.trim();
    }
    const response = await fetch('/api/recuerdos', {method:'DELETE', headers, body:JSON.stringify({path,key})});
    if (!response.ok) throw new Error('delete');
    removeFromGallery(photo);
  } catch { const feedback = viewer.open ? document.getElementById('photo-feedback') : document.getElementById('album-feedback');
    feedback.textContent = 'No se pudo retirar la foto. Inténtalo de nuevo.'; }
};
function addPhoto(src, name, pie, shared = false) {
  if (photos.some(photo => photo.src === src)) return;

  document.getElementById('vacio').hidden = true;
  const alt = pie || name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');

  const thumb = new Image();
  thumb.alt = alt;
  thumb.loading = 'lazy';
  thumb.src = src;
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label','Ampliar foto: ' + alt);
  button.append(thumb);
  const tile = document.createElement('div');
  tile.append(button);
  const photo = {src, alt, message: pie || '', shared, tile};
  photos.push(photo);
  button.onclick = () => { showPhoto(photos.indexOf(photo)); viewer.showModal(); };
  if (ownerKey(photo) || (moderation && shared)) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'withdraw-photo';
    remove.textContent = moderation ? 'Moderar: eliminar foto' : 'Retirar mi foto';
    remove.onclick = () => withdrawPhoto(photo);
    tile.append(remove);
  }
  gallery.append(tile);
}
document.getElementById('previous').onclick = () => showPhoto(selected - 1);
document.getElementById('next').onclick = () => showPhoto(selected + 1);
document.getElementById('dismiss').onclick = () => viewer.close();
viewer.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight') showPhoto(selected + 1);
  if (event.key === 'ArrowLeft') showPhoto(selected - 1);
});
let x0 = null;
viewer.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, {passive:true});
viewer.addEventListener('touchend', e => {
  if (x0 === null) return;
  const dx = e.changedTouches[0].clientX - x0; x0 = null;
  if (Math.abs(dx) > 50) showPhoto(selected + (dx < 0 ? 1 : -1));
});
viewer.addEventListener('click', e => { if (e.target === viewer) viewer.close(); });
// Coloca las fotos compartidas en la carpeta fotos/ de main.
// Opcional: lista tus fotos aquí para no depender de la API de GitHub. Ej: {archivo:'graduacion.jpg', pie:'El gran día'}
const recuerdos = [];
async function loadAlbum() {
  if (recuerdos.length) { for (const r of recuerdos) addPhoto('fotos/' + encodeURIComponent(r.archivo), r.archivo, r.pie); return; }
  const response = await fetch('https://api.github.com/repos/roberthjr21/Licenciada-Kathleen/contents/fotos?ref=main');
  if (!response.ok) return;
  const files = await response.json();
  if (!Array.isArray(files)) return;
  for (const file of files.sort((a,b) => a.name.localeCompare(b.name,'es',{numeric:true}))) {
    if (file.type === 'file' && /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name))
      addPhoto('fotos/' + encodeURIComponent(file.name), file.name);
  }
}
const albumRefreshMs = 5000;
let refreshTimer;
let refreshing = false;

async function syncSharedPhotos() {
  clearTimeout(refreshTimer);
  if (refreshing || document.hidden || !navigator.onLine) return;
  refreshing = true;
  let nextDelay = albumRefreshMs;
  try {
    const response = await fetch('/api/recuerdos', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('album');
    const { enabled, photos: sharedPhotos, captions = {} } = await response.json();
    aporte.hidden = !enabled;
    if (Array.isArray(sharedPhotos)) {
      const urls = new Set(sharedPhotos);
      for (const photo of [...photos]) if (photo.shared && !urls.has(photo.src)) removeFromGallery(photo);
      for (const url of urls) addPhoto(url, 'Recuerdo compartido', captions[url], true);
    }
  } catch {
    nextDelay = 15000;
  } finally {
    refreshing = false;
    if (!document.hidden && navigator.onLine) refreshTimer = setTimeout(syncSharedPhotos, nextDelay);
  }
}
document.addEventListener('visibilitychange', syncSharedPhotos);
window.addEventListener('online', syncSharedPhotos);
syncSharedPhotos();
loadAlbum().catch(() => {});
