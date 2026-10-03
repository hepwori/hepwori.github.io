import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { VARS, VAR, OUTPUTS, OUT, GEARS, defaults, compute, allGears, nearestGear, speedAt, fitCda, shiftTable } from './model.js';

const $ = (id) => document.getElementById(id);
const S = 5, H = 4, N = 56; // half-width of floor, height of box, grid resolution
const MPH = 0.44704, LB = 0.45359237;

// ---------- state ----------
const state = defaults();                 // SI values
const ui = { mode: 'cadence', x: 'ratio', y: 'cad', z: 'power', c: 'speed', s: 'speed', hold: 'y', snap: true, ring: 'auto', cog: 'auto', autoscale: true, clip: true };
state.cad = 95; state.ratio = 50 / 21;
let zRange = null;

const disp = (id) => VAR[id].fromSI(state[id]);
const fmt = (v, dec) => (Number.isFinite(v) ? v.toFixed(dec) : '—');
const gear = () => ({ ring: ui.ring === 'auto' ? 'auto' : +ui.ring, cog: ui.cog === 'auto' ? 'auto' : +ui.cog });
const run = (over = {}) => compute({ ...state, ...over }, ui.mode, gear());
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const sgn = (x, d = 0) => (Math.abs(x) < 0.5 * Math.pow(10, -d) ? '±' : x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d);

const ENGINE = { power: ['power'], speed: ['speed'], cadence: ['cad', 'ratio'] };
const DEP = { power: 'speed', speed: 'power', cadence: 'power' };
const MODE_DEFAULT = { power: ['power', 'grade', 'speed'], speed: ['speed', 'grade', 'power'], cadence: ['ratio', 'cad', 'power'] };
const axisVars = () => VARS.filter((v) => !v.noAxis && (v.group !== 'engine' || ENGINE[ui.mode].includes(v.id)));
const heldId = () => (ui.hold === 'y' ? ui.y : ui.x);
const freeId = () => (ui.hold === 'y' ? ui.x : ui.y);

// set a variable from a display-unit value (clamped, with optional snap to a real gear ratio)
function setVar(id, d) {
  const v = VAR[id]; d = clamp(d, v.min, v.max);
  if (id === 'ratio' && ui.snap) d = nearestGear(d).ratio;
  state[id] = v.toSI(d);
}

// ---------- controls ----------
const rows = {};
function buildControls() {
  const ctl = $('ctl');
  ctl.innerHTML = '';
  const seg = document.createElement('div'); seg.className = 'seg modes';
  seg.innerHTML = [['cadence', 'gear + cadence'], ['power', 'power → speed'], ['speed', 'speed → power']]
    .map(([m, l]) => `<label><input type="radio" name="mode" value="${m}"><span>${l}</span></label>`).join('');
  seg.addEventListener('change', (e) => setMode(e.target.value));
  ctl.appendChild(seg);
  const groups = [['engine', 'rider inputs'], ['terrain', 'terrain & weather'], ['bike', 'bike & rider'], ['gearing', 'auto-gear']];
  for (const [g, title] of groups) {
    const d = document.createElement('details'); d.className = 'sec'; d.open = g !== 'gearing';
    d.innerHTML = `<summary><span class="eyebrow">${title}</span></summary>`;
    if (g === 'bike') {
      const p = document.createElement('div'); p.className = 'presets';
      p.innerHTML = '<span>CdA:</span>';
      for (const [n, v] of [['tuck', 0.27], ['drops', 0.30], ['hoods', 0.34], ['tops', 0.40]]) {
        const b = document.createElement('button'); b.className = 'pill'; b.textContent = `${n} ${v}`; b.onclick = () => { state.cda = v; sync(); }; p.appendChild(b);
      }
      d.appendChild(p);
    }
    for (const v of VARS.filter((v) => v.group === g)) {
      const r = document.createElement('div'); r.className = 'row';
      r.innerHTML = `<label><span class="nm">${v.label}</span><span class="chip"></span>${v.note ? `<span class="note">${v.note}</span>` : ''}</label><output></output><input type="range" min="${v.min}" max="${v.max}" step="${v.step}">`;
      const inp = r.querySelector('input');
      inp.addEventListener('input', () => { setVar(v.id, +inp.value); sync(); });
      d.appendChild(r);
      rows[v.id] = { el: r, inp, out: r.querySelector('output'), chip: r.querySelector('.chip') };
    }
    if (g === 'gearing') {
      const w = document.createElement('div'); w.className = 'gear';
      const opts = (arr) => ['auto', ...arr].map((x) => `<option>${x}</option>`).join('');
      w.innerHTML = `<label class="field"><span>chainring</span><select id="selRing">${opts(GEARS.rings)}</select></label><label class="field"><span>cog</span><select id="selCog">${opts(GEARS.cogs)}</select></label>`;
      w.addEventListener('change', (e) => { ui[e.target.id === 'selRing' ? 'ring' : 'cog'] = e.target.value; sync(); });
      d.appendChild(w);
      const n = document.createElement('div'); n.className = 'gearnote';
      n.textContent = `50/34 × 11-34, 700×28 (${GEARS.circ} m). used in power/speed modes: picks the combo nearest your target cadence.`;
      d.appendChild(n);
    }
    ctl.appendChild(d);
  }
  document.querySelector(`input[name=mode][value=${ui.mode}]`).checked = true;
}

