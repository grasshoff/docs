// famulus-visualization — declarative scene runtime (Three.js 0.170.0).
//
// Extracted and generalised from the scene system of ai-sundial3d/sundial.html
// (scenes.yml: visibility, camera, camera_animation, duration, description;
// thick Line2 lines; play/pause transport). The application registers named
// layers — Three objects it builds itself, or layers declared from data — and
// a list of scenes switches them, moves the camera and tells the narrative.
//
//   import { createStage } from './scene/scene.js';
//   const stage = createStage(el, { up: [0, 0, 1] });
//   stage.declare({ id: 'day_lines', kind: 'line', paths: [[[x,y,z], ...], ...], color: 'oxford', width: 3 });
//   stage.play(scenes);                       // scenes: array as in scenes.yml
//
// A scene: { id, title, description, duration (s), camera: {position, target},
//   camera_animation: {from_theta, to_theta, duration}, visibility: {layer: bool},
//   highlight: [layer, ...], reveal: [layer, ...] }  — `reveal` draws the
// layer's lines progressively over the scene; `highlight` draws it in gold.
// Motion follows the sundial3d preference: slow enough to follow, one change
// per step.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { tokens, color, isDark } from '../famulus-tokens.js';

const resolve = (c) => (typeof c === 'string' && !c.startsWith('#') ? color(c) || tokens.color.ink : c);
const v3 = (p) => (Array.isArray(p) ? new THREE.Vector3(p[0], p[1], p[2]) : new THREE.Vector3(p.x, p.y, p.z));

export function thickLine(points, { color: c = 'oxford', width = 2, opacity = 1 } = {}, resolution) {
  const geometry = new LineGeometry();
  geometry.setPositions(points.flatMap(p => (Array.isArray(p) ? p : [p.x, p.y, p.z])));
  const material = new LineMaterial({
    color: new THREE.Color(resolve(c)), linewidth: width, resolution, transparent: opacity < 1, opacity,
  });
  const line = new Line2(geometry, material);
  line.computeLineDistances();
  line.userData.segments = Math.max(points.length - 1, 0);
  return line;
}

