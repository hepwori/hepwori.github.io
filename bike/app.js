import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VARS, VAR, OUTPUTS, OUT, GEARS, defaults, compute } from './model.js';

const $ = (id) => document.getElementById(id);
const S = 5, H = 4, N = 56; // half-width of floor, height of box, grid resolution

// ---------- state ----------
const state = defaults();                 // SI values
const ui = { mode: 'power', x: 'power', y: 'grade', z: 'speed', c: 'aeroShare', ring: 'auto', cog: 'auto', autoscale: true };
let zRange = null;                        // locked z range when autoscale off

const disp = (id) => VAR[id].fromSI(state[id]);
const fmt = (v, dec) => (Number.isFinite(v) ? v.toFixed(dec) : '—');
const gear = () => ({ ring: ui.ring === 'auto' ? 'auto' : +ui.ring, cog: ui.cog === 'auto' ? 'auto' : +ui.cog });
const run = (over = {}) => compute({ ...state, ...over }, ui.mode, gear());
const axisVars = () => VARS.filter((v) => !v.noAxis && v.id !== (ui.mode === 'power' ? 'speed' : 'power'));

// ---------- controls ----------
const rows = {};
function buildControls() {
  const groups = [['engine', 'engine'], ['terrain', 'terrain & weather'], ['bike', 'bike & rider'], ['gearing', 'gearing']];
  const ctl = $('ctl');
  ctl.innerHTML = '';
  for (const [g, title] of groups) {
    const h = document.createElement('h2'); h.textContent = title; h.style.marginTop = g === 'engine' ? '0' : '14px'; ctl.appendChild(h);
    if (g === 'engine') {
      const seg = document.createElement('div'); seg.className = 'seg';
      seg.innerHTML = `<label><input type="radio" name="mode" value="power" checked><span>power → speed</span></label><label><input type="radio" name="mode" value="speed"><span>speed → power</span></label>`;
      seg.addEventListener('change', (e) => { ui.mode = e.target.value; fixAxes(); buildSelects(); sync(); });
      ctl.appendChild(seg);
    }
    if (g === 'bike') {
      const p = document.createElement('div'); p.className = 'presets';
      p.innerHTML = '<span class="note" style="font-size:11px;color:var(--muted)">CdA preset:</span>';
      for (const [n, v] of [['aero tuck', 0.27], ['drops', 0.30], ['hoods', 0.34], ['tops', 0.40]]) {
        const b = document.createElement('button'); b.textContent = `${n} ${v}`; b.onclick = () => { state.cda = v; sync(); }; p.appendChild(b);
      }
      ctl.appendChild(p);
    }
    for (const v of VARS.filter((v) => v.group === g)) {
      const r = document.createElement('div'); r.className = 'row';
      r.innerHTML = `<label><span class="nm">${v.label}</span><span class="chip"></span>${v.note ? `<span class="note">${v.note}</span>` : ''}</label><output></output><input type="range" min="${v.min}" max="${v.max}" step="${v.step}">`;
      const inp = r.querySelector('input');
      inp.addEventListener('input', () => { state[v.id] = v.toSI(+inp.value); sync(); });
      ctl.appendChild(r);
      rows[v.id] = { el: r, inp, out: r.querySelector('output'), chip: r.querySelector('.chip') };
    }
    if (g === 'gearing') {
      const d = document.createElement('div'); d.className = 'gear';
      const opts = (arr) => ['auto', ...arr].map((x) => `<option>${x}</option>`).join('');
      d.innerHTML = `<label>chainring <select id="selRing">${opts(GEARS.rings)}</select></label><label>cog <select id="selCog">${opts(GEARS.cogs)}</select></label>`;
      d.addEventListener('change', (e) => { ui[e.target.id === 'selRing' ? 'ring' : 'cog'] = e.target.value; sync(); });
      ctl.appendChild(d);
      const n = document.createElement('div'); n.className = 'note'; n.style.cssText = 'font-size:11px;color:var(--muted);margin-top:4px';
      n.textContent = `50/34 × 11-34, 700×28 (${GEARS.circ} m). "auto" picks the combo nearest your target cadence.`;
      ctl.appendChild(n);
    }
  }
}

