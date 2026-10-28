// NEXUS · Personaje 3D cabezón
// Diseño propio construido con geometría suave y sombreado "toon"; las armas y escudos son
// KayKit Fantasy Weapons Bits (CC0, assets/kaykit). Un único renderer que se mueve entre
// contenedores (los navegadores limitan los contextos WebGL) y también genera miniaturas.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ─── Catálogo visual (nombres, precios y niveles: tabla shop_items) ──────────
export const SKIN_TONES = ['#FFE0CC', '#F6C9A6', '#E2A97E', '#C08259', '#8E5A3B', '#5E3A26'];
export const EYE_COLORS = [['Marrón', '#6B3F1E'], ['Azul', '#3D8BFF'], ['Verde', '#2FA45A'], ['Avellana', '#A07A2C'], ['Gris', '#7D8B99'], ['Violeta', '#8A55E0']];
export const HAIR_COLORS = ['#2A1F1A', '#5A3420', '#9A5427', '#E0B25E', '#F2E2B8', '#D2462F', '#E9E6EE', '#4A6CF0'];
export const HAIR_STYLES = [['corto', 'Corto'], ['pinchos', 'Pinchos'], ['rapado', 'Rapado'], ['melena', 'Melena'], ['largo', 'Largo'], ['coleta', 'Coleta'], ['mono', 'Moño']];
export const DEFAULT_AVATAR = { sex: 'm', age: 'adult', skin: 1, eyes: 0, hair: 'corto', hairColor: 1, beard: false, equip: {} };

// Ropa y equipo dibujados en código. Las armas usan modelos KayKit.
export const OUTFITS = {
  torso_aldeano: { tunic: '#5B8DEF', belt: '#6B4423' },
  torso_cuero: { tunic: '#8A5A34', belt: '#4A2E18', straps: '#5A3A20' },
  torso_mago: { tunic: '#6A4BC9', belt: '#E8C25A', robe: '#5A3DB0' },
  torso_ninja: { tunic: '#2B2F3A', belt: '#D2462F', straps: '#1C1F27' },
  torso_hierro: { tunic: '#4A5263', belt: '#3A2A1A', plate: '#B8C2D0', pauldrons: '#A3AEBE' },
  torso_oro: { tunic: '#8E2A2A', belt: '#5A1A1A', plate: '#F2C14E', pauldrons: '#E0A92E' },
};
export const WEAPONS = {
  arma_espada_madera: ['sword_A', 0.42], arma_daga: ['dagger_A', 0.3], arma_sai: ['dagger_B', 0.32], arma_espada: ['sword_B', 0.5],
  arma_cimitarra: ['sword_C', 0.52], arma_estoque: ['sword_D', 0.55], arma_espadon: ['sword_E', 0.66], arma_hacha: ['axe_A', 0.46],
  arma_hacha_doble: ['axe_B', 0.56], arma_cuchilla: ['axe_C', 0.52], arma_garrote: ['hammer_A', 0.48], arma_lucero: ['hammer_B', 0.52],
  arma_martillo: ['hammer_C', 0.56], arma_lanza: ['spear_A', 0.9], arma_alabarda: ['halberd', 0.9], arma_baculo: ['staff_A', 0.85],
  arma_baston: ['staff_B', 0.85], arma_varita: ['wand_A', 0.32],
  escudo_madera: ['shield_A', 0.36], escudo_heraldico: ['shield_B', 0.4], escudo_pinchos: ['shield_C', 0.42],
  arco_corto: ['bow_A_withString', 0.62], arco_largo: ['bow_B_withString', 0.7],
};
const HEADWEAR = ['casco_hierro', 'casco_vikingo', 'capucha', 'sombrero_mago', 'corona', 'diadema'];
const CAPES = { capa_roja: '#C93A3A', capa_azul: '#2F5FD0', capa_negra: '#23252D', capa_real: '#7A2DB8' };
const BOOTS = { botas_cuero: '#6B4423', botas_hierro: '#9AA5B5', botas_oro: '#E8B53E' };

