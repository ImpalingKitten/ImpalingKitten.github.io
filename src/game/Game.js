import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const SAVE_KEY = 'observer-save-v1';
const LEVEL_COUNT = 8;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const damp = (from, to, rate, dt) => THREE.MathUtils.lerp(from, to, 1 - Math.exp(-rate * dt));

class SaveSystem {
  hasSave() {
    return Boolean(localStorage.getItem(SAVE_KEY));
  }

  load() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY));
    } catch {
      return null;
    }
  }

  save(data) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  clear() {
    localStorage.removeItem(SAVE_KEY);
  }
}

class ProceduralAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.hum = null;
    this.volume = 0.22;
  }

  start() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.createHum();
    }
    this.ctx.resume();
  }

  setVolume(value) {
    this.volume = value;
    if (this.master) this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.04);
  }

  createHum() {
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const lfoGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 74;
    lfo.type = 'triangle';
    lfo.frequency.value = 0.11;
    lfoGain.gain.value = 18;
    gain.gain.value = 0.045;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    lfo.start();
    this.hum = gain;
  }

  tone(freq = 440, duration = 0.12, type = 'sine', volume = 0.08) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, this.ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + duration + 0.02);
  }

  materialize() {
    this.tone(660, 0.08, 'triangle', 0.045);
    this.tone(990, 0.16, 'sine', 0.03);
  }

  dissolve() {
    this.tone(170, 0.14, 'sawtooth', 0.035);
  }

  danger() {
    this.tone(96, 0.18, 'square', 0.07);
  }

  checkpoint() {
    this.tone(520, 0.08, 'sine', 0.06);
    setTimeout(() => this.tone(780, 0.12, 'sine', 0.05), 80);
  }
}

class ObservationManager {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.targets = [];
    this.occluders = [];
    this.frustum = new THREE.Frustum();
    this.matrix = new THREE.Matrix4();
    this.raycaster = new THREE.Raycaster();
    this.center = new THREE.Vector3();
    this.direction = new THREE.Vector3();
  }

  register(target) {
    this.targets.push(target);
  }

  unregisterAll() {
    this.targets.length = 0;
    this.occluders.length = 0;
  }

  addOccluder(mesh) {
    this.occluders.push(mesh);
  }

  update(dt, player) {
    this.camera.updateMatrixWorld();
    this.matrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);

    for (const target of this.targets) {
      target.getObservationPoint(this.center);
      const inFrustum = this.frustum.containsPoint(this.center);
      let observed = false;
      if (inFrustum) {
        this.direction.subVectors(this.center, this.camera.position);
        const distance = this.direction.length();
        this.direction.normalize();
        const dot = this.camera.getWorldDirection(new THREE.Vector3()).dot(this.direction);
        if (dot > 0.18) {
          this.raycaster.set(this.camera.position, this.direction);
          this.raycaster.far = distance;
          const hits = this.raycaster.intersectObjects(this.occluders, false);
          observed = hits.length === 0 || hits[0].distance > distance - 0.45 || target.containsMesh(hits[0].object);
        }
      }
      target.setObserved(observed);
      target.update(dt, player);
    }
  }
}

class ObservedObject {
  constructor({ game, mesh, kind, solidWhenObserved = true, solidWhenUnobserved = false, hideWhenUnobserved = true }) {
    this.game = game;
    this.mesh = mesh;
    this.kind = kind;
    this.solidWhenObserved = solidWhenObserved;
    this.solidWhenUnobserved = solidWhenUnobserved;
    this.hideWhenUnobserved = hideWhenUnobserved;
    this.isObserved = false;
    this.wasObserved = false;
    this.opacity = hideWhenUnobserved ? 0 : 1;
    this.box = new THREE.Box3();
    this.collider = { object: this, enabled: false, box: this.box };
    this.mesh.userData.observedObject = this;
    this.mesh.traverse((child) => {
      child.userData.observedObject = this;
      if (child.material) {
        child.material = child.material.clone();
        child.material.transparent = true;
      }
    });
    game.scene.add(mesh);
    game.observation.register(this);
    game.dynamicColliders.push(this.collider);
    this.refreshCollider();
  }