function buildSelects() {
  const fill = (el, items, cur) => { el.innerHTML = items.map(([v, l]) => `<option value="${v}">${l}</option>`).join(''); el.value = cur; };
  const av = axisVars().map((v) => [v.id, `${v.label}${v.unit ? ' (' + v.unit + ')' : ''}`]);
  fill($('selX'), av, ui.x); fill($('selY'), av, ui.y);
  const outs = OUTPUTS.map((o) => [o.id, `${o.label} (${o.unit})`]);
  fill($('selZ'), outs, ui.z); fill($('selC'), outs, ui.c);
}
function fixAxes() {
  const ok = new Set(axisVars().map((v) => v.id));
  const dep = ui.mode === 'power' ? 'speed' : 'power', ind = ui.mode === 'power' ? 'power' : 'speed';
  if (!ok.has(ui.x)) ui.x = ui.x === dep ? ind : 'power';
  if (!ok.has(ui.y)) ui.y = ui.y === dep ? ind : 'grade';
  if (ui.x === ui.y) ui.y = [...ok].find((i) => i !== ui.x);
  if (ui.z === ind) ui.z = dep; // the independent engine var is now an input, plot the other
}
for (const k of ['X', 'Y', 'Z', 'C']) {
  $('sel' + k).addEventListener('change', (e) => {
    ui[k.toLowerCase()] = e.target.value;
    if (ui.x === ui.y) { const o = axisVars().find((v) => v.id !== ui.x).id; if (k === 'X') ui.y = o; else ui.x = o; buildSelects(); }
    zRange = null; sync();
  });
}

// ---------- three scene ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
camera.position.set(12.5, 9, 14);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, H * 0.35, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;
scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(6, 12, 8); scene.add(sun);

// surface
const geo = new THREE.BufferGeometry();
const pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3);
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
{
  const idx = [];
  for (let i = 0; i < N - 1; i++) for (let j = 0; j < N - 1; j++) {
    const a = i * N + j, b = a + 1, c = a + N, d = c + 1; idx.push(a, c, b, b, c, d);
  }
  geo.setIndex(idx);
}
const surf = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
scene.add(surf);
const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.1 }));
scene.add(wire);

const decor = new THREE.Group(); scene.add(decor);
const slices = new THREE.Group(); scene.add(slices);
const marker = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
const markerRing = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }));
const drop = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
const ghost = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
ghost.visible = false;
scene.add(marker, markerRing, drop, ghost);

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage); resize();

