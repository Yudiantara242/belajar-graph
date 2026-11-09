/* =========================================================
   GRAPH ADVENTURE — script.js
   Vanilla JavaScript murni. Diorganisir per-bagian:
   1. State global
   2. Loading screen
   3. Navigasi antar halaman & progress bar
   4. Utilitas (SVG graph renderer, confetti, audio, badge toast)
   5. Interaksi halaman materi (1-12)
   6. Game engine (hub + 8 level)
   7. Halaman penutup (Mission Complete)
   8. Inisialisasi
========================================================= */

/* ============ 1. STATE GLOBAL ============ */
const APP = {
  materialOrder: [
    // Urutan mengikuti langkah RPM
    'page-cover',
    'page-asesmen','page-apersepsi-tree','page-pemantik-awal','page-tujuan', // Pendahuluan
    'page-peta-buleleng',                                         // Stimulation
    'page-masalah',                                               // Problem Statement
    'page-komponen',                                              // Data Collection
    'page-jenis','page-undirected','page-directed','page-weighted', // Data Processing
    'page-vs',                                                    // Verification
    'page-apaitu','page-penerapan','page-ringkasan','page-kesimpulan' // Generalization
  ],
  stageOf: {
    'page-asesmen':'Pendahuluan','page-apersepsi-tree':'Pendahuluan','page-pemantik-awal':'Pendahuluan','page-tujuan':'Pendahuluan',
    'page-peta-buleleng':'Stimulation','page-masalah':'Problem Statement','page-komponen':'Data Collection',
    'page-jenis':'Data Processing','page-undirected':'Data Processing','page-directed':'Data Processing','page-weighted':'Data Processing',
    'page-vs':'Verification','page-apaitu':'Generalization','page-penerapan':'Generalization',
    'page-ringkasan':'Generalization','page-kesimpulan':'Generalization / Penutup',
    'page-game-hub':'Penguatan','page-level-stage':'Penguatan','page-final':'Penutup'
  },
  currentPage: 'page-cover',
  score: 0,
  correctCount: 0,
  totalAnswered: 0,
  badges: [],           // { id, name, icon }
  levelsDone: {},       // { 1: true, 2: true, ... }
  soundOn: false,
  audioCtx: null,
  currentLevel: null,
  levelTimerInterval: null,
};

const LEVEL_DEFS = [
  { id:1, name:'Hitung Vertex & Edge', icon:'fa-hashtag', time:60 },
  { id:2, name:'Pilih Jenis Graph', icon:'fa-shapes', time:60 },
  { id:3, name:'Susun Graph', icon:'fa-arrows-turn-to-dots', time:75 },
  { id:4, name:'Temukan Semua Jalur', icon:'fa-route', time:75 },
  { id:5, name:'Jalur Paling Efisien', icon:'fa-weight-hanging', time:60 },
  { id:6, name:'Benar atau Salah', icon:'fa-circle-check', time:60 },
  { id:7, name:'Studi Kasus Pertemanan', icon:'fa-user-group', time:90 },
  { id:8, name:'Escape Mission', icon:'fa-person-running', time:90 },
];

/* ============ 2. LOADING SCREEN ============ */
window.addEventListener('DOMContentLoaded', () => {
  const fill = document.getElementById('loadingBarFill');
  let pct = 0;
  const iv = setInterval(() => {
    pct += Math.random() * 18 + 6;
    if (pct >= 100) { pct = 100; clearInterval(iv); }
    fill.style.width = pct + '%';
    if (pct === 100) {
      setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hide');
        initApp();
      }, 350);
    }
  }, 220);
});

/* ============ 3. NAVIGASI ============ */
function showPage(pageId){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId);
  if (!target) return;
  target.classList.add('active');
  APP.currentPage = pageId;
  const chip = document.getElementById('stageChip');
  if (chip){ chip.textContent = APP.stageOf[pageId] || ''; chip.style.display = APP.stageOf[pageId] ? '' : 'none'; }
  updateProgressBar();
  window.scrollTo({top:0, behavior:'instant'});
  runPageEnterAnimation(pageId);
}

function updateProgressBar(){
  const idx = APP.materialOrder.indexOf(APP.currentPage);
  const fill = document.getElementById('progressFill');
  const label = document.getElementById('progressLabel');
  if (idx >= 0){
    const pct = (idx / (APP.materialOrder.length - 1)) * 100;
    fill.style.width = pct + '%';
    label.textContent = `${idx} / ${APP.materialOrder.length - 1}`;
  } else {
    fill.style.width = '0%';
    label.textContent = 'Game';
  }
}

function goNext(){
  const idx = APP.materialOrder.indexOf(APP.currentPage);
  if (idx >= 0 && idx < APP.materialOrder.length - 1){
    showPage(APP.materialOrder[idx+1]);
  }
}
function goPrev(){
  const idx = APP.materialOrder.indexOf(APP.currentPage);
  if (idx > 0){
    showPage(APP.materialOrder[idx-1]);
  } else {
    showPage('page-cover');
  }
}

function bindNav(){
  document.querySelectorAll('.next-btn').forEach(b => b.addEventListener('click', goNext));
  document.querySelectorAll('.prev-btn').forEach(b => b.addEventListener('click', goPrev));
  document.querySelectorAll('[data-goto]').forEach(b => {
    b.addEventListener('click', () => {
      const target = b.dataset.goto;
      if (target === 'materi-start') showPage('page-asesmen');
      else showPage(target);
    });
  });
  document.getElementById('btnHome').addEventListener('click', () => showPage('page-cover'));
  document.getElementById('btnBackToHub').addEventListener('click', () => {
    stopLevelTimer();
    showPage('page-game-hub');
    renderLevelHub();
  });
}

/* Trigger per-page enter animations / setup */
function runPageEnterAnimation(pageId){
  if (pageId === 'page-tujuan') animateChecklist();
  if (pageId === 'page-apersepsi-tree') renderTreeGraph('svg-tree-intro');
  if (pageId === 'page-peta-buleleng') renderBulelengMap();
  if (pageId === 'page-apaitu') renderApaituGraph();
  if (pageId === 'page-komponen') renderKomponenGraph();
  if (pageId === 'page-vs') { renderTreeGraph(); renderVsGraph(); }
  if (pageId === 'page-undirected') renderUndirectedGraph();
  if (pageId === 'page-directed') renderDirectedGraph();
  if (pageId === 'page-weighted') renderWeightedGraph();
  if (pageId === 'page-ringkasan') renderMindmap();
  if (pageId === 'page-game-hub') renderLevelHub();
}

/* ============ 4. UTILITAS ============ */

/* --- 4.1 SVG Graph Renderer (dipakai berulang di banyak halaman) --- */
function svgGraph(nodes, edges, opts = {}){
  const w = opts.width || 400, h = opts.height || 380;
  const parts = [];
  parts.push(`<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" class="gv-root">`);
  parts.push(`<defs><marker id="arrow-${opts.uid}" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 Z" fill="var(--blue-dark)"/></marker></defs>`);

  // Edges
  edges.forEach((e, i) => {
    const n1 = nodes.find(n => n.id === e.from);
    const n2 = nodes.find(n => n.id === e.to);
    if (!n1 || !n2) return;
    const midX = (n1.x + n2.x)/2, midY = (n1.y + n2.y)/2;
    const cls = ['gv-edge'];
    if (e.directed) cls.push('directed');
    if (opts.selectableEdges) cls.push('selectable');
    if (opts.highlightEdges && opts.highlightEdges.includes(i)) cls.push('path-highlight');
    // shrink line end for directed arrow so it doesn't overlap node
    let x2 = n2.x, y2 = n2.y;
    if (e.directed){
      const dx = n2.x - n1.x, dy = n2.y - n1.y;
      const len = Math.sqrt(dx*dx+dy*dy) || 1;
      x2 = n2.x - (dx/len)*22; y2 = n2.y - (dy/len)*22;
    }
    parts.push(`<line data-edge-idx="${i}" class="${cls.join(' ')}" x1="${n1.x}" y1="${n1.y}" x2="${x2}" y2="${y2}" ${e.directed? `marker-end="url(#arrow-${opts.uid})"`:''}/>`);
    if (e.weight !== undefined){
      parts.push(`<rect x="${midX-13}" y="${midY-11}" width="26" height="20" rx="6" fill="var(--surface)" stroke="var(--blue)" stroke-width="1.5"/>`);
      parts.push(`<text x="${midX}" y="${midY+4}" class="gv-edge-label" text-anchor="middle">${e.weight}</text>`);
    }
  });

  // Nodes
  nodes.forEach(n => {
    parts.push(`<g class="gv-node-group" data-node-id="${n.id}">
      <circle data-node-id="${n.id}" class="gv-node-circle" cx="${n.x}" cy="${n.y}" r="22"></circle>
      <text x="${n.x}" y="${n.y}" class="gv-node-label">${n.label}</text>
    </g>`);
  });

  parts.push('</svg>');
  return parts.join('');
}
let _uidCounter = 0;
function nextUid(){ return 'u' + (_uidCounter++); }