  containsMesh(mesh) {
    let node = mesh;
    while (node) {
      if (node === this.mesh) return true;
      node = node.parent;
    }
    return false;
  }

  getObservationPoint(target) {
    this.mesh.getWorldPosition(target);
    target.y += 0.45;
  }

  setObserved(value) {
    this.isObserved = value;
    this.collider.enabled = value ? this.solidWhenObserved : this.solidWhenUnobserved;
    if (value !== this.wasObserved) {
      this.onObservationChanged(value);
      this.wasObserved = value;
    }
  }

  onObservationChanged(value) {
    if (value) this.game.audio.materialize();
    else this.game.audio.dissolve();
  }

  update(dt) {
    const targetOpacity = this.hideWhenUnobserved ? (this.isObserved ? 1 : 0.04) : 1;
    this.opacity = damp(this.opacity, targetOpacity, 9, dt);
    this.mesh.visible = this.opacity > 0.025;
    this.mesh.traverse((child) => {
      if (child.material) {
        child.material.opacity = this.opacity;
        if (child.material.uniforms?.uVisibility) child.material.uniforms.uVisibility.value = this.opacity;
        if (child.material.uniforms?.uTime) child.material.uniforms.uTime.value = performance.now() * 0.001;
      }
    });
    this.refreshCollider();
  }

  refreshCollider() {
    this.box.setFromObject(this.mesh);
  }
}

class ObservationWall extends ObservedObject {
  constructor(game, position, size, color = 0xffffff) {
    super({
      game,
      mesh: new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), game.materials.observed(color, 0x63f6ff)),
      kind: 'Wall',
      solidWhenObserved: true,
      solidWhenUnobserved: false,
      hideWhenUnobserved: true
    });
    this.mesh.position.copy(position);
  }
}

class ObservationPlatform extends ObservedObject {
  constructor(game, position, size, color = 0xbfc5c8) {
    super({
      game,
      mesh: new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), game.materials.observed(color, 0xff9f35)),
      kind: 'Platform',
      solidWhenObserved: true,
      solidWhenUnobserved: false,
      hideWhenUnobserved: true
    });
    this.mesh.position.copy(position);
  }
}

class ObservationDoor extends ObservedObject {
  constructor(game, position, size) {
    super({
      game,
      mesh: new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), game.materials.observed(0xf8f8f8, 0x50eaff)),
      kind: 'Door',
      solidWhenObserved: true,
      solidWhenUnobserved: false,
      hideWhenUnobserved: true
    });
    this.mesh.position.copy(position);
  }
}

class ObservationMover extends ObservedObject {
  constructor(game, position, size, axis = 'x', distance = 6, speed = 1.2) {
    super({
      game,
      mesh: new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), game.materials.observed(0xeeeeee, 0xff9f35)),
      kind: 'Mover',
      solidWhenObserved: true,
      solidWhenUnobserved: true,
      hideWhenUnobserved: false
    });
    this.mesh.position.copy(position);
    this.start = position.clone();
    this.axis = axis;
    this.distance = distance;
    this.speed = speed;
    this.phase = 0;
  }

  update(dt, player) {
    if (this.isObserved) this.phase += dt * this.speed;
    const offset = Math.sin(this.phase) * this.distance;
    this.mesh.position.copy(this.start);
    this.mesh.position[this.axis] += offset;
    super.update(dt, player);
  }
}

class ObservationEnemy extends ObservedObject {
  constructor(game, position) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 20, 14), game.materials.observed(0x0c0f10, 0xff7b37));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 8), game.materials.glow(0xff7b37));
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 0.8, 12), game.materials.dark);
    body.position.y = 0.72;
    eye.position.set(0, 0.83, -0.43);
    stalk.position.y = 0.24;
    group.add(stalk, body, eye);
    super({ game, mesh: group, kind: 'Enemy', solidWhenObserved: true, solidWhenUnobserved: false, hideWhenUnobserved: true });
    this.mesh.position.copy(position);
    this.speed = 2.1;
    this.attackTimer = 0;
  }

  update(dt, player) {
    if (this.isObserved) {
      const toPlayer = player.position.clone().sub(this.mesh.position);
      toPlayer.y = 0;
      const dist = toPlayer.length();
      if (dist > 0.001) {
        toPlayer.normalize();
        this.mesh.lookAt(player.position.x, this.mesh.position.y, player.position.z);
      }
      if (dist > 1.2) this.mesh.position.addScaledVector(toPlayer, this.speed * dt);
      this.attackTimer -= dt;
      if (dist < 1.25 && this.attackTimer <= 0) {
        this.game.damage('The observed hunter found you.');
        this.attackTimer = 1.0;
      }
    }
    super.update(dt, player);
  }
}