// ─── Materiales toon ────────────────────────────────────────────────────────
const gradient = (() => {
  const d = new Uint8Array([96, 96, 96, 255, 178, 178, 178, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const mats = new Map();
// Material suave tipo "juguete de vinilo": PBR con reflejos del entorno; el metal brilla de verdad
function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) {
    let m;
    if (opts.basic) m = new THREE.MeshBasicMaterial({ color, transparent: !!opts.opacity, opacity: opts.opacity ?? 1, depthWrite: !opts.opacity });
    else m = new THREE.MeshStandardMaterial({
      color, side: opts.side || THREE.FrontSide,
      metalness: opts.metal ? 0.85 : 0, roughness: opts.metal ? 0.28 : (opts.rough ?? 0.58),
      envMapIntensity: opts.metal ? 1.4 : 0.9,
      flatShading: !opts.smooth && !opts.metal, // el metal facetado refleja a cuadros
    });
    mats.set(key, m);
  }
  return mats.get(key);
}
const canvasTex = new Map();
function drawTex(key, w, h, draw) {
  if (!canvasTex.has(key)) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    canvasTex.set(key, t);
  }
  return canvasTex.get(key);
}
// Ojo almendrado: párpado superior marcado que tapa parte del iris, iris en degradado y brillo
function eyeTexture(color, female) {
  return drawTex('eye2' + color + female, 200, 140, (g, w, h) => {
    const cx = w / 2, cy = h * 0.55;
    const almond = () => { g.beginPath(); g.moveTo(w * 0.06, cy); g.quadraticCurveTo(w * 0.42, h * 0.08, w * 0.94, cy - h * 0.06); g.quadraticCurveTo(w * 0.55, h * 0.98, w * 0.06, cy); g.closePath(); };
    g.save(); almond(); g.clip();
    g.fillStyle = '#F7F3EE'; g.fillRect(0, 0, w, h);
    const base = new THREE.Color(color);
    const ir = g.createRadialGradient(cx, cy + h * 0.08, 2, cx, cy, h * 0.36);
    ir.addColorStop(0, '#' + base.clone().lerp(new THREE.Color('#ffffff'), 0.35).getHexString());
    ir.addColorStop(0.6, color);
    ir.addColorStop(1, '#' + base.clone().multiplyScalar(0.4).getHexString());
    g.fillStyle = ir; g.beginPath(); g.arc(cx, cy + h * 0.04, h * 0.34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#120C09'; g.beginPath(); g.arc(cx, cy + h * 0.05, h * 0.15, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(cx + h * 0.12, cy - h * 0.06, h * 0.075, 0, Math.PI * 2); g.fill();
    // sombra del párpado sobre el ojo
    const sh = g.createLinearGradient(0, 0, 0, h * 0.5); sh.addColorStop(0, 'rgba(40,20,10,0.22)'); sh.addColorStop(1, 'rgba(40,20,10,0)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h * 0.5);
    g.restore();
    // línea del párpado superior (más gruesa hacia fuera) y pestañas en ellas
    g.strokeStyle = '#1B1410'; g.lineCap = 'round';
    g.lineWidth = h * 0.085; g.beginPath(); g.moveTo(w * 0.08, cy - h * 0.02); g.quadraticCurveTo(w * 0.42, h * 0.06, w * 0.95, cy - h * 0.08); g.stroke();
    g.lineWidth = h * 0.03; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(w * 0.2, cy + h * 0.2); g.quadraticCurveTo(w * 0.55, h * 0.96, w * 0.9, cy + h * 0.02); g.stroke(); g.globalAlpha = 1;
    if (female) { g.lineWidth = h * 0.05; g.beginPath(); g.moveTo(w * 0.9, cy - h * 0.08); g.lineTo(w * 0.99, cy - h * 0.24); g.stroke(); }
  });
}
// Boca: sonrisa cerrada (labios algo marcados en ellas)
function mouthTexture(female) {
  return drawTex('mouth2' + female, 128, 64, (g, w, h) => {
    if (female) { g.fillStyle = '#C8576A'; g.beginPath(); g.moveTo(w * 0.2, h * 0.42); g.quadraticCurveTo(w / 2, h * 0.3, w * 0.8, h * 0.42); g.quadraticCurveTo(w / 2, h * 0.86, w * 0.2, h * 0.42); g.fill(); }
    g.strokeStyle = female ? '#7A2A38' : '#5A2A22'; g.lineWidth = h * 0.1; g.lineCap = 'round';
    g.beginPath(); g.moveTo(w * 0.18, h * 0.4); g.quadraticCurveTo(w / 2, h * 0.68, w * 0.82, h * 0.4); g.stroke();
  });
}

const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

function mesh(geo, mat, pos, scale, rot) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  if (scale) m.scale.set(...scale);
  if (rot) m.rotation.set(...rot);
  return m;
}
const G = {
  sphere: new THREE.SphereGeometry(1, 16, 12),
  head: new THREE.SphereGeometry(1, 22, 16), // algo más fina para que los ojos asienten bien
  capsule: new THREE.CapsuleGeometry(1, 1, 3, 10),
  cone: new THREE.ConeGeometry(1, 1, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  circle: new THREE.CircleGeometry(1, 28),
};

// ─── Cabeza ──────────────────────────────────────────────────────────────────
const HEAD = { cy: 0.62, a: 0.24, b: 0.225, c: 0.23 };
// Punto de la superficie de la cabeza (elipsoide) para pegar rasgos de la cara
function onHead(x, y, lift = 0.004) {
  const { cy, a, b, c } = HEAD;
  const k = 1 - (x / a) ** 2 - ((y - cy) / b) ** 2;
  const z = c * Math.sqrt(Math.max(0.0001, k));
  const n = new THREE.Vector3(x / a ** 2, (y - cy) / b ** 2, z / c ** 2).normalize();
  return { p: new THREE.Vector3(x, y, z).addScaledVector(n, lift), n };
}
function stick(obj, x, y, lift) {
  const { p, n } = onHead(x, y, lift);
  obj.position.copy(p);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  return obj;
}

const eyeGeo = new THREE.PlaneGeometry(1, 1);
function buildEye(side, cfg, teen) {
  const g = new THREE.Group();
  const s = teen ? 1.12 : 1;
  const iris = (EYE_COLORS[cfg.eyes] || EYE_COLORS[0])[1];
  const m = new THREE.MeshBasicMaterial({ map: eyeTexture(iris, cfg.sex === 'f'), transparent: true, depthWrite: false, side: THREE.DoubleSide });
  // Escala x negativa en el ojo izquierdo: las pestañas quedan siempre hacia fuera
  g.add(mesh(eyeGeo, m, [0, 0, 0], [0.108 * s * side, 0.08 * s, 1]));
  const wrap = new THREE.Group(); wrap.add(g);
  stick(wrap, 0.09 * side, 0.605, 0.009);
  wrap.userData.blink = g;
  return wrap;
}

function buildHead(cfg, hairMat) {
  const teen = cfg.age === 'teen';
  const skin = SKIN_TONES[cfg.skin] || SKIN_TONES[1];
  const head = new THREE.Group();
  head.add(mesh(G.head, toon(skin, { rough: 0.65, smooth: true }), [0, HEAD.cy, 0], [HEAD.a, HEAD.b, HEAD.c]));
  head.add(mesh(G.sphere, toon(skin), [-0.235, 0.6, 0], [0.04, 0.05, 0.03]), mesh(G.sphere, toon(skin), [0.235, 0.6, 0], [0.04, 0.05, 0.03]));
  const eyes = [buildEye(-1, cfg, teen), buildEye(1, cfg, teen)];
  head.add(...eyes);
  // Cejas
  [-1, 1].forEach((sd) => {
    const b = mesh(G.capsule, hairMat, [0, 0, 0], [0.008, 0.032, 0.006], [0, 0, Math.PI / 2 - sd * 0.12]);
    const w = new THREE.Group(); w.add(b); stick(w, 0.092 * sd, 0.665, 0.006); head.add(w);
  });
  // Boca y mejillas
  const mouth = mesh(eyeGeo, new THREE.MeshBasicMaterial({ map: mouthTexture(cfg.sex === 'f'), transparent: true, depthWrite: false }), [0, 0, 0], [0.06, 0.03, 1]);
  const nose = new THREE.Group(); nose.add(mesh(G.sphere, toon(shade(skin, 0.95)), [0, 0, 0], [0.016, 0.02, 0.014])); stick(nose, 0, 0.565, 0.003); head.add(nose);
  const mw = new THREE.Group(); mw.add(mouth); stick(mw, 0, cfg.beard && cfg.sex === 'm' && cfg.age !== 'teen' ? 0.522 : 0.522, cfg.beard ? 0.012 : 0.003); head.add(mw);
  [-1, 1].forEach((sd) => {
    const c = mesh(G.circle, toon('#FF6F86', { basic: true, opacity: 0.16 }), [0, 0, 0], [0.04, 0.022, 1]);
    const cw = new THREE.Group(); cw.add(c); stick(cw, 0.145 * sd, 0.545, 0.006); head.add(cw);
  });
  // Barba (adulto)
  if (cfg.beard && cfg.sex === 'm' && cfg.age !== 'teen') {
    head.add(mesh(G.sphere, hairMat, [0, 0.455, 0.14], [0.12, 0.065, 0.085]));
    const mu = mesh(G.capsule, hairMat, [0, 0, 0], [0.014, 0.05, 0.012], [0, 0, Math.PI / 2]);
    const muw = new THREE.Group(); muw.add(mu); stick(muw, 0, 0.552, 0.01); head.add(muw);
  }
  head.userData.eyes = eyes;
  return head;
}

// ─── Pelo ────────────────────────────────────────────────────────────────────
function capGeo(cover) {
  // Casquete que cubre la parte superior; inclinado para dejar la frente libre
  return new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * cover);
}
function buildHair(style, mat, hidden) {
  const g = new THREE.Group();
  const top = new THREE.Group(); // lo que tapa un casco
  const { cy, a, b, c } = HEAD;
  const cap = (cover, k, tilt) => mesh(capGeo(cover), mat, [0, cy, -0.01], [a * k, b * k, c * k], [-tilt, 0, 0]);
  const tuft = (x, y, z, sx, sy, sz, rx, rz) => mesh(G.sphere, mat, [x, y, z], [sx, sy, sz], [rx || 0, 0, rz || 0]);
  if (style === 'rapado') {
    top.add(cap(0.46, 1.02, 0.35));
    top.add(mesh(capGeo(0.4), mat, [0, cy, -0.005], [a * 1.025, b * 1.025, c * 1.025], [0.12, 0, 0]));
  } else {
    top.add(cap(0.52, 1.07, 0.42));
    // Segundo casquete inclinado hacia delante: tapa la coronilla delantera sin bajar a la frente
    top.add(mesh(capGeo(0.42), mat, [0, cy, -0.005], [a * 1.075, b * 1.075, c * 1.075], [0.15, 0, 0]));
    // Flequillo: mechones redondeados sobre la frente
    const fr = [[-0.12, 0.74, 0.15, 0.6], [-0.04, 0.755, 0.18, 0.2], [0.05, 0.755, 0.18, -0.2], [0.13, 0.735, 0.15, -0.6]];
    fr.forEach(([x, y, z, rz]) => top.add(tuft(x, y, z, 0.07, 0.055, 0.05, 0.3, rz)));
  }
  if (style === 'pinchos') {
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * Math.PI * 2;
      const sp = mesh(G.cone, mat, [Math.sin(ang) * 0.13, cy + 0.2, Math.cos(ang) * 0.11 - 0.03], [0.06, 0.16, 0.06]);
      sp.rotation.set(Math.cos(ang) * 0.75 - 0.25, 0, -Math.sin(ang) * 0.75);
      top.add(sp);
    }
  }
  if (style === 'melena' || style === 'largo') {
    const len = style === 'largo' ? 0.36 : 0.2;
    const back = mesh(G.capsule, mat, [0, cy - len * 0.55, -0.1], [0.22, len * 0.6, 0.15]);
    g.add(back);
    [-1, 1].forEach((sd) => g.add(mesh(G.capsule, mat, [0.21 * sd, cy - len * 0.5, 0.03], [0.055, len * 0.55, 0.06], [0, 0, sd * 0.08])));
  }
  if (style === 'coleta') {
    g.add(mesh(G.sphere, mat, [0, cy + 0.08, -0.25], [0.06, 0.06, 0.06]));
    g.add(mesh(G.capsule, mat, [0, cy - 0.06, -0.3], [0.06, 0.14, 0.06], [0.35, 0, 0]));
    g.add(mesh(new THREE.TorusGeometry(0.05, 0.014, 8, 20), toon('#D2462F'), [0, cy + 0.04, -0.26], null, [Math.PI / 2 - 0.4, 0, 0]));
  }
  if (style === 'mono') {
    top.add(mesh(G.sphere, mat, [0, cy + 0.24, -0.08], [0.1, 0.09, 0.1]));
  }
  if (style !== 'rapado') {
    [-1, 1].forEach((sd) => top.add(tuft(0.215 * sd, cy - 0.04, 0.02, 0.04, 0.09, 0.06)));
  }
  if (hidden) top.visible = false;
  g.add(top);
  return g;
}

// ─── Equipo de cabeza ────────────────────────────────────────────────────────
function buildHeadwear(id) {
  const g = new THREE.Group();
  const { cy } = HEAD;
  if (id === 'casco_hierro' || id === 'casco_vikingo') {
    const metal = toon(id === 'casco_hierro' ? '#B8C2D0' : '#9AA5B5', { metal: true });
    g.add(mesh(capGeo(0.5), metal, [0, cy, -0.005], [0.265, 0.25, 0.255], [-0.3, 0, 0]));
    g.add(mesh(new THREE.TorusGeometry(1, 0.08, 5, 18), toon('#7D8798', { metal: true }), [0, cy - 0.005, 0], [0.255, 0.255, 0.25], [Math.PI / 2 - 0.3, 0, 0]));
    if (id === 'casco_hierro') {
      g.add(mesh(G.capsule, metal, [0, cy + 0.03, 0.245], [0.016, 0.06, 0.016]));
      g.add(mesh(G.capsule, toon('#D2462F'), [0, cy + 0.27, -0.02], [0.03, 0.09, 0.08], [Math.PI / 2 - 0.2, 0, 0]));
    } else {
      [-1, 1].forEach((sd) => {
        const horn = mesh(G.cone, toon('#F2E8D0'), [0.25 * sd, cy + 0.12, 0], [0.045, 0.16, 0.045], [0, 0, -sd * 0.9]);
        g.add(horn);
      });
    }
  } else if (id === 'capucha') {
    g.add(mesh(capGeo(0.62), toon('#2E6B3A'), [0, cy + 0.01, -0.03], [0.275, 0.265, 0.27], [-0.55, 0, 0]));
    g.add(mesh(G.cone, toon('#2E6B3A'), [0, cy + 0.1, -0.24], [0.08, 0.2, 0.08], [-2.2, 0, 0]));
  } else if (id === 'sombrero_mago') {
    const hat = toon('#4B33A8');
    g.add(mesh(G.cyl, hat, [0, cy + 0.14, 0], [0.34, 0.02, 0.34]));
    const tip = mesh(G.cone, hat, [0, cy + 0.33, -0.04], [0.19, 0.38, 0.19], [-0.25, 0, 0]);
    g.add(tip);
    g.add(mesh(new THREE.TorusGeometry(1, 0.12, 5, 18), toon('#E8C25A'), [0, cy + 0.17, 0], [0.19, 0.19, 0.19], [Math.PI / 2, 0, 0]));
  } else if (id === 'corona') {
    const gold = toon('#F2C14E', { metal: true });
    g.add(mesh(new THREE.CylinderGeometry(1, 1, 1, 32, 1, true), gold, [0, cy + 0.2, -0.02], [0.13, 0.06, 0.13]));
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      g.add(mesh(G.cone, gold, [Math.sin(ang) * 0.13, cy + 0.26, Math.cos(ang) * 0.13 - 0.02], [0.03, 0.07, 0.03]));
    }
    g.add(mesh(G.sphere, toon('#D2462F', { metal: true }), [0, cy + 0.2, 0.115], [0.02, 0.02, 0.012]));
  } else if (id === 'diadema') {
    g.add(mesh(new THREE.TorusGeometry(1, 0.06, 5, 18, Math.PI), toon('#FF5E8A'), [0, cy + 0.05, -0.02], [0.25, 0.25, 0.25], [-0.25, 0, 0]));
  }
  return g;
}

