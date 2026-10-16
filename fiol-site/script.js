// language: JavaScript, file: script.js

/* ═══════════════════════════════════════════════════
   playlist: info.txt (строки "music: файл = Название")
   fallback: music.js (window.TRACKS)
   папка с mp3: MUSIC_DIR
   ═══════════════════════════════════════════════════ */
const MUSIC_DIR     = "music/";
const DEFAULT_COVER = "assets/pictureavatarkasong.png";
const ALLOWED       = ['.mp3'];

let playlist = [];

/* ── фон: дождь если видео нет ── */
const video = document.querySelector('.wallpaper video');
const rainCanvas = document.getElementById('rain');
let rainRAF = null;

function startRain(){
  if(rainRAF) return;
  rainCanvas.style.display = 'block';
  const x = rainCanvas.getContext('2d');
  let w, h, drops;
  function resize(){
    w = rainCanvas.width  = innerWidth;
    h = rainCanvas.height = innerHeight;
    drops = Array.from({length: Math.floor(w/7)}, ()=>({
      x: Math.random()*w, y: Math.random()*h,
      l: 8 + Math.random()*18, v: 3 + Math.random()*5,
      o: .15 + Math.random()*.35
    }));
  }
  function tick(){
    x.clearRect(0,0,w,h);
    x.lineWidth = 1; x.lineCap = 'round';
    for(const d of drops){
      x.strokeStyle = `rgba(200,170,255,${d.o})`;
      x.beginPath(); x.moveTo(d.x, d.y); x.lineTo(d.x, d.y + d.l); x.stroke();
      d.y += d.v;
      if(d.y > h){ d.y = -d.l; d.x = Math.random()*w; }
    }
    rainRAF = requestAnimationFrame(tick);
  }
  resize();
  addEventListener('resize', resize);
  tick();
}
function stopRain(){
  if(rainRAF){ cancelAnimationFrame(rainRAF); rainRAF = null; }
  rainCanvas.style.display = 'none';
  rainCanvas.getContext('2d').clearRect(0,0,rainCanvas.width,rainCanvas.height);
}

if(video && video.querySelector('source')){
  video.addEventListener('canplay', ()=>{ video.style.display='block'; stopRain(); });
  video.addEventListener('error',   ()=>{ video.style.display='none';  startRain(); });
  setTimeout(()=>{ if(video.readyState < 2){ video.style.display='none'; startRain(); } }, 1500);
}else{
  if(video) video.style.display = 'none';
  startRain();
}

/* ── копирование ── */
const toast = document.getElementById('toast');
let toastTimer;
function showToast(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> toast.classList.remove('show'), 1600);
}
document.querySelectorAll('.link[data-copy]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    const val = el.getAttribute('data-copy');
    navigator.clipboard.writeText(val)
      .then(()=> showToast('скопировано: ' + val))
      .catch(()=> { window.location.href = el.href; });
  });
});

/* ── плеер ── */
const audio    = document.getElementById('audio');
const listEl   = document.getElementById('list');
const playBtn  = document.getElementById('play');
const prevBtn  = document.getElementById('prev');
const nextBtn  = document.getElementById('next');
const nowTitle = document.getElementById('now-title');
const nowArtist= document.getElementById('now-artist');
const coverEl  = document.getElementById('cover');
const fill     = document.getElementById('fill');
const curEl    = document.getElementById('cur');
const durEl    = document.getElementById('dur');
const bar      = document.getElementById('bar');

let index = 0, playing = false;
const coverFor = () => DEFAULT_COVER;

function render(){
  listEl.innerHTML = '';
  if(!playlist.length){
    listEl.innerHTML = '<div class="empty">треков нет — добавь <b>music:</b> строки в <b>info.txt</b> или впиши в <b>music.js</b></div>';
    return;
  }
  playlist.forEach((t,i)=>{
    const active = i === index;
    const row = document.createElement('div');
    row.className = 'track' + (active ? ' active' : '') + (active && playing ? ' playing' : '');
    row.innerHTML = `
      <div class="thumb"><img src="${coverFor()}" alt=""></div>
      <div class="meta"><div class="name">${t.title}</div></div>
      <div class="time">—:—</div>`;
    row.onclick = ()=> load(i, true);
    listEl.appendChild(row);
  });
}

