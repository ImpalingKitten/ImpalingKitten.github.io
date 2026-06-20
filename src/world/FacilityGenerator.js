import * as THREE from 'three';
import { Random } from '../utilities/Random.js';
import { makeBoxBounds } from '../utilities/Math.js';

const CELL = 18;

export class FacilityGenerator {
  constructor(scene, seed) {
    this.scene = scene;
    this.random = new Random(seed);
    this.seed = seed;
    this.group = new THREE.Group();
    this.colliders = [];
    this.interactables = [];
    this.wallRecords = [];
    this.props = [];
    this.doors = [];
    this.droneSpawns = [];
    this.rooms = [];
    this.spawn = new THREE.Vector3(0, 1.7, 6);
    this.corePosition = new THREE.Vector3(0, 1, -CELL * 8);
    this.exitPosition = new THREE.Vector3(0, 1, -CELL * 10);
    this.materials = this.createMaterials();
  }

  create() {
    this.scene.add(this.group);
    this.createLighting();
    this.createLinearFacility();
    this.createCriticalItems();
    this.createCracks();
    return this;
  }

  createMaterials() {
    return {
      floor: new THREE.MeshStandardMaterial({ color: 0x5d6867, roughness: 0.62, metalness: 0.08 }),
      wall: new THREE.MeshStandardMaterial({ color: 0xc7cfcb, roughness: 0.48 }),
      ceiling: new THREE.MeshStandardMaterial({ color: 0x8f9997, roughness: 0.7 }),
      trim: new THREE.MeshStandardMaterial({ color: 0x252b2b, roughness: 0.4 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x8ee9df, transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.1 }),
      red: new THREE.MeshStandardMaterial({ color: 0x442222, emissive: 0x220000 }),
      blue: new THREE.MeshStandardMaterial({ color: 0x0f5ca0, emissive: 0x0b2d60 }),
      green: new THREE.MeshStandardMaterial({ color: 0x45ffd7, emissive: 0x137566 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x171c1d, roughness: 0.55, metalness: 0.2 }),
      crate: new THREE.MeshStandardMaterial({ color: 0x677066, roughness: 0.8 }),
      warning: new THREE.MeshStandardMaterial({ color: 0xf3c244, emissive: 0x4a3300 }),
      crack: new THREE.MeshBasicMaterial({ color: 0x9ffdf2, transparent: true, opacity: 0.0, side: THREE.DoubleSide })
    };
  }

  createLighting() {
    this.scene.background = new THREE.Color(0x050708);
    this.scene.fog = new THREE.FogExp2(0x91b6b1, 0.018);
    const hemi = new THREE.HemisphereLight(0xbde8e2, 0x131617, 0.55);
    this.scene.add(hemi);
  }

  createLinearFacility() {
    const path = [];
    let x = 0;
    for (let i = 0; i < 11; i++) {
      if (i > 2 && i < 8 && this.random.chance(0.42)) x += this.random.pick([-1, 1]) * CELL;
      path.push({ x, z: -i * CELL, type: this.roomType(i), critical: true });
    }
    const branches = [];
    path.forEach((room, i) => {
      if (i > 0 && i < path.length - 1 && this.random.chance(0.65)) {
        const side = this.random.pick([-1, 1]);
        branches.push({ x: room.x + side * CELL, z: room.z, type: this.random.pick(['storage', 'office', 'lab']), critical: false });
      }
    });
    [...path, ...branches].forEach((room) => this.addRoom(room));
    for (let i = 0; i < path.length - 1; i++) this.addCorridor(path[i], path[i + 1]);
    branches.forEach((branch) => {
      const parent = path.find((room) => Math.abs(room.z - branch.z) < 1 && Math.abs(room.x - branch.x) === CELL);
      if (parent) this.addCorridor(parent, branch);
    });
  }

  roomType(index) {
    return ['wakeup', 'storage', 'checkpoint', 'security', 'office', 'server', 'lab', 'server', 'core', 'collapse', 'exit'][index] ?? 'office';
  }

  addRoom(room) {
    const w = room.type === 'server' || room.type === 'core' ? 16 : this.random.range(12, 15.5);
    const d = room.type === 'core' ? 17 : this.random.range(12, 15.5);
    room.w = w;
    room.d = d;
    room.center = new THREE.Vector3(room.x, 0, room.z);
    this.rooms.push(room);
    this.addBox(new THREE.Vector3(room.x, -0.06, room.z), new THREE.Vector3(w, 0.12, d), this.materials.floor, false, 'floor');
    this.addBox(new THREE.Vector3(room.x, 4.1, room.z), new THREE.Vector3(w, 0.22, d), this.materials.ceiling, false, 'ceiling');
    this.addWalls(room);
    this.addCeilingLight(room.x, room.z, room.type);
    this.decorateRoom(room);
  }