function buildSelects() {
  const fill = (el, items, cur) => { el.innerHTML = items.map(([v, l]) => `<option value="${v}">${l}</option>`).join(''); el.value = cur; };
  const av = axisVars().map((v) => [v.id, `${v.label}${v.unit ? ' (' + v.unit + ')' : ''}`]);
  fill($('selX'), av, ui.x); fill($('selY'), av, ui.y);
  const outs = OUTPUTS.map((o) => [o.id, `${o.label} (${o.unit})`]);
  fill($('selZ'), outs, ui.z); fill($('selC'), outs, ui.c); fill($('selL'), outs, ui.z); fill($('selR'), outs, ui.s);
}
function setMode(mode, quiet) {
  const r = run();
  state.power = Math.max(r.p, 0); state.speed = r.v; state.cad = r.cad; state.ratio = r.ring / r.cog;
  ui.mode = mode;
  const ok = new Set(axisVars().map((v) => v.id));
  if (!ok.has(ui.x) || !ok.has(ui.y) || ui.x === ui.y) [ui.x, ui.y] = MODE_DEFAULT[mode];
  if (ENGINE[mode].includes(ui.z) || ui.z === 'cad' && mode === 'cadence') ui.z = DEP[mode];
  if (ui.s === ui.z) ui.s = ui.z === 'speed' ? 'power' : 'speed';
  zRange = null;
  const radio = document.querySelector(`input[name=mode][value=${mode}]`); if (radio) radio.checked = true;
  buildSelects(); if (!quiet) sync();
}
for (const k of ['X', 'Y', 'Z', 'C']) {
  $('sel' + k).addEventListener('change', (e) => {
    ui[k.toLowerCase()] = e.target.value;
    if (ui.x === ui.y) { const o = axisVars().find((v) => v.id !== ui.x).id; if (k === 'X') ui.y = o; else ui.x = o; }
    buildSelects(); zRange = null; sync();
  });
}
$('selL').addEventListener('change', (e) => { ui.z = e.target.value; buildSelects(); zRange = null; sync(); });
$('selR').addEventListener('change', (e) => { ui.s = e.target.value; sync(); });
$('snap').addEventListener('change', (e) => { ui.snap = e.target.checked; if (ui.snap) setVar('ratio', disp('ratio')); sync(); });
$('clip').addEventListener('change', (e) => { ui.clip = e.target.checked; zRange = null; sync(); });
$('autoscale').addEventListener('change', (e) => { ui.autoscale = e.target.checked; sync(); });
$('holdSlider').addEventListener('input', (e) => { setVar(heldId(), +e.target.value); sync(); });

// ---------- three scene ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
camera.position.set(12.5, 8.5, 13.5);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, H * 0.35, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.15); sun.position.set(6, 12, 8); scene.add(sun);

const geo = new THREE.BufferGeometry();
const pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3);
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
{
  const idx = [];
  for (let i = 0; i < N - 1; i++) for (let j = 0; j < N - 1; j++) { const a = i * N + j, b = a + 1, c = a + N, d = c + 1; idx.push(a, c, b, b, c, d); }
  geo.setIndex(idx);
}
const surf = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
scene.add(surf);
const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.08 }));
scene.add(wire);
const decor = new THREE.Group(); scene.add(decor);

// slice plane (built once in local coords: spans local x, height along y, normal +z)
const slicePlane = new THREE.Group(); scene.add(slicePlane);
const planeMat = new THREE.MeshBasicMaterial({ color: 0xf08c00, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
const barMat = new THREE.MeshBasicMaterial({ color: 0xf08c00 });
const plane = new THREE.Mesh(new THREE.PlaneGeometry(2 * S, H), planeMat); plane.position.y = H / 2;
const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-S, 0, 0], [S, 0, 0], [S, H, 0], [-S, H, 0]].map((p) => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color: 0xf08c00, transparent: true, opacity: 0.6 }));
const handles = [];
for (const y of [0, H]) {
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2 * S, 0.1, 0.1), barMat); bar.position.y = y;
  const hit = new THREE.Mesh(new THREE.BoxGeometry(2 * S, 0.7, 0.7), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.position.y = y;
  slicePlane.add(bar, hit); handles.push(hit);
}
slicePlane.add(plane, edge);

const sliceLine = new Line2(new LineGeometry(), new LineMaterial({ color: 0xf08c00, linewidth: 3.5, worldUnits: false }));
sliceLine.geometry.setPositions([0, 0, 0, 0, 0, 0]); scene.add(sliceLine);

const marker = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
const markerRing = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 }));
const drop = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
const ghost = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
ghost.visible = false;
scene.add(marker, markerRing, drop, ghost);

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  sliceLine.material.resolution.set(w, h);
}
new ResizeObserver(resize).observe(stage); resize();

