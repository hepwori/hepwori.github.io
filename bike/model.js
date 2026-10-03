// steady-state cycling power-balance model. SI internally.
// P_wheel = v * ( m g (sinθ + Crr cosθ) + ½ ρ CdA · va|va| ),  va = v + headwind,  P_wheel = η · P_crank

export const G = 9.80665;
const LB = 0.45359237, MPH = 0.44704, FT = 0.3048;

// 2x12, 50/34 x 11-34 (shimano 105 r7100-ish), 700x28 rolling circumference
export const GEARS = {
  rings: [50, 34],
  cogs: [11, 12, 13, 14, 15, 17, 19, 21, 24, 27, 30, 34],
  circ: 2.136,
};

const id = (x) => x;
// every adjustable variable. min/max/step/def are in DISPLAY units; toSI/fromSI convert.
export const VARS = [
  { id: 'power',  group: 'engine',  label: 'power (crank)',  unit: 'W',    min: 0,    max: 600,  step: 5,     def: 200,   dec: 0, toSI: id, fromSI: id },
  { id: 'speed',  group: 'engine',  label: 'speed',          unit: 'mph',  min: 0,    max: 45,   step: 0.5,   def: 17,    dec: 1, toSI: (d) => d * MPH, fromSI: (s) => s / MPH },
  { id: 'grade',  group: 'terrain', label: 'grade',          unit: '%',    min: -10,  max: 18,   step: 0.5,   def: 0,     dec: 1, toSI: id, fromSI: id },
  { id: 'wind',   group: 'terrain', label: 'net headwind',   unit: 'mph',  min: -20,  max: 20,   step: 1,     def: 0,     dec: 0, toSI: (d) => d * MPH, fromSI: (s) => s / MPH, note: '+ = headwind, − = tailwind' },
  { id: 'alt',    group: 'terrain', label: 'altitude',       unit: 'ft',   min: 0,    max: 10000, step: 100,  def: 500,   dec: 0, toSI: (d) => d * FT, fromSI: (s) => s / FT },
  { id: 'temp',   group: 'terrain', label: 'temperature',    unit: '°F',   min: 20,   max: 105,  step: 1,     def: 65,    dec: 0, toSI: (d) => (d - 32) * 5 / 9, fromSI: (s) => s * 9 / 5 + 32 },
  { id: 'cda',    group: 'bike',    label: 'CdA',            unit: 'm²',   min: 0.20, max: 0.50, step: 0.005, def: 0.34,  dec: 3, toSI: id, fromSI: id, note: 'drag area: bike + rider' },
  { id: 'crr',    group: 'bike',    label: 'Crr',            unit: '',     min: 0.002, max: 0.012, step: 0.0005, def: 0.0045, dec: 4, toSI: id, fromSI: id, note: 'rolling resistance coeff.' },
  { id: 'rider',  group: 'bike',    label: 'rider mass',     unit: 'lb',   min: 110,  max: 260,  step: 1,     def: 180,   dec: 0, toSI: (d) => d * LB, fromSI: (s) => s / LB },
  { id: 'bike',   group: 'bike',    label: 'bike mass',      unit: 'lb',   min: 14,   max: 30,   step: 0.5,   def: 19,    dec: 1, toSI: (d) => d * LB, fromSI: (s) => s / LB },
  { id: 'kit',    group: 'bike',    label: 'kit mass',       unit: 'lb',   min: 0,    max: 20,   step: 0.5,   def: 8,     dec: 1, toSI: (d) => d * LB, fromSI: (s) => s / LB, note: 'helmet, shoes, clothes, bottles, tools' },
  { id: 'eta',    group: 'bike',    label: 'drivetrain eff.', unit: '%',   min: 90,   max: 99,   step: 0.1,   def: 97.5,  dec: 1, toSI: (d) => d / 100, fromSI: (s) => s * 100 },
  { id: 'tcad',   group: 'gearing', label: 'target cadence', unit: 'rpm',  min: 50,   max: 130,  step: 1,     def: 90,    dec: 0, toSI: id, fromSI: id, noAxis: true },
];
export const VAR = Object.fromEntries(VARS.map((v) => [v.id, v]));
export const defaults = () => Object.fromEntries(VARS.map((v) => [v.id, v.toSI(v.def)]));

export function airDensity(altM, tempC) {
  const p = 101325 * Math.pow(1 - 2.25577e-5 * altM, 5.25588); // ISA barometric
  return p / (287.05 * (tempC + 273.15));                      // dry air, ideal gas
}