export function createStage(el, { up = [0, 1, 0], fov = 40, background = null } = {}) {
  el.classList.add('fv-scene');
  const width = () => el.clientWidth || 800;
  const height = () => el.clientHeight || 500;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width(), height());
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const bg = () => new THREE.Color(background || (isDark() ? tokens.dark.paper : tokens.color.paper));
  scene.background = bg();
  const camera = new THREE.PerspectiveCamera(fov, width() / height(), 0.1, 100000);
  camera.up.set(...up);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(1, -1, 2);
  scene.add(sun);
  const resolution = new THREE.Vector2(width(), height());

  // overlay: title, annotation, transport (one action per control)
  const title = Object.assign(document.createElement('div'), { className: 'fv-scene-title' });
  const note = Object.assign(document.createElement('div'), { className: 'fv-scene-annotation' });
  const bar = Object.assign(document.createElement('div'), { className: 'fv-scene-transport' });
  el.append(title, note, bar);

  const layers = new Map();
  const tickers = [];
  const state = { scenes: [], idx: -1, timer: null, playing: false, orbit: null, reveal: [], elapsed: 0 };

  function addLayer(id, object) {
    object.userData.layer = id;
    object.userData.baseColors = [];
    object.traverse(o => {
      if (o.material && o.material.color) object.userData.baseColors.push([o, o.material.color.clone(), o.material.linewidth]);
    });
    scene.add(object);
    layers.set(id, object);
    return object;
  }

  // Layers declared from data: line (paths), points, axis, model (GLB url).
  function declare(spec) {
    const group = new THREE.Group();
    if (spec.kind === 'line') {
      for (const path of spec.paths) group.add(thickLine(path, spec, resolution));
    } else if (spec.kind === 'points') {
      const geo = new THREE.BufferGeometry().setFromPoints(spec.points.map(v3));
      group.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: resolve(spec.color || 'gold_deep'), size: spec.size || 4, sizeAttenuation: false })));
    } else if (spec.kind === 'axis') {
      const a = v3(spec.origin), d = v3(spec.direction).normalize();
      group.add(thickLine([a.clone().addScaledVector(d, -spec.length / 2), a.clone().addScaledVector(d, spec.length / 2)], spec, resolution));
    } else if (spec.kind === 'model') {
      // the .web.glb preview rule of ai-sundial3d: never load a full scan twin into a page
      if (!/\.web\.glb(\?|$)/.test(spec.url) && !spec.allowFull) throw new Error(`model ${spec.url}: load the .web.glb preview, not the full scan`);
      new GLTFLoader().load(spec.url, gltf => group.add(gltf.scene));
    } else {
      throw new Error(`unknown layer kind ${spec.kind}`);
    }
    return addLayer(spec.id, group);
  }

  function setVisible(id, on) { const l = layers.get(id); if (l) l.visible = on; }

  function setHighlight(ids) {
    for (const [id, layer] of layers) {
      const hl = ids.includes(id);
      for (const [o, base, w] of layer.userData.baseColors) {
        o.material.color.copy(hl ? new THREE.Color(color('gold_deep')) : base);
        if (w !== undefined && o.material.linewidth !== undefined) o.material.linewidth = hl ? w * 1.6 : w;
      }
    }
  }

  function startReveal(ids, seconds) {
    state.reveal = [];
    for (const id of ids) {
      const layer = layers.get(id);
      if (!layer) continue;
      layer.traverse(o => {
        if (o.isLine2) { o.geometry.instanceCount = 0; state.reveal.push(o); }
      });
    }
    state.revealSeconds = seconds;
    state.elapsed = 0;
  }

  // Frame the visible layers when a scene names no camera.
  function fit(ids) {
    const box = new THREE.Box3();
    for (const id of ids || layers.keys()) { const l = layers.get(id); if (l && l.visible) box.expandByObject(l); }
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    const dist = r / Math.sin((camera.fov * Math.PI) / 360);
    const dir = new THREE.Vector3(1, -1.4, 0.9).normalize();
    camera.position.copy(c).addScaledVector(dir, dist * 1.05);
    controls.target.copy(c);
    controls.update();
  }

  function apply(i) {
    const s = state.scenes[i];
    if (!s) return;
    state.idx = i;
    state.timer = s.duration || 6;
    title.textContent = s.title || '';
    note.classList.remove('visible');
    note.textContent = s.description || '';
    setTimeout(() => note.classList.add('visible'), 400);
    if (s.visibility) for (const [id, on] of Object.entries(s.visibility)) setVisible(id, Boolean(on));
    setHighlight(s.highlight || []);
    if (s.camera && s.camera.position) {
      camera.position.copy(v3(s.camera.position));
      if (s.camera.target) controls.target.copy(v3(s.camera.target));
      controls.update();
    } else {
      fit(s.frame);
    }
    state.orbit = s.camera_animation ? { ...s.camera_animation, elapsed: 0, base: camera.position.clone() } : null;
    startReveal(s.reveal || [], (s.reveal_seconds || (s.duration || 6) * 0.8));
    step.textContent = `${i + 1} / ${state.scenes.length}`;
    el.dispatchEvent(new CustomEvent('fv-scene', { detail: { index: i, scene: s } }));
  }

  // transport
  const mk = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn; bar.appendChild(b); return b; };
  const prevB = mk('◀', () => apply(Math.max(state.idx - 1, 0)));
  const playB = mk('Pause', () => { state.playing = !state.playing; playB.textContent = state.playing ? 'Pause' : 'Play'; });
  const nextB = mk('▶', () => apply(Math.min(state.idx + 1, state.scenes.length - 1)));
  const step = Object.assign(document.createElement('span'), { className: 'fv-scene-step' });
  bar.appendChild(step);
  void prevB; void nextB;

  // ?t=<seconds> in the page URL opens the narrative frozen at that instant.
  function play(scenes, { autoplay = true, start = 0 } = {}) {
    state.scenes = scenes;
    const t = new URLSearchParams(location.search).get('t');
    if (t !== null && !Number.isNaN(Number(t))) { seek(Number(t)); return; }
    state.playing = autoplay;
    playB.textContent = autoplay ? 'Pause' : 'Play';
    apply(start);
  }

  // Scene time follows elapsed time, so sparse frames (background tabs, headless
  // captures) still show the state the narrative has reached; it never runs
  // backwards (a rAF stamp may predate `last`) and stands still while hidden.
  let last = performance.now();
  function frameLoop(now) {
    requestAnimationFrame(frameLoop);
    const dt = document.hidden ? 0 : Math.max(0, (now - last) / 1000);
    last = Math.max(last, now);
    if (state.playing) advance(dt);
    controls.update();
    renderer.render(scene, camera);
    if (now - lastInk > 500) { lastInk = now; el.dataset.ink = inkFraction().toFixed(4); }
  }
  requestAnimationFrame(frameLoop);

  // One step of scene time: camera orbit, progressive reveal, scene timer, tickers.
  function advance(dt) {
    {
      if (state.orbit) {
        const o = state.orbit;
        o.elapsed += dt;
        const f = Math.min(o.elapsed / (o.duration || 10), 1);
        const theta = ((o.from_theta || 0) + ((o.to_theta || 0) - (o.from_theta || 0)) * f) * Math.PI / 180;
        const rel = o.base.clone().sub(controls.target);
        const upv = camera.up.clone().normalize();
        camera.position.copy(controls.target).add(rel.applyAxisAngle(upv, theta));
        if (f >= 1) state.orbit = null;
      }
      if (state.reveal.length) {
        state.elapsed += dt;
        const f = Math.min(state.elapsed / state.revealSeconds, 1);
        const eased = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;  // cubic-in-out (tokens.motion.ease)
        for (const o of state.reveal) o.geometry.instanceCount = Math.max(0, Math.ceil(o.userData.segments * eased));
        if (f >= 1) state.reveal = [];
      }
      if (state.timer !== null) {
        state.timer -= dt;
        if (state.timer <= 0) {
          state.timer = null;
          if (state.idx < state.scenes.length - 1) apply(state.idx + 1);
          else { state.playing = false; playB.textContent = 'Play'; }
        }
      }
      for (const t of tickers) t(dt, state);
    }
  }

  // Jump to scene time t (seconds from the first scene) by simulating it in
  // fixed steps, then hold still: the same state a reader sees at t, every time.
  // Used for still frames (posters, PDF figures) and deterministic render checks.
  function seek(t, { hold = true } = {}) {
    apply(0);
    state.playing = true;
    const step = 1 / 30;
    for (let s = 0; s < t && state.playing; s += step) advance(Math.min(step, t - s));
    state.playing = !hold;
    playB.textContent = state.playing ? 'Pause' : 'Play';
    if (hold) { note.style.transition = 'none'; note.classList.add('visible'); }   // a still shows its caption at once
    controls.update();
    renderer.render(scene, camera);
    el.dataset.ink = inkFraction().toFixed(4);
    el.dataset.sceneTime = String(t);
  }

  // Share of the canvas that differs from the background — lets a render
  // check tell a drawn scene from an empty one (the overlay text does not count).
  let lastInk = -Infinity;
  const probe = Object.assign(document.createElement('canvas'), { width: 96, height: 64 });
  function inkFraction() {
    const ctx = probe.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(renderer.domElement, 0, 0, probe.width, probe.height);
    const px = ctx.getImageData(0, 0, probe.width, probe.height).data;
    const b = scene.background.getRGB({}, THREE.SRGBColorSpace);   // canvas pixels are sRGB
    const [br, bgc, bb] = [b.r * 255, b.g * 255, b.b * 255];
    let n = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (Math.abs(px[i] - br) + Math.abs(px[i + 1] - bgc) + Math.abs(px[i + 2] - bb) > 24) n++;
    }
    return n / (px.length / 4);
  }

  new ResizeObserver(() => {
    renderer.setSize(width(), height());
    camera.aspect = width() / height();
    camera.updateProjectionMatrix();
    resolution.set(width(), height());
  }).observe(el);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { scene.background = bg(); });

  return {
    THREE, scene, camera, controls, renderer, layers, state,
    addLayer, declare, setVisible, setHighlight, fit, play, apply, seek,
    onTick: (fn) => tickers.push(fn),
  };
}