// ---------- helpers ----------
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function viridis(t) {
  const st = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
  t = Math.min(Math.max(t, 0), 1) * 4; const i = Math.min(Math.floor(t), 3), f = t - i;
  return st[i].map((a, k) => (a + (st[i + 1][k] - a) * f) / 255);
}
function niceTicks(lo, hi, n = 5) {
  if (!(hi > lo)) { hi = lo + 1; }
  const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step;
  const ticks = []; for (let t = a; t <= b + step * 1e-6; t += step) ticks.push(+t.toFixed(10));
  return { ticks, lo: a, hi: b, step };
}
const tickFmt = (v, step) => (step >= 1 ? v.toFixed(0) : v.toFixed(Math.min(4, Math.ceil(-Math.log10(step)))));
function label(text, { size = 0.3, color = css('--text2'), bold = false } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), px = 56;
  g.font = `${bold ? '700 ' : ''}${px}px system-ui, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 16; c.width = w; c.height = px + 16;
  g.font = `${bold ? '700 ' : ''}${px}px system-ui, sans-serif`; g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillText(text, w / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set((size * w) / px, (size * c.height) / px, 1); sp.renderOrder = 10; return sp;
}
function clearGroup(g) {
  for (const o of [...g.children]) {
    g.remove(o);
    o.geometry?.dispose();
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
const lerp = (a, b, t) => a + (b - a) * t;

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
  if (zmin >= 0 && zmin < 0.35 * zmax) zmin = 0;
  zt = niceTicks(zmin, zmax);
  if (!ui.autoscale && zRange) zt = zRange; else zRange = zt;
  xr = [X.min, X.max]; yr = [Y.min, Y.max]; zr = [zt.lo, zt.hi]; cr = [cmin, cmax];
}
const sx = (v) => -S + ((v - xr[0]) / (xr[1] - xr[0])) * 2 * S;
const sy = (v) => -S + ((v - yr[0]) / (yr[1] - yr[0])) * 2 * S;
const sz = (v) => Math.min(Math.max((v - zr[0]) / (zr[1] - zr[0]), -0.02), 1.02) * H;

function updateSurface() {
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const k = i * N + j;
    pos[k * 3] = -S + (j / (N - 1)) * 2 * S; pos[k * 3 + 1] = sz(zs[k]); pos[k * 3 + 2] = -S + (i / (N - 1)) * 2 * S;
    const t = cr[1] > cr[0] ? (cs[k] - cr[0]) / (cr[1] - cr[0]) : 0.5;
    const c = viridis(t); col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
  }
  geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  geo.computeVertexNormals(); geo.computeBoundingSphere(); geo.computeBoundingBox();
}

function updateDecor() {
  const key = [ui.x, ui.y, ui.z, zt.lo, zt.hi, css('--text2')].join('|');
  if (key === drawn) return; drawn = key;
  clearGroup(decor);
  const X = VAR[ui.x], Y = VAR[ui.y], oz = OUT[ui.z], grid = css('--grid');
  const xt = niceTicks(xr[0], xr[1], 6), yt = niceTicks(yr[0], yr[1], 6);
  const ptsF = [], ptsW = [];
  // floor grid
  for (const t of xt.ticks) if (t >= xr[0] - 1e-9 && t <= xr[1] + 1e-9) { const x = sx(t); ptsF.push([x, 0, -S], [x, 0, S]); ptsW.push([x, 0, -S], [x, H, -S]); }
  for (const t of yt.ticks) if (t >= yr[0] - 1e-9 && t <= yr[1] + 1e-9) { const z = sy(t); ptsF.push([-S, 0, z], [S, 0, z]); ptsW.push([-S, 0, z], [-S, H, z]); }
  for (const t of zt.ticks) { const y = ((t - zr[0]) / (zr[1] - zr[0])) * H; ptsW.push([-S, y, -S], [S, y, -S], [-S, y, -S], [-S, y, S]); }
  decor.add(lineSeg(ptsF, grid, 0.9), lineSeg(ptsW, grid, 0.5));
  const lab = (txt, x, y, z, o) => { const s = label(txt, o); s.position.set(x, y, z); decor.add(s); };
  for (const t of xt.ticks) if (t >= xr[0] - 1e-9 && t <= xr[1] + 1e-9) lab(tickFmt(t, xt.step), sx(t), -0.05, S + 0.5);
  for (const t of yt.ticks) if (t >= yr[0] - 1e-9 && t <= yr[1] + 1e-9) lab(tickFmt(t, yt.step), S + 0.6, -0.05, sy(t));
  for (const t of zt.ticks) lab(tickFmt(t, zt.step), -S - 0.55, ((t - zr[0]) / (zr[1] - zr[0])) * H, -S);
  lab(`${X.label} (${X.unit})`, 0, -0.05, S + 1.35, { bold: true, size: 0.36, color: css('--accent') });
  lab(`${Y.label} (${Y.unit})`, S + 1.9, -0.05, 0, { bold: true, size: 0.36, color: css('--accent2') });
  lab(`${oz.label} (${oz.unit})`, -S - 0.5, H + 0.55, -S, { bold: true, size: 0.36, color: css('--text') });
  scene.background = new THREE.Color(css('--canvas'));
  wire.material.color.set(matchMedia('(prefers-color-scheme: dark)').matches ? 0xffffff : 0x000000);
}

function updateMarker(r) {
  const X = VAR[ui.x], Y = VAR[ui.y], oz = OUT[ui.z];
  const cx = Math.min(Math.max(disp(ui.x), X.min), X.max), cy = Math.min(Math.max(disp(ui.y), Y.min), Y.max);
  const px = sx(cx), pz = sy(cy), py = sz(oz.get(r));
  marker.position.set(px, py, pz); markerRing.position.copy(marker.position);
  drop.geometry.setFromPoints([new THREE.Vector3(px, 0, pz), new THREE.Vector3(px, py, pz)]);
  // slice curves through the marker
  clearGroup(slices);
  const a = [], b = [];
  const x0 = X.toSI(X.min), x1 = X.toSI(X.max), y0 = Y.toSI(Y.min), y1 = Y.toSI(Y.max);
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const ra = run({ [ui.x]: lerp(x0, x1, t) }), rb = run({ [ui.y]: lerp(y0, y1, t) });
    a.push(new THREE.Vector3(-S + t * 2 * S, sz(oz.get(ra)) + 0.02, pz));
    b.push(new THREE.Vector3(px, sz(oz.get(rb)) + 0.02, -S + t * 2 * S));
  }
  slices.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(a), new THREE.LineBasicMaterial({ color: css('--accent').length ? new THREE.Color(css('--accent')) : 0xff7700 })));
  slices.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(b), new THREE.LineBasicMaterial({ color: new THREE.Color(css('--accent2')) })));
}

// ---------- readouts ----------
function updateReadout(r) {
  const cell = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
  $('readout').innerHTML = [
    cell(`${fmt(r.v / 0.44704, 1)} mph`, `${fmt(r.v * 3.6, 1)} km/h`),
    cell(`${fmt(r.p, 0)} W`, ui.mode === 'speed' && r.p < 0 ? 'braking needed' : `${fmt(r.wkg, 2)} W/kg`),
    cell(`${fmt(r.cad, 0)} rpm`, `${r.ring}×${r.cog}`),
    cell(`${fmt(r.torque, 1)} N·m`, 'crank torque'),
    cell(`${fmt(r.pace, 1)}`, 'min / mile'),
    cell(`${fmt(r.climb, 0)} ft/h`, 'climb rate'),
  ].join('');
  const items = [['gravity', r.grav, '#8c6bb1'], ['rolling', r.roll, '#2b8a3e'], ['aero', r.aero, '#1c7ed6'], ['drivetrain', r.loss, '#868e96']];
  const tot = Math.max(items.reduce((s, [, w]) => s + Math.max(w, 0), 0), 1);
  $('brk').innerHTML = items.map(([n, w, c]) => `<span>${n}</span><i style="width:${Math.max(Math.min(w, tot), 0) / tot * 100}%;background:${c}"></i><em>${fmt(w, 0)} W</em>`).join('')
    + `<span style="grid-column:1/-1;font-size:11px;color:var(--muted)">total mass ${fmt(r.m / 0.45359237, 0)} lb · air ${fmt(r.rho, 3)} kg/m³${r.grav < 0 ? ' · gravity is helping' : ''}</span>`;
  for (const v of VARS) {
    const row = rows[v.id]; const d = disp(v.id);
    row.out.textContent = `${fmt(d, v.dec)} ${v.unit}`; row.inp.value = d;
    row.chip.textContent = v.id === ui.x ? 'X' : v.id === ui.y ? 'Y' : ''; row.chip.className = 'chip ' + (v.id === ui.x ? 'x' : v.id === ui.y ? 'y' : '');
    row.chip.style.display = row.chip.textContent ? '' : 'none';
    const hide = (ui.mode === 'power' && v.id === 'speed') || (ui.mode === 'speed' && v.id === 'power');
    row.el.style.display = hide ? 'none' : '';
  }
  const oc = OUT[ui.c];
  $('legT').textContent = `color: ${oc.label}`; $('legLo').textContent = `${fmt(cr[0], oc.dec)} ${oc.unit}`; $('legHi').textContent = `${fmt(cr[1], oc.dec)} ${oc.unit}`;
  $('legBar').style.background = `linear-gradient(90deg, ${[0, .25, .5, .75, 1].map((t) => 'rgb(' + viridis(t).map((c) => Math.round(c * 255)).join(',') + ')').join(',')})`;
}

// ---------- main loop ----------
let dirty = true;
function sync() { dirty = true; }
function frame() {
  if (dirty) {
    dirty = false;
    evalGrid(); updateSurface(); updateDecor();
    const r = run(); updateMarker(r); updateReadout(r);
  }
  controls.update(); renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- hover / click ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tip = $('tip');
function pick(e) {
  const b = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const h = ray.intersectObject(surf)[0]; if (!h) return null;
  const X = VAR[ui.x], Y = VAR[ui.y];
  const fx = Math.min(Math.max((h.point.x + S) / (2 * S), 0), 1), fy = Math.min(Math.max((h.point.z + S) / (2 * S), 0), 1);
  const dx = lerp(X.min, X.max, fx), dy = lerp(Y.min, Y.max, fy);
  const r = run({ [ui.x]: X.toSI(dx), [ui.y]: Y.toSI(dy) });
  return { dx, dy, r, b };
}
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.buttons) { tip.style.display = 'none'; ghost.visible = false; return; }
  const p = pick(e); if (!p) { tip.style.display = 'none'; ghost.visible = false; return; }
  const X = VAR[ui.x], Y = VAR[ui.y], oz = OUT[ui.z], oc = OUT[ui.c];
  tip.textContent = `${X.label} ${fmt(p.dx, X.dec)} ${X.unit}\n${Y.label} ${fmt(p.dy, Y.dec)} ${Y.unit}\n${oz.label} ${fmt(oz.get(p.r), oz.dec)} ${oz.unit}` + (ui.c !== ui.z ? `\n${oc.label} ${fmt(oc.get(p.r), oc.dec)} ${oc.unit}` : '');
  tip.style.display = 'block';
  tip.style.left = Math.min(e.clientX - p.b.left + 14, p.b.width - 190) + 'px'; tip.style.top = Math.max(e.clientY - p.b.top - 70, 4) + 'px';
  ghost.position.set(sx(p.dx), sz(oz.get(p.r)), sy(p.dy)); ghost.visible = true;
});
renderer.domElement.addEventListener('pointerleave', () => { tip.style.display = 'none'; ghost.visible = false; });
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4 || e.button !== 0) return;
  const p = pick(e); if (!p) return;
  state[ui.x] = VAR[ui.x].toSI(p.dx); state[ui.y] = VAR[ui.y].toSI(p.dy); sync();
});
$('autoscale')?.addEventListener('change', (e) => { ui.autoscale = e.target.checked; sync(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { drawn = ''; sync(); });

// ---------- boot ----------
buildControls(); buildSelects(); frame();
window.__bike = { state, ui, run, sync };