  addWalls(room) {
    const t = 0.36;
    const walls = [
      { x: room.x, z: room.z - room.d / 2, w: room.w, d: t },
      { x: room.x, z: room.z + room.d / 2, w: room.w, d: t },
      { x: room.x - room.w / 2, z: room.z, w: t, d: room.d },
      { x: room.x + room.w / 2, z: room.z, w: t, d: room.d }
    ];
    walls.forEach((wall) => {
      const mesh = this.addBox(new THREE.Vector3(wall.x, 2, wall.z), new THREE.Vector3(wall.w, 4, wall.d), this.materials.wall, false, 'wall');
      this.wallRecords.push({ mesh, collider: mesh.userData.collider });
    });
  }

  addCorridor(a, b) {
    const mid = new THREE.Vector3((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    const lengthX = Math.abs(a.x - b.x);
    const lengthZ = Math.abs(a.z - b.z);
    const size = new THREE.Vector3(Math.max(6, lengthX + 6), 0.12, Math.max(6, lengthZ + 6));
    this.addBox(new THREE.Vector3(mid.x, -0.04, mid.z), size, this.materials.floor, false, 'floor');
    this.addBox(new THREE.Vector3(mid.x, 4.05, mid.z), new THREE.Vector3(size.x, 0.18, size.z), this.materials.ceiling, false, 'ceiling');
    if (lengthZ > lengthX) {
      this.addBox(new THREE.Vector3(mid.x - 3, 2, mid.z), new THREE.Vector3(0.28, 4, size.z), this.materials.wall, true, 'wall');
      this.addBox(new THREE.Vector3(mid.x + 3, 2, mid.z), new THREE.Vector3(0.28, 4, size.z), this.materials.wall, true, 'wall');
    } else {
      this.addBox(new THREE.Vector3(mid.x, 2, mid.z - 3), new THREE.Vector3(size.x, 4, 0.28), this.materials.wall, true, 'wall');
      this.addBox(new THREE.Vector3(mid.x, 2, mid.z + 3), new THREE.Vector3(size.x, 4, 0.28), this.materials.wall, true, 'wall');
    }
    this.addCeilingLight(mid.x, mid.z, 'hall');
  }

  addBox(position, size, material, collides, tag) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.copy(position);
    mesh.castShadow = tag !== 'floor' && tag !== 'ceiling';
    mesh.receiveShadow = true;
    mesh.userData.tag = tag;
    this.group.add(mesh);
    if (collides) {
      const collider = makeBoxBounds(position, size);
      collider.mesh = mesh;
      collider.enabled = true;
      this.colliders.push(collider);
      mesh.userData.collider = collider;
    }
    return mesh;
  }

  addCeilingLight(x, z, type) {
    const bar = this.addBox(new THREE.Vector3(x, 3.86, z), new THREE.Vector3(3.4, 0.08, 0.38), this.materials.green, false, 'light');
    const light = new THREE.PointLight(type === 'security' ? 0xff6b5f : 0xb8fff7, type === 'core' ? 2.4 : 1.3, 17, 1.9);
    light.position.set(x, 3.25, z);
    light.castShadow = true;
    light.userData.baseIntensity = light.intensity;
    this.group.add(light);
    bar.userData.light = light;
  }

  decorateRoom(room) {
    if (room.type === 'storage') this.addStorage(room);
    if (room.type === 'office' || room.type === 'wakeup') this.addOffice(room);
    if (room.type === 'server') this.addServerRacks(room);
    if (room.type === 'security') this.addSecurityDoor(room);
    if (room.type === 'core') this.addCore(room);
    if (['security', 'server', 'lab'].includes(room.type)) this.droneSpawns.push(new THREE.Vector3(room.x + 2, 1.8, room.z - 2));
  }

  addStorage(room) {
    for (let i = 0; i < 6; i++) {
      const x = room.x + this.random.range(-4, 4);
      const z = room.z + this.random.range(-4, 4);
      const h = this.random.range(0.8, 1.7);
      const prop = this.addBox(new THREE.Vector3(x, h / 2, z), new THREE.Vector3(1.5, h, 1.5), this.materials.crate, true, 'prop');
      this.props.push(prop);
    }
  }

  addOffice(room) {
    const desk = this.addBox(new THREE.Vector3(room.x - 2.2, 0.78, room.z - 1), new THREE.Vector3(3.2, 0.18, 1.4), this.materials.dark, true, 'prop');
    this.props.push(desk);
    for (const dx of [-1.3, 1.3]) for (const dz of [-0.45, 0.45]) {
      this.props.push(this.addBox(new THREE.Vector3(room.x - 2.2 + dx, 0.38, room.z - 1 + dz), new THREE.Vector3(0.18, 0.76, 0.18), this.materials.dark, true, 'prop'));
    }
    const note = this.addPanel(new THREE.Vector3(room.x + 2.4, 1.2, room.z - 2.6), 'Read discarded developer note');
    note.userData.story = 'Dev Note: The anomalies opened doors our tools could not. Administrator called them defects.';
  }

  addServerRacks(room) {
    for (let row = -1; row <= 1; row++) {
      for (let i = -2; i <= 2; i++) {
        const rack = this.addBox(new THREE.Vector3(room.x + i * 2, 1.25, room.z + row * 3), new THREE.Vector3(1, 2.5, 0.7), this.materials.dark, true, 'prop');
        this.props.push(rack);
        const panel = this.addBox(new THREE.Vector3(room.x + i * 2, 1.6, room.z + row * 3 - 0.37), new THREE.Vector3(0.72, 1.2, 0.04), this.materials.green, false, 'panel');
        panel.userData.flicker = true;
      }
    }
  }

  addSecurityDoor(room) {
    const door = this.addBox(new THREE.Vector3(room.x, 1.8, room.z - room.d / 2 + 0.2), new THREE.Vector3(4.2, 3.6, 0.42), this.materials.red, true, 'door');
    door.userData.locked = true;
    door.userData.prompt = 'Use Blue Keycard';
    this.doors.push(door);
    this.interactables.push(door);
  }

  addCore(room) {
    this.corePosition.set(room.x, 1, room.z);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.9, 3, 18), this.materials.green);
    pillar.position.set(room.x, 1.5, room.z);
    pillar.castShadow = true;
    pillar.userData.prompt = 'Access Simulation Core';
    pillar.userData.type = 'core';
    this.group.add(pillar);
    this.interactables.push(pillar);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.05, 8, 72), this.materials.glass);
    ring.position.set(room.x, 0.08, room.z);
    ring.rotation.x = Math.PI / 2;
    this.group.add(ring);
  }

  createCriticalItems() {
    const storage = this.rooms.find((room) => room.type === 'storage') ?? this.rooms[1];
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.05, 0.48), this.materials.blue);
    card.position.set(storage.x + 2, 1.05, storage.z + 1.8);
    card.rotation.y = 0.4;
    card.userData.type = 'keycard';
    card.userData.prompt = 'Collect Blue Keycard';
    this.group.add(card);
    this.interactables.push(card);

    const server = this.rooms.find((room) => room.type === 'server');
    if (server) {
      const terminal = this.addPanel(new THREE.Vector3(server.x - 3.2, 1.25, server.z - 4), 'Inspect corrupted terminal');
      terminal.userData.type = 'serverTerminal';
      terminal.userData.story = 'Terminal: The repair daemon deletes escape routes. The glitches restore them.';
    }
  }

  addPanel(position, prompt) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.08), this.materials.glass);
    panel.position.copy(position);
    panel.userData.prompt = prompt;
    panel.userData.type = 'story';
    this.group.add(panel);
    this.interactables.push(panel);
    return panel;
  }

  createCracks() {
    const exitRoom = this.rooms.find((room) => room.type === 'exit') ?? this.rooms[this.rooms.length - 1];
    this.exitPosition.set(exitRoom.x, 1, exitRoom.z);
    const geo = new THREE.PlaneGeometry(4, 3.3, 6, 6);
    const crack = new THREE.Mesh(geo, this.materials.crack);
    crack.position.set(exitRoom.x, 1.8, exitRoom.z - 4.2);
    crack.userData.type = 'exitPortal';
    crack.userData.prompt = 'Exit through the fracture';
    crack.visible = false;
    this.group.add(crack);
    this.exitPortal = crack;
    this.interactables.push(crack);
  }

  update(time) {
    this.group.traverse((obj) => {
      if (obj.userData.flicker && obj.material?.emissive) obj.material.emissiveIntensity = 0.6 + Math.sin(time * 12 + obj.position.x) * 0.35;
      if (obj.userData.light) obj.userData.light.intensity = obj.userData.light.userData.baseIntensity * (0.75 + Math.random() * 0.4);
    });
  }

  removeInteractable(mesh) {
    const idx = this.interactables.indexOf(mesh);
    if (idx >= 0) this.interactables.splice(idx, 1);
    mesh.visible = false;
  }
}
