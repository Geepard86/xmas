/* Rätselhafte Weihnachtszeit – Die verschwundenen Werte · Web-Adventskalender */
(() => {
'use strict';
const YEAR = 2026, KEY = 'wh2026', DEDICATION = 'Sandra';
const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
let DATA = null;

/* ---------------- Speicher: localStorage + IndexedDB-Spiegel ---------------- */
const blank = () => ({ v: 1, name: DEDICATION, answers: {}, tips: {}, notes: {}, sus: {}, grid: {}, wish: '', introSeen: false });
let S = blank();
let db = null;
function idb() {
  return new Promise(res => {
    try {
      const r = indexedDB.open('wh2026db', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { db = r.result; res(db); };
      r.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}
function idbGet(k) { return new Promise(res => { if (!db) return res(null); const t = db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null); }); }
function idbSet(k, v) { if (!db) return; try { db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch (e) {} }
function score(s) { return Object.values(s.answers || {}).reduce((n, a) => n + a.length, 0); }
async function load() {
  await idb();
  let a = null, b = null;
  try { a = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  b = await idbGet('state');
  // Der Stand mit mehr gelösten Rätseln gewinnt – so geht nichts verloren, wenn ein Speicher gelöscht wurde
  const best = [a, b].filter(Boolean).sort((x, y) => score(y) - score(x))[0];
  if (best) S = Object.assign(blank(), best);
  save();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  idbSet('state', S);
}

/* ---------------- Datum / Freischaltung ---------------- */
const preview = new URLSearchParams(location.search).get('vorschau') === 'tim';
if (preview) sessionStorage.setItem('wh-preview', '1');
const isPreview = () => sessionStorage.getItem('wh-preview') === '1';
function openUntil() {
  if (isPreview()) return 24;
  const n = new Date();
  if (n >= new Date(YEAR, 11, 24)) return 24;          // ab 24.12.2026 dauerhaft alles offen
  if (n.getFullYear() === YEAR && n.getMonth() === 11) return n.getDate();
  return 0;
}
const isOpen = d => d <= openUntil();
const solvedSteps = d => (S.answers[d] || []).length;
const stepsOf = d => (d === 6 || d === 7) ? 2 : 1;
const isSolved = d => solvedSteps(d) >= stepsOf(d);
const solvedCount = () => Array.from({ length: 23 }, (_, i) => i + 1).filter(isSolved).length;
const magic = () => 8 + 4 * solvedCount();

/* ---------------- Namen ---------------- */
function poss(n) { return /[sßxz]$/i.test(n) ? n + '’' : n + 's'; }
function personalize(t) {
  const n = (S.name || DEDICATION).trim() || DEDICATION;
  return t.replace(/\bSandras\b/g, poss(n)).replace(/\bSandra\b/g, n);
}
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const P = t => esc(personalize(t));

/* ---------------- Kryptografie (Fortsetzungen erst mit richtiger Antwort lesbar) ---------------- */
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function decrypt(enc, answer, salt) {
  const raw = new TextEncoder().encode(answer.normalize('NFC').trim().toUpperCase());
  const base = await crypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 60000 },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(enc.iv) }, key, b64(enc.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
const cache = {};   // entschlüsselte Inhalte je Tag/Schritt
async function unlockChain(d) {
  const day = DATA.days[d - 1]; const ans = S.answers[d] || [];
  let step = day.step, out = [];
  for (let i = 0; i < ans.length && step; i++) {
    const k = d + '-' + (i + 1);
    if (!cache[k]) { try { cache[k] = await decrypt(step.enc, ans[i], `wh${d}-${i + 1}`); } catch (e) { S.answers[d] = ans.slice(0, i); save(); break; } }
    out.push(cache[k]); step = cache[k].next || null;
  }
  return { results: out, current: step };
}

/* ---------------- UI-Helfer ---------------- */
function go(html, after) { view.classList.remove('enter'); void view.offsetWidth; view.innerHTML = html; view.classList.add('enter'); window.scrollTo({ top: 0 }); after && after(); }
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => el.hidden = true, 2600); }
function modal(html, onOpen) { $('#modalBody').innerHTML = '<button class="xclose" data-close aria-label="Schließen">✕</button>' + html; $('#modal').hidden = false; onOpen && onOpen($('#modalBody')); }
function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });
function seal(n, pct, size = 42) {
  const st = Array.from({ length: 12 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 6; const x = 50 + 37 * Math.cos(a), y = 50 + 37 * Math.sin(a);
    const p = Array.from({ length: 10 }, (_, j) => { const r = j % 2 ? 1.5 : 3.6, b = -Math.PI / 2 + j * Math.PI / 5; return (x + r * Math.cos(b)).toFixed(1) + ',' + (y + r * Math.sin(b)).toFixed(1); }).join(' ');
    return `<polygon points="${p}" fill="#B08D3C"/>`; }).join('');
  return `<svg class="seal" width="${size}" height="${size}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="49" fill="#961E1E"/><circle cx="50" cy="50" r="44.5" fill="none" stroke="#B08D3C" stroke-width="1.6"/>${st}
  <text x="50" y="${pct ? 56 : 62}" text-anchor="middle" font-family="Lora" font-size="${pct ? 34 : 40}" fill="#fff">${n}</text>${pct ? `<text x="50" y="76" text-anchor="middle" font-family="Lora" font-size="12" fill="#F5E6C8">${pct} %</text>` : ''}</svg>`;
}
function burst() {
  for (let i = 0; i < 26; i++) { const b = document.createElement('div'); b.className = 'magic-burst';
    b.style.left = (40 + Math.random() * 20) + 'vw'; b.style.top = (55 + Math.random() * 25) + 'vh'; b.style.setProperty('--dx', (Math.random() * 60 - 30) + 'vw');
    b.style.animationDelay = (Math.random() * .4) + 's'; document.body.appendChild(b); setTimeout(() => b.remove(), 2200); }
}

/* ---------------- Startseite ---------------- */
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
function home() {
  const now = new Date(), today = (now.getFullYear() === YEAR && now.getMonth() === 11) ? now.getDate() : 0;
  const r = rng(now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate());
  const order = DATA.days.slice().map(x => [r(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
  const doors = order.map((day, idx) => {
    const d = day.day, o = isOpen(d), sv = d < 24 ? isSolved(d) : !!(S.answers[24] || []).length;
    const sunday = /ADVENT/.test(day.kicker) || d === 24;
    const tx = (r() * 160 - 80).toFixed(0), ty = (r() * 160 - 80).toFixed(0), rot = (r() * 360 - 180).toFixed(0);
    return `<button class="door ${o ? '' : 'locked'} ${sv ? 'solved' : ''} ${sunday ? 'sunday' : ''} ${d === today && !sv ? 'today' : ''}" data-d="${d}" aria-label="Türchen ${d}"
      style="--tx:${tx}px;--ty:${ty}px;--rot:${rot}deg;animation-delay:${(idx * 0.035).toFixed(2)}s">
      <span class="behind">${sv && d < 24 ? seal(d, 0, 50) : '<span class="spark">✦</span>'}<span class="bh-ort">${o ? esc(day.ort) : ''}</span>${o && day.wert ? `<span class="bh-wert">${esc(day.wert)}</span>` : ''}</span>
      <span class="front"><span class="num">${d}</span><span class="lbl">${o ? (sv ? 'gelöst' : '') : 'öffnet am ' + d + '.12.'}</span></span></button>`;
  }).join('');
  go(`<section class="hero">
      <h1>Rätselhafte<br>Weihnachtszeit</h1>
      <div class="orn">✦</div>
      <div class="sub">Die verschwundenen Werte</div>
      <div class="dedic">Ein persönlicher Rätsel-Adventskalender für ${DEDICATION}</div>
      ${S.name && S.name !== DEDICATION ? `<div class="player">Es rätselt: <b>${esc(S.name)}</b></div>` : ''}
    </section>
    <div class="baro"><div class="baro-label"><span>Weihnachtsmagie</span><span>${magic()} %</span></div>
      <div class="baro-track"><div class="baro-fill" id="baroFill"></div></div></div>
    <div class="doors swirl">${doors}</div>
    <div class="home-actions">
      <button class="btn" id="hIntro">Santas Brief &amp; Anleitung</button>
      <button class="btn" id="hSus">Verdächtige (${100 - Object.values(S.sus).filter(Boolean).length})</button>
      ${(S.answers[24] || []).length ? '<button class="btn primary" id="hFin">Das Finale</button>' : ''}
    </div>
    ${openUntil() === 0 ? `<p class="center light small" style="margin-top:1.2rem">Das erste Türchen öffnet sich am 1. Dezember ${YEAR}.</p>` : ''}`,
  () => {
    requestAnimationFrame(() => setTimeout(() => $('#baroFill').style.width = magic() + '%', 60));
    view.querySelectorAll('.door').forEach(b => b.onclick = () => {
      const d = +b.dataset.d;
      if (!isOpen(d)) { toast(`Geduld! Türchen ${d} öffnet sich am ${d}. Dezember.`); return; }
      if (b.classList.contains('open')) { location.hash = '#tag/' + d; return; }
      b.classList.add('open'); setTimeout(() => location.hash = '#tag/' + d, 1100);
    });
    $('#hIntro').onclick = () => location.hash = '#intro';
    $('#hSus').onclick = () => location.hash = '#verdaechtige';
    const f = $('#hFin'); if (f) f.onclick = () => location.hash = '#finale';
  });
}

/* ---------------- Intro ---------------- */
function intro() {
  const I = DATA.intro;
  go(`<article class="paper"><div class="kicker">Ein Brief vom Nordpol</div><div class="porn">★</div>
      <div class="story">${I.brief.map(p => `<p>${P(p)}</p>`).join('')}</div></article>
    <article class="paper"><div class="kicker">Am Nordpol</div><h2 class="ptitle">Willkommen!</h2><div class="porn">★</div>
      <div class="story">${I.willkommen.map(p => `<p>${P(p)}</p>`).join('')}</div></article>
    <article class="paper"><div class="kicker">So funktioniert dein Kalender</div><div class="porn">★</div>
      <div class="story">
      <p><b>Jeden Tag ein Türchen.</b> Ab dem 1. Dezember öffnet sich jeden Tag ein neues Türchen. Verpasste Tage kannst du jederzeit nachholen.</p>
      <p><b>Geschichte und Rätsel.</b> Lies die Geschichte, dann löse das Rätsel. Du kannst direkt auf dem Rätsel malen, markieren und dir Notizen machen.</p>
      <p><b>Deine Antwort.</b> Tippe die Antwort an, die du für richtig hältst. Ist sie richtig, geht die Geschichte weiter und du erhältst einen Hinweis auf den Täter.</p>
      <p><b>Tipps.</b> Kommst du nicht weiter, öffne die Tipps nacheinander. Der Lösungsweg kommt ganz zum Schluss.</p>
      <p><b>Die Verdächtigen.</b> Hake mit jedem Hinweis die Verdächtigen ab, die es nicht gewesen sein können. Am 24. bleibt genau einer übrig.</p>
      <p><b>Dein Fortschritt</b> wird auf diesem Gerät gespeichert. Im Menü kannst du einen Sicherungscode erstellen und ihn auf jedem Gerät wieder einlesen.</p>
      </div></article>
    <article class="paper"><div class="kicker">Prolog</div><h2 class="ptitle">Die Reise zum Nordpol</h2><div class="porn">★</div>
      <div class="story">${I.prolog.map(p => `<p>${P(p)}</p>`).join('')}</div></article>
    <div class="center"><button class="btn primary" id="iGo">Zum Adventskalender</button></div>`,
  () => { $('#iGo').onclick = () => { S.introSeen = true; save(); location.hash = '#'; }; });
}

/* ---------------- Tagesansicht ---------------- */
async function dayView(d) {
  if (!isOpen(d)) { location.hash = '#'; return; }
  const day = DATA.days[d - 1];
  const { results, current } = await unlockChain(d);
  const first = day.step;
  // Schritte rendern: gelöste Schritte mit ihrer Fortsetzung, dann ggf. aktueller Schritt
  let html = `<article class="paper"><div class="kicker">${esc(day.kicker)}</div><h2 class="ptitle">${esc(day.ort)}</h2>
    ${day.wert ? `<div class="pwert">Was hier fehlt: ${esc(day.wert)}</div>` : ''}<div class="porn">★</div>
    <div class="story">${day.story.map(p => `<p>${P(p)}</p>`).join('')}</div></article>`;
  let step = first;
  for (let i = 0; i < results.length; i++) {
    html += puzzleCard(d, i + 1, step, S.answers[d][i]);
    html += endingCard(d, results[i], i);
    step = results[i].next || null;
  }
  if (current) html += puzzleCard(d, results.length + 1, current, null);
  html += `<div class="navrow">${d > 1 && isOpen(d - 1) ? `<button class="btn ghost" id="prevD">‹ Tag ${d - 1}</button>` : '<span></span>'}
    <button class="btn ghost" id="toHome">Kalender</button>${d < 24 && isOpen(d + 1) ? `<button class="btn ghost" id="nextD">Tag ${d + 1} ›</button>` : '<span></span>'}</div>`;
  go(html, () => {
    view.querySelectorAll('[data-step]').forEach(card => wirePuzzle(card, d));
    const pv = $('#prevD'), nx = $('#nextD'); if (pv) pv.onclick = () => location.hash = '#tag/' + (d - 1); if (nx) nx.onclick = () => location.hash = '#tag/' + (d + 1);
    $('#toHome').onclick = () => location.hash = '#';
    const fin = $('#toFinale'); if (fin) fin.onclick = () => location.hash = '#finale';
  });
}
function puzzleCard(d, n, step, solvedWith) {
  const k = d + '-' + n, opened = S.tips[k] || 0;
  const ml = Math.max(...step.options.map(o => o.length)); const wide = ml > 14 ? 'wide' : ml > 4 ? 'mid' : '';
  return `<article class="paper puzzle" data-step="${n}">
    <div class="kicker">Rätsel des Tages${stepsOf(d) > 1 ? ' · Teil ' + n + ' von 2' : ''}</div>
    <h3 class="ptitle sm">${esc(step.title)}</h3>
    <div class="stage-slot"><div class="stage" id="st-${k}">
      <div class="stage-bar"><span class="sb-title">${esc(step.title)}</span><button class="zbtn" data-notes aria-label="Notizen">✎</button><button class="zbtn" data-z="-">−</button><button class="zbtn" data-z="+">+</button><button class="zbtn xfs" aria-label="Vollbild schließen">✕</button></div>
      <div class="pz-wrap"><div class="pz-inner"><img src="${step.img}" alt="${esc(step.title)}"><canvas></canvas>${step.grid && step.grid.blocks.length ? `<div class="gridlayer" data-k="${k}"></div>` : ''}${step.grid && step.grid.type === 'count' ? '<div class="countlayer"></div>' : ''}</div></div>
      <div class="tools">
        ${step.grid && step.grid.blocks.length ? '<button class="tool on" data-t="grid" title="In die Felder eintragen">▦</button>' : ''}
        ${step.grid && step.grid.type === 'count' ? '<button class="tool on" data-t="count" title="Schritte zählen">👣 <span class="cnt">0</span></button>' : ''}
        <button class="tool ${step.grid ? '' : 'on'}" data-t="hand" title="Blättern">✋</button>
        <button class="tool" data-t="pen" title="Stift">✎</button>
        <button class="tool" data-t="marker" title="Marker">▮</button>
        <button class="tool" data-t="x" title="Kreuz setzen">✗</button>
        <button class="tool" data-t="o" title="Kreis setzen">◯</button>
        <button class="tool" data-t="erase" title="Radierer">⌫</button>
        <span class="sws"><button class="sw on" data-c="#c0392b" style="background:#c0392b"></button><button class="sw" data-c="#1f4d3a" style="background:#1f4d3a"></button><button class="sw" data-c="#2357c6" style="background:#2357c6"></button><button class="sw" data-c="#2b2622" style="background:#2b2622"></button></span>
        <button class="tool" data-t="undo" title="Rückgängig">↶</button>
        <button class="tool" data-t="clear" title="Alles löschen">🗑</button>
        <button class="tool fsbtn" data-t="fs" title="Vollbild">⛶ Vollbild</button>
      </div>
      <div class="fsnotes" hidden><textarea placeholder="Deine Notizen …"></textarea></div>
    </div></div>
    ${step.grid && step.grid.type === 'ws' ? `<div class="wslist" id="wsl-${k}"></div>` : ''}
    <textarea class="notes" placeholder="Deine Notizen …" data-k="${k}">${esc(S.notes[k] || '')}</textarea>
    <div class="q">${esc(step.question || 'Deine Antwort')}</div>
    <div class="opts ${wide}">${step.options.map(o => `<button class="opt ${solvedWith && o === solvedWith ? 'right' : ''}" ${solvedWith ? 'disabled' : ''} data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>
    <div class="tips">${['Tipp 1', 'Tipp 2', 'Tipp 3', 'Lösungsweg'].map((t, i) => `<div class="tip"><button data-tip="${i}" ${i > opened ? 'disabled' : ''}>${i < opened ? '▾' : '▸'} ${t}</button>${i < opened ? `<div class="tt">${P(step.tips[i])}</div>` : ''}</div>`).join('')}</div>
  </article>`;
}
function endingCard(d, r, i) {
  let h = `<article class="paper ending"><div class="kicker">${d}. Dezember · Fortsetzung</div><div class="porn">★</div>
    ${r.paras.map(p => `<p>${P(p)}</p>`).join('')}`;
  if (r.box) {
    const [hh, a, w] = r.box;
    h += `<div class="box">${seal(d, magicAt(d), 64)}<div class="bt"><div class="h">${esc(hh)}</div><div class="a">${esc(a)}</div><div class="w">${esc(w || '')}</div></div></div>
      <div class="center" style="margin-top:.8rem"><button class="btn" onclick="location.hash='#verdaechtige'">Zur Verdächtigenliste</button></div>`;
  }
  if (r.finale) h += `<div class="center"><button class="btn primary" id="toFinale">Weiter zum Finale</button></div>`;
  return h + '</article>';
}
const magicAt = d => 8 + 4 * d;

const TRACK = { h: 'M0,50 H100', v: 'M50,0 V100', ne: 'M50,0 Q50,50 100,50', nw: 'M50,0 Q50,50 0,50', se: 'M100,50 Q50,50 50,100', sw: 'M0,50 Q50,50 50,100' };
const KOPPEL_COL = ['', 'rgba(192,57,43,.30)', 'rgba(35,87,198,.28)', 'rgba(31,140,80,.30)', 'rgba(233,170,40,.38)'];
function cellHTML(type, v) {
  if (!v) return '';
  if (type === 'track') return v === 'x' ? '<b class="cx">✗</b>' : `<svg viewBox="0 0 100 100"><path d="${TRACK[v]}" stroke="#2357c6" stroke-width="16" fill="none" stroke-linecap="round"/><path d="${TRACK[v]}" stroke="#fff" stroke-width="4" fill="none" stroke-dasharray="6 10"/></svg>`;
  if (type === 'color') return '';
  if (type === 'hl') return '';
  if (type === 'pick') return `<b class="pk">${esc(v === '✗' ? '✗' : v.slice(0, 2))}</b>`;
  return `<b class="${v === '✗' ? 'cx' : 'cv'}">${esc(v)}</b>`;
}
function picker(title, opts, cb) {
  modal(`<h3>${esc(title)}</h3><div class="picker">${opts.map(o => `<button class="opt" data-v="${esc(o[0])}">${o[1]}</button>`).join('')}</div>`, b => {
    b.querySelectorAll('[data-v]').forEach(x => x.onclick = () => { closeModal(); cb(x.dataset.v); });
  });
}
const WS_COL = { 'Orte': 'rgba(35,87,198,.38)', 'Gefäße': 'rgba(214,140,30,.42)', 'Gründe': 'rgba(130,70,190,.38)', 'Werte': 'rgba(31,140,80,.38)', 'Hl. Nacht': 'rgba(200,50,60,.36)' };
function wsWord(grid, a, b) {
  const [r1, c1] = a, [r2, c2] = b, dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1), n = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1));
  if (!(r1 === r2 || c1 === c2 || Math.abs(r2 - r1) === Math.abs(c2 - c1))) return null;
  const cells = []; let w = '';
  for (let i = 0; i <= n; i++) { const r = r1 + dr * i, c = c1 + dc * i; cells.push([r, c]); w += [...grid.letters[r]][c]; }
  for (const [cat, ws] of Object.entries(grid.cats)) for (const word of ws) if (word === w || word === [...w].reverse().join('')) return { word, cat, cells };
  return null;
}
function sudokuDups(layer, st) {
  const v = (r, c) => st['0.' + r + '.' + c] || '';
  layer.querySelectorAll('.cell').forEach(el => {
    const [, r, c] = el.dataset.id.split('.').map(Number), x = v(r, c); let dup = false;
    if (x) for (let i = 0; i < 9 && !dup; i++) {
      if (i !== c && v(r, i) === x) dup = true; if (i !== r && v(i, c) === x) dup = true;
      const br = 3 * Math.floor(r / 3) + Math.floor(i / 3), bc = 3 * Math.floor(c / 3) + i % 3; if ((br !== r || bc !== c) && v(br, bc) === x) dup = true;
    }
    el.classList.toggle('dup', dup);
  });
}
function buildGrid(layer, grid, k) {
  const st = S.grid[k] || (S.grid[k] = {});
  layer.innerHTML = grid.blocks.map((b, bi) => {
    let h = '';
    for (let r = 0; r < b.rows; r++) for (let c = 0; c < b.cols; c++) {
      const id = bi + '.' + r + '.' + c, w = (b.x1 - b.x0) / b.cols, hh = (b.y1 - b.y0) / b.rows;
      const v = st[id] || '';
      let bg = grid.type === 'color' ? KOPPEL_COL[+v || 0] : grid.type === 'hl' && v ? 'rgba(255,214,64,.55)' : '';
      if (grid.type === 'ws') { const f = (st.found || []).find(x => x.cells.some(([rr, cc]) => rr === r && cc === c)); bg = f ? WS_COL[f.cat] : ''; }
      h += `<div class="cell" data-id="${id}" style="left:${(b.x0 + c * w) * 100}%;top:${(b.y0 + r * hh) * 100}%;width:${w * 100}%;height:${hh * 100}%;${bg ? 'background:' + bg : ''}">${cellHTML(grid.type, v)}</div>`;
    }
    return h;
  }).join('');
  if (grid.type === 'num') sudokuDups(layer, st);
  if (grid.type === 'ws') renderWsList(layer, grid, st);
  const fit = () => { const c = layer.querySelector('.cell'); if (c) layer.style.setProperty('--ch', c.getBoundingClientRect().height + 'px'); };
  new ResizeObserver(fit).observe(layer); fit();
  layer.onclick = e => {
    const cell = e.target.closest('.cell'); if (!cell || !layer.parentElement.classList.contains('gridmode')) return;
    const id = cell.dataset.id, cur = st[id] || '';
    const set = v => { if (v) st[id] = v; else delete st[id]; save();
      cell.innerHTML = cellHTML(grid.type, v);
      cell.style.background = grid.type === 'color' ? KOPPEL_COL[+v || 0] : grid.type === 'hl' && v ? 'rgba(255,214,64,.55)' : ''; };
    if (grid.type === 'ws') {
      const [, r, c] = id.split('.').map(Number);
      if (!layer._sel) { layer._sel = [r, c]; cell.classList.add('sel'); return; }
      const hit = wsWord(grid, layer._sel, [r, c]); layer.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); layer._sel = null;
      if (!hit) { toast('Kein Wort aus der Liste – versuch es noch einmal.'); return; }
      st.found = (st.found || []).filter(f => f.word !== hit.word).concat([hit]); save(); buildGrid(layer, grid, k);
      toast('Gefunden: ' + hit.word); return;
    }
    if (grid.type === 'mark') set({ '': '✗', '✗': '✓', '✓': '' }[cur]);
    else if (grid.type === 'path') set({ '': '●', '●': '✗', '✗': '' }[cur]);
    else if (grid.type === 'color') set(String(((+cur || 0) + 1) % 5) === '0' ? '' : String((+cur || 0) + 1));
    else if (grid.type === 'hl') set(cur ? '' : '1');
    else if (grid.type === 'num') picker('Zahl eintragen', [...'123456789'].map(n => [n, n]).concat([['', 'leer']]), v => { set(v); sudokuDups(layer, st); });
    else if (grid.type === 'pick') picker('Wer steht hier?', grid.options.map(o => [o, esc(o)]).concat([['', 'leer']]), set);
    else if (grid.type === 'track') picker('Gleisstück wählen', [['h', svgP('h')], ['v', svgP('v')], ['ne', svgP('ne')], ['nw', svgP('nw')], ['se', svgP('se')], ['sw', svgP('sw')], ['x', '✗'], ['', 'leer']], set);
  };
}
function renderWsList(layer, grid, st) {
  const box = layer.closest('.paper, .stage') && document.getElementById('wsl-' + layer.dataset.k); if (!box) return;
  const found = new Set((st.found || []).map(f => f.word));
  box.innerHTML = Object.entries(grid.cats).map(([cat, ws]) => `<div class="wsrow"><b>${esc(cat)}:</b> ${ws.map(w => `<span class="wsw ${found.has(w) ? 'done' : ''}" style="${found.has(w) ? '--wc:' + WS_COL[cat] : ''}">${esc(w)}</span>`).join(' ')}</div>`).join('')
    + `<div class="small">Tippe den ersten und den letzten Buchstaben eines Wortes an. Gefunden: ${found.size} von ${Object.values(grid.cats).flat().length}</div>`;
}
const svgP = t => `<svg viewBox="0 0 100 100" width="44" height="44"><rect width="100" height="100" fill="#faf7f0" stroke="#cdc6b9"/><path d="${TRACK[t]}" stroke="#2357c6" stroke-width="14" fill="none" stroke-linecap="round"/></svg>`;
function wirePuzzle(card, d) {
  const n = +card.dataset.step, k = d + '-' + n, step = currentStepObj(d, n);
  const stage = card.querySelector('.stage'), slot = card.querySelector('.stage-slot');
  const inner = stage.querySelector('.pz-inner'), img = inner.querySelector('img'), cv = inner.querySelector('canvas'), ctx = cv.getContext('2d');
  const layer = inner.querySelector('.gridlayer');
  let tool = step && step.grid ? 'grid' : 'hand', color = '#c0392b', drawing = false, last = null, hist = [], zoom = 1;
  if (layer) { buildGrid(layer, step.grid, k); inner.classList.add('gridmode'); }
  const cl = inner.querySelector('.countlayer');
  const drawCount = () => { const pts = (S.grid[k] || {}).pts || []; cl.innerHTML = pts.map((p, i) => `<span class="step" style="left:${p[0] * 100}%;top:${p[1] * 100}%">${i + 1}</span>`).join('');
    stage.querySelectorAll('.cnt').forEach(x => x.textContent = pts.length); };
  if (cl) { tool = 'count'; inner.classList.add('countmode'); drawCount();
    cl.onclick = e => { if (tool !== 'count') return; const b = inner.getBoundingClientRect(); const st = S.grid[k] || (S.grid[k] = {});
      (st.pts = st.pts || []).push([(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]); save(); drawCount(); }; }
  const fit = async () => {
    cv.width = img.naturalWidth || 1200; cv.height = img.naturalHeight || 1400;
    const saved = await idbGet('draw-' + k) || localStorage.getItem('wh-draw-' + k);
    if (saved) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, cv.width, cv.height); im.src = saved; }
  };
  img.complete ? fit() : img.addEventListener('load', fit);
  const pos = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * cv.width / b.width, (e.clientY - b.top) * cv.height / b.height]; };
  const persist = () => { clearTimeout(cv._t); cv._t = setTimeout(() => { const u = cv.toDataURL('image/png'); idbSet('draw-' + k, u); try { localStorage.setItem('wh-draw-' + k, u); } catch (e) {} }, 600); };
  const snap = () => { hist.push(ctx.getImageData(0, 0, cv.width, cv.height)); if (hist.length > 20) hist.shift(); };
  cv.addEventListener('pointerdown', e => {
    if (tool === 'hand' || tool === 'grid') return; e.preventDefault();
    const p = pos(e), sc = cv.width / cv.getBoundingClientRect().width * (zoom > 1 ? 1 : 1);
    if (tool === 'x' || tool === 'o') {
      snap(); const s = 13 * cv.width / 1100; ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = color; ctx.lineWidth = 4.5 * cv.width / 1100; ctx.lineCap = 'round';
      ctx.beginPath();
      if (tool === 'x') { ctx.moveTo(p[0] - s, p[1] - s); ctx.lineTo(p[0] + s, p[1] + s); ctx.moveTo(p[0] + s, p[1] - s); ctx.lineTo(p[0] - s, p[1] + s); }
      else ctx.arc(p[0], p[1], s * 1.3, 0, 7);
      ctx.stroke(); persist(); return;
    }
    cv.setPointerCapture(e.pointerId); drawing = true; last = p; snap();
  });
  cv.addEventListener('pointermove', e => {
    if (!drawing) return; const p = pos(e), sc = cv.width / cv.getBoundingClientRect().width;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = tool === 'marker' ? color + '55' : color; ctx.lineWidth = (tool === 'marker' ? 16 : tool === 'erase' ? 22 : 3.2) * sc;
    ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...p); ctx.stroke(); last = p;
  });
  const end = () => { if (drawing) { drawing = false; persist(); } };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  const setTool = t => {
    tool = t; stage.querySelectorAll('.tool[data-t]').forEach(x => { if (['grid', 'count', 'hand', 'pen', 'marker', 'x', 'o', 'erase'].includes(x.dataset.t)) x.classList.toggle('on', x.dataset.t === t); });
    inner.classList.toggle('drawing', !['hand', 'grid', 'count'].includes(t)); inner.classList.toggle('gridmode', t === 'grid'); inner.classList.toggle('countmode', t === 'count');
  };
  const setZoom = z => { zoom = Math.max(1, Math.min(4, z)); inner.style.width = (zoom * 100) + '%'; };
  const openFS = () => { document.body.appendChild(stage); stage.classList.add('fs'); document.body.classList.add('noscroll'); setZoom(1); };
  const closeFS = () => { stage.querySelector('.fsnotes').hidden = true; slot.appendChild(stage); stage.classList.remove('fs'); document.body.classList.remove('noscroll'); setZoom(1); };
  stage.querySelectorAll('.tool').forEach(b => b.onclick = () => {
    const t = b.dataset.t;
    if (t === 'undo') { if (tool === 'count' && cl) { const st = S.grid[k] || {}; (st.pts || []).pop(); save(); drawCount(); return; } const h = hist.pop(); if (h) { ctx.putImageData(h, 0, 0); persist(); } return; }
    if (t === 'clear') { if (confirm('Alle Markierungen auf diesem Rätsel löschen?')) { snap(); ctx.clearRect(0, 0, cv.width, cv.height); persist();
        if (layer) { S.grid[k] = {}; save(); buildGrid(layer, step.grid, k); } if (cl) { S.grid[k] = {}; save(); drawCount(); } } return; }
    if (t === 'fs') { stage.classList.contains('fs') ? closeFS() : openFS(); return; }
    setTool(t);
  });
  stage.querySelectorAll('.zbtn[data-z]').forEach(b => b.onclick = () => setZoom(zoom + (b.dataset.z === '+' ? .5 : -.5)));
  stage.querySelector('.xfs').onclick = closeFS;
  const fsn = stage.querySelector('.fsnotes'), fta = fsn.querySelector('textarea'), cta = card.querySelector('.notes');
  stage.querySelector('[data-notes]').onclick = () => { fsn.hidden = !fsn.hidden; if (!fsn.hidden) { fta.value = cta.value; fta.focus(); } };
  fta.oninput = () => { cta.value = fta.value; S.notes[k] = fta.value; clearTimeout(fta._t); fta._t = setTimeout(save, 400); };
  stage._close = closeFS;
  card.querySelectorAll('.sw').forEach(b => b.onclick = () => { color = b.dataset.c; card.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === b)); if (['hand', 'erase', 'grid'].includes(tool)) setTool('pen'); });
  const ta = card.querySelector('.notes'); ta.oninput = () => { S.notes[k] = ta.value; clearTimeout(ta._t); ta._t = setTimeout(save, 400); };
  card.querySelectorAll('[data-tip]').forEach(b => b.onclick = () => {
    const i = +b.dataset.tip; if ((S.tips[k] || 0) > i) return;
    if (i === 3 && !confirm('Wirklich den Lösungsweg anzeigen?')) return;
    S.tips[k] = i + 1; save();
    const tip = b.parentElement; b.textContent = '▾ ' + ['Tipp 1', 'Tipp 2', 'Tipp 3', 'Lösungsweg'][i];
    const tt = document.createElement('div'); tt.className = 'tt'; tt.innerHTML = P(step.tips[i]); tip.appendChild(tt);
    const nb = card.querySelector(`[data-tip="${i + 1}"]`); if (nb) nb.disabled = false;
  });
  card.querySelectorAll('.opt').forEach(b => b.onclick = () => answer(d, n, b));
}
function currentStepObj(d, n) {
  let st = DATA.days[d - 1].step;
  for (let i = 1; i < n; i++) st = (cache[d + '-' + i] || {}).next;
  return st;
}
async function answer(d, n, btn) {
  const { current } = await unlockChain(d);
  if (!current) return;
  const o = btn.dataset.o;
  try {
    const res = await decrypt(current.enc, o, `wh${d}-${n}`);
    cache[d + '-' + n] = res;
    S.answers[d] = (S.answers[d] || []).slice(0, n - 1).concat([o]); save();
    btn.classList.add('right'); burst();
    setTimeout(() => dayView(d).then(() => { const e = view.querySelectorAll('.ending'); e.length && e[e.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' }); }), 700);
  } catch (e) {
    btn.classList.add('wrong'); setTimeout(() => btn.classList.remove('wrong'), 450);
    const w = DATA.wrong[Math.floor(Math.random() * DATA.wrong.length)];
    modal(`<h3>${esc(w[0])}</h3><p>${P(w[1])}</p><p>${P(w[2])}</p><p class="wsig">– W.</p>
      <p class="small">Diese Antwort führt nicht weiter. Prüfe deine Lösung noch einmal.</p><div class="center"><button class="btn primary" data-close>Zurück zum Rätsel</button></div>`);
  }
}

/* ---------------- Verdächtige ---------------- */
const HINT = [p => p.art === 'Tier' && p.gebiet === 'Südufer', p => p.gebiet === 'Santas Anwesen' && p.schal === 'Rot', p => p.art === 'Kobold' && p.geb === 'Lebkuchen',
  p => p.gebiet === 'Dorf' && p.geb === 'Cupcake', p => p.art === 'Troll' && p.lied === 'Jingle Bell Rock', p => p.name.startsWith('B'), p => p.schal === 'Gold' && p.geb === 'Spekulatius',
  p => p.gebiet === 'Zuckerwald' && p.schal === 'Grün', p => p.art === 'Schneewesen' && p.schal === 'Blau', p => p.art === 'Kobold' && +p.alter < 50, p => p.art === 'Tier' && p.geb === 'Vanillekipferl',
  p => p.art === 'Troll' && p.gebiet === 'Zuckerwald', p => p.gebiet === 'Südufer' && p.lied === 'Ave Maria', p => p.art === 'Elf' && p.gebiet === 'Zuckerwald' && p.geb === 'Lebkuchen',
  p => { const w = p.name.split(' '); return w[0][0] === w[w.length - 1][0]; }, p => p.gebiet === 'Nordwälder' && p.schal === 'Grün', p => p.art === 'Troll', p => +p.alter <= 742,
  p => p.geb === 'Spekulatius', p => p.name.split(' ')[0].length > 3, p => p.lied === 'Jingle Bells', p => p.gebiet !== 'Dorf', p => p.schal !== 'Silber'];
const SF = { status: 'alle', art: '', gebiet: '', schal: '', geb: '', lied: '', q: '' };
async function suspects() {
  const hints = [];
  for (let d = 1; d <= 23; d++) { if (!isSolved(d)) continue; const { results } = await unlockChain(d); const b = results.find(r => r.box); if (b) hints.push([d, b.box[1]]); }
  // je Hinweis: wie viele Personen er (nach den vorherigen Hinweisen) betrifft und wie viele davon schon abgehakt sind
  let rest = DATA.suspects.slice(); const counts = {};
  for (let d = 1; d <= 23; d++) { const hit = rest.filter(HINT[d - 1]); rest = rest.filter(p => !HINT[d - 1](p)); counts[d] = [hit.filter(p => S.sus[p.nr]).length, hit.length]; }
  const vals = f => [...new Set(DATA.suspects.map(p => p[f]))].sort();
  const list = DATA.suspects.filter(s => (SF.status === 'alle' || (SF.status === 'offen' ? !S.sus[s.nr] : S.sus[s.nr]))
    && ['art', 'gebiet', 'schal', 'geb', 'lied'].every(f => !SF[f] || s[f] === SF[f]) && (!SF.q || s.name.toLowerCase().includes(SF.q.toLowerCase())));
  const left = DATA.suspects.filter(s => !S.sus[s.nr]).length;
  const sel = (f, lab) => `<select data-sf="${f}"><option value="">${lab}: alle</option>${vals(f).map(v => `<option ${SF[f] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
  go(`<article class="paper"><div class="kicker">Die Akte</div><h2 class="ptitle">Die Verdächtigen</h2><div class="porn">★</div>
      <p class="center small">Noch nicht abgehakt: <b>${left}</b> von 100 · Tippe eine Person an, um sie abzuhaken.</p>
      ${hints.length ? `<details open><summary><b>Deine Hinweise (${hints.length})</b></summary><ol class="hints">${hints.map(h => { const [x, y] = counts[h[0]];
        return `<li value="${h[0]}">${esc(h[1].replace('➜ ', ''))} <span class="hc ${x >= y ? 'ok' : ''}">${x >= y ? '✓ erledigt' : `${x} von ${y} abgehakt`}</span></li>`; }).join('')}</ol></details>` : '<p class="small center">Hinweise erhältst du mit jedem gelösten Rätsel.</p>'}
      <div class="filters">${['alle', 'offen', 'abgehakt'].map(f => `<button class="tool ${SF.status === f ? 'on' : ''}" data-f="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}</div>
      <div class="selects">${sel('art', 'Art')}${sel('gebiet', 'Wohngebiet')}${sel('schal', 'Schal')}${sel('geb', 'Gebäck')}${sel('lied', 'Lied')}
        <input type="search" data-sf="q" placeholder="Name suchen" value="${esc(SF.q)}"></div>
      <p class="small">${list.length} Treffer${list.length ? ' · <button class="linkbtn" id="markAll">alle Treffer abhaken</button>' : ''}</p>
      <div class="sus">${list.map(s => `<div class="s ${S.sus[s.nr] ? 'off' : ''}" data-nr="${s.nr}"><span class="ck">${S.sus[s.nr] ? '✓' : ''}</span><span class="nr">${s.nr}</span>
        <span><div class="nm">${esc(s.name)}</div><div class="at">${esc(s.art)} · ${esc(s.gebiet)} · ${esc(s.alter)} J. · Schal: ${esc(s.schal)} · ${esc(s.geb)} · ${esc(s.lied)}</div></span></div>`).join('')}</div>
    </article><div class="center"><button class="btn ghost" onclick="location.hash='#'">Zum Kalender</button></div>`,
  () => {
    view.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { SF.status = b.dataset.f; suspects(); });
    view.querySelectorAll('select[data-sf]').forEach(s => s.onchange = () => { SF[s.dataset.sf] = s.value; suspects(); });
    const q = view.querySelector('input[data-sf]'); q.onchange = () => { SF.q = q.value; suspects(); };
    const ma = $('#markAll'); if (ma) ma.onclick = () => { if (!confirm(list.length + ' Personen abhaken?')) return; list.forEach(p => S.sus[p.nr] = true); save(); suspects(); };
    view.querySelectorAll('.s').forEach(el => el.onclick = () => { const nr = el.dataset.nr; S.sus[nr] = !S.sus[nr]; save();
      el.classList.toggle('off', !!S.sus[nr]); el.querySelector('.ck').textContent = S.sus[nr] ? '✓' : ''; });
  });
}

/* ---------------- Finale ---------------- */
async function finale() {
  if (!(S.answers[24] || []).length) { location.hash = '#tag/24'; return; }
  const { results } = await unlockChain(24); const f = results[0].finale;
  go(f.map((c, i) => `<article class="paper ending"><div class="kicker">24. Dezember · Fortsetzung ${['I', 'II', 'III'][i]}</div><h2 class="ptitle">${esc(c.title)}</h2><div class="porn">★</div>
      ${c.paras.map(p => `<p>${P(p)}</p>`).join('')}</article>`).join('') +
    `<article class="paper"><div class="kicker">Für dich</div><h2 class="ptitle">Dein Wunsch</h2><div class="porn">★</div>
      <p class="center">Der Wunschhüter hat dir einen einzigen Wunsch für das kommende Jahr geschenkt.</p>
      <textarea class="notes" id="wish" placeholder="Ich wünsche mir …">${esc(S.wish || '')}</textarea></article>
    <div class="center"><button class="btn ghost" onclick="location.hash='#'">Zum Kalender</button></div>`,
  () => { burst(); const w = $('#wish'); w.oninput = () => { S.wish = w.value; clearTimeout(w._t); w._t = setTimeout(save, 400); }; });
}

/* ---------------- Menü: Name, Sicherung ---------------- */
const toB64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
function backupCode() {
  const sus = DATA.suspects.map(s => S.sus[s.nr] ? '1' : '0').join('');
  return 'WH26-' + toB64(JSON.stringify({ n: S.name, a: S.answers, t: S.tips, g: S.grid, s: BigInt('0b1' + sus).toString(36), w: S.wish }));
}
function restore(code) {
  const o = JSON.parse(fromB64(code.trim().replace(/^WH26-/, '')));
  const bits = [...o.s].reduce((acc, ch) => acc * 36n + BigInt(parseInt(ch, 36)), 0n).toString(2).slice(1); const sus = {};
  DATA.suspects.forEach((s, i) => { if (bits[i] === '1') sus[s.nr] = true; });
  S = Object.assign(blank(), S, { name: o.n || S.name, answers: o.a || {}, tips: o.t || {}, grid: o.g || {}, sus, wish: o.w || '' }); save();
}
function menu() {
  modal(`<h3>Menü</h3>
    <label class="small">Wer rätselt? Der Name erscheint in allen Geschichten.</label>
    <input id="mName" value="${esc(S.name || DEDICATION)}" maxlength="24">
    <button class="btn primary" id="mSave">Name übernehmen</button>
    <hr style="border:0;border-top:1px solid #e3d6bb;margin:1rem 0">
    <p class="small"><b>Fortschritt sichern.</b> Dein Stand wird automatisch auf diesem Gerät gespeichert. Mit dem Sicherungscode kannst du ihn jederzeit – auch auf einem anderen Gerät – wiederherstellen. Gelöste Rätsel lassen sich außerdem jederzeit mit derselben Antwort sofort wieder freischalten.</p>
    <textarea id="mCode" rows="3" readonly>${backupCode()}</textarea>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn" id="mCopy">Code kopieren</button><button class="btn" id="mFile">Als Datei speichern</button></div>
    <p class="small" style="margin-top:1rem"><b>Wiederherstellen</b></p>
    <textarea id="mIn" rows="3" placeholder="WH26-…"></textarea>
    <button class="btn" id="mRestore">Code einlesen</button>
    <hr style="border:0;border-top:1px solid #e3d6bb;margin:1rem 0">
    <div class="center"><button class="btn ghost" data-close>Schließen</button></div>`, b => {
    $('#mSave', b).onclick = () => { S.name = $('#mName', b).value.trim() || DEDICATION; save(); closeModal(); route(); toast('Name gespeichert'); };
    $('#mCopy', b).onclick = () => { navigator.clipboard && navigator.clipboard.writeText($('#mCode', b).value); toast('Sicherungscode kopiert'); };
    $('#mFile', b).onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([$('#mCode', b).value], { type: 'text/plain' }));
      a.download = 'Weihnachtszeit-Sicherung.txt'; a.click(); };
    $('#mRestore', b).onclick = () => { try { restore($('#mIn', b).value); closeModal(); route(); toast('Fortschritt wiederhergestellt'); } catch (e) { toast('Der Code ist ungültig.'); } };
  });
}
$('#btnMenu').onclick = menu;
$('#btnHome').onclick = () => location.hash = '#';

/* ---------------- Routing ---------------- */
function route() {
  document.querySelectorAll('body > .stage.fs').forEach(s => s._close && s._close());
  closeModal();
  const h = location.hash.replace(/^#/, '');
  if (!S.introSeen && !h) return firstVisit();
  if (h.startsWith('tag/')) return dayView(+h.split('/')[1]);
  if (h === 'intro') return intro();
  if (h === 'verdaechtige') return suspects();
  if (h === 'finale') return finale();
  home();
}
function firstVisit() {
  modal(`<h3>Willkommen am Nordpol</h3><p>Dies ist ein persönlicher Rätsel-Adventskalender für <b>${DEDICATION}</b>.</p>
    <p>Wer rätselt hier? Dein Name wird in allen Geschichten verwendet.</p><input id="fvName" value="${esc(S.name || DEDICATION)}" maxlength="24">
    <div class="center"><button class="btn primary" id="fvGo">Los geht’s</button></div>`, b => {
    $('#fvGo', b).onclick = () => { S.name = $('#fvName', b).value.trim() || DEDICATION; S.introSeen = true; save(); closeModal(); location.hash = '#intro'; };
  });
  home();
}
window.addEventListener('hashchange', route);

/* ---------------- Schnee ---------------- */
(function snow() {
  const c = $('#snow'), x = c.getContext('2d'); let W, H, fl = [];
  const rs = () => { W = c.width = innerWidth; H = c.height = innerHeight; fl = Array.from({ length: Math.min(120, Math.floor(W / 6)) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2 + .6, s: Math.random() * .6 + .25, w: Math.random() * 2 })); };
  rs(); addEventListener('resize', rs);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  (function loop() { x.clearRect(0, 0, W, H); x.fillStyle = 'rgba(255,255,255,.75)';
    for (const f of fl) { f.y += f.s; f.w += .01; f.x += Math.sin(f.w) * .3; if (f.y > H) { f.y = -4; f.x = Math.random() * W; } x.beginPath(); x.arc(f.x, f.y, f.r, 0, 7); x.fill(); }
    if (!reduce) requestAnimationFrame(loop); })();
})();

/* ---------------- Start ---------------- */
(async () => {
  await load();
  try { DATA = await (await fetch('data/kalender.json', { cache: 'no-cache' })).json(); }
  catch (e) { view.innerHTML = '<p class="light">Die Daten konnten nicht geladen werden. Bitte die Seite über einen Webserver öffnen.</p>'; return; }
  if (!window.crypto || !crypto.subtle) { view.innerHTML = '<p class="light">Dieser Browser unterstützt die Verschlüsselung nicht. Bitte die Seite über https öffnen.</p>'; return; }
  route();
})();
})();