/* --- 4.2 Confetti --- */
function fireConfetti(){
  const canvas = document.getElementById('confettiCanvas');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#2563EB','#10B981','#FBBF24','#EF4444','#A78BFA'];
  const particles = Array.from({length:120}, () => ({
    x: Math.random()*canvas.width, y: -20 - Math.random()*canvas.height*0.3,
    r: 4+Math.random()*5, c: colors[Math.floor(Math.random()*colors.length)],
    vy: 2+Math.random()*3, vx: -1.5+Math.random()*3, rot: Math.random()*360, vr: -6+Math.random()*12
  }));
  let frame = 0;
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle = p.c; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.6); ctx.restore();
    });
    frame++;
    if (frame < 110) requestAnimationFrame(draw);
    else ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  draw();
}

/* --- 4.3 Audio (WebAudio, tanpa file eksternal) --- */
function getAudioCtx(){
  if (!APP.audioCtx) APP.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return APP.audioCtx;
}
function playTone(freq, duration, type='sine', vol=0.15){
  if (!APP.soundOn) return;
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.type = type; osc.frequency.value = freq;
  gain.gain.value = vol;
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.stop(ctx.currentTime + duration);
}
function sfxCorrect(){ playTone(660,0.12); setTimeout(()=>playTone(880,0.18),110); }
function sfxWrong(){ playTone(180,0.25,'sawtooth',0.12); }
function sfxClick(){ playTone(1000,0.05,'square',0.05); }

let ambientNodes = [];
function toggleMusic(){
  APP.soundOn = !APP.soundOn;
  const icon = document.querySelector('#btnSound i');
  icon.className = APP.soundOn ? 'fa-solid fa-volume-high' : 'fa-solid fa-music';
  localStorage.setItem('ga_sound', APP.soundOn ? '1':'0');
  if (APP.soundOn) startAmbient(); else stopAmbient();
}
function startAmbient(){
  const ctx = getAudioCtx();
  stopAmbient();
  [261.6, 329.6, 392.0].forEach((f,i) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = f;
    gain.gain.value = 0.015;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    ambientNodes.push(osc);
  });
}
function stopAmbient(){
  ambientNodes.forEach(o => { try{ o.stop(); }catch(e){} });
  ambientNodes = [];
}

