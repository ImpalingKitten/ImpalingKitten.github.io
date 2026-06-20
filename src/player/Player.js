import * as THREE from 'three';
import { horizontalForward, rectsOverlap, clamp, lerp } from '../utilities/Math.js';

export class Player {
  constructor(camera, canvas, world, audio) {
    this.camera = camera;
    this.canvas = canvas;
    this.world = world;
    this.audio = audio;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = 0;
    this.sensitivity = 1;
    this.radius = 0.42;
    this.height = 1.72;
    this.grounded = true;
    this.crouching = false;
    this.locked = false;
    this.bob = 0;
    this.stepTimer = 0;
    this.raycaster = new THREE.Raycaster();
    this.target = null;
    this.lowGravity = 0;
    this.bind();
  }

  bind() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyC') this.crouching = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyC') this.crouching = false;
    });
    this.canvas.addEventListener('click', () => this.canvas.requestPointerLock());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const scale = 0.0022 * this.sensitivity;
      this.yaw -= e.movementX * scale;
      this.pitch = clamp(this.pitch - e.movementY * scale, -1.42, 1.42);
    });
  }

  setSensitivity(value) {
    this.sensitivity = value;
  }

  reset(position) {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.yaw = Math.PI;
    this.pitch = 0;
    this.updateCamera(0);
  }

  update(dt, ui) {
    const desiredHeight = this.crouching ? 1.05 : 1.72;
    this.height = lerp(this.height, desiredHeight, Math.min(1, dt * 12));
    const speed = (this.keys.has('ShiftLeft') && !this.crouching ? 6.2 : 3.8) * (this.crouching ? 0.55 : 1);
    const forward = horizontalForward(this.camera);
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(-1);
    const wish = new THREE.Vector3();
    if (this.keys.has('KeyW')) wish.add(forward);
    if (this.keys.has('KeyS')) wish.sub(forward);
    if (this.keys.has('KeyA')) wish.sub(right);
    if (this.keys.has('KeyD')) wish.add(right);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    this.velocity.x = lerp(this.velocity.x, wish.x, Math.min(1, dt * 10));
    this.velocity.z = lerp(this.velocity.z, wish.z, Math.min(1, dt * 10));

    if (this.keys.has('Space') && this.grounded) {
      this.velocity.y = this.lowGravity > 0 ? 6.2 : 4.5;
      this.grounded = false;
    }

    const gravity = this.lowGravity > 0 ? -3.2 : -12;
    this.velocity.y += gravity * dt;
    this.lowGravity = Math.max(0, this.lowGravity - dt);

    this.moveAxis('x', this.velocity.x * dt);
    this.moveAxis('z', this.velocity.z * dt);
    this.position.y += this.velocity.y * dt;
    if (this.position.y < 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.grounded = true;
    }

    const planarSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (planarSpeed > 0.8 && this.grounded) {
      this.bob += dt * planarSpeed * 6;
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.audio.footstep(planarSpeed);
        this.stepTimer = 0.42 / Math.max(0.8, planarSpeed / 4);
      }
    }
    this.updateCamera(planarSpeed);
    this.findInteraction(ui);
  }

  moveAxis(axis, amount) {
    this.position[axis] += amount;
    const body = { x: this.position.x, z: this.position.z, w: this.radius * 2, d: this.radius * 2 };
    for (const collider of this.world.colliders) {
      if (!collider.enabled || this.position.y + this.height < collider.minY || this.position.y > collider.maxY) continue;
      if (rectsOverlap(body, collider)) {
        this.position[axis] -= amount;
        this.velocity[axis] = 0;
        return;
      }
    }
  }

  updateCamera(speed) {
    const bobY = this.grounded ? Math.sin(this.bob) * 0.045 * clamp(speed / 4, 0, 1) : 0;
    this.camera.position.set(this.position.x, this.position.y + this.height + bobY, this.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  findInteraction(ui) {
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    const hits = this.raycaster.intersectObjects(this.world.interactables, false);
    this.target = null;
    for (const hit of hits) {
      if (!hit.object.visible || hit.distance > 3.2) continue;
      this.target = hit.object;
      ui.setInteraction(`[E] ${hit.object.userData.prompt ?? 'Interact'}`);
      return;
    }
    ui.setInteraction('');
  }
}