// ─── Cuerpo ──────────────────────────────────────────────────────────────────
function torsoGeo(sex, flare = 0) {
  const pts = sex === 'f'
    ? [[0.0, 0.13], [0.12, 0.13], [0.135, 0.17], [0.11, 0.24], [0.115, 0.3], [0.12, 0.34], [0.07, 0.385], [0, 0.39]]
    : [[0.0, 0.13], [0.12, 0.13], [0.125, 0.18], [0.12, 0.25], [0.135, 0.31], [0.14, 0.34], [0.08, 0.385], [0, 0.39]];
  if (flare) { pts[0][0] = 0; pts[1] = [0.12 + flare, 0.02]; }
  return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 14);
}

// Alturas: el diseño original del torso iba de 0.13 a 0.39; se estira a 0.21–0.5
const Y = (y) => 0.21 + (y - 0.13) * 1.1;
function buildBody(cfg, eq) {
  const skin = toon(SKIN_TONES[cfg.skin] || SKIN_TONES[1], { rough: 0.65 });
  const o = OUTFITS[eq.torso] || OUTFITS.torso_aldeano;
  const body = new THREE.Group();
  const tunic = toon(o.tunic);
  // Piernas y botas
  const bootCol = BOOTS[eq.pies] || '#5A3A22';
  const legs = [];
  [-1, 1].forEach((sd) => {
    const leg = new THREE.Group();
    leg.add(mesh(G.capsule, toon(shade(o.tunic, 0.55)), [0, 0.13, 0], [0.046, 0.055, 0.046]));
    const metalBoot = eq.pies === 'botas_hierro' || eq.pies === 'botas_oro';
    leg.add(mesh(G.sphere, toon(bootCol, { metal: metalBoot }), [0, 0.04, 0.02], [0.066, 0.05, 0.085]));
    leg.add(mesh(G.cyl, toon(shade(bootCol, 0.55)), [0, 0.008, 0.02], [0.062, 0.012, 0.08]));
    leg.add(mesh(new THREE.TorusGeometry(1, 0.18, 5, 18), toon(shade(bootCol, metalBoot ? 1 : 1.3), { metal: metalBoot }), [0, 0.09, 0], [0.05, 0.05, 0.05], [Math.PI / 2, 0, 0]));
    leg.position.x = 0.058 * sd;
    legs.push(leg); body.add(leg);
  });
  // Torso
  const torso = mesh(torsoGeo(cfg.sex), tunic, [0, Y(0) - 0.0, 0], [1, 1.1, 1]); torso.position.y = 0.21 - 0.13 * 1.1; body.add(torso);
  if (o.robe) { const rb = mesh(torsoGeo(cfg.sex, 0.06), toon(o.robe), null, [1, 1.1, 1]); rb.position.y = 0.21 - 0.13 * 1.1; body.add(rb); }
  body.add(mesh(G.cyl, toon(SKIN_TONES[cfg.skin] || SKIN_TONES[1], { rough: 0.65 }), [0, Y(0.4), 0], [0.042, 0.06, 0.042]));
  body.add(mesh(new THREE.TorusGeometry(1, 0.11, 5, 18), toon(o.belt), [0, Y(0.2), 0], [0.122, 0.122, 0.13], [Math.PI / 2, 0, 0]));
  body.add(mesh(new THREE.BoxGeometry(1, 1, 1), toon('#F2C14E', { metal: true }), [0, Y(0.2), 0.128], [0.04, 0.032, 0.012]));
  body.add(mesh(new THREE.TorusGeometry(1, 0.22, 5, 18), toon(shade(o.tunic, 1.25)), [0, Y(0.38), 0], [0.065, 0.065, 0.06], [Math.PI / 2, 0, 0]));
  body.add(mesh(new THREE.TorusGeometry(1, 0.06, 5, 18), toon(shade(o.tunic, 0.7)), [0, Y(0.14), 0], [0.122, 0.122, 0.122], [Math.PI / 2, 0, 0]));
  if (o.straps) body.add(mesh(new THREE.TorusGeometry(1, 0.05, 5, 18), toon(o.straps), [0, Y(0.27), 0], [0.13, 0.19, 0.13], [0, Math.PI / 2, 0.6]));
  if (o.plate) {
    const pl = toon(o.plate, { metal: true });
    body.add(mesh(G.sphere, pl, [0, Y(0.29), 0.02], [0.135, 0.1, 0.115]));
  }
  // Brazos (grupos con pivote en el hombro para animar)
  const arms = [];
  [-1, 1].forEach((sd) => {
    const arm = new THREE.Group();
    arm.position.set((cfg.sex === 'f' ? 0.13 : 0.145) * sd, Y(0.35), 0);
    arm.add(mesh(G.capsule, tunic, [0, -0.085, 0], [0.036, 0.062, 0.036]));
    const hand = new THREE.Group();
    hand.position.set(0, -0.19, 0.01);
    hand.add(mesh(G.sphere, skin, [0, 0, 0], [0.034, 0.038, 0.034]));
    arm.add(mesh(new THREE.TorusGeometry(1, 0.22, 5, 18), toon(shade(o.tunic, 0.7)), [0, -0.155, 0], [0.038, 0.038, 0.038], [Math.PI / 2, 0, 0]));
    arm.add(hand);
    arm.rotation.z = sd * 0.18;
    arm.userData.hand = hand;
    if (o.pauldrons) arm.add(mesh(G.sphere, toon(o.pauldrons, { metal: true }), [0, 0.0, 0], [0.065, 0.05, 0.065]));
    arms.push(arm); body.add(arm);
  });
  // Capa
  if (CAPES[eq.espalda]) {
    const cg = new THREE.CylinderGeometry(0.13, 0.22, 0.44, 24, 6, true, Math.PI * 0.62, Math.PI * 0.76);
    // El arco de cilindro centrado en θ=π queda a la espalda
    const cape = mesh(cg, toon(CAPES[eq.espalda], { side: THREE.DoubleSide }), [0, Y(0.25), -0.015]);
    body.add(cape);
    body.userData.cape = cape;
  }
  body.userData.arms = arms; body.userData.legs = legs;
  return body;
}