/* --- 4.4 Badge toast --- */
function awardBadge(id, name, icon){
  if (APP.badges.find(b => b.id === id)) return;
  APP.badges.push({id, name, icon});
  const toast = document.createElement('div');
  toast.className = 'badge-toast';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><div><strong>Lencana Baru!</strong><span>${name}</span></div>`;
  document.body.appendChild(toast);
  requestAnimationFrame(()=> toast.classList.add('show'));
  setTimeout(()=>{ toast.classList.remove('show'); setTimeout(()=>toast.remove(),400); }, 3200);
}

/* --- 4.5 Skor --- */
function addScore(points, isCorrect){
  APP.score += points;
  APP.totalAnswered++;
  if (isCorrect) APP.correctCount++;
  document.getElementById('scoreValue').textContent = APP.score;
  const lvl = document.getElementById('levelScoreLabel');
  if (lvl) lvl.textContent = APP.score;
  document.getElementById('scoreChip').classList.add('zoom-in');
  setTimeout(()=>document.getElementById('scoreChip').classList.remove('zoom-in'), 350);
}

/* ============ 5. INTERAKSI HALAMAN MATERI ============ */

/* -- Responsif: bangun ulang latar cover saat ukuran layar berubah -- */
let _coverResizeT;
window.addEventListener('resize', () => {
  clearTimeout(_coverResizeT);
  _coverResizeT = setTimeout(() => { if (APP.currentPage === 'page-cover') buildCoverBackground(); }, 250);
});

/* -- Cover animated background nodes -- */
function buildCoverBackground(){
  const bg = document.getElementById('coverBg');
  const W = window.innerWidth, H = window.innerHeight;
  const count = 14;
  const pts = Array.from({length:count}, () => ({ x: Math.random()*W, y: Math.random()*H }));
  let svgLines = '';
  for (let i=0;i<pts.length;i++){
    for (let j=i+1;j<pts.length;j++){
      const d = Math.hypot(pts[i].x-pts[j].x, pts[i].y-pts[j].y);
      if (d < 220) svgLines += `<line x1="${pts[i].x}" y1="${pts[i].y}" x2="${pts[j].x}" y2="${pts[j].y}" stroke="var(--blue)" stroke-opacity="0.12" stroke-width="1.5"/>`;
    }
  }
  bg.innerHTML = `<svg width="${W}" height="${H}" style="position:absolute;inset:0;">${svgLines}</svg>`;
  pts.forEach((p,i) => {
    const dot = document.createElement('div');
    dot.className = 'cover-node' + (i % 3 === 0 ? ' g':'');
    dot.style.left = p.x+'px'; dot.style.top = p.y+'px';
    dot.style.animationDelay = (Math.random()*3)+'s';
    bg.appendChild(dot);
  });
}

/* -- Halaman 2: checklist animasi satu per satu -- */
function animateChecklist(){
  const items = document.querySelectorAll('#tujuanList li');
  items.forEach((li,i) => {
    li.classList.remove('shown');
    void li.offsetWidth;
    setTimeout(()=> li.classList.add('shown'), i*350 + 150);
  });
}

/* -- Halaman 2B: peta sederhana Kabupaten Buleleng -- */
function renderBulelengMap(containerId = 'bulelengMap'){
  const container = document.getElementById(containerId);
  if (!container || container.dataset.built) return; // ilustrasi statis, cukup dibangun sekali
  const nodes = [
    { id:'SGR', label:'Singaraja',    x:300, y:110 },
    { id:'LOV', label:'Lovina',       x:130, y:135 },
    { id:'GIT', label:'Gitgit',       x:420, y:210 },
    { id:'BUY', label:'Danau Buyan',  x:540, y:300 },
  ];
  const edges = [ ['SGR','LOV'], ['SGR','GIT'], ['GIT','BUY'] ];
  const findNode = id => nodes.find(n => n.id === id);

  let svg = `<svg viewBox="0 0 640 380" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="640" height="380" fill="var(--gray-50)"/>
    <path d="M0,55 Q160,20 320,52 T640,48 L640,0 L0,0 Z" fill="#BFE3F5" opacity="0.55"/>
    <text x="320" y="26" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="2" fill="#2b6ea6">LAUT BALI</text>
    <path d="M560,340 L600,290 L640,340 Z" fill="#A7D8B5"/>
    <path d="M585,315 L600,296 L615,315 Z" fill="#ffffff"/>
    <text x="600" y="360" text-anchor="middle" font-size="11" fill="var(--text-soft)">Pegunungan</text>
    <g>
      <circle cx="35" cy="45" r="16" fill="var(--surface)" stroke="var(--blue)" stroke-width="2"/>
      <text x="35" y="50" text-anchor="middle" font-size="13" font-weight="800" fill="var(--blue)">U</text>
      <path d="M35,29 L30,38 L40,38 Z" fill="var(--blue)"/>
    </g>`;

  edges.forEach(([a,b]) => {
    const n1 = findNode(a), n2 = findNode(b);
    svg += `<line class="map-edge" x1="${n1.x}" y1="${n1.y}" x2="${n2.x}" y2="${n2.y}"/>`;
  });
  nodes.forEach(n => {
    svg += `<g>
      <text x="${n.x}" y="${n.y}" class="map-pin-icon">&#xf3c5;</text>
      <text x="${n.x}" y="${n.y+26}" class="map-pin-label">${n.label}</text>
    </g>`;
  });
  svg += `</svg>`;
  container.innerHTML = svg;
  container.dataset.built = '1';
}

/* -- Pertanyaan pemantik: toggle poin diskusi -- */
function initPemantikToggle(){
  document.querySelectorAll('.pemantik-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const hint = btn.nextElementSibling;
      hint.classList.toggle('show');
      const icon = btn.querySelector('i');
      icon.classList.toggle('fa-chevron-down');
      icon.classList.toggle('fa-chevron-up');
      sfxClick();
    });
  });
}

/* -- Halaman 3: apersepsi jawaban -- */
function initApersepsi(){
  document.getElementById('btnLihatJawaban').addEventListener('click', () => {
    document.getElementById('apersepsiAnswer').classList.add('shown');
    sfxClick();
  });
}

/* -- Halaman 4: apa itu graph (vertex muncul lalu edge) -- */
function renderApaituGraph(){
  const nodes = [ {id:'A',label:'A',x:80,y:80}, {id:'B',label:'B',x:300,y:60}, {id:'C',label:'C',x:340,y:260}, {id:'D',label:'D',x:120,y:300} ];
  const edges = [ {from:'A',to:'B'}, {from:'B',to:'C'}, {from:'C',to:'D'}, {from:'D',to:'A'} ];
  const el = document.getElementById('svg-apaitu');
  el.innerHTML = svgGraph(nodes, edges, {uid:nextUid(), width:400, height:380});
  animateVertexThenEdge(el);
}
function animateVertexThenEdge(container){
  const circles = container.querySelectorAll('.gv-node-circle');
  const texts = container.querySelectorAll('.gv-node-label');
  const lines = container.querySelectorAll('.gv-edge');
  [...circles, ...texts].forEach(el => { el.style.opacity = 0; });
  lines.forEach(el => { el.style.opacity = 0; el.style.strokeDasharray = '6 4'; });
  circles.forEach((c,i) => setTimeout(()=>{ c.style.transition='opacity .4s'; c.style.opacity=1; }, i*180));
  texts.forEach((t,i) => setTimeout(()=>{ t.style.transition='opacity .4s'; t.style.opacity=1; }, i*180+100));
  setTimeout(()=>{
    lines.forEach((l,i)=> setTimeout(()=>{ l.style.transition='opacity .5s'; l.style.opacity=1; }, i*220));
  }, circles.length*180 + 200);
}
document.addEventListener('click', e => {
  if (e.target && e.target.id === 'btnReplayApaitu') renderApaituGraph();
});

/* -- Halaman 5: komponen graph interaktif -- */
function renderKomponenGraph(){
  const nodes = [ {id:'A',label:'A',x:200,y:60}, {id:'B',label:'B',x:340,y:180}, {id:'C',label:'C',x:250,y:320}, {id:'D',label:'D',x:80,y:280}, {id:'E',label:'E',x:60,y:120} ];
  const edges = [ {from:'A',to:'B'}, {from:'B',to:'C'}, {from:'C',to:'D'}, {from:'D',to:'E'}, {from:'E',to:'A'}, {from:'A',to:'C'} ];
  const el = document.getElementById('svg-komponen');
  el.innerHTML = svgGraph(nodes, edges, {uid:nextUid(), width:400, height:380});
  const info = document.getElementById('komponenInfo');
  el.querySelectorAll('.gv-node-circle').forEach(c => {
    c.addEventListener('click', () => {
      info.innerHTML = `<i class="fa-solid fa-circle-dot"></i><p><strong>Vertex (Simpul) — "${c.dataset.nodeId}"</strong><br>Vertex adalah titik/objek dalam graph. Contoh dalam kehidupan sehari-hari: satu kota, satu akun media sosial, atau satu ruangan.</p>`;
      info.classList.add('pulse'); setTimeout(()=>info.classList.remove('pulse'),500);
      sfxClick();
    });
  });
  el.querySelectorAll('.gv-edge').forEach(edge => {
    edge.classList.add('selectable');
    edge.addEventListener('click', () => {
      info.innerHTML = `<i class="fa-solid fa-arrows-left-right"></i><p><strong>Edge (Sisi)</strong><br>Edge adalah garis penghubung yang menyatakan hubungan antara dua vertex. Contoh: jalan yang menghubungkan dua kota, atau koneksi pertemanan.</p>`;
      info.classList.add('pulse'); setTimeout(()=>info.classList.remove('pulse'),500);
      sfxClick();
    });
  });
}

/* -- Data Collection: tugas hitung vertex, edge, dan jalur -- */
function initKomponenTask(){
  const btn = document.getElementById('btnCekTask');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const v = parseInt(document.getElementById('cntV').value, 10);
    const e = parseInt(document.getElementById('cntE').value, 10);
    const p = document.getElementById('cntPath').value.toUpperCase().replace(/[^A-E]/g, '');
    const validPaths = ['ACD','ABCD','AED'];
    const okV = v === 5, okE = e === 6, okP = validPaths.includes(p);
    const fb = document.getElementById('taskFeedback');
    const msg = [];
    msg.push(okV ? '✔ Vertex benar.' : '✘ Vertex: hitung lagi semua titik.');
    msg.push(okE ? '✔ Edge benar.' : '✘ Edge: hitung lagi semua garis.');
    msg.push(okP ? '✔ Jalur A ke D valid.' : '✘ Jalur: ikuti garis dari A sampai D.');
    fb.innerHTML = msg.join('<br>');
    fb.className = 'task-feedback ' + (okV && okE && okP ? 'ok' : 'no');
    (okV && okE && okP) ? sfxCorrect() : sfxWrong();
  });
}

/* -- Generalization: penegasan konsep -- */
function initKesimpulan(){
  const b = document.getElementById('btnKunciKes');
  if (b) b.addEventListener('click', () => { document.getElementById('kesKunci').classList.add('shown'); sfxClick(); });
}

/* -- Halaman 6: tree vs graph -- */
function renderTreeGraph(targetId='svg-tree'){
  const nodes = [ {id:'R',label:'R',x:200,y:40}, {id:'A',label:'A',x:100,y:140}, {id:'B',label:'B',x:300,y:140}, {id:'C',label:'C',x:50,y:250}, {id:'D',label:'D',x:150,y:250} ];
  const edges = [ {from:'R',to:'A'}, {from:'R',to:'B'}, {from:'A',to:'C'}, {from:'A',to:'D'} ];
  const tgt = document.getElementById(targetId); if (tgt) tgt.innerHTML = svgGraph(nodes, edges, {uid:nextUid(), width:360, height:300});
}
function renderVsGraph(){
  const nodes = [ {id:'A',label:'A',x:180,y:40}, {id:'B',label:'B',x:320,y:120}, {id:'C',label:'C',x:260,y:260}, {id:'D',label:'D',x:100,y:260}, {id:'E',label:'E',x:40,y:120} ];
  const edges = [ {from:'A',to:'B'},{from:'B',to:'C'},{from:'C',to:'D'},{from:'D',to:'E'},{from:'E',to:'A'},{from:'A',to:'C'} ];
  document.getElementById('svg-vsgraph').innerHTML = svgGraph(nodes, edges, {uid:nextUid(), width:360, height:300});
}

/* -- Halaman 7: jenis-jenis graph cards -- */
const JENIS_INFO = {
  undirected: { title:'Undirected Graph', text:'Sisi pada graph ini tidak memiliki arah, sehingga hubungan berlaku dua arah antar vertex. Contoh: pertemanan Facebook, jalan dua arah.' },
  directed: { title:'Directed Graph', text:'Sisi pada graph ini memiliki arah tertentu, sehingga hubungan hanya berlaku satu arah. Contoh: Instagram follow, alur pekerjaan.' },
  weighted: { title:'Weighted Graph', text:'Setiap sisi pada graph ini memiliki bobot/nilai, misalnya jarak, biaya, waktu, atau kecepatan. Contoh: Google Maps.' },
};
function initJenisCards(){
  document.querySelectorAll('.jenis-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.jenis-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const data = JENIS_INFO[card.dataset.jenis];
      const box = document.getElementById('jenisExpand');
      box.innerHTML = `<div class="jenis-expand-box"><h4>${data.title}</h4><p>${data.text}</p></div>`;
      sfxClick();
    });
  });
}

/* -- Halaman 8, 9, 10: graph tipe -- */
function renderUndirectedGraph(){
  const nodes = [ {id:'A',label:'A',x:80,y:180}, {id:'B',label:'B',x:220,y:80}, {id:'C',label:'C',x:340,y:200} ];
  const edges = [ {from:'A',to:'B'}, {from:'B',to:'C'} ];
  document.getElementById('svg-undirected').innerHTML = svgGraph(nodes, edges, {uid:nextUid(), width:400, height:280});
}
function renderDirectedGraph(){
  const nodes = [ {id:'A',label:'A',x:80,y:180}, {id:'B',label:'B',x:220,y:80}, {id:'C',label:'C',x:340,y:200} ];
  const edges = [ {from:'A',to:'B',directed:true}, {from:'B',to:'C',directed:true} ];
  document.getElementById('svg-directed').innerHTML = svgGraph(nodes, edges, {uid:nextUid(), width:400, height:280});
}
function renderWeightedGraph(){
  const nodes = [ {id:'A',label:'A',x:70,y:200}, {id:'B',label:'B',x:220,y:70}, {id:'C',label:'C',x:370,y:200}, {id:'D',label:'D',x:220,y:320} ];
  const edges = [ {from:'A',to:'B',weight:4}, {from:'B',to:'C',weight:6}, {from:'A',to:'D',weight:3}, {from:'D',to:'C',weight:5} ];
  document.getElementById('svg-weighted').innerHTML = svgGraph(nodes, edges, {uid:nextUid(), width:440, height:380});
}

/* -- Mini quiz generic handler (halaman 8 & 9) -- */
function initMiniQuiz(){
  document.querySelectorAll('.mini-quiz').forEach(quiz => {
    const opts = quiz.querySelectorAll('.opt-btn');
    const fb = quiz.querySelector('.mini-quiz-feedback');
    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        opts.forEach(o => o.disabled = true);
        const correct = btn.dataset.correct === 'true';
        if (correct){
          btn.classList.add('correct');
          fb.textContent = '✔ Benar! ' + (quiz.dataset.quiz === 'undirected-quiz' ? 'Pada undirected graph, hubungan berlaku dua arah.' : 'Pada directed graph, arah B→A belum tentu ada meskipun A→B ada.');
          fb.className = 'mini-quiz-feedback ok';
          sfxCorrect();
        } else {
          btn.classList.add('wrong');
          opts.forEach(o => { if (o.dataset.correct==='true') o.classList.add('correct'); });
          fb.textContent = '✘ Kurang tepat. ' + (quiz.dataset.quiz === 'undirected-quiz' ? 'Pada undirected graph, hubungan berlaku dua arah.' : 'Pada directed graph, arah B→A belum tentu ada meskipun A→B ada.');
          fb.className = 'mini-quiz-feedback no';
          sfxWrong();
        }
      });
    });
  });
}

/* -- Halaman 11: penerapan graph -- */
const PENERAPAN_INFO = {
  maps: 'Google Maps merepresentasikan lokasi sebagai vertex dan jalan sebagai edge berbobot (jarak/waktu) untuk mencari rute tercepat.',
  social: 'Media sosial merepresentasikan pengguna sebagai vertex dan hubungan follow/pertemanan sebagai edge.',
  network: 'Jaringan komputer merepresentasikan perangkat sebagai vertex dan kabel/koneksi sebagai edge.',
  train: 'Jalur kereta merepresentasikan stasiun sebagai vertex dan lintasan rel sebagai edge berbobot (jarak/waktu tempuh).',
  flight: 'Jalur penerbangan merepresentasikan bandara sebagai vertex dan rute penerbangan sebagai edge berbobot (jarak/biaya).',
};
function initPenerapanCards(){
  document.querySelectorAll('.penerapan-card').forEach(card => {
    card.addEventListener('click', () => {
      document.getElementById('penerapanDetail').innerHTML = `<div class="penerapan-detail-box"><p>${PENERAPAN_INFO[card.dataset.p]}</p></div>`;
      sfxClick();
    });
  });
}

/* -- Halaman 12: mindmap -- */
function renderMindmap(){
  const container = document.getElementById('mindmap');
  const nodes = container.querySelectorAll('.mm-node');
  const cx = container.clientWidth/2 || 280, cy = container.clientHeight/2 || 210;
  const lines = document.getElementById('mmLines');
  lines.setAttribute('viewBox', `0 0 ${container.clientWidth||560} ${container.clientHeight||420}`);
  let svgContent = '';
  nodes.forEach((node,i) => {
    const angle = (i / nodes.length) * 2*Math.PI - Math.PI/2;
    const rx = Math.max(60, cx - node.offsetWidth/2 - 6), ry = Math.max(60, cy - node.offsetHeight/2 - 6);
    const x = cx + rx*Math.cos(angle), y = cy + ry*Math.sin(angle);
    node.style.left = x+'px'; node.style.top = y+'px';
    node.style.transform = 'translate(-50%,-50%)';
    node.style.animationDelay = (i*0.12)+'s';
    svgContent += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--gray-300)" stroke-width="2" stroke-dasharray="4 4"/>`;
  });
  lines.innerHTML = svgContent;
}
window.addEventListener('resize', () => { if (APP.currentPage === 'page-ringkasan') renderMindmap(); });