// ---------- helpers ----------
function viridis(t) {
  const st = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
  t = clamp(t, 0, 1) * 4; const i = Math.min(Math.floor(t), 3), f = t - i;
  return st[i].map((a, k) => (a + (st[i + 1][k] - a) * f) / 255);
}
function niceTicks(lo, hi, n = 5) {
  if (!(hi > lo)) hi = lo + 1;
  const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step;
  const ticks = []; for (let t = a; t <= b + step * 1e-6; t += step) ticks.push(+t.toFixed(10));
  return { ticks, lo: a, hi: b, step };
}
const tickFmt = (v, step) => (step >= 1 ? v.toFixed(0) : v.toFixed(Math.min(4, Math.ceil(-Math.log10(step) - 1e-9))));
function label(text, { size = 0.3, color = css('--ink2'), bold = false } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), px = 56;
  const font = `${bold ? '500 ' : '400 '}${px}px "JetBrains Mono", ui-monospace, monospace`;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 16; c.width = w; c.height = px + 16;
  g.font = font; g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillText(text, w / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set((size * w) / px, (size * c.height) / px, 1); sp.renderOrder = 10; return sp;
}
function clearGroup(g) {
  for (const o of [...g.children]) {
    g.remove(o); o.geometry?.dispose();
    if (o.material) { o.material.map?.dispose(); o.material.dispose(); }
  }
}
function lineSeg(pts, color, opacity = 1) {
  const g = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p)));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
}

// ---------- grid evaluation ----------
const zs = new Float32Array(N * N), cs = new Float32Array(N * N);
let xr, yr, zr, cr, zt, drawn = '';

function evalGrid() {
  const X = VAR[ui.x], Y = VAR[ui.y], oz = OUT[ui.z], oc = OUT[ui.c];
  const x0 = X.toSI(X.min), x1 = X.toSI(X.max), y0 = Y.toSI(Y.min), y1 = Y.toSI(Y.max);
  let zmin = Infinity, zmax = -Infinity, cmin = Infinity, cmax = -Infinity;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const r = run({ [ui.x]: lerp(x0, x1, j / (N - 1)), [ui.y]: lerp(y0, y1, i / (N - 1)) });
    const z = oz.get(r), c = oc.get(r), k = i * N + j;
    zs[k] = z; cs[k] = c;
    if (z < zmin) zmin = z; if (z > zmax) zmax = z; if (c < cmin) cmin = c; if (c > cmax) cmax = c;
  }
  if (ui.clip) { // tame tall outliers (e.g. 2000 W corners) so the interesting region fills the box
    const q = Float32Array.from(zs).sort(), q90 = q[Math.floor(0.9 * (q.length - 1))];
    const cap = q90 + 0.6 * (q90 - zmin); if (zmax > cap * 1.15) zmax = cap;
  }
  if (zmin >= 0 && zmin < 0.35 * zmax) zmin = 0;
  zt = niceTicks(zmin, zmax);
  if (!ui.autoscale && zRange) zt = zRange; else zRange = zt;
  xr = [X.min, X.max]; yr = [Y.min, Y.max]; zr = [zt.lo, zt.hi]; cr = [cmin, cmax];
}
const sx = (v) => -S + ((v - xr[0]) / (xr[1] - xr[0])) * 2 * S;
const sy = (v) => -S + ((v - yr[0]) / (yr[1] - yr[0])) * 2 * S;
const sz = (v) => clamp((v - zr[0]) / (zr[1] - zr[0]), -0.02, 1.02) * H;

function updateSurface() {
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const k = i * N + j;
    pos[k * 3] = -S + (j / (N - 1)) * 2 * S; pos[k * 3 + 1] = sz(zs[k]); pos[k * 3 + 2] = -S + (i / (N - 1)) * 2 * S;
    const c = viridis(cr[1] > cr[0] ? (cs[k] - cr[0]) / (cr[1] - cr[0]) : 0.5); col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
  }
  geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  geo.computeVertexNormals(); geo.computeBoundingSphere(); geo.computeBoundingBox();
}

