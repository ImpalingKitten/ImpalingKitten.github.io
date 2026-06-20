import { Drone } from './Drone.js';

export class DroneManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.drones = [];
    for (const spawn of world.facility.droneSpawns.slice(0, 5)) {
      const drone = new Drone(spawn, spawn, world.facility.materials);
      this.drones.push(drone);
      scene.add(drone.group);
    }
  }

  update(dt, player, audio) {
    for (const drone of this.drones) {
      const result = drone.update(dt, player, this.world, audio);
      if (result) return result;
    }
    return null;
  }

  freezeRandom() {
    const active = this.drones.filter((drone) => drone.freezeTimer <= 0);
    const drone = active[Math.floor(Math.random() * active.length)];
    if (drone) drone.freeze(4 + Math.random() * 3);
  }
}