/* ============ 6. GAME ENGINE ============ */

function renderLevelHub(){
  const grid = document.getElementById('levelGrid');
  grid.innerHTML = '';
  LEVEL_DEFS.forEach(lv => {
    const card = document.createElement('div');
    card.className = 'level-card' + (APP.levelsDone[lv.id] ? ' done' : '');
    card.innerHTML = `
      ${APP.levelsDone[lv.id] ? '<div class="lv-check"><i class="fa-solid fa-circle-check"></i></div>' : ''}
      <div class="lv-num">${lv.id}</div>
      <div class="lv-name">${lv.name}</div>
      <div class="lv-star"><i class="fa-solid fa-hourglass-half"></i> ${lv.time}s</div>`;
    card.addEventListener('click', () => startLevel(lv.id));
    grid.appendChild(card);
  });
}

function startLevel(id){
  APP.currentLevel = id;
  document.getElementById('levelNumLabel').textContent = id;
  document.getElementById('levelScoreLabel').textContent = APP.score;
  showPage('page-level-stage');
  document.getElementById('progressLabel').textContent = 'Game · Level ' + id;
  startLevelTimer(LEVEL_DEFS.find(l=>l.id===id).time);
  const renderFn = LEVEL_RENDERERS[id];
  if (renderFn) renderFn();
}

function startLevelTimer(seconds){
  stopLevelTimer();
  let remain = seconds;
  const totalLabel = LEVEL_DEFS.find(l=>l.id===APP.currentLevel).time;
  updateTimerDisplay(remain, totalLabel);
  APP.levelTimerInterval = setInterval(() => {
    remain--;
    updateTimerDisplay(remain, totalLabel);
    if (remain <= 0){
      stopLevelTimer();
      showFeedback(false, "Waktu habis! Yuk simak pembahasannya dan lanjut.", true);
    }
  }, 1000);
}
function stopLevelTimer(){ if (APP.levelTimerInterval) clearInterval(APP.levelTimerInterval); }
function updateTimerDisplay(remain, total){
  const m = Math.max(0,Math.floor(remain/60)).toString().padStart(2,'0');
  const s = Math.max(0,remain%60).toString().padStart(2,'0');
  document.getElementById('levelTimer').textContent = `${m}:${s}`;
  document.getElementById('levelProgressFill').style.width = Math.max(0,(remain/total)*100)+'%';
  const chip = document.querySelector('.timer-chip');
  chip.classList.toggle('urgent', remain <= 10 && remain > 0);
}

