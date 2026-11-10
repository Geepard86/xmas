/* Rätselhafte Weihnachtszeit – Die verschwundenen Werte · Web-Adventskalender */
(() => {
'use strict';
const YEAR = 2026, KEY = 'wh2026', DEDICATION = 'Sandra';
const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
let DATA = null;

/* ---------------- Speicher: localStorage + IndexedDB-Spiegel ---------------- */
const blank = () => ({ v: 1, name: DEDICATION, answers: {}, tips: {}, notes: {}, sus: {}, wish: '', introSeen: false });
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
function modal(html, onOpen) { $('#modalBody').innerHTML = html; $('#modal').hidden = false; onOpen && onOpen($('#modalBody')); }
function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.dataset.close !== undefined) closeModal(); });
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
function home() {
  const open = openUntil(), today = (new Date().getFullYear() === YEAR && new Date().getMonth() === 11) ? new Date().getDate() : 0;
  const doors = DATA.days.map(day => {
    const d = day.day, o = isOpen(d), sv = d < 24 ? isSolved(d) : !!(S.answers[24] || []).length;
    const sunday = /ADVENT/.test(day.kicker) || d === 24;
    return `<button class="door ${o ? '' : 'locked'} ${sv ? 'solved' : ''} ${sunday ? 'sunday' : ''} ${d === today && !sv ? 'today' : ''}" data-d="${d}" aria-label="Türchen ${d}">
      ${sv && d < 24 ? seal(d, 0, 46) : `<span class="num">${d}</span>`}
      <span class="lbl">${o ? esc(day.ort) : '<span class="lock">öffnet am ' + d + '.12.</span>'}</span></button>`;
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
    <div class="doors">${doors}</div>
    <div class="home-actions">
      <button class="btn" id="hIntro">Santas Brief &amp; Anleitung</button>
      <button class="btn" id="hSus">Verdächtige (${100 - Object.values(S.sus).filter(Boolean).length})</button>
      ${(S.answers[24] || []).length ? '<button class="btn primary" id="hFin">Das Finale</button>' : ''}
    </div>
    ${open === 0 ? `<p class="center light small" style="margin-top:1.2rem">Das erste Türchen öffnet sich am 1. Dezember ${YEAR}.</p>` : ''}`,
  () => {
    requestAnimationFrame(() => setTimeout(() => $('#baroFill').style.width = magic() + '%', 60));
    view.querySelectorAll('.door').forEach(b => b.onclick = () => {
      const d = +b.dataset.d;
      if (!isOpen(d)) { toast(`Geduld! Türchen ${d} öffnet sich am ${d}. Dezember.`); return; }
      b.classList.add('opening'); setTimeout(() => location.hash = '#tag/' + d, 380);
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
  const wide = step.options.some(o => o.length > 12);
  return `<article class="paper puzzle" data-step="${n}">
    ${stepsOf(d) > 1 ? `<div class="kicker" style="margin-bottom:.4rem">Teil ${n} von 2</div>` : ''}
    <div class="pz-wrap"><div class="pz-inner" id="pz-${k}"><img src="${step.img}" alt="${esc(step.title)}" loading="lazy"><canvas></canvas></div></div>
    <div class="tools">
      <button class="tool on" data-t="hand" title="Blättern">✋</button>
      <button class="tool" data-t="pen" title="Stift">✎</button>
      <button class="tool" data-t="marker" title="Marker">▮</button>
      <button class="tool" data-t="erase" title="Radierer">⌫</button>
      <button class="sw on" data-c="#c0392b" style="background:#c0392b"></button><button class="sw" data-c="#1f4d3a" style="background:#1f4d3a"></button>
      <button class="sw" data-c="#2357c6" style="background:#2357c6"></button><button class="sw" data-c="#2b2622" style="background:#2b2622"></button>
      <button class="tool" data-t="undo" title="Rückgängig">↶</button><button class="tool" data-t="zoom" title="Vergrößern">⤢</button><button class="tool" data-t="clear" title="Alles löschen">🗑</button>
    </div>
    <textarea class="notes" placeholder="Deine Notizen …" data-k="${k}">${esc(S.notes[k] || '')}</textarea>
    <div class="q">Deine Antwort</div>
    <div class="opts ${wide ? 'wide' : ''}">${step.options.map(o => `<button class="opt ${solvedWith && o === solvedWith ? 'right' : ''}" ${solvedWith ? 'disabled' : ''} data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>
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

function wirePuzzle(card, d) {
  const n = +card.dataset.step, k = d + '-' + n;
  const inner = card.querySelector('.pz-inner'), img = inner.querySelector('img'), cv = inner.querySelector('canvas'), ctx = cv.getContext('2d');
  let tool = 'hand', color = '#c0392b', drawing = false, last = null, hist = [];
  const fit = async () => {
    const r = window.devicePixelRatio || 1; const w = img.naturalWidth || 1200, h = img.naturalHeight || 1400;
    cv.width = w; cv.height = h; // Zeichnung in Bildauflösung
    const saved = await idbGet('draw-' + k) || localStorage.getItem('wh-draw-' + k);
    if (saved) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, w, h); im.src = saved; }
  };
  img.complete ? fit() : img.addEventListener('load', fit);
  const pos = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * cv.width / b.width, (e.clientY - b.top) * cv.height / b.height]; };
  const persist = () => { clearTimeout(cv._t); cv._t = setTimeout(() => { const u = cv.toDataURL('image/png'); idbSet('draw-' + k, u); try { localStorage.setItem('wh-draw-' + k, u); } catch (e) {} }, 600); };
  cv.addEventListener('pointerdown', e => {
    if (tool === 'hand') return; e.preventDefault(); cv.setPointerCapture(e.pointerId); drawing = true; last = pos(e);
    hist.push(ctx.getImageData(0, 0, cv.width, cv.height)); if (hist.length > 15) hist.shift();
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
  card.querySelectorAll('.tool').forEach(b => b.onclick = () => {
    const t = b.dataset.t;
    if (t === 'undo') { const h = hist.pop(); if (h) { ctx.putImageData(h, 0, 0); persist(); } return; }
    if (t === 'clear') { if (confirm('Alle Markierungen auf diesem Rätsel löschen?')) { hist.push(ctx.getImageData(0, 0, cv.width, cv.height)); ctx.clearRect(0, 0, cv.width, cv.height); persist(); } return; }
    if (t === 'zoom') { inner.classList.toggle('zoom'); b.classList.toggle('on'); return; }
    tool = t; card.querySelectorAll('.tool[data-t="hand"],.tool[data-t="pen"],.tool[data-t="marker"],.tool[data-t="erase"]').forEach(x => x.classList.toggle('on', x === b));
    inner.classList.toggle('drawing', tool !== 'hand');
  });
  card.querySelectorAll('.sw').forEach(b => b.onclick = () => { color = b.dataset.c; card.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === b)); if (tool === 'hand' || tool === 'erase') card.querySelector('.tool[data-t="pen"]').click(); });
  const ta = card.querySelector('.notes'); ta.oninput = () => { S.notes[k] = ta.value; clearTimeout(ta._t); ta._t = setTimeout(save, 400); };
  card.querySelectorAll('[data-tip]').forEach(b => b.onclick = () => {
    const i = +b.dataset.tip; if ((S.tips[k] || 0) > i) return;
    if (i === 3 && !confirm('Wirklich den Lösungsweg anzeigen?')) return;
    S.tips[k] = i + 1; save(); dayView(d).then(() => { const el = document.getElementById('pz-' + k); el && el.closest('.paper').querySelector('.tips').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  });
  card.querySelectorAll('.opt').forEach(b => b.onclick = () => answer(d, n, b));
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
let susFilter = 'alle';
async function suspects() {
  const hints = [];
  for (let d = 1; d <= 23; d++) { if (!isSolved(d)) continue; const { results } = await unlockChain(d); const b = results.find(r => r.box); if (b) hints.push([d, b.box[1]]); }
  const list = DATA.suspects.filter(s => susFilter === 'alle' || (susFilter === 'offen' ? !S.sus[s.nr] : S.sus[s.nr]));
  const left = DATA.suspects.filter(s => !S.sus[s.nr]).length;
  go(`<article class="paper"><div class="kicker">Die Akte</div><h2 class="ptitle">Die Verdächtigen</h2><div class="porn">★</div>
      <p class="center small">Noch nicht abgehakt: <b>${left}</b> von 100 · Tippe eine Person an, um sie abzuhaken.</p>
      ${hints.length ? `<details ${hints.length < 4 ? 'open' : ''}><summary><b>Deine Hinweise (${hints.length})</b></summary><ol class="hints">${hints.map(h => `<li value="${h[0]}">${esc(h[1].replace('➜ ', ''))}</li>`).join('')}</ol></details>` : '<p class="small center">Hinweise erhältst du mit jedem gelösten Rätsel.</p>'}
      <div class="filters">${['alle', 'offen', 'abgehakt'].map(f => `<button class="tool ${susFilter === f ? 'on' : ''}" data-f="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}</div>
      <div class="sus">${list.map(s => `<div class="s ${S.sus[s.nr] ? 'off' : ''}" data-nr="${s.nr}"><span class="ck">${S.sus[s.nr] ? '✓' : ''}</span><span class="nr">${s.nr}</span>
        <span><div class="nm">${esc(s.name)}</div><div class="at">${esc(s.art)} · ${esc(s.gebiet)} · ${esc(s.alter)} J. · Schal: ${esc(s.schal)} · ${esc(s.geb)} · ${esc(s.lied)}</div></span></div>`).join('')}</div>
    </article><div class="center"><button class="btn ghost" onclick="location.hash='#'">Zum Kalender</button></div>`,
  () => {
    view.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { susFilter = b.dataset.f; suspects(); });
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
  return 'WH26-' + toB64(JSON.stringify({ n: S.name, a: S.answers, t: S.tips, s: parseInt('1' + sus, 2).toString(36), w: S.wish }));
}
function restore(code) {
  const o = JSON.parse(fromB64(code.trim().replace(/^WH26-/, '')));
  const bits = parseInt(o.s, 36).toString(2).slice(1); const sus = {};
  DATA.suspects.forEach((s, i) => { if (bits[i] === '1') sus[s.nr] = true; });
  S = Object.assign(blank(), S, { name: o.n || S.name, answers: o.a || {}, tips: o.t || {}, sus, wish: o.w || '' }); save();
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