// ─── Armas (KayKit) ──────────────────────────────────────────────────────────
const loader = new GLTFLoader();
const weaponFiles = new Map();
function loadWeapon(file) {
  if (!weaponFiles.has(file)) weaponFiles.set(file, loader.loadAsync(`assets/kaykit/${file}.gltf`).then((g) => g.scene));
  return weaponFiles.get(file);
}
async function buildWeapon(id, height) {
  const def = WEAPONS[id];
  if (!def) return null;
  const src = await loadWeapon(def[0]);
  const obj = src.clone(true);
  obj.traverse((m) => { if (m.isMesh) { const mt = m.material; m.material = new THREE.MeshStandardMaterial({ map: mt.map, color: mt.color, roughness: 0.45, metalness: 0.25 }); } });
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const axis = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  obj.scale.multiplyScalar((def[1] * height) / size[axis]);
  const wrap = new THREE.Group(); wrap.add(obj);
  const far = Math.abs(box.max[axis]) >= Math.abs(box.min[axis]) ? 1 : -1;
  if (axis === 'x') obj.rotation.z = far > 0 ? Math.PI / 2 : -Math.PI / 2;
  if (axis === 'z') obj.rotation.x = far > 0 ? -Math.PI / 2 : Math.PI / 2;
  if (axis === 'y' && far < 0) obj.rotation.x = Math.PI;
  wrap.updateMatrixWorld(true);
  const s2 = new THREE.Box3().setFromObject(wrap).getSize(new THREE.Vector3());
  if (s2.x < s2.z) obj.rotation.y += Math.PI / 2;
  return wrap;
}