function showFeedback(isCorrect, explanation, timeUp=false){
  stopLevelTimer();
  const content = document.getElementById('levelContent');
  let banner = content.querySelector('.feedback-banner');
  if (!banner){
    banner = document.createElement('div');
    banner.className = 'feedback-banner';
    content.appendChild(banner);
  }
  banner.className = 'feedback-banner ' + (isCorrect ? 'ok':'no');
  banner.innerHTML = `<i class="fa-solid ${isCorrect?'fa-circle-check':'fa-circle-xmark'}"></i>
    <div>${timeUp ? '⏰ Waktu Habis' : (isCorrect ? '✔ Jawaban Benar!' : '✘ Jawaban Kurang Tepat')}<span class="feedback-explain">${explanation}</span></div>`;
  requestAnimationFrame(()=>banner.classList.add('show'));
  if (isCorrect){ fireConfetti(); sfxCorrect(); } else { sfxWrong(); }

  let nextBtn = content.querySelector('.next-level-btn');
  if (!nextBtn){
    nextBtn = document.createElement('button');
    nextBtn.className = 'next-level-btn';
    nextBtn.innerHTML = 'Lanjut <i class="fa-solid fa-arrow-right"></i>';
    content.appendChild(nextBtn);
    nextBtn.addEventListener('click', () => completeLevel(APP.currentLevel));
  }
}

function completeLevel(id){
  APP.levelsDone[id] = true;
  const badgeMap = {
    1:['b1','Penghitung Ulung','fa-hashtag'], 2:['b2','Pengenal Graph','fa-shapes'],
    3:['b3','Penyusun Graph','fa-arrows-turn-to-dots'], 4:['b4','Penjelajah Jalur','fa-route'],
    5:['b5','Ahli Efisiensi','fa-weight-hanging'], 6:['b6','Detektif Fakta','fa-circle-check'],
    7:['b7','Analis Sosial','fa-user-group'], 8:['b8','Kurir Sejati','fa-person-running'],
  };
  const b = badgeMap[id];
  awardBadge(b[0], b[1], b[2]);
  const nextLevel = LEVEL_DEFS.find(l => l.id === id+1);
  if (nextLevel){
    startLevel(nextLevel.id);
  } else {
    finishGame();
  }
}

/* -------- LEVEL 1: Hitung Vertex & Edge -------- */
function renderLevel1(){
  const nodes = [ {id:'A',label:'A',x:200,y:50}, {id:'B',label:'B',x:340,y:160}, {id:'C',label:'C',x:270,y:320}, {id:'D',label:'D',x:100,y:320}, {id:'E',label:'E',x:40,y:150} ];
  const edges = [ {from:'A',to:'B'},{from:'B',to:'C'},{from:'C',to:'D'},{from:'D',to:'E'},{from:'E',to:'A'},{from:'A',to:'C'} ];
  const content = document.getElementById('levelContent');
  content.innerHTML = `
    <div class="level-instructions"><h3><i class="fa-solid fa-hashtag"></i> Hitung Vertex &amp; Edge</h3>
    <p>Amati graph di bawah ini, lalu hitung jumlah vertex dan edge-nya.</p></div>
    <div class="graph-canvas" id="lvl1Graph" style="max-width:420px;"></div>
    <div class="num-input-row">
      <div class="num-input-box"><label>Jumlah Vertex</label><input type="number" id="lvl1Vertex" min="0"></div>
      <div class="num-input-box"><label>Jumlah Edge</label><input type="number" id="lvl1Edge" min="0"></div>
    </div>
    <button class="submit-btn" id="lvl1Submit">Kirim Jawaban <i class="fa-solid fa-paper-plane"></i></button>`;
  document.getElementById('lvl1Graph').innerHTML = svgGraph(nodes, edges, {uid:nextUid(), width:400, height:380});
  document.getElementById('lvl1Submit').addEventListener('click', () => {
    const v = parseInt(document.getElementById('lvl1Vertex').value);
    const e = parseInt(document.getElementById('lvl1Edge').value);
    const correct = (v === nodes.length && e === edges.length);
    addScore(correct?100:0, correct);
    document.getElementById('lvl1Submit').disabled = true;
    showFeedback(correct, `Jawaban yang benar: Vertex = ${nodes.length}, Edge = ${edges.length}.`);
  });
}

/* -------- LEVEL 2: Pilih Jenis Graph -------- */
const LEVEL2_ROUNDS = [
  { type:'undirected', nodes:[{id:'A',label:'A',x:80,y:150},{id:'B',label:'B',x:220,y:60},{id:'C',label:'C',x:340,y:170}], edges:[{from:'A',to:'B'},{from:'B',to:'C'}] },
  { type:'directed', nodes:[{id:'A',label:'A',x:80,y:150},{id:'B',label:'B',x:220,y:60},{id:'C',label:'C',x:340,y:170}], edges:[{from:'A',to:'B',directed:true},{from:'B',to:'C',directed:true}] },
  { type:'weighted', nodes:[{id:'A',label:'A',x:80,y:180},{id:'B',label:'B',x:230,y:60},{id:'C',label:'C',x:360,y:180}], edges:[{from:'A',to:'B',weight:5},{from:'B',to:'C',weight:3}] },
];
let lvl2Round = 0, lvl2Score = 0;
function renderLevel2(){
  lvl2Round = 0; lvl2Score = 0;
  renderLevel2Round();
}
function renderLevel2Round(){
  const content = document.getElementById('levelContent');
  if (lvl2Round >= LEVEL2_ROUNDS.length){
    addScore(lvl2Score, lvl2Score>0);
    showFeedback(lvl2Score === LEVEL2_ROUNDS.length*50, `Kamu menjawab benar ${lvl2Score/50} dari ${LEVEL2_ROUNDS.length} soal.`);
    return;
  }
  const r = LEVEL2_ROUNDS[lvl2Round];
  content.innerHTML = `
    <div class="level-instructions"><h3><i class="fa-solid fa-shapes"></i> Pilih Jenis Graph</h3>
    <p>Soal ${lvl2Round+1} dari ${LEVEL2_ROUNDS.length} — Perhatikan graph berikut, lalu tentukan jenisnya.</p></div>
    <div class="graph-canvas" id="lvl2Graph" style="max-width:380px;"></div>
    <div class="answer-grid">
      <div class="answer-card" data-type="undirected">Undirected</div>
      <div class="answer-card" data-type="directed">Directed</div>
      <div class="answer-card" data-type="weighted">Weighted</div>
    </div>`;
  document.getElementById('lvl2Graph').innerHTML = svgGraph(r.nodes, r.edges, {uid:nextUid(), width:400, height:280});
  content.querySelectorAll('.answer-card').forEach(card => {
    card.addEventListener('click', () => {
      if (content.querySelector('.answer-card.correct, .answer-card.wrong')) return;
      const correct = card.dataset.type === r.type;
      card.classList.add(correct?'correct':'wrong');
      if (!correct) content.querySelector(`[data-type="${r.type}"]`).classList.add('correct');
      if (correct){ lvl2Score += 50; sfxCorrect(); } else sfxWrong();
      setTimeout(() => { lvl2Round++; renderLevel2Round(); }, 1100);
    });
  });
}

/* -------- LEVEL 3: Drag & Drop susun graph --------
   Sekolah berperan sebagai HUB yang terhubung ke 3 lokasi lain (Rumah, Perpustakaan,
   Kantin). Ketiga lokasi tersebut berkedudukan setara secara struktur graph — masing-masing
   HANYA terhubung ke Sekolah, tidak ke satu sama lain — sehingga posisinya boleh saling
   ditukar dan tetap dianggap benar. Untuk mencegah kesan keliru bahwa posisi menunjukkan
   jarak (ini graph tak berbobot, bukan weighted graph), ketiga garis edge dibuat SAMA
   PANJANG secara simetris dari titik pusat. Penilaian dilakukan berdasarkan STRUKTUR
   koneksi (siapa yang jadi hub, siapa yang jadi leaf), bukan posisi x,y yang persis. */
