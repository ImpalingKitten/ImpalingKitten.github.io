import * as THREE from 'three';

export class GlitchManager {
  constructor(world, droneManager, ui, audio) {
    this.world = world;
    this.drones = droneManager;
    this.ui = ui;
    this.audio = audio;
    this.progress = 0;
    this.instability = 0.08;
    this.timer = 3;
    this.active = new Map();
    this.triggered = new Set();
    this.duplicates = [];
    this.lowZones = [];
    this.names = {
      missingWalls: 'Missing Walls',
      duplication: 'Duplication',
      lowGravity: 'Physics Failure',
      frozenDrones: 'Frozen Drones',
      cracks: 'Out of Bounds'
    };
  }

  setProgress(value) {
    this.progress = value;
    this.instability = 0.08 + value * 0.16;
  }

  update(dt, player) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = Math.max(1.8, 6.5 - this.progress * 0.45);
      this.triggerRandom(player);
    }
    for (const [type, data] of this.active) {
      data.time -= dt;
      if (data.time <= 0) this.end(type, data);
    }
    for (const zone of this.lowZones) {
      if (zone.visible && player.position.distanceTo(zone.position) < 2.4) player.lowGravity = 0.45;
      zone.rotation.y += dt * 0.8;
    }
    this.ui.setGlitches([...this.active.keys()].map((type) => this.names[type]));
  }

  triggerRandom(player) {
    const available = ['missingWalls', 'duplication', 'lowGravity', 'frozenDrones', 'cracks'];
    const type = available[Math.floor(Math.random() * Math.min(available.length, 2 + this.progress))];
    this.trigger(type, player);
  }

  trigger(type, player) {
    this.triggered.add(type);
    this.audio.glitch(1 + this.progress * 0.2);
    if (type === 'missingWalls') this.missingWalls();
    if (type === 'duplication') this.duplication();
    if (type === 'lowGravity') this.lowGravity(player);
    if (type === 'frozenDrones') this.frozenDrones();
    if (type === 'cracks') this.cracks();
  }

  triggerAll(player) {
    for (const type of ['missingWalls', 'duplication', 'lowGravity', 'frozenDrones', 'cracks']) this.trigger(type, player);
  }

  missingWalls() {
    const candidates = this.world.facility.wallRecords.filter((record) => record.mesh.visible);
    const chosen = candidates.sort(() => Math.random() - 0.5).slice(0, 6);
    for (const record of chosen) {
      record.mesh.visible = false;
      if (record.collider) record.collider.enabled = false;
    }
    this.active.set('missingWalls', { time: 6, chosen });
    this.ui.ai('Please ignore the missing walls. Authorized geometry will return shortly.');
  }

  duplication() {
    const props = this.world.facility.props.filter((prop) => prop.visible).sort(() => Math.random() - 0.5).slice(0, 4);
    const clones = [];
    for (const prop of props) {
      const clone = prop.clone();
      clone.position.x += (Math.random() - 0.5) * 4;
      clone.position.z += (Math.random() - 0.5) * 4;
      clone.position.y += Math.random() * 1.2;
      clone.material = prop.material.clone();
      clone.material.emissive = new THREE.Color(0x163d3a);
      this.world.facility.group.add(clone);
      clones.push(clone);
    }
    this.duplicates.push(...clones);
    this.active.set('duplication', { time: 9, clones });
    this.ui.ai('Duplicated objects are not stairs. Do not climb them.', true);
  }

  lowGravity(player) {
    const zone = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 0.05, 36),
      new THREE.MeshBasicMaterial({ color: 0x7df1e7, transparent: true, opacity: 0.3 })
    );
    zone.position.set(player.position.x + Math.sin(Date.now()) * 4, 0.08, player.position.z - 4);
    this.world.facility.group.add(zone);
    this.lowZones.push(zone);
    this.active.set('lowGravity', { time: 10, zone });
    this.ui.ai('Gravity service interruption detected. Stay on approved floors.');
  }

  frozenDrones() {
    this.drones.freezeRandom();
    this.active.set('frozenDrones', { time: 5 });
    this.ui.ai('Security drone pause is a visual defect. It can still see you. Probably.');
  }

  cracks() {
    const portal = this.world.facility.exitPortal;
    portal.visible = true;
    portal.material.opacity = 0.38;
    this.active.set('cracks', { time: 8, portal });
    this.ui.ai('Out-of-bounds access is prohibited. There is nothing behind the world.', true);
  }

  end(type, data) {
    if (type === 'missingWalls') {
      for (const record of data.chosen) {
        record.mesh.visible = true;
        if (record.collider) record.collider.enabled = true;
      }
    }
    if (type === 'duplication') {
      for (const clone of data.clones) clone.parent?.remove(clone);
    }
    if (type === 'lowGravity') {
      data.zone.parent?.remove(data.zone);
    }
    if (type === 'cracks' && !this.world.facility.exitPortal.userData.finalOpen) {
      data.portal.visible = false;
      data.portal.material.opacity = 0;
    }
    this.active.delete(type);
  }

  allTriggered() {
    return ['missingWalls', 'duplication', 'lowGravity', 'frozenDrones', 'cracks'].every((type) => this.triggered.has(type));
  }
}