let fontsReady = false;
function updateDecor() {
  const key = [ui.x, ui.y, ui.z, zt.lo, zt.hi, css('--ink2'), fontsReady].join('|');
  if (key === drawn) return; drawn = key;
  clearGroup(decor);
  const X = VAR[ui.x], Y = VAR[ui.y], oz = OUT[ui.z], grid = css('--grid');
  const xt = niceTicks(xr[0], xr[1], 6), yt = niceTicks(yr[0], yr[1], 6);
  const inX = (t) => t >= xr[0] - 1e-9 && t <= xr[1] + 1e-9, inY = (t) => t >= yr[0] - 1e-9 && t <= yr[1] + 1e-9;
  const ptsF = [], ptsW = [];
  for (const t of xt.ticks) if (inX(t)) { const x = sx(t); ptsF.push([x, 0, -S], [x, 0, S]); ptsW.push([x, 0, -S], [x, H, -S]); }
  for (const t of yt.ticks) if (inY(t)) { const z = sy(t); ptsF.push([-S, 0, z], [S, 0, z]); ptsW.push([-S, 0, z], [-S, H, z]); }
  for (const t of zt.ticks) { const y = ((t - zr[0]) / (zr[1] - zr[0])) * H; ptsW.push([-S, y, -S], [S, y, -S], [-S, y, -S], [-S, y, S]); }
  decor.add(lineSeg(ptsF, grid, 0.75), lineSeg(ptsW, grid, 0.4));
  const lab = (txt, x, y, z, o) => { const s = label(txt, o); s.position.set(x, y, z); decor.add(s); };
  for (const t of xt.ticks) if (inX(t)) lab(tickFmt(t, xt.step), sx(t), -0.05, S + 0.5);
  for (const t of yt.ticks) if (inY(t)) lab(tickFmt(t, yt.step), S + 0.6, -0.05, sy(t));
  for (const t of zt.ticks) lab(tickFmt(t, zt.step), -S - 0.55, ((t - zr[0]) / (zr[1] - zr[0])) * H, -S);
  lab(X.unit ? `${X.label} (${X.unit})` : X.label, 0, -0.05, S + 1.6, { bold: true, size: 0.34, color: css('--x') });
  lab(Y.unit ? `${Y.label} (${Y.unit})` : Y.label, S + 2.1, -0.05, 0, { bold: true, size: 0.34, color: css('--y') });
  lab(`${oz.label} (${oz.unit})`, -S - 0.5, H + 0.55, -S, { bold: true, size: 0.34, color: css('--ink') });
  wire.material.color.set(matchMedia('(prefers-color-scheme: dark)').matches ? 0xffffff : 0x000000);
  const amber = new THREE.Color(css('--slice'));
  planeMat.color.copy(amber); barMat.color.copy(amber); edge.material.color.copy(amber); sliceLine.material.color.copy(amber);
}

function updateMarkerAndSlice(r) {
  const X = VAR[ui.x], Y = VAR[ui.y], oz = OUT[ui.z];
  const cx = clamp(disp(ui.x), X.min, X.max), cy = clamp(disp(ui.y), Y.min, Y.max);
  const px = sx(cx), pz = sy(cy), py = sz(oz.get(r));
  marker.position.set(px, py, pz); markerRing.position.copy(marker.position);
  drop.geometry.setFromPoints([new THREE.Vector3(px, 0, pz), new THREE.Vector3(px, py, pz)]);
  // slice plane at the held variable; curve across the free one
  if (ui.hold === 'y') { slicePlane.rotation.y = 0; slicePlane.position.set(0, 0, pz); }
  else { slicePlane.rotation.y = Math.PI / 2; slicePlane.position.set(px, 0, 0); }
  const F = VAR[freeId()], f0 = F.toSI(F.min), f1 = F.toSI(F.max), pts = [];
  for (let i = 0; i < 160; i++) {
    const t = i / 159, y = sz(oz.get(run({ [F.id]: lerp(f0, f1, t) }))) + 0.03, a = -S + t * 2 * S;
    if (ui.hold === 'y') pts.push(a, y, pz); else pts.push(px, y, a);
  }
  sliceLine.geometry.setPositions(pts);
}

// ---------- readouts ----------
const SEG = [['gravity', '#9b72e8'], ['rolling', '#2fb67c'], ['aero', '#2d8cf0'], ['drivetrain', '#8d96a3']];
function updateReadout(r) {
  $('heroBig').innerHTML = `${fmt(r.v / MPH, 1)}<small>mph</small>`;
  $('heroSub').textContent = `${fmt(r.v * 3.6, 1)} km/h · ${fmt(r.pace, 1)} min/mi`;
  const t = (v, u, l) => `<div><b>${v}<u>${u}</u></b><span>${l}</span></div>`;
  $('readout').innerHTML = [
    t(fmt(r.p, 0), 'W', ui.mode === 'speed' && r.p < 0 ? 'braking needed' : `${fmt(r.wkg, 2)} W/kg`),
    t(fmt(r.cad, 0), 'rpm', `${r.ring}×${r.cog}`),
    t(fmt(r.ring / r.cog, 2), '', 'gear ratio'),
    t(fmt(r.torque, 1), 'N·m', 'crank torque'),
    t(fmt(r.climb, 0), 'ft/h', 'climb rate'),
    t(fmt(r.aeroShare * 100, 0), '%', 'aero share'),
  ].join('');
  const comps = [r.grav, r.roll, r.aero, r.loss];
  const tot = Math.max(comps.reduce((s, w) => s + Math.max(w, 0), 0), 1);
  $('stack').innerHTML = comps.map((w, i) => `<i style="width:${Math.max(w, 0) / tot * 100}%;background:${SEG[i][1]}"></i>`).join('');
  $('stackleg').innerHTML = comps.map((w, i) => `<div><span style="--c:${SEG[i][1]}">${SEG[i][0]}</span><b>${fmt(w, 0)} W</b></div>`).join('');
  $('finePrint').textContent = `${fmt(r.m / LB, 0)} lb total · air ${fmt(r.rho, 3)} kg/m³${r.grav < 0 ? ' · gravity is helping' : ''}`;
  const slider = (inp, v) => { inp.style.setProperty('--p', `${clamp((v - inp.min) / (inp.max - inp.min), 0, 1) * 100}%`); };
  for (const v of VARS) {
    const row = rows[v.id], d = disp(v.id);
    row.out.textContent = `${fmt(d, v.dec)} ${v.unit}`; row.inp.value = d; slider(row.inp, d);
    const tag = v.id === ui.x ? 'x' : v.id === ui.y ? 'y' : '';
    const isHeld = v.id === heldId();
    row.chip.textContent = isHeld ? `${tag.toUpperCase()} · slice` : tag.toUpperCase();
    row.chip.className = 'chip ' + (isHeld ? 'h' : tag); row.chip.style.display = tag ? '' : 'none';
    row.el.className = 'row' + (tag ? ' is' + tag : '');
    row.el.style.display = v.group === 'engine' && !ENGINE[ui.mode].includes(v.id) ? 'none' : '';
  }
  const oc = OUT[ui.c];
  $('legT').textContent = `color · ${oc.label}`; $('legLo').textContent = `${fmt(cr[0], oc.dec)} ${oc.unit}`; $('legHi').textContent = `${fmt(cr[1], oc.dec)} ${oc.unit}`;
  $('legBar').style.background = `linear-gradient(90deg, ${[0, .25, .5, .75, 1].map((t) => 'rgb(' + viridis(t).map((c) => Math.round(c * 255)).join(',') + ')').join(',')})`;
  $('surfTitle').textContent = `${OUT[ui.z].label} over ${VAR[ui.x].label} × ${VAR[ui.y].label}`;
}