const LEVEL3_ITEMS = ['Rumah','Sekolah','Perpustakaan','Kantin'];
const LEVEL3_SLOTS = [
  { id:'hub',       role:'hub',  x:160, y:130, cx:200, cy:170 },
  { id:'leafTop',   role:'leaf', x:160, y:20,  cx:200, cy:60  },
  { id:'leafRight', role:'leaf', x:255, y:185, cx:295, cy:225 },
  { id:'leafLeft',  role:'leaf', x:65,  y:185, cx:105, cy:225 },
];
let lvl3Filled = {};
let lvl3Selected = null;
function renderLevel3(){
  lvl3Filled = {};
  lvl3Selected = null;
  const content = document.getElementById('levelContent');
  content.innerHTML = `
    <div class="level-instructions"><h3><i class="fa-solid fa-arrows-turn-to-dots"></i> Susun Graph</h3>
    <p>Kasus: <strong>Sekolah</strong> terhubung dengan tiga lokasi — <strong>Rumah</strong>, <strong>Perpustakaan</strong>, dan <strong>Kantin</strong>. Seret (atau ketuk) setiap label ke posisi (vertex) yang tepat pada graph berikut.</p>
    <p style="font-size:.85rem; color:var(--text-soft);"><i class="fa-solid fa-circle-info"></i> Catatan: ini graph tak berbobot — panjang garis hanya menunjukkan <em>hubungan (edge)</em>, bukan jarak sebenarnya.</p></div>
    <div class="dnd-wrap">
      <div class="dnd-pool" id="lvl3Pool"></div>
      <div class="dnd-stage" id="lvl3Stage"><div class="dnd-canvas" id="lvl3Canvas"><svg id="lvl3Lines" style="position:absolute;inset:0;width:100%;height:100%;"></svg></div></div>
    </div>
    <button class="submit-btn" id="lvl3Submit">Periksa Susunan <i class="fa-solid fa-paper-plane"></i></button>`;
  const pool = document.getElementById('lvl3Pool');
  LEVEL3_ITEMS.forEach(item => {
    const el = document.createElement('div');
    el.className = 'dnd-item'; el.textContent = item; el.draggable = true; el.dataset.item = item;
    el.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', item));
    // Perangkat sentuh: ketuk label, lalu ketuk lingkaran tujuan
    el.addEventListener('click', () => {
      if (el.classList.contains('placed')) return;
      const was = el.classList.contains('selected');
      pool.querySelectorAll('.dnd-item').forEach(x => x.classList.remove('selected'));
      if (!was) el.classList.add('selected');
      lvl3Selected = was ? null : item;
      sfxClick();
    });
    pool.appendChild(el);
  });
  const canvas = document.getElementById('lvl3Canvas');
  const lines = document.getElementById('lvl3Lines');
  const hub = LEVEL3_SLOTS.find(s => s.role === 'hub');
  lines.innerHTML = LEVEL3_SLOTS.filter(s => s.role === 'leaf')
    .map(leaf => `<line x1="${hub.cx}" y1="${hub.cy}" x2="${leaf.cx}" y2="${leaf.cy}" stroke="var(--gray-300)" stroke-width="3"/>`)
    .join('');
  LEVEL3_SLOTS.forEach(slot => {
    const s = document.createElement('div');
    s.className = 'dnd-slot'; s.dataset.slot = slot.id; s.dataset.role = slot.role;
    s.style.left = slot.x+'px'; s.style.top = slot.y+'px';
    s.textContent = '?';
    s.addEventListener('dragover', e => { e.preventDefault(); s.classList.add('over'); });
    s.addEventListener('dragleave', () => s.classList.remove('over'));
    const place = item => {
      if (!item || s.classList.contains('filled')) return;
      s.textContent = item; s.classList.add('filled');
      s.dataset.placed = item;
      lvl3Filled[slot.id] = item;
      const poolItem = pool.querySelector(`[data-item="${item}"]`);
      if (poolItem) poolItem.classList.remove('selected'), poolItem.classList.add('placed');
      lvl3Selected = null;
      sfxClick();
    };
    s.addEventListener('drop', e => {
      e.preventDefault(); s.classList.remove('over');
      place(e.dataTransfer.getData('text/plain'));
    });
    s.addEventListener('click', () => place(lvl3Selected));
    canvas.appendChild(s);
  });
  const stage = document.getElementById('lvl3Stage');
  const fit = () => { const sc = Math.min(1, stage.clientWidth / 400); canvas.style.transform = `scale(${sc})`; stage.style.maxHeight = (340*sc)+'px'; };
  fit(); window.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(stage);
  document.getElementById('lvl3Submit').addEventListener('click', () => {
    const hubItem = lvl3Filled['hub'];
    const leafItems = ['leafTop','leafRight','leafLeft'].map(id => lvl3Filled[id]).filter(Boolean);
    const hubCorrect = hubItem === 'Sekolah';
    const expectedLeaves = ['Rumah','Perpustakaan','Kantin'];
    const leafSet = new Set(leafItems);
    const leavesCorrect = leafItems.length === 3 && expectedLeaves.every(x => leafSet.has(x));
    const allCorrect = hubCorrect && leavesCorrect;
    addScore(allCorrect ? 100 : (hubCorrect ? 50 : 0), allCorrect);
    document.getElementById('lvl3Submit').disabled = true;
    showFeedback(allCorrect,
      allCorrect
        ? 'Tepat! Sekolah menjadi hub yang terhubung ke Rumah, Perpustakaan, dan Kantin. Posisi Perpustakaan dan Kantin boleh saling ditukar karena keduanya sama-sama hanya terhubung ke Sekolah.'
        : 'Sekolah harus berada di posisi tengah (hub) karena terhubung ke 3 lokasi lain. Posisi Rumah, Perpustakaan, dan Kantin bebas saling ditukar selama ketiganya terhubung ke Sekolah.');
  });
}

/* -------- LEVEL 4: Temukan semua jalur A → D -------- */
const LVL4_NODES = [ {id:'A',label:'A',x:60,y:180},{id:'B',label:'B',x:200,y:60},{id:'C',label:'C',x:200,y:300},{id:'D',label:'D',x:360,y:180} ];
const LVL4_EDGES = [ {from:'A',to:'B',directed:true},{from:'A',to:'C',directed:true},{from:'B',to:'D',directed:true},{from:'C',to:'D',directed:true},{from:'B',to:'C',directed:true} ];
const LVL4_VALID_PATHS = ['A-B-D','A-C-D','A-B-C-D'];
const LVL4_OPTIONS = ['A-B-D','A-C-D','A-B-C-D','A-D','A-C-B-D'];
let lvl4Selected = new Set();
function renderLevel4(){
  lvl4Selected = new Set();
  const content = document.getElementById('levelContent');
  content.innerHTML = `
    <div class="level-instructions"><h3><i class="fa-solid fa-route"></i> Temukan Semua Jalur A → D</h3>
    <p>Pilih semua opsi jalur yang valid (mengikuti arah edge) dari A menuju D.</p></div>
    <div class="graph-canvas" id="lvl4Graph" style="max-width:420px;"></div>
    <div class="answer-grid two" id="lvl4Options"></div>
    <button class="submit-btn" id="lvl4Submit">Kirim Jawaban <i class="fa-solid fa-paper-plane"></i></button>`;
  document.getElementById('lvl4Graph').innerHTML = svgGraph(LVL4_NODES, LVL4_EDGES, {uid:nextUid(), width:420, height:360});
  const optWrap = document.getElementById('lvl4Options');
  LVL4_OPTIONS.forEach(opt => {
    const card = document.createElement('div');
    card.className = 'answer-card'; card.textContent = opt; card.dataset.path = opt;
    card.addEventListener('click', () => {
      card.classList.toggle('correct', false);
      if (lvl4Selected.has(opt)){ lvl4Selected.delete(opt); card.style.outline='none'; card.style.borderColor='var(--border)'; }
      else { lvl4Selected.add(opt); card.style.borderColor='var(--blue)'; card.style.outline='3px solid var(--blue)'; }
    });
    optWrap.appendChild(card);
  });
  document.getElementById('lvl4Submit').addEventListener('click', () => {
    const chosen = [...lvl4Selected].sort().join(',');
    const valid = [...LVL4_VALID_PATHS].sort().join(',');
    const correct = chosen === valid;
    optWrap.querySelectorAll('.answer-card').forEach(card => {
      const isValid = LVL4_VALID_PATHS.includes(card.dataset.path);
      card.classList.add(isValid ? 'correct':'wrong');
    });
    addScore(correct?150:0, correct);
    document.getElementById('lvl4Submit').disabled = true;
    showFeedback(correct, `Jalur valid dari A ke D: ${LVL4_VALID_PATHS.join(', ')}.`);
  });
}