// resistive force at ground speed v (N); positive = opposes motion
function force(v, k) {
  const va = v + k.wind;
  return k.mg * (k.sin + k.crr * k.cos) + 0.5 * k.rho * k.cda * va * Math.abs(va);
}

// largest v in [0, VMAX] where wheel power balances. scanning down handles tailwind non-monotonicity.
const VMAX = 40;
export function solveSpeed(pw, k) {
  const f = (v) => pw - v * force(v, k);
  let hi = VMAX, fhi = f(hi);
  for (let v = VMAX - 0.1; v >= 0; v -= 0.1) {
    const fv = f(v);
    if (fv >= 0) {
      let lo = v; hi = v + 0.1;
      for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (f(mid) >= 0) lo = mid; else hi = mid; }
      return (lo + hi) / 2;
    }
  }
  return 0;
}

// gear choice: nearest-to-target cadence among allowed combos. ring/cog = 'auto' or a number.
export function pickGear(v, tcad, ring = 'auto', cog = 'auto') {
  const rings = ring === 'auto' ? GEARS.rings : [ring];
  const cogs = cog === 'auto' ? GEARS.cogs : [cog];
  let best = null;
  for (const r of rings) for (const c of cogs) {
    const cad = (v * 60 * c) / (GEARS.circ * r);
    const err = Math.abs(cad - tcad);
    if (!best || err < best.err - 1e-9 || (Math.abs(err - best.err) < 1e-9 && r > best.ring)) best = { ring: r, cog: c, cad, err };
  }
  return best;
}

// s: SI state. mode: 'power' (power → speed) or 'speed' (speed → power). gear: {ring, cog}
export function compute(s, mode = 'power', gear = {}) {
  const theta = Math.atan(s.grade / 100);
  const m = s.rider + s.bike + s.kit;
  const rho = airDensity(s.alt, s.temp);
  const k = { mg: m * G, sin: Math.sin(theta), cos: Math.cos(theta), crr: s.crr, rho, cda: s.cda, wind: s.wind };

  let v, pw, p;
  if (mode === 'power') {
    p = s.power; pw = p * s.eta; v = solveSpeed(pw, k);
  } else {
    v = s.speed; pw = v * force(v, k);
    p = pw >= 0 ? pw / s.eta : pw; // negative = braking needed (no drivetrain involved)
  }
  const va = v + s.wind;
  const grav = k.mg * k.sin * v, roll = k.mg * s.crr * k.cos * v, aero = 0.5 * rho * s.cda * va * Math.abs(va) * v;
  const g = pickGear(v, s.tcad, gear.ring, gear.cog);
  const cad = g.cad;
  const omega = (cad * 2 * Math.PI) / 60;
  const resist = Math.max(aero, 0) + roll + Math.max(grav, 0);
  return {
    v, p, pw, grav, roll, aero, loss: p > 0 ? p - pw : 0, rho, m,
    cad, ring: g.ring, cog: g.cog,
    torque: omega > 0.05 ? Math.max(p, 0) / omega : 0,
    wkg: Math.max(p, 0) / s.rider,
    pace: v > 0.45 ? Math.min(26.8224 / v, 60) : 60,               // min per mile
    climb: (v * k.sin * 3600) / FT,                                // ft/hr
    aeroShare: resist > 0 ? Math.min(Math.max(aero, 0) / resist, 1) : 0,
    force: force(v, k),
  };
}

// dependent outputs: display units
export const OUTPUTS = [
  { id: 'speed',    label: 'speed',            unit: 'mph',   dec: 1, get: (r) => r.v / MPH },
  { id: 'power',    label: 'crank power',      unit: 'W',     dec: 0, get: (r) => r.p },
  { id: 'cad',      label: 'cadence (in gear)', unit: 'rpm',  dec: 0, get: (r) => r.cad },
  { id: 'torque',   label: 'crank torque',     unit: 'N·m',   dec: 1, get: (r) => r.torque },
  { id: 'wkg',      label: 'power / weight',   unit: 'W/kg',  dec: 2, get: (r) => r.wkg },
  { id: 'pace',     label: 'pace',             unit: 'min/mi', dec: 1, get: (r) => r.pace },
  { id: 'climb',    label: 'climb rate',       unit: 'ft/hr', dec: 0, get: (r) => r.climb },
  { id: 'aeroShare', label: 'aero share of resistance', unit: '%', dec: 0, get: (r) => r.aeroShare * 100 },
];
export const OUT = Object.fromEntries(OUTPUTS.map((o) => [o.id, o]));