// ---------- slice chart ----------
const chartEl = $('chart'), ctip = $('ctip');
let chartGeom = null;
function renderChart(r) {
  const F = VAR[freeId()], Hd = VAR[heldId()], oL = OUT[ui.z], oR = OUT[ui.s], two = oL !== oR;
  const isRatio = F.id === 'ratio';
  // header
  const hv = `${fmt(disp(Hd.id), Hd.dec)}${Hd.unit ? ' ' + Hd.unit : ''}`;
  $('sliceTitle').innerHTML = `${oL.label}${two ? ` &amp; ${oR.label}` : ''} <small>across ${F.label}, holding ${Hd.label} at ${hv}</small>`;
  $('hold').innerHTML = [['y', VAR[ui.y]], ['x', VAR[ui.x]]].map(([k, v]) => `<button data-k="${k}" class="${ui.hold === k ? 'on' : ''}">hold ${v.label}</button>`).join('');
  $('holdName').innerHTML = `plane at <b>${Hd.label}</b>`;
  const hs = $('holdSlider'); hs.min = Hd.min; hs.max = Hd.max; hs.step = Hd.id === 'ratio' ? 0.01 : Hd.step; hs.value = disp(Hd.id);
  hs.style.setProperty('--p', `${clamp((disp(Hd.id) - Hd.min) / (Hd.max - Hd.min), 0, 1) * 100}%`);
  $('holdOut').textContent = hv;
  $('snapWrap').style.display = ui.x === 'ratio' || ui.y === 'ratio' ? '' : 'none';

  // sample
  const n = 240, f0 = F.toSI(F.min), f1 = F.toSI(F.max), xs = [], L = [], R = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), res = run({ [F.id]: lerp(f0, f1, t) });
    xs.push(lerp(F.min, F.max, t)); L.push(oL.get(res)); R.push(oR.get(res));
  }
  const W = chartEl.clientWidth || 700, Ht = isRatio ? 340 : 310;
  const m = { l: 64, r: two ? 64 : 16, t: 16, b: isRatio ? 74 : 44 };
  const pw = W - 12 - m.l - m.r, ph = Ht - m.t - m.b;
  const rng = (a) => { let lo = Math.min(...a), hi = Math.max(...a); if (lo >= 0 && lo < 0.35 * hi) lo = 0; return niceTicks(lo, hi, 5); };
  const tl = rng(L), tr = rng(R), tx = niceTicks(F.min, F.max, 8);
  const px = (v) => m.l + ((v - F.min) / (F.max - F.min)) * pw;
  const pL = (v) => m.t + ph - ((v - tl.lo) / (tl.hi - tl.lo)) * ph;
  const pR = (v) => m.t + ph - ((v - tr.lo) / (tr.hi - tr.lo)) * ph;
  const path = (a, p) => a.map((v, i) => `${i ? 'L' : 'M'}${px(xs[i]).toFixed(1)},${p(v).toFixed(1)}`).join('');
  let s = `<svg width="${W - 12}" height="${Ht}" viewBox="0 0 ${W - 12} ${Ht}">`;
  for (const t of tl.ticks) s += `<line x1="${m.l}" x2="${m.l + pw}" y1="${pL(t)}" y2="${pL(t)}" stroke="var(--line)"/>`;
  for (const t of tl.ticks) s += `<text x="${m.l - 10}" y="${pL(t) + 3.5}" text-anchor="end" fill="var(--s1)">${tickFmt(t, tl.step)}</text>`;
  if (two) for (const t of tr.ticks) s += `<text x="${m.l + pw + 10}" y="${pR(t) + 3.5}" fill="var(--s2)">${tickFmt(t, tr.step)}</text>`;
  s += `<text x="${m.l - 10}" y="${m.t - 5}" text-anchor="end" fill="var(--s1)" style="font-weight:500">${oL.unit}</text>`;
  if (two) s += `<text x="${m.l + pw + 10}" y="${m.t - 5}" fill="var(--s2)" style="font-weight:500">${oR.unit}</text>`;
  for (const t of tx.ticks) if (t >= F.min - 1e-9 && t <= F.max + 1e-9) s += `<text x="${px(t)}" y="${m.t + ph + 16}" text-anchor="middle" fill="var(--muted)">${tickFmt(t, tx.step)}</text>`;
  const gs = isRatio ? allGears().filter((g) => g.ratio >= F.min && g.ratio <= F.max) : [];
  const curG = nearestGear(state.ratio);
  if (isRatio) { // real gears: faint verticals, dots on each curve, label strip
    for (const g of gs) s += `<line x1="${px(g.ratio)}" x2="${px(g.ratio)}" y1="${m.t}" y2="${m.t + ph}" stroke="var(--line)" stroke-dasharray="2 3"/>`;
  }
  s += `<path d="${path(L, pL)}" fill="none" stroke="var(--s1)" stroke-width="2.4" stroke-linejoin="round"/>`;
  if (two) s += `<path d="${path(R, pR)}" fill="none" stroke="var(--s2)" stroke-width="2.4" stroke-linejoin="round"/>`;
  if (isRatio) {
    for (const g of gs) {
      const res = run({ ratio: g.ratio }), isCur = g === curG || (g.ring === curG.ring && g.cog === curG.cog);
      s += `<circle cx="${px(g.ratio)}" cy="${pL(oL.get(res))}" r="${isCur ? 4.5 : 3}" fill="var(--card)" stroke="var(--s1)" stroke-width="1.8"/>`;
      if (two) s += `<circle cx="${px(g.ratio)}" cy="${pR(oR.get(res))}" r="${isCur ? 4.5 : 3}" fill="var(--card)" stroke="var(--s2)" stroke-width="1.8"/>`;
    }
    GEARS.rings.forEach((ring, ri) => {
      const y = m.t + ph + 34 + ri * 16;
      s += `<text x="${m.l - 10}" y="${y + 3}" text-anchor="end" fill="var(--muted)">${ring}×</text>`;
      for (const g of gs.filter((q) => q.ring === ring)) {
        const isCur = g.ring === curG.ring && g.cog === curG.cog;
        if (isCur) s += `<rect x="${px(g.ratio) - 11}" y="${y - 8}" width="22" height="16" rx="8" fill="var(--slice)"/>`;
        s += `<text x="${px(g.ratio)}" y="${y + 3}" text-anchor="middle" fill="${isCur ? '#000' : g.xchain ? 'var(--muted)' : 'var(--ink2)'}" style="${isCur ? 'font-weight:500' : ''}">${g.cog}</text>`;
      }
    });
  }
  // marker
  const cxv = clamp(disp(F.id), F.min, F.max), cx = px(cxv);
  s += `<line x1="${cx}" x2="${cx}" y1="${m.t}" y2="${m.t + ph}" stroke="var(--slice)" stroke-width="1.5"/>`;
  s += `<circle cx="${cx}" cy="${pL(oL.get(r))}" r="6" fill="var(--s1)" stroke="var(--card)" stroke-width="2.5"/>`;
  if (two) s += `<circle cx="${cx}" cy="${pR(oR.get(r))}" r="6" fill="var(--s2)" stroke="var(--card)" stroke-width="2.5"/>`;
  s += `<line id="xh" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" stroke="var(--ink2)" stroke-width="1" stroke-dasharray="3 3" style="display:none"/>`;
  s += `<text x="${m.l + pw / 2}" y="${Ht - 4}" text-anchor="middle" fill="var(--ink2)" style="font-weight:500">${F.label}${F.unit ? ' (' + F.unit + ')' : isRatio ? ' (chainring ÷ cog)' : ''}</text></svg>`;
  chartEl.querySelector('svg')?.remove(); chartEl.insertAdjacentHTML('afterbegin', s);
  chartGeom = { F, m, pw, W: W - 12, px, oL, oR, two, isRatio };
  $('chartkey').innerHTML = `<span style="--c:var(--s1)">${oL.label} (${oL.unit}) — left axis</span>` + (two ? `<span style="--c:var(--s2)">${oR.label} (${oR.unit}) — right axis</span>` : '') + `<span style="--c:var(--slice)">current point</span>` + (isRatio ? `<span style="--c:var(--muted);opacity:.9">hollow dots = the 24 real gears (cassette cog on strip; small ring on bottom row)</span>` : '');
}
function chartX(e) {
  const g = chartGeom; if (!g) return null;
  const b = chartEl.getBoundingClientRect();
  const x = clamp(e.clientX - b.left - 6, g.m.l, g.m.l + g.pw);
  let v = lerp(g.F.min, g.F.max, (x - g.m.l) / g.pw);
  if (g.F.id === 'ratio' && ui.snap) v = nearestGear(v).ratio;
  return { v, b };
}
let chartDrag = false;
chartEl.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#hold')) return;
  chartDrag = true; chartEl.setPointerCapture(e.pointerId);
  const p = chartX(e); if (p) { setVar(chartGeom.F.id, p.v); sync(); }
});
chartEl.addEventListener('pointerup', () => { chartDrag = false; });
chartEl.addEventListener('pointerleave', () => { ctip.style.display = 'none'; const xh = $('xh'); if (xh) xh.style.display = 'none'; });
chartEl.addEventListener('pointermove', (e) => {
  const p = chartX(e); if (!p) return;
  if (chartDrag) { setVar(chartGeom.F.id, p.v); sync(); }
  const g = chartGeom, res = run({ [g.F.id]: g.F.toSI(p.v) }), xh = $('xh');
  const cx = g.px(p.v); if (xh) { xh.setAttribute('x1', cx); xh.setAttribute('x2', cx); xh.style.display = ''; }
  const gr = g.isRatio ? nearestGear(p.v) : null;
  ctip.textContent = `${g.F.label} ${fmt(p.v, g.F.dec)}${g.F.unit ? ' ' + g.F.unit : ''}${gr ? `  (${gr.ring}×${gr.cog})` : ''}\n${g.oL.label} ${fmt(g.oL.get(res), g.oL.dec)} ${g.oL.unit}` + (g.two ? `\n${g.oR.label} ${fmt(g.oR.get(res), g.oR.dec)} ${g.oR.unit}` : '');
  ctip.style.display = 'block';
  const left = cx + 22 + 200 > p.b.width ? cx - 230 : cx + 18;
  ctip.style.left = left + 'px'; ctip.style.top = '24px';
});
$('hold').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { ui.hold = b.dataset.k; sync(); } });
new ResizeObserver(() => sync()).observe(chartEl);