// ─── Montaje ─────────────────────────────────────────────────────────────────
export async function buildCharacter(cfgIn) {
  const cfg = Object.assign({}, DEFAULT_AVATAR, cfgIn || {});
  const eq = Object.assign({}, cfg.equip || {});
  const root = new THREE.Group();
  const rig = new THREE.Group(); // lo que se anima (rebote)
  root.add(rig);
  const hairMat = toon(HAIR_COLORS[cfg.hairColor] || HAIR_COLORS[1], { rough: 0.42 });
  const body = buildBody(cfg, eq);
  const NECK = Y(0.41);
  const headPivot = new THREE.Group(); headPivot.position.y = NECK;
  headPivot.scale.setScalar(cfg.age === 'teen' ? 0.8 : 0.72);
  const head = buildHead(cfg, hairMat);
  head.position.y = -0.38;
  const hat = HEADWEAR.includes(eq.cabeza) ? eq.cabeza : null;
  const coversHair = hat && hat !== 'diadema' && hat !== 'corona';
  head.add(buildHair(HAIR_STYLES.some(([k]) => k === cfg.hair) ? cfg.hair : 'corto', hairMat, coversHair));
  if (hat) head.add(buildHeadwear(hat));
  headPivot.add(head);
  rig.add(body, headPivot);
  // Proporciones por edad: adolescente algo más bajo y aún más cabezón
  if (cfg.age === 'teen') { body.scale.setScalar(0.86); headPivot.position.y = NECK * 0.86; }
  const height = 0.95;
  // Armas: mano derecha (arma) delante y arriba; mano izquierda (escudo/arco) hacia fuera
  const [armL, armR] = body.userData.arms; // arms[0] es x<0 = derecha del personaje
  const w = await buildWeapon(eq.arma, height);
  if (w) { w.rotation.set(0.45, 0, 0.38); w.position.set(0, -0.02, 0.02); armL.userData.hand.add(w); }
  const s = await buildWeapon(eq.escudo, height);
  if (s) {
    const isBow = /^arco/.test(eq.escudo);
    s.rotation.set(0, isBow ? Math.PI / 2 : -0.5, isBow ? 0.32 : 0.1);
    s.position.set(isBow ? 0.01 : 0.03, isBow ? -0.08 : -0.12, isBow ? 0.02 : 0.05);
    armR.userData.hand.add(s);
  }
  root.userData = { rig, body, headPivot, eyes: head.userData.eyes, arms: body.userData.arms, cape: body.userData.cape, height: cfg.age === 'teen' ? 0.86 : 0.95, seed: Math.random() * 10 };
  return root;
}