/* -------- LEVEL 5: Jalur paling efisien (weighted) -------- */
const LVL5_NODES = [ {id:'A',label:'A',x:60,y:200},{id:'B',label:'B',x:210,y:60},{id:'C',label:'C',x:210,y:340},{id:'D',label:'D',x:380,y:200} ];
const LVL5_EDGES = [ {from:'A',to:'B',weight:4},{from:'A',to:'C',weight:2},{from:'B',to:'D',weight:5},{from:'C',to:'D',weight:4},{from:'B',to:'C',weight:1} ];
const LVL5_OPTIONS = [ {path:'A-B-D', total:9}, {path:'A-C-D', total:6}, {path:'A-B-C-D', total:9}, {path:'A-C-B-D', total:8} ];
function renderLevel5(){
  const content = document.getElementById('levelContent');
  content.innerHTML = `
    <div class="level-instructions"><h3><i class="fa-solid fa-weight-hanging"></i> Jalur Paling Efisien</h3>
    <p>Setiap edge memiliki bobot (misal: jarak dalam km). Pilih jalur dari A ke D dengan <strong>total bobot terkecil</strong>.</p></div>
    <div class="graph-canvas" id="lvl5Graph" style="max-width:460px;"></div>
    <div class="answer-grid two" id="lvl5Options"></div>`;
  document.getElementById('lvl5Graph').innerHTML = svgGraph(LVL5_NODES, LVL5_EDGES, {uid:nextUid(), width:440, height:400});
  const wrap = document.getElementById('lvl5Options');
  const minTotal = Math.min(...LVL5_OPTIONS.map(o=>o.total));
  LVL5_OPTIONS.forEach(opt => {
    const card = document.createElement('div');
    card.className = 'answer-card'; card.innerHTML = `${opt.path}<br><small>Total: ${opt.total}</small>`;
    card.addEventListener('click', () => {
      if (wrap.querySelector('.correct, .wrong')) return;
      const correct = opt.total === minTotal;
      card.classList.add(correct?'correct':'wrong');
      wrap.querySelectorAll('.answer-card').forEach((c,i)=>{ if (LVL5_OPTIONS[i].total===minTotal) c.classList.add('correct'); });
      addScore(correct?150:0, correct);
      showFeedback(correct, `Jalur paling efisien adalah A-C-D dengan total bobot ${minTotal}.`);
    });
    wrap.appendChild(card);
  });
}

/* -------- LEVEL 6: Benar atau Salah -------- */
const LVL6_QUESTIONS = [
  { q:'Setiap graph pasti memiliki root seperti tree.', a:false, exp:'Salah. Graph tidak harus memiliki root, berbeda dengan tree.' },
  { q:'Pada directed graph, arah hubungan antar vertex diperhatikan.', a:true, exp:'Benar. Directed graph memiliki arah pada setiap edge-nya.' },
  { q:'Weighted graph memberikan nilai/bobot pada setiap edge.', a:true, exp:'Benar. Bobot dapat berupa jarak, biaya, waktu, atau kecepatan.' },
  { q:'Graph tidak dapat digunakan untuk merepresentasikan jaringan komputer.', a:false, exp:'Salah. Jaringan komputer adalah salah satu penerapan graph.' },
  { q:'Graph dapat memiliki siklus (kembali ke vertex yang sama).', a:true, exp:'Benar. Berbeda dengan tree, graph dapat memiliki siklus.' },
];
let lvl6Idx = 0, lvl6Correct = 0;
function renderLevel6(){
  lvl6Idx = 0; lvl6Correct = 0;
  renderLevel6Q();
}
function renderLevel6Q(){
  const content = document.getElementById('levelContent');
  if (lvl6Idx >= LVL6_QUESTIONS.length){
    const allCorrect = lvl6Correct === LVL6_QUESTIONS.length;
    addScore(lvl6Correct*30, allCorrect);
    showFeedback(allCorrect, `Kamu menjawab benar ${lvl6Correct} dari ${LVL6_QUESTIONS.length} pernyataan.`);
    return;
  }
  const item = LVL6_QUESTIONS[lvl6Idx];
  content.innerHTML = `
    <div class="level-instructions"><h3><i class="fa-solid fa-circle-check"></i> Benar atau Salah</h3>
    <p>Pernyataan ${lvl6Idx+1} dari ${LVL6_QUESTIONS.length}</p></div>
    <div class="level-story" style="text-align:center; font-size:1.1rem; font-weight:600;">${item.q}</div>
    <div class="answer-grid two">
      <div class="answer-card" data-val="true">Benar</div>
      <div class="answer-card" data-val="false">Salah</div>
    </div>`;
  content.querySelectorAll('.answer-card').forEach(card => {
    card.addEventListener('click', () => {
      if (content.querySelector('.correct, .wrong')) return;
      const val = card.dataset.val === 'true';
      const correct = val === item.a;
      card.classList.add(correct ? 'correct':'wrong');
      if (!correct) content.querySelector(`[data-val="${item.a}"]`).classList.add('correct');
      if (correct){ lvl6Correct++; sfxCorrect(); } else sfxWrong();
      setTimeout(() => { lvl6Idx++; renderLevel6Q(); }, 1300);
    });
  });
}

/* -------- LEVEL 7: Studi kasus pertemanan -------- */
const LVL7_NODES = [ {id:'Ani',label:'Ani',x:80,y:80},{id:'Budi',label:'Budi',x:320,y:80},{id:'Citra',label:'Citra',x:340,y:280},{id:'Dedi',label:'Dedi',x:60,y:280} ];
const LVL7_TARGET = [ ['Ani','Budi'], ['Budi','Citra'], ['Citra','Dedi'] ];
let lvl7Selected = null, lvl7Edges = [];
function renderLevel7(){
  lvl7Selected = null; lvl7Edges = [];
  const content = document.getElementById('levelContent');
  content.innerHTML = `
    <div class="level-instructions"><h3><i class="fa-solid fa-user-group"></i> Studi Kasus: Hubungan Pertemanan</h3>
    <p>Cerita: <strong>Ani berteman dengan Budi</strong>, <strong>Budi berteman dengan Citra</strong>, dan <strong>Citra berteman dengan Dedi</strong>. Klik dua titik (vertex) secara berurutan untuk menggambar edge pertemanan yang sesuai.</p></div>
    <div class="graph-canvas" id="lvl7Graph" style="max-width:420px;"></div>
    <p class="path-select-hint" id="lvl7Hint">Edge tergambar: 0 / ${LVL7_TARGET.length}</p>
    <button class="submit-btn" id="lvl7Submit">Periksa Graph <i class="fa-solid fa-paper-plane"></i></button>`;
  drawLevel7Graph();
  document.getElementById('lvl7Submit').addEventListener('click', () => {
    const normalize = arr => arr.map(e => e.slice().sort().join('-')).sort().join(',');
    const correct = normalize(lvl7Edges) === normalize(LVL7_TARGET) && lvl7Edges.length === LVL7_TARGET.length;
    addScore(correct?150:Math.min(lvl7Edges.length,LVL7_TARGET.length)*30, correct);
    document.getElementById('lvl7Submit').disabled = true;
    showFeedback(correct, 'Graph pertemanan yang tepat: Ani–Budi, Budi–Citra, Citra–Dedi.');
  });
}
function drawLevel7Graph(){
  const el = document.getElementById('lvl7Graph');
  const edgesForRender = lvl7Edges.map(([a,b]) => ({from:a, to:b}));
  el.innerHTML = svgGraph(LVL7_NODES, edgesForRender, {uid:nextUid(), width:400, height:360});
  el.querySelectorAll('.gv-node-circle').forEach(c => {
    if (c.dataset.nodeId === lvl7Selected) c.classList.add('highlight');
    c.addEventListener('click', () => {
      const id = c.dataset.nodeId;
      if (!lvl7Selected){ lvl7Selected = id; drawLevel7Graph(); sfxClick(); return; }
      if (lvl7Selected === id){ lvl7Selected = null; drawLevel7Graph(); return; }
      lvl7Edges.push([lvl7Selected, id]);
      lvl7Selected = null;
      drawLevel7Graph();
      document.getElementById('lvl7Hint').textContent = `Edge tergambar: ${lvl7Edges.length} / ${LVL7_TARGET.length}`;
      sfxClick();
    });
  });
}