// ---------- shift explorer ----------
function updateShift(r) {
  const rows = shiftTable(state, r), mph = (v) => v / MPH;
  const cur = rows.find((x) => x.cur) || rows[0];
  const same = rows.filter((x) => x.ring === r.ring).sort((p, q) => p.ratio - q.ratio), i = same.findIndex((x) => x.cur);
  const card = (title, g) => {
    if (!g) return `<div class="scard"><h3>${title}</h3>end of the cassette</div>`;
    const dRatio = (g.ratio / cur.ratio - 1) * 100;
    return `<div class="scard"><h3>${title} → ${g.ring}×${g.cog} <small>${sgn(dRatio, 0)}% gear</small></h3>
      hold <b>${fmt(r.cad, 0)} rpm</b> → <b>${fmt(mph(g.hc.v), 1)} mph</b> <span class="d">${sgn(mph(g.hc.v) - mph(r.v), 1)}</span> · needs <b>${fmt(g.hc.p, 0)} W</b> <span class="d">${sgn(g.hc.p - r.p)}</span><br>
      hold <b>${fmt(r.p, 0)} W</b> → <b>${fmt(g.hp.cad, 0)} rpm</b> <span class="d">${sgn(g.hp.cad - r.cad)}</span> · <b>${fmt(mph(g.hp.v), 1)} mph</b> <span class="d">${sgn(mph(g.hp.v) - mph(r.v), 2)}</span></div>`;
  };
  $('cards').innerHTML = card('shift down', same[i - 1]) + `<div class="scard cur"><h3>now: ${r.ring}×${r.cog}</h3><b>${fmt(mph(r.v), 1)} mph</b> · <b>${fmt(r.cad, 0)} rpm</b> · <b>${fmt(r.p, 0)} W</b><br>${fmt(r.torque, 1)} N·m at the crank</div>` + card('shift up', same[i + 1]);
  $('ladder').innerHTML = `<tr><th>gear</th><th>ratio</th><th>Δ gear</th><th>mph @ ${fmt(r.cad, 0)} rpm</th><th>W needed</th><th>ΔW</th><th>rpm @ ${fmt(r.p, 0)} W</th><th>mph</th></tr>` +
    rows.map((x) => `<tr class="go ${x.cur ? 'cur' : ''}" data-r="${x.ring}" data-c="${x.cog}"><td>${x.ring}×${x.cog}${x.xchain ? '<span class="xc">x-chain</span>' : ''}</td><td>${fmt(x.ratio, 2)}</td><td>${x.cur ? '' : sgn((x.ratio / cur.ratio - 1) * 100, 0) + '%'}</td><td>${fmt(mph(x.hc.v), 1)}</td><td>${fmt(x.hc.p, 0)}</td><td>${x.cur ? '' : sgn(x.hc.p - r.p)}</td><td>${fmt(x.hp.cad, 0)}</td><td>${fmt(mph(x.hp.v), 1)}</td></tr>`).join('');
}
$('ladder').addEventListener('click', (e) => {
  const tr = e.target.closest('tr.go'); if (!tr) return;
  const r = run(); setMode('cadence', true);
  state.cad = r.cad; state.ratio = +tr.dataset.r / +tr.dataset.c; sync();
});
$('fitGo').addEventListener('click', () => {
  const P = +$('fitP').value, mph = +$('fitV').value, cad = +$('fitC').value;
  if (!(P > 0 && mph > 0 && cad > 0)) return;
  const g = nearestGear((mph * MPH * 60) / (cad * GEARS.circ)), v = speedAt(cad, g.ratio);
  const cda = fitCda(state, P, v);
  if (!(cda > 0)) { $('fitMsg').textContent = "can't fit: that point implies negative drag (check grade/wind)."; return; }
  state.cda = cda; setMode('cadence', true);
  state.cad = cad; state.ratio = g.ratio; sync();
  $('fitMsg').textContent = `nearest gear ${g.ring}×${g.cog} → ${fmt(v / MPH, 1)} mph; fit CdA ${fmt(cda, 3)} m² at current grade/wind/mass/Crr${cda > 0.5 ? ' (high: maybe a headwind, a false flat, or heavier Crr)' : ''}.`;
});

