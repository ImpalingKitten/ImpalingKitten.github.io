import * as THREE from 'three';

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;

export function distance2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

export function rectsOverlap(a, b) {
  return Math.abs(a.x - b.x) < (a.w + b.w) * 0.5 && Math.abs(a.z - b.z) < (a.d + b.d) * 0.5;
}

export function makeBoxBounds(position, size) {
  return {
    x: position.x,
    z: position.z,
    w: size.x,
    d: size.z,
    minY: position.y - size.y * 0.5,
    maxY: position.y + size.y * 0.5
  };
}

export function pulseColor(material, base, flash, amount) {
  material.color.copy(base).lerp(flash, amount);
  if (material.emissive) material.emissive.copy(flash).multiplyScalar(amount * 0.8);
}

export function horizontalForward(camera) {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  return forward.normalize();
}