class ObservationProjectile extends ObservedObject {
  constructor(game, position, direction) {
    super({
      game,
      mesh: new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 8), game.materials.glow(0xff7b37)),
      kind: 'Projectile',
      solidWhenObserved: true,
      solidWhenUnobserved: false,
      hideWhenUnobserved: true
    });
    this.mesh.position.copy(position);
    this.velocity = direction.normalize().multiplyScalar(5.8);
    this.life = 8;
  }

  update(dt, player) {
    if (this.isObserved) this.mesh.position.addScaledVector(this.velocity, dt);
    this.life -= dt;
    if (this.isObserved && this.mesh.position.distanceTo(player.position) < 0.75) this.game.damage('You observed the shot into reality.');
    super.update(dt, player);
    if (this.life <= 0) this.mesh.visible = false;
  }
}

class ObservationRoom extends ObservedObject {
  constructor(game, position, pieces) {
    const group = new THREE.Group();
    for (const piece of pieces) group.add(piece);
    group.position.copy(position);
    super({ game, mesh: group, kind: 'Room', solidWhenObserved: true, solidWhenUnobserved: false, hideWhenUnobserved: true });
  }
}

class Player {
  constructor(game) {
    this.game = game;
    this.camera = game.camera;
    this.controls = new PointerLockControls(this.camera, game.canvas);
    this.position = this.controls.getObject().position;
    this.velocity = new THREE.Vector3();
    this.keys = new Set();
    this.radius = 0.38;
    this.height = 1.72;
    this.grounded = false;
    this.stepHeight = 0.55;
    this.spawn = new THREE.Vector3();
    this.bind();
  }

  bind() {
    this.game.canvas.addEventListener('click', () => {
      if (this.game.running && !this.game.paused) this.controls.lock();
    });
    window.addEventListener('keydown', (event) => {
      this.keys.add(event.code);
      if (event.code === 'Space') event.preventDefault();
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
  }

  reset(position) {
    this.spawn.copy(position);
    this.position.copy(position);
    this.position.y += this.height;
    this.velocity.set(0, 0, 0);
  }

  respawn() {
    this.position.copy(this.spawn);
    this.position.y += this.height;
    this.velocity.set(0, 0, 0);
  }

  update(dt) {
    const forward = this.camera.getWorldDirection(new THREE.Vector3());
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, WORLD_UP).multiplyScalar(-1).normalize();
    const wish = new THREE.Vector3();
    if (this.keys.has('KeyW')) wish.add(forward);
    if (this.keys.has('KeyS')) wish.sub(forward);
    if (this.keys.has('KeyA')) wish.sub(right);
    if (this.keys.has('KeyD')) wish.add(right);
    if (wish.lengthSq() > 0) wish.normalize();
    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 7.2 : 4.45;
    const control = this.grounded ? 12 : 4.5;
    this.velocity.x = damp(this.velocity.x, wish.x * speed, control, dt);
    this.velocity.z = damp(this.velocity.z, wish.z * speed, control, dt);
    if (this.keys.has('Space') && this.grounded) {
      this.velocity.y = 5.5;
      this.grounded = false;
    }
    this.velocity.y -= 13.5 * dt;
    this.moveAxis('x', this.velocity.x * dt);
    this.moveAxis('z', this.velocity.z * dt);
    this.moveY(this.velocity.y * dt);
    if (this.position.y < -8) this.game.damage('You fell outside the observed world.');
  }

  getBodyBox(offset = new THREE.Vector3()) {
    const p = this.position.clone().add(offset);
    return new THREE.Box3(
      new THREE.Vector3(p.x - this.radius, p.y - this.height, p.z - this.radius),
      new THREE.Vector3(p.x + this.radius, p.y, p.z + this.radius)
    );
  }

  moveAxis(axis, amount) {
    if (Math.abs(amount) < 0.00001) return;
    this.position[axis] += amount;
    const box = this.getBodyBox();
    for (const collider of this.game.getActiveColliders()) {
      if (box.intersectsBox(collider.box)) {
        this.position[axis] -= amount;
        this.velocity[axis] = 0;
        return;
      }
    }
  }

  moveY(amount) {
    this.position.y += amount;
    const box = this.getBodyBox();
    this.grounded = false;
    for (const collider of this.game.getActiveColliders()) {
      if (!box.intersectsBox(collider.box)) continue;
      if (amount <= 0) {
        this.position.y = collider.box.max.y + this.height;
        this.grounded = true;
      } else {
        this.position.y = collider.box.min.y;
      }
      this.velocity.y = 0;
      return;
    }
  }
}

export class Game {
  constructor(root, ui) {
    this.root = root;
    this.ui = ui;
    this.canvas = ui.canvas;
    this.saveSystem = new SaveSystem();
    this.audio = new ProceduralAudio();
    this.clock = new THREE.Clock();
    this.running = false;
    this.paused = false;
    this.levelIndex = 0;
    this.staticColliders = [];
    this.dynamicColliders = [];
    this.projectiles = [];
    this.checkpoint = new THREE.Vector3();
    this.flash = 0;
    this.setupRenderer();
    this.createMaterials();
    this.bindEvents();
    this.animate();
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 180);
    this.resize();
  }