// ---------- main loop ----------
let dirty = true;
function sync() { dirty = true; }
function frame() {
  if (dirty) {
    dirty = false;
    evalGrid(); updateSurface(); updateDecor();
    const r = run(); updateMarkerAndSlice(r); updateReadout(r); renderChart(r); updateShift(r);
  }
  controls.update(); renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- 3d interaction: hover, click-to-set, drag the slice plane ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tip = $('tip'), cv = renderer.domElement;
const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function setRay(e) {
  const b = cv.getBoundingClientRect();
  ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
  ray.setFromCamera(ndc, camera); return b;
}
const hitHandle = (e) => { setRay(e); slicePlane.updateMatrixWorld(true); return ray.intersectObjects(handles)[0]; };
function pick(e) {
  const b = setRay(e);
  const h = ray.intersectObject(surf)[0]; if (!h) return null;
  const X = VAR[ui.x], Y = VAR[ui.y];
  const dx = lerp(X.min, X.max, clamp((h.point.x + S) / (2 * S), 0, 1)), dy = lerp(Y.min, Y.max, clamp((h.point.z + S) / (2 * S), 0, 1));
  const r = run({ [ui.x]: X.toSI(dx), [ui.y]: Y.toSI(dy) });
  return { dx, dy, r, b };
}
let planeDrag = false;
cv.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !hitHandle(e)) return;
  planeDrag = true; controls.enabled = false; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing';
  e.stopImmediatePropagation(); dragTo(e);
}, true);
function dragTo(e) {
  setRay(e); const pt = new THREE.Vector3(); if (!ray.ray.intersectPlane(floor, pt)) return;
  const id = heldId(), V = VAR[id], c = ui.hold === 'y' ? pt.z : pt.x;
  setVar(id, lerp(V.min, V.max, clamp((c + S) / (2 * S), 0, 1))); sync();
}
const endDrag = () => { if (planeDrag) { planeDrag = false; controls.enabled = true; cv.style.cursor = ''; } };
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('pointermove', (e) => {
  if (planeDrag) { dragTo(e); return; }
  if (e.buttons) { tip.style.display = 'none'; ghost.visible = false; return; }
  const onBar = !!hitHandle(e); cv.style.cursor = onBar ? 'grab' : '';
  barMat.color.set(css('--slice')).multiplyScalar(onBar ? 1.25 : 1);
  const p = onBar ? null : pick(e); if (!p) { tip.style.display = 'none'; ghost.visible = false; return; }
  const X = VAR[ui.x], Y = VAR[ui.y], oz = OUT[ui.z], oc = OUT[ui.c];
  tip.textContent = `${X.label} ${fmt(p.dx, X.dec)} ${X.unit}\n${Y.label} ${fmt(p.dy, Y.dec)} ${Y.unit}\n${oz.label} ${fmt(oz.get(p.r), oz.dec)} ${oz.unit}` + (ui.c !== ui.z ? `\n${oc.label} ${fmt(oc.get(p.r), oc.dec)} ${oc.unit}` : '');
  tip.style.display = 'block';
  tip.style.left = Math.min(e.clientX - p.b.left + 16, p.b.width - 230) + 'px'; tip.style.top = Math.max(e.clientY - p.b.top - 80, 40) + 'px';
  ghost.position.set(sx(p.dx), sz(oz.get(p.r)), sy(p.dy)); ghost.visible = true;
});
cv.addEventListener('pointerleave', () => { tip.style.display = 'none'; ghost.visible = false; });
let down = null;
cv.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
cv.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4 || e.button !== 0) return;
  const p = pick(e); if (!p) return;
  setVar(ui.x, p.dx); setVar(ui.y, p.dy); sync();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { drawn = ''; sync(); });

// ---------- boot ----------
buildControls(); buildSelects(); frame();
Promise.all([document.fonts.load('400 14px "JetBrains Mono"'), document.fonts.load('500 14px "JetBrains Mono"')]).catch(() => {}).then(() => { fontsReady = true; sync(); });
window.__bike = { state, ui, run, sync, handleScreen: () => { const v = new THREE.Vector3(0, H, 0); slicePlane.updateMatrixWorld(true); v.applyMatrix4(slicePlane.matrixWorld).project(camera); const b = cv.getBoundingClientRect(); return [b.left + (v.x + 1) / 2 * b.width, b.top + (1 - v.y) / 2 * b.height]; } };
