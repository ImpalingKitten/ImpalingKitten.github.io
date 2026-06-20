export const GlitchShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    intensity: { value: 0.1 },
    damage: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float intensity;
    uniform float damage;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv;
      float band = step(0.985 - damage * 0.05, hash(vec2(floor(uv.y * 90.0), floor(time * 18.0))));
      float tear = (hash(vec2(floor(uv.y * 40.0), floor(time * 7.0))) - 0.5) * intensity * band;
      uv.x += tear;
      uv.x += sin(uv.y * 180.0 + time * 18.0) * 0.0015 * damage;

      float split = (0.002 + damage * 0.006) * intensity;
      float r = texture2D(tDiffuse, uv + vec2(split, 0.0)).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - vec2(split, 0.0)).b;
      vec3 color = vec3(r, g, b);

      float scan = 0.94 + 0.06 * sin(uv.y * 900.0);
      float staticNoise = (hash(uv * vec2(900.0, 500.0) + time) - 0.5) * damage * 0.08;
      color = color * scan + staticNoise;
      color += vec3(0.05, 0.18, 0.22) * band * damage;
      gl_FragColor = vec4(color, 1.0);
    }
  `
};