// ─── Animación ───────────────────────────────────────────────────────────────
let celebrateUntil = 0;
export function celebrate() { celebrateUntil = performance.now() + 900; }
function animate(obj, t) {
  const u = obj.userData; const s = u.seed;
  const tt = t / 1000 + s;
  let jump = 0, spin = 0;
  if (t < celebrateUntil) {
    const k = 1 - (celebrateUntil - t) / 900;
    jump = Math.sin(k * Math.PI) * 0.12; spin = k * Math.PI * 2;
  }
  const bounce = Math.abs(Math.sin(tt * 2.2));
  u.rig.position.y = bounce * 0.014 + jump;
  u.rig.rotation.y = spin;
  // Estira al subir y se aplasta al tocar suelo (squash & stretch)
  const sq = 1 + (bounce - 0.5) * 0.035;
  u.rig.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  // Mira a los lados de vez en cuando
  const look = Math.sin(tt * 0.45);
  u.headPivot.rotation.y = Math.abs(look) > 0.85 ? Math.sign(look) * 0.3 * ((Math.abs(look) - 0.85) / 0.15) : 0;
  u.headPivot.rotation.z = Math.sin(tt * 1.1) * 0.05;
  u.headPivot.rotation.x = Math.sin(tt * 0.7) * 0.03;
  if (u.arms) { u.arms[0].rotation.x = Math.sin(tt * 2.2) * 0.08 - 0.25; u.arms[1].rotation.x = -Math.sin(tt * 2.2) * 0.08; }
  if (u.cape) u.cape.rotation.x = Math.sin(tt * 2) * 0.05 - 0.06;
  // Parpadeo cada ~3,5 s
  const bl = (tt % 3.5) < 0.12 ? 0.12 : 1;
  u.eyes.forEach((e) => { e.userData.blink.scale.y = bl; });
}