function load(i, autoplay){
  if(!playlist.length) return;
  index = (i + playlist.length) % playlist.length;
  const t = playlist[index];
  audio.src = t.src;
  nowTitle.textContent = t.title;
  nowArtist.textContent = '';
  nowArtist.classList.add('hidden');
  coverEl.innerHTML = `<img src="${coverFor()}" alt="">`;
  render();
  if(autoplay) play();
}

function play(){
  if(!playlist.length) return;
  audio.play().then(()=>{ playing = true; playBtn.textContent='❚❚'; render(); }).catch(()=>{});
}
function pause(){ audio.pause(); playing = false; playBtn.textContent='▶'; render(); }

playBtn.onclick = ()=> playing ? pause() : play();
prevBtn.onclick = ()=> load(index-1, playing);
nextBtn.onclick = ()=> load(index+1, playing);

audio.ontimeupdate = ()=>{
  if(!audio.duration) return;
  fill.style.width = (audio.currentTime/audio.duration*100) + '%';
  curEl.textContent = fmt(audio.currentTime);
};
audio.onloadedmetadata = ()=>{ durEl.textContent = fmt(audio.duration); };
audio.onended = ()=> load(index+1, true);
bar.onclick = e=>{
  if(!audio.duration) return;
  const r = bar.getBoundingClientRect();
  audio.currentTime = ((e.clientX - r.left)/r.width) * audio.duration;
};
function fmt(s){
  if(!isFinite(s)) return '0:00';
  const m = Math.floor(s/60), x = Math.floor(s%60);
  return m + ':' + String(x).padStart(2,'0');
}

/* ═══════════════════════════════════════════════════
   читаем info.txt, строим плейлист
   ═══════════════════════════════════════════════════ */
fetch('info.txt', { cache: 'no-store' })
  .then(r => r.ok ? r.text() : Promise.reject())
  .then(txt => {
    const data = { music: [] };

    txt.split('\n').forEach(raw => {
      const line = raw.trim();
      if(!line) return;

      // строка трека: "music: файл.mp3 = Название"
      const m = line.match(/^music\s*:\s*(.+?)\s*=\s*(.*)$/i);
      if(m){
        const file  = m[1].trim();
        const title = m[2].trim();
        const lower = file.toLowerCase();
        if(!ALLOWED.some(ext => lower.endsWith(ext))) return;

        const src  = file.includes('/') ? file : MUSIC_DIR + file;
        const base = file.split('/').pop().replace(/\.[^.]+$/, '');
        data.music.push({ src, title: title || base });
        return;
      }

      // "ключ: значение"
      const i = line.indexOf(':');
      if(i > 0){
        const k = line.slice(0,i).trim();
        const v = line.slice(i+1).trim();
        if(k !== 'music') data[k] = v;
      }
    });

    if(data.name) document.getElementById('name').textContent = data.name;
    if(data.bio)  document.getElementById('bio').textContent  = data.bio;

    playlist = data.music;
    index = 0;
    render();
  })
  .catch(()=>{
    // info.txt не прочитался — берём music.js
    document.getElementById('bio').textContent = 'строка о себе';

    const fallback = window.TRACKS || [];
    playlist = fallback
      .map(e => {
        const file  = typeof e === 'string' ? e : (e && e.file);
        const title = typeof e === 'string' ? null : (e && e.title);
        if(!file) return null;
        const lower = file.toLowerCase();
        if(!ALLOWED.some(ext => lower.endsWith(ext))) return null;
        const src  = file.includes('/') ? file : MUSIC_DIR + file;
        const base = file.split('/').pop().replace(/\.[^.]+$/, '');
        return { src, title: title || base };
      })
      .filter(Boolean);

    index = 0;
    render();
  });