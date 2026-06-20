import * as THREE from 'three';
import { distance2D } from '../utilities/Math.js';

export class Drone {
  constructor(position, patrolCenter, materials) {
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.center = patrolCenter.clone();
    this.state = 'PATROL';
    this.timer = Math.random() * 4;
    this.freezeTimer = 0;
    this.speed = 2.1;
    this.target = position.clone();
    this.lastKnown = position.clone();
    this.createMesh(materials);
  }

  createMesh(materials) {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 12), materials.dark);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), materials.red);
    eye.position.set(0, 0.08, -0.5);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xff524a, transparent: true, opacity: 0.08, depthWrite: false }));
    cone.position.set(0, -0.05, -2.6);
    cone.rotation.x = -Math.PI / 2;
    const thrusterGeo = new THREE.CylinderGeometry(0.13, 0.17, 0.32, 10);
    for (const x of [-0.42, 0.42]) {
      const t = new THREE.Mesh(thrusterGeo, materials.green);
      t.rotation.x = Math.PI / 2;
      t.position.set(x, -0.28, 0.25);
      this.group.add(t);
    }
    this.group.add(body, eye, cone);
    this.eye = eye;
    this.cone = cone;
  }

  update(dt, player, world, audio) {
    this.timer -= dt;
    this.group.position.y = 1.75 + Math.sin(performance.now() * 0.002 + this.center.x) * 0.12;
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
      this.state = 'FREEZE';
      this.eye.material.emissive?.setHex(0x003bff);
      return;
    }

    const sees = this.canSee(player);
    if (sees) {
      this.state = 'CHASE';
      this.lastKnown.copy(player.position);
      audio.alarm();
    } else if (this.state === 'CHASE') {
      this.state = 'SEARCH';
      this.timer = 2.5;
    } else if (this.state === 'SEARCH' && this.timer <= 0) {
      this.state = 'PATROL';
    }

    if (this.state === 'PATROL' && this.timer <= 0) {
      this.pickPatrolTarget();
      this.timer = 2 + Math.random() * 3;
    }

    const target = this.state === 'CHASE' ? player.position : this.state === 'SEARCH' ? this.lastKnown : this.target;
    this.moveToward(target, dt, world);
    if (distance2D(this.group.position, player.position) < 0.85 && Math.abs(this.group.position.y - (player.position.y + 1.1)) < 1.4) return 'captured';
    return null;
  }

  canSee(player) {
    const toPlayer = new THREE.Vector3().subVectors(player.position, this.group.position);
    const dist = Math.hypot(toPlayer.x, toPlayer.z);
    if (dist > 9) return false;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.group.quaternion);
    toPlayer.y = 0;
    toPlayer.normalize();
    return forward.dot(toPlayer) > 0.45;
  }

  moveToward(target, dt) {
    const delta = new THREE.Vector3(target.x - this.group.position.x, 0, target.z - this.group.position.z);
    const len = delta.length();
    if (len < 0.2) return;
    delta.normalize();
    this.group.position.addScaledVector(delta, this.speed * (this.state === 'CHASE' ? 1.45 : 1) * dt);
    const yaw = Math.atan2(delta.x, delta.z);
    this.group.rotation.y = yaw;
  }

  pickPatrolTarget() {
    this.target.set(this.center.x + (Math.random() - 0.5) * 8, 1.8, this.center.z + (Math.random() - 0.5) * 8);
  }

  freeze(seconds = 4) {
    this.freezeTimer = Math.max(this.freezeTimer, seconds);
  }
}