/* -------- LEVEL 8: Escape Mission -------- */
const LVL8_NODES = [ {id:'Sekolah',label:'SKL',x:50,y:190},{id:'Aula',label:'AUL',x:180,y:60},{id:'Kantin',label:'KTN',x:180,y:320},{id:'Perpus',label:'PRP',x:340,y:100},{id:'Lab',label:'LAB',x:400,y:250} ];
const LVL8_EDGES = [ {from:'Sekolah',to:'Aula',weight:3},{from:'Sekolah',to:'Kantin',weight:2},{from:'Aula',to:'Perpus',weight:4},{from:'Kantin',to:'Lab',weight:6},{from:'Perpus',to:'Lab',weight:2} ];
const LVL8_OPTIONS = [ {path:'Sekolah-Aula-Perpus-Lab', total:9}, {path:'Sekolah-Kantin-Lab', total:8}, {path:'Sekolah-Aula-Perpus-Lab (lewat Aula)', total:9} ];
function renderLevel8(){
  const content = document.getElementById('levelContent');
  content.innerHTML = `
    <div class="level-instructions"><h3><i class="fa-solid fa-person-running"></i> Escape Mission</h3></div>
    <div class="level-story"><i class="fa-solid fa-scroll"></i> Kamu adalah <strong>kurir sekolah</strong>. Sebuah dokumen penting harus dikirim secepatnya dari <strong>Sekolah</strong> menuju <strong>Laboratorium (LAB)</strong>. Bobot pada setiap jalur menunjukkan waktu tempuh (menit). Pilih jalur paling efisien!</div>
    <div class="graph-canvas" id="lvl8Graph" style="max-width:460px;"></div>
    <div class="answer-grid two" id="lvl8Options"></div>`;
  document.getElementById('lvl8Graph').innerHTML = svgGraph(LVL8_NODES, LVL8_EDGES, {uid:nextUid(), width:440, height:380});
  const wrap = document.getElementById('lvl8Options');
  const uniqueOptions = [ {path:'Sekolah → Aula → Perpus → Lab', total:9}, {path:'Sekolah → Kantin → Lab', total:8} ];
  const minTotal = Math.min(...uniqueOptions.map(o=>o.total));
  uniqueOptions.forEach(opt => {
    const card = document.createElement('div');
    card.className = 'answer-card'; card.innerHTML = `${opt.path}<br><small>Total waktu: ${opt.total} menit</small>`;
    card.addEventListener('click', () => {
      if (wrap.querySelector('.correct, .wrong')) return;
      const correct = opt.total === minTotal;
      card.classList.add(correct?'correct':'wrong');
      wrap.querySelectorAll('.answer-card').forEach((c,i)=>{ if (uniqueOptions[i].total===minTotal) c.classList.add('correct'); });
      addScore(correct?200:0, correct);
      if (correct){
        setTimeout(()=>{ fireConfetti(); }, 150);
        showFeedback(true, 'Misi berhasil! Jalur Sekolah → Kantin → Lab adalah rute tercepat (8 menit). Dokumen berhasil dikirim tepat waktu!');
      } else {
        showFeedback(false, 'Jalur tercepat adalah Sekolah → Kantin → Lab (8 menit).');
      }
    });
    wrap.appendChild(card);
  });
}

const LEVEL_RENDERERS = {
  1: renderLevel1, 2: renderLevel2, 3: renderLevel3, 4: renderLevel4,
  5: renderLevel5, 6: renderLevel6, 7: renderLevel7, 8: renderLevel8,
};

/* ============ 7. HALAMAN PENUTUP ============ */
function finishGame(){
  stopLevelTimer();
  document.getElementById('finalScore').textContent = APP.score;
  document.getElementById('finalCorrect').textContent = APP.correctCount;
  const pct = APP.totalAnswered ? Math.round((APP.correctCount/APP.totalAnswered)*100) : 0;
  document.getElementById('finalPercent').textContent = pct + '%';
  const starCount = pct >= 90 ? 5 : pct >= 75 ? 4 : pct >= 60 ? 3 : pct >= 40 ? 2 : 1;
  document.getElementById('finalStars').textContent = '★'.repeat(starCount) + '☆'.repeat(5-starCount);
  const shelf = document.getElementById('badgeShelf');
  shelf.innerHTML = APP.badges.map(b => `<div class="shelf-badge"><i class="fa-solid ${b.icon}"></i><span>${b.name}</span></div>`).join('');
  showPage('page-final');
  setTimeout(fireConfetti, 300);
}

function resetGame(){
  APP.score = 0; APP.correctCount = 0; APP.totalAnswered = 0; APP.badges = []; APP.levelsDone = {};
  document.getElementById('scoreValue').textContent = 0;
}

/* ============ 8. INISIALISASI ============ */
function initApp(){
  buildCoverBackground();
  bindNav();
  initApersepsi();
  initKomponenTask();
  initKesimpulan();
  initPemantikToggle();
  initJenisCards();
  initMiniQuiz();
  initPenerapanCards();
  showPage('page-cover');

  // Petunjuk modal
  const modal = document.getElementById('petunjukModal');
  document.getElementById('btnHelp').addEventListener('click', () => modal.classList.add('show'));
  document.getElementById('btnPetunjukCover').addEventListener('click', () => modal.classList.add('show'));
  document.getElementById('closePetunjuk').addEventListener('click', () => modal.classList.remove('show'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });

  // Sound toggle
  document.getElementById('btnSound').addEventListener('click', toggleMusic);

  // Theme toggle (dark/light) — persisted via localStorage
  const themeBtn = document.getElementById('btnTheme');
  const savedTheme = localStorage.getItem('ga_theme');
  if (savedTheme === 'dark'){ document.body.setAttribute('data-theme','dark'); themeBtn.querySelector('i').className='fa-solid fa-sun'; }
  themeBtn.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    if (isDark){ document.body.removeAttribute('data-theme'); themeBtn.querySelector('i').className='fa-solid fa-moon'; localStorage.setItem('ga_theme','light'); }
    else { document.body.setAttribute('data-theme','dark'); themeBtn.querySelector('i').className='fa-solid fa-sun'; localStorage.setItem('ga_theme','dark'); }
    if (APP.currentPage === 'page-ringkasan') renderMindmap();
  });

  // Fullscreen toggle (disembunyikan di perangkat yang tidak mendukung, misalnya iPhone)
  if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) document.getElementById('btnFullscreen').style.display = 'none';
  document.getElementById('btnFullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
    else document.exitFullscreen();
  });

  // Play again
  document.getElementById('btnPlayAgain').addEventListener('click', () => {
    resetGame();
    showPage('page-game-hub');
    renderLevelHub();
  });
}
