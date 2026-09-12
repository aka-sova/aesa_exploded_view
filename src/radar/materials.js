import * as THREE from 'three';

const std = (color, metalness, roughness, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });

const physical = (color, opacity) =>
  new THREE.MeshPhysicalMaterial({
    color, roughness: 0.35, metalness: 0.05, clearcoat: 1,
    transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
  });

// instanceColor only multiplies the diffuse term; this makes the emissive term follow it too,
// so the element/module colours glow instead of washing out under a flat white emissive.
function emissiveFollowsInstanceColor(shader) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance *= vColor;\n#endif',
  );
}

function recordBase(m) {
  m.userData.baseOpacity = m.opacity;
  m.userData.baseTransparent = m.transparent;
  m.userData.baseWireframe = m.wireframe;
  m.userData.baseDepthWrite = m.depthWrite;
  return m;
}

export function createMaterials() {
  const m = {
    silver: std(0xa9b0ba, 0.92, 0.3),
    titanium: std(0x848c96, 0.92, 0.36),
    dark: std(0x252b33, 0.88, 0.42),
    shell: std(0x4f586a, 0.9, 0.32),
    inner: std(0x2a303a, 0.8, 0.48),
    gold: std(0xb69a45, 0.87, 0.3),
    copper: std(0xb87333, 0.9, 0.35),
    coolant: std(0x3f8c88, 0.85, 0.35),
    pcb: std(0x1e3a2a, 0.3, 0.6),
    radome: physical(0xdfe6ee, 0.55),
    glass: physical(0xbfd8ff, 0.3),
    element: std(0xffffff, 0.2, 0.6, { emissive: 0xffffff, emissiveIntensity: 0.6 }),
    trm: std(0xffffff, 0.7, 0.4, { emissive: 0xffffff, emissiveIntensity: 0.35 }),
  };
  m.element.onBeforeCompile = emissiveFollowsInstanceColor;
  m.trm.onBeforeCompile = emissiveFollowsInstanceColor;
  for (const k in m) recordBase(m[k]);
  return m;
}