  createMaterials() {
    this.materials = {
      floor: new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.78, metalness: 0.02 }),
      wall: new THREE.MeshStandardMaterial({ color: 0xd9dcdd, roughness: 0.66 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.5 }),
      cyan: new THREE.MeshStandardMaterial({ color: 0x67f8ff, emissive: 0x0a6c74, roughness: 0.35 }),
      orange: new THREE.MeshStandardMaterial({ color: 0xff9f35, emissive: 0x6d2400, roughness: 0.38 }),
      glow: (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.8, roughness: 0.2 }),
      observed: (base, edge) => new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
          uBase: { value: new THREE.Color(base) },
          uEdge: { value: new THREE.Color(edge) },
          uVisibility: { value: 1 },
          uTime: { value: 0 }
        },
        vertexShader: `
          varying vec3 vPos;
          varying vec3 vNormal;
          void main() {
            vPos = position;
            vNormal = normal;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uBase;
          uniform vec3 uEdge;
          uniform float uVisibility;
          uniform float uTime;
          varying vec3 vPos;
          varying vec3 vNormal;
          float grid(vec3 p) {
            vec3 q = abs(fract(p * 3.0 + uTime * 0.08) - 0.5);
            return smoothstep(0.485, 0.5, max(max(q.x, q.y), q.z));
          }
          void main() {
            float rim = pow(1.0 - abs(vNormal.z) * 0.45, 2.0);
            float dissolve = step(fract(sin(dot(floor(vPos * 7.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453), uVisibility);
            vec3 color = mix(uBase, uEdge, clamp(rim + grid(vPos) * 0.28, 0.0, 1.0));
            gl_FragColor = vec4(color, max(0.035, uVisibility) * dissolve);
          }
        `
      })
    };
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (event) => {
      if (!this.running) return;
      if (event.code === 'Escape') this.pause();
      if (event.code === 'KeyR') this.loadLevel(this.levelIndex, true);
    });
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  start(continueGame = false, selectedLevel = null) {
    const save = continueGame ? this.saveSystem.load() : null;
    this.audio.start();
    this.running = true;
    this.paused = false;
    this.levelIndex = selectedLevel ?? save?.levelIndex ?? 0;
    this.ui.showHud();
    this.loadLevel(this.levelIndex, false);
    if (save?.checkpoint && continueGame) {
      this.checkpoint.set(save.checkpoint.x, save.checkpoint.y, save.checkpoint.z);
      this.player.reset(this.checkpoint);
    }
  }

  createScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050607);
    this.scene.fog = new THREE.FogExp2(0x0d1112, 0.018);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x111111, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(8, 18, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    this.scene.add(sun);
    this.observation = new ObservationManager(this.camera, this.scene);
    this.staticColliders = [];
    this.dynamicColliders = [];
    this.projectiles = [];
    this.player = new Player(this);
    this.scene.add(this.player.controls.getObject());
  }

  loadLevel(index, fromCheckpoint = false) {
    this.createScene();
    const level = LEVELS[index];
    this.currentLevel = level;
    this.ui.setLevel(index, LEVEL_COUNT, level.title, level.lesson);
    level.build(this);
    this.checkpoint.copy(level.spawn);
    this.player.reset(fromCheckpoint ? this.checkpoint : level.spawn);
    this.ui.story(level.message);
    this.save();
  }

  nextLevel() {
    if (this.levelIndex >= LEVEL_COUNT - 1) {
      this.win();
      return;
    }
    this.levelIndex += 1;
    this.audio.checkpoint();
    this.loadLevel(this.levelIndex);
  }

  save() {
    if (!this.running) return;
    this.saveSystem.save({
      levelIndex: this.levelIndex,
      checkpoint: { x: this.checkpoint.x, y: this.checkpoint.y, z: this.checkpoint.z }
    });
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this.player?.controls.unlock();
    this.ui.showPause();
    this.save();
  }

  resume() {
    this.paused = false;
    this.ui.hidePause();
    this.player?.controls.lock();
  }

  saveAndQuit() {
    this.save();
    this.running = false;
    this.player?.controls.unlock();
    this.ui.showMainMenu();
  }

  levelSelect(index) {
    this.start(false, index);
  }

  getActiveColliders() {
    return [
      ...this.staticColliders,
      ...this.dynamicColliders.filter((collider) => collider.enabled)
    ];
  }

  addBox(position, size, material = this.materials.wall, collides = true, occludes = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    mesh.updateMatrixWorld();
    if (collides) this.staticColliders.push({ box: new THREE.Box3().setFromObject(mesh), mesh });
    if (occludes) this.observation.addOccluder(mesh);
    return mesh;
  }

  addExit(position) {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.06, 12, 48), this.materials.glow(0x67f8ff));
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.08, 48), this.materials.cyan);
    ring.rotation.x = Math.PI / 2;
    core.rotation.x = Math.PI / 2;
    group.add(ring, core);
    group.position.copy(position);
    group.position.y = 1.25;
    this.scene.add(group);
    this.exit = group;
  }

  addCheckpoint(position) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 32), this.materials.glow(0x67f8ff));
    pad.position.copy(position);
    pad.position.y += 0.04;
    this.scene.add(pad);
    return pad;
  }

  addLauncher(position, direction, interval = 2.1) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 20), this.materials.orange);
    mesh.position.copy(position);
    mesh.lookAt(position.clone().add(direction));
    this.scene.add(mesh);
    this.launchers.push({ position: position.clone(), direction: direction.clone().normalize(), interval, timer: 0 });
  }

  buildRoom(length = 24, width = 10) {
    const centerZ = (5 - length) * 0.5;
    const depth = length + 5;
    this.addBox(new THREE.Vector3(0, -0.12, centerZ), new THREE.Vector3(width, 0.24, depth), this.materials.floor, true, false);
    this.addBox(new THREE.Vector3(-width / 2, 2, centerZ), new THREE.Vector3(0.25, 4, depth), this.materials.wall);
    this.addBox(new THREE.Vector3(width / 2, 2, centerZ), new THREE.Vector3(0.25, 4, depth), this.materials.wall);
    this.addBox(new THREE.Vector3(0, 4, centerZ), new THREE.Vector3(width, 0.25, depth), this.materials.wall, false, false);
  }

  damage(reason) {
    this.flash = 1;
    this.audio.danger();
    this.ui.warn(reason);
    this.player.respawn();
  }

  update(dt) {
    this.player.update(dt);
    this.observation.update(dt, this.player);
    this.updateLaunchers(dt);
    this.updateExitAndCheckpoint();
    this.flash = Math.max(0, this.flash - dt * 2.6);
    this.ui.setDamage(this.flash);
    this.ui.setVitals(this.observation.targets.filter((t) => t.isObserved).length, this.observation.targets.length);
  }

  updateLaunchers(dt) {
    if (!this.launchers) return;
    for (const launcher of this.launchers) {
      launcher.timer -= dt;
      if (launcher.timer <= 0) {
        this.projectiles.push(new ObservationProjectile(this, launcher.position.clone(), launcher.direction.clone()));
        launcher.timer = launcher.interval;
      }
    }
  }

  updateExitAndCheckpoint() {
    if (this.exit) {
      this.exit.rotation.z += 0.015;
      if (this.player.position.distanceTo(this.exit.position) < 1.35) this.nextLevel();
    }
    if (this.checkpointPad && this.player.position.distanceTo(this.checkpointPad.position) < 1.25) {
      const cp = this.checkpointPad.position.clone();
      cp.y = 0;
      if (this.checkpoint.distanceTo(cp) > 0.1) {
        this.checkpoint.copy(cp);
        this.audio.checkpoint();
        this.ui.story('Checkpoint anchored. Memory survives collapse.');
        this.save();
      }
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.running && !this.paused) this.update(dt);
    this.render();
  }

  render() {
    if (!this.scene) {
      this.renderer.setClearColor(0x050607, 1);
      this.renderer.clear();
      return;
    }
    this.renderer.render(this.scene, this.camera);
  }

  win() {
    this.running = false;
    this.saveSystem.clear();
    this.player?.controls.unlock();
    this.ui.victory();
  }
}

