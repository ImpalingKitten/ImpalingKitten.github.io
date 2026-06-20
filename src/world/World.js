import { FacilityGenerator } from './FacilityGenerator.js';

export class World {
  constructor(scene, seed) {
    this.facility = new FacilityGenerator(scene, seed).create();
    this.colliders = this.facility.colliders;
    this.interactables = this.facility.interactables;
  }

  update(time) {
    this.facility.update(time);
  }

  getSpawn() {
    return this.facility.spawn.clone();
  }

  setExitActive(active) {
    if (this.facility.exitPortal) {
      this.facility.exitPortal.visible = active;
      this.facility.exitPortal.material.opacity = active ? 0.78 : 0;
    }
  }
}
