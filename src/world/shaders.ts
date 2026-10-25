// GLSL for the three.js stage. World meshes live in world pixels with y
// flipped (three's y points up); the camera maps them to whole device pixels.

export const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

/**
 * Underground darkness, one texel per tile. The spirit carries its own light,
 * stepped per tile like the roots' glow, so walking underground reveals the dark.
 */
export const DARKNESS_FRAG = /* glsl */ `
uniform sampler2D tLight;
uniform vec2 uTiles;
uniform vec2 uSpirit;
uniform float uSpiritRadius;
varying vec2 vUv;
void main() {
  vec4 dark = texture2D(tLight, vUv);
  vec2 tile = floor(vec2(vUv.x, 1.0 - vUv.y) * uTiles);
  float dist = length(tile - floor(uSpirit / 16.0));
  float lit = clamp(1.0 - dist / uSpiritRadius, 0.0, 1.0);
  lit = floor(lit * 4.0 + 0.5) / 4.0;
  gl_FragColor = vec4(dark.rgb, dark.a * (1.0 - lit));
}
`

/**
 * One frame of the spirit sheet. uSweep runs a colour transition up the body
 * (the sheet's "Color Transition" frames) in the colour of the care just done.
 * uEmissive renders the same sprite as a light source for the bloom pass.
 */
export const SPIRIT_FRAG = /* glsl */ `
uniform sampler2D tSheet;
uniform vec4 uFrame;
uniform float uFlip;
uniform vec3 uTint;
uniform float uTintAmount;
uniform float uSweep;
uniform float uGlow;
uniform float uEmissive;
varying vec2 vUv;
void main() {
  vec2 local = vec2(uFlip > 0.5 ? 1.0 - vUv.x : vUv.x, vUv.y);
  vec4 c = texture2D(tSheet, uFrame.xy + local * uFrame.zw);
  if (c.a < 0.5) discard;
  float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  float below = step(vUv.y, uSweep) * uTintAmount;
  vec3 col = mix(c.rgb, uTint * (0.35 + lum * 1.6), below);
  float edge = (1.0 - smoothstep(0.0, 0.05, abs(vUv.y - uSweep))) * uTintAmount;
  col += uTint * edge;
  if (uEmissive > 0.5) col = col * uGlow + uTint * edge * 2.0;
  gl_FragColor = vec4(col, 1.0);
}
`

/**
 * Pixel particles, animated entirely on the GPU from their spawn data:
 * kind 0 fireflies wander, kind 1 bursts fly out and fade, kind 2 motes rise.
 */
export const PARTICLE_VERT = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform float uMotion;
attribute vec2 aOrigin;
attribute vec2 aVelocity;
attribute vec3 aColor;
attribute float aBirth;
attribute float aLife;
attribute float aSeed;
attribute float aKind;
attribute float aSize;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float t = uTime * uMotion;
  float age = uTime - aBirth;
  vec2 p = aOrigin;
  float alpha = 1.0;
  if (aKind < 0.5) {
    p += vec2(sin(t * 0.7 + aSeed * 6.28) * 10.0 + sin(t * 1.3 + aSeed * 17.0) * 4.0,
              cos(t * 0.5 + aSeed * 9.0) * 7.0);
    alpha = 0.55 + 0.45 * sin(t * 2.0 + aSeed * 40.0);
  } else if (aKind < 1.5) {
    float k = clamp(age / aLife, 0.0, 1.0);
    p += aVelocity * age * (1.0 - 0.45 * k) + vec2(0.0, 26.0 * age * age);
    alpha = (age < 0.0 || age > aLife) ? 0.0 : 1.0 - k * k;
  } else {
    float cycle = fract(t * 0.08 + aSeed);
    p += vec2(sin(t + aSeed * 30.0) * 3.0, -cycle * aVelocity.y);
    alpha = sin(cycle * 3.14159);
  }
  vColor = aColor;
  vAlpha = alpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(floor(p.x) + 0.5, -(floor(p.y) + 0.5), 0.0, 1.0);
  gl_PointSize = uScale * aSize;
}
`

export const PARTICLE_FRAG = /* glsl */ `
uniform float uBoost;
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha <= 0.01) discard;
  gl_FragColor = vec4(vColor * vAlpha * uBoost, vAlpha);
}
`

/**
 * Final composite: scene + selective bloom, plus effects driven by play:
 * a shockwave with chromatic split where new growth lands, god rays from the
 * ruin once the roots reach it (with a flash at the reveal), and a vignette
 * that deepens and cools as the view goes underground.
 */
export const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uPulse;
uniform vec3 uPulseColor;
uniform vec3 uRuin;
uniform float uFlash;
uniform float uDepth;
uniform float uBloomStrength;
uniform float uMotion;
varying vec2 vUv;

const float PULSE_LIFE = 1.2;

void main() {
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 uv = vUv;
  vec2 dir = vec2(0.0);
  float ring = 0.0;
  float age = uTime - uPulse.z;
  if (uMotion > 0.5 && uPulse.z >= 0.0 && age < PULSE_LIFE) {
    vec2 d = (uv - uPulse.xy) * aspect;
    float dist = length(d);
    ring = smoothstep(0.06, 0.0, abs(dist - age * 0.55)) * (1.0 - age / PULSE_LIFE);
    dir = d / max(dist, 1e-4) / aspect;
    uv -= dir * ring * 0.012;
  }

  vec3 base;
  base.r = texture2D(tDiffuse, uv + dir * ring * 0.004).r;
  base.g = texture2D(tDiffuse, uv).g;
  base.b = texture2D(tDiffuse, uv - dir * ring * 0.004).b;
  vec3 bloom = texture2D(tBloom, uv).rgb;

  vec3 rays = vec3(0.0);
  if (uRuin.z > 0.0) {
    vec2 march = (uv - uRuin.xy) / 32.0;
    vec2 p = uv;
    float decay = 1.0;
    for (int i = 0; i < 32; i++) {
      p -= march;
      rays += texture2D(tBloom, p).rgb * decay;
      decay *= 0.93;
    }
    float flash = exp(-uFlash * 1.5) * uMotion;
    rays *= 0.02 * uRuin.z * (1.0 + 4.0 * flash);
  }

  vec3 color = base + bloom * uBloomStrength + rays * vec3(1.0, 0.85, 0.6);
  color += uPulseColor * ring * 0.3;
  color += vec3(1.0, 0.85, 0.55) * exp(-uFlash * 2.0) * 0.3 * uRuin.z * uMotion;

  float vig = smoothstep(0.95, 0.3, length((vUv - 0.5) * aspect));
  color *= mix(1.0, vig, 0.2 + 0.4 * uDepth);
  color = mix(color, color * vec3(0.88, 0.94, 1.1), uDepth * 0.45);
  gl_FragColor = vec4(color, 1.0);
}
`