// ─── Visor compartido ────────────────────────────────────────────────────────
let renderer, scene, camera, current = null, currentKey = '', container = null, raf = 0, building = 0;
let yaw = 0.35, targetYaw = 0.35, dragging = false, lastX = 0, mode = 'full', sparks = null, downX = 0;

function ensureRenderer() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x6a6458, 0.9));
  const key = new THREE.DirectionalLight(0xfff2e0, 2.6); key.position.set(1.4, 2.4, 2.2); scene.add(key);
  const rim = new THREE.DirectionalLight(0xfff0d6, 1.8); rim.position.set(-1.8, 1.4, -2.2); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0x7aa2ff, 1.2); rim2.position.set(2, 0.8, -1.6); scene.add(rim2);
  // Pedestal con anillo luminoso
  const ped = new THREE.Group(); ped.name = 'pedestal';
  ped.add(mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.05, 64), new THREE.MeshStandardMaterial({ color: 0x1d1d19, roughness: 0.35, metalness: 0.4 }), [0, -0.025, 0]));
  ped.add(mesh(new THREE.TorusGeometry(0.345, 0.006, 8, 96), new THREE.MeshBasicMaterial({ color: 0xcbea5b }), [0, 0.001, 0], null, [Math.PI / 2, 0, 0]));
  scene.add(ped);
  // Chispas flotantes
  const N = 26, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const an = Math.random() * Math.PI * 2, r = 0.25 + Math.random() * 0.25; pos.set([Math.cos(an) * r, Math.random() * 1.1, Math.sin(an) * r], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sc = document.createElement('canvas'); sc.width = sc.height = 32; const sx = sc.getContext('2d');
  const sgr = sx.createRadialGradient(16, 16, 0, 16, 16, 16); sgr.addColorStop(0, 'rgba(230,255,160,1)'); sgr.addColorStop(1, 'rgba(230,255,160,0)'); sx.fillStyle = sgr; sx.fillRect(0, 0, 32, 32);
  sparks = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.035, map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(sparks);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.001;
  scene.add(shadow);
  const el = renderer.domElement;
  el.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';
  el.addEventListener('pointerdown', (e) => { dragging = true; lastX = downX = e.clientX; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; });
  el.addEventListener('pointermove', (e) => { if (!dragging) return; targetYaw += (e.clientX - lastX) * 0.015; lastX = e.clientX; });
  // Un toque sin arrastrar hace que salte
  const up = (e) => { dragging = false; el.style.cursor = 'grab'; if (e && Math.abs(e.clientX - downX) < 4) celebrate(); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}

function frame(obj, m, w, h) {
  const H = obj.userData.height || 0.92;
  camera.aspect = w / h;
  if (m === 'head') { camera.fov = 24; camera.position.set(0, H * 0.72, 1.5); camera.lookAt(0, H * 0.68, 0); }
  else if (m === 'bust') { camera.fov = 26; camera.position.set(0, H * 0.62, 1.9); camera.lookAt(0, H * 0.55, 0); }
  else { camera.fov = 26; camera.position.set(0, H * 0.62, 2.55); camera.lookAt(0, H * 0.47, 0); }
  camera.updateProjectionMatrix();
}

function loop(t) {
  raf = requestAnimationFrame(loop);
  if (!current || !container) return;
  const w = container.clientWidth, h = container.clientHeight;
  if (!w || !h) return;
  const size = renderer.getSize(new THREE.Vector2());
  if (size.x !== w || size.y !== h) { renderer.setSize(w, h, false); frame(current, mode, w, h); }
  yaw += (targetYaw - yaw) * 0.12;
  current.rotation.y = yaw;
  animate(current, t);
  if (sparks) {
    const at = sparks.geometry.attributes.position;
    for (let i = 0; i < at.count; i++) { let y = at.getY(i) + 0.0016; if (y > 1.15) y = 0; at.setY(i, y); }
    at.needsUpdate = true;
  }
  renderer.render(scene, camera);
}

const key = (cfg) => JSON.stringify(cfg || {});
async function setCharacter(cfg) {
  const k = key(cfg);
  if (k === currentKey && current) return current;
  const id = ++building;
  const obj = await buildCharacter(cfg);
  if (id !== building) return current;
  if (current) scene.remove(current);
  current = obj; currentKey = k; scene.add(obj);
  return obj;
}

export async function show(el, cfg, opts = {}) {
  ensureRenderer();
  if (container !== el) { container = el; el.appendChild(renderer.domElement); }
  mode = opts.mode || 'full';
  if (typeof opts.yaw === 'number') yaw = targetYaw = opts.yaw;
  const obj = await setCharacter(cfg);
  const w = el.clientWidth || 300, h = el.clientHeight || 300;
  renderer.setSize(w, h, false); frame(obj, mode, w, h);
  if (!raf) raf = requestAnimationFrame(loop);
}
export function hide() { if (raf) cancelAnimationFrame(raf); raf = 0; }

const snaps = new Map();
let queue = Promise.resolve();
export function snapshot(cfg, opts = {}) {
  const k = (opts.mode || 'head') + (opts.size || 96) + (opts.yaw ?? '') + key(cfg);
  if (snaps.has(k)) return snaps.get(k);
  const p = queue = queue.then(async () => {
    ensureRenderer();
    const obj = await buildCharacter(cfg);
    obj.rotation.y = opts.yaw ?? 0.25;
    animate(obj, 0);
    obj.userData.eyes.forEach((e) => { e.userData.blink.scale.y = 1; }); // nunca a mitad de parpadeo
    const prev = current; if (prev) prev.visible = false;
    scene.add(obj);
    const s = opts.size || 96, pr = renderer.getPixelRatio(), old = renderer.getSize(new THREE.Vector2());
    renderer.setPixelRatio(2); renderer.setSize(s, s, false);
    frame(obj, opts.mode || 'head', s, s);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(obj); if (prev) prev.visible = true;
    renderer.setPixelRatio(pr); renderer.setSize(old.x || 1, old.y || 1, false);
    if (current && container) frame(current, mode, container.clientWidth, container.clientHeight);
    return url;
  });
  snaps.set(k, p);
  return p;
}

window.Avatar3D = { show, hide, snapshot, celebrate, buildCharacter, SKIN_TONES, EYE_COLORS, HAIR_COLORS, HAIR_STYLES, DEFAULT_AVATAR, WEAPONS, OUTFITS };
window.dispatchEvent(new Event('avatar3d-ready'));