function vec(x, y, z) {
  return new THREE.Vector3(x, y, z);
}

function addGuideStrips(game, zs) {
  for (const z of zs) {
    game.addBox(vec(-2.2, 0.02, z), vec(0.8, 0.04, 0.08), game.materials.cyan, false, false);
    game.addBox(vec(2.2, 0.02, z), vec(0.8, 0.04, 0.08), game.materials.orange, false, false);
  }
}

const LEVELS = [
  {
    title: 'Observed Barriers',
    lesson: 'Observed walls are solid. Unobserved walls do not exist.',
    message: 'Look away from the white wall and move through where it used to be.',
    spawn: vec(0, 0, 2),
    build(game) {
      game.buildRoom(24, 9);
      addGuideStrips(game, [-2, -6, -10, -14]);
      new ObservationWall(game, vec(0, 1.25, -7), vec(5.2, 2.5, 0.55));
      game.addExit(vec(0, 0, -18));
    }
  },
  {
    title: 'Vanishing Steps',
    lesson: 'Observed platforms hold you. Unobserved platforms disappear.',
    message: 'Cross the gap by keeping each step in view as your feet commit.',
    spawn: vec(0, 0, 2),
    build(game) {
      game.buildRoom(30, 12);
      game.addBox(vec(0, -2.25, -12), vec(10, 4, 12), game.materials.dark, false, false);
      for (let i = 0; i < 6; i++) new ObservationPlatform(game, vec((i % 2 ? 1.8 : -1.8), 0.35, -4 - i * 2.4), vec(2.8, 0.32, 1.4));
      game.checkpointPad = game.addCheckpoint(vec(0, 0, -11.5));
      game.addExit(vec(0, 0, -24));
    }
  },
  {
    title: 'The Door That Needs You',
    lesson: 'Doors only exist while observed.',
    message: 'Keep the door in your view long enough to use it as a bridge.',
    spawn: vec(0, 0, 2),
    build(game) {
      game.buildRoom(28, 10);
      game.addBox(vec(0, -2.25, -11), vec(8, 4, 10), game.materials.dark, false, false);
      const door = new ObservationDoor(game, vec(0, 0.25, -10), vec(4.2, 0.34, 2.6));
      door.mesh.rotation.x = Math.PI / 2;
      game.addExit(vec(0, 0, -22));
    }
  },
  {
    title: 'Predator Logic',
    lesson: 'Enemies only move while visible.',
    message: 'Looking at the hunter gives it reality. Break eye contact to survive.',
    spawn: vec(0, 0, 2),
    build(game) {
      game.buildRoom(30, 12);
      game.addBox(vec(0, 1, -10), vec(1, 2, 5.5), game.materials.wall);
      game.addBox(vec(-3.8, 1, -15), vec(3, 2, 0.25), game.materials.wall);
      new ObservationEnemy(game, vec(0, 0, -8));
      new ObservationEnemy(game, vec(3.2, 0, -17));
      game.checkpointPad = game.addCheckpoint(vec(-3.5, 0, -12.5));
      game.addExit(vec(0, 0, -24));
    }
  },
  {
    title: 'Witness Engine',
    lesson: 'Moving platforms only move while visible.',
    message: 'Observe the ferry to call it, look away to pause it under your path.',
    spawn: vec(0, 0, 2),
    build(game) {
      game.buildRoom(32, 12);
      game.addBox(vec(0, -2.25, -13), vec(10, 4, 16), game.materials.dark, false, false);
      new ObservationMover(game, vec(0, 0.35, -12), vec(3.4, 0.35, 2.2), 'x', 3.6, 1.4);
      new ObservationPlatform(game, vec(-3.8, 0.2, -7), vec(2.4, 0.3, 2));
      new ObservationPlatform(game, vec(3.8, 0.2, -17), vec(2.4, 0.3, 2));
      game.addExit(vec(0, 0, -26));
    }
  },
  {
    title: 'Blind Fire',
    lesson: 'Projectiles only exist while visible.',
    message: 'When the shot is in sight, it is lethal. Look away to let it pass through you.',
    spawn: vec(0, 0, 2),
    build(game) {
      game.launchers = [];
      game.buildRoom(30, 10);
      game.addBox(vec(0, 0.8, -10), vec(7, 0.18, 0.18), game.materials.orange, false, false);
      game.addLauncher(vec(-3.8, 1.4, -10), vec(1, 0, 0), 1.35);
      game.addLauncher(vec(3.8, 1.1, -15), vec(-1, 0, 0), 1.7);
      game.addExit(vec(0, 0, -24));
    }
  },
  {
    title: 'Room Through Glass',
    lesson: 'Entire rooms only exist while observed.',
    message: 'Look through windows to construct the pathway before stepping into it.',
    spawn: vec(0, 0, 2),
    build(game) {
      game.buildRoom(34, 12);
      game.addBox(vec(0, -2.25, -15), vec(10, 4, 18), game.materials.dark, false, false);
      const pieces = [];
      pieces.push(new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 8), game.materials.observed(0xf2f2f2, 0x67f8ff)));
      pieces.push(new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 8), game.materials.observed(0xd9dcdd, 0x67f8ff)));
      pieces[1].position.set(-2.5, 1.1, 0);
      pieces.push(pieces[1].clone());
      pieces[2].position.x = 2.5;
      new ObservationRoom(game, vec(0, 0.15, -15), pieces);
      game.addBox(vec(0, 1.6, -8), vec(5.4, 1.5, 0.12), game.materials.cyan, false, false);
      game.addExit(vec(0, 0, -28));
    }
  },
  {
    title: 'Observer',
    lesson: 'Reality is a negotiation with your attention.',
    message: 'Remove walls, spawn platforms, bait hunters, pause machinery, and deny bullets.',
    spawn: vec(0, 0, 3),
    build(game) {
      game.launchers = [];
      game.buildRoom(42, 14);
      game.addBox(vec(0, -2.25, -20), vec(12, 4, 24), game.materials.dark, false, false);
      new ObservationWall(game, vec(0, 1.25, -5), vec(5.5, 2.5, 0.45));
      new ObservationPlatform(game, vec(-3.5, 0.35, -11), vec(2.5, 0.3, 2));
      new ObservationMover(game, vec(0, 0.45, -17), vec(3.2, 0.35, 2.2), 'x', 4.1, 1.7);
      new ObservationPlatform(game, vec(3.6, 0.35, -23), vec(2.6, 0.3, 2));
      new ObservationEnemy(game, vec(0, 0, -14));
      new ObservationEnemy(game, vec(-4, 0, -25));
      game.addLauncher(vec(5.3, 1.2, -27), vec(-1, 0, 0), 1.45);
      new ObservationDoor(game, vec(0, 0.25, -31), vec(4.5, 0.34, 2.6)).mesh.rotation.x = Math.PI / 2;
      game.checkpointPad = game.addCheckpoint(vec(0, 0, -19));
      game.addExit(vec(0, 0, -36));
    }
  }
];
