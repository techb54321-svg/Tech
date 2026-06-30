import { Color, MeshPhysicalMaterial, type IUniform } from 'three'

// ---------------------------------------------------------------------------
// Enamel material — the hero of the whole sequence.
//
// It is a real PBR MeshPhysicalMaterial (so it picks up the baked environment
// map for that wet, glassy, clearcoated look) patched via onBeforeCompile with
// a single driver uniform `uErosion` (0 → 1). As erosion rises:
//
//   • roughness climbs           glossy → matte → frosted
//   • a noise-masked pitting     organic, uneven micro-craters
//   • vertices push INWARD       the surface visibly recedes
//   • thin dark cracks spider    ridged-noise fracture lines
//   • the outer shell DISSOLVES  fresnel+noise edge, chunks slough away,
//                                revealing the (separate) dentin mesh beneath
//
// Everything is one mesh animated by uniforms — no per-frame mesh swaps — which
// is the Quest-friendly approach the brief calls for.
// ---------------------------------------------------------------------------

export interface EnamelUniforms {
  uErosion: IUniform<number>
  uTime: IUniform<number>
  uDentin: IUniform<Color>
}

// Compact value-noise + fbm + ridged noise, shared by vertex and fragment.
const NOISE_GLSL = /* glsl */ `
  float hash(vec3 p){
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 x){
    vec3 i = floor(x); vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p){
    float a = 0.5, s = 0.0;
    for(int i=0;i<4;i++){ s += a*vnoise(p); p *= 2.02; a *= 0.5; }
    return s;
  }
  float ridged(vec3 p){ return 1.0 - abs(2.0*fbm(p)-1.0); }
`

export function createEnamelMaterial(): { material: MeshPhysicalMaterial; uniforms: EnamelUniforms } {
  const uniforms: EnamelUniforms = {
    uErosion: { value: 0 },
    uTime: { value: 0 },
    uDentin: { value: new Color('#d8c08a') }, // yellower dentin tone
  }

  const material = new MeshPhysicalMaterial({
    color: new Color('#f6f3ec'),
    roughness: 0.12,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    sheen: 0.5,
    sheenColor: new Color('#fff6ec'),
    sheenRoughness: 0.4,
    envMapIntensity: 1.5,
    // a touch of translucency for the wet enamel look
    transmission: 0.0,
    ior: 1.55,
  })
  // Render both sides once chunks dissolve away and we can see in.
  material.transparent = false

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uErosion = uniforms.uErosion
    shader.uniforms.uTime = uniforms.uTime
    shader.uniforms.uDentin = uniforms.uDentin

    // --- VERTEX ---------------------------------------------------------
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uErosion;
        uniform float uTime;
        varying float vErode;     // 0..1 how attacked this point is
        varying vec3  vLocalPos;
        ${NOISE_GLSL}`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        vLocalPos = position;
        // Uneven susceptibility: low areas / grooves erode first.
        float mask = fbm(position * 3.2);
        float pit  = fbm(position * 12.0 + 7.0);
        // How much THIS vertex has been eaten away (organic, non-uniform).
        float erode = smoothstep(0.15, 1.0, uErosion * (0.55 + 0.9 * mask));
        vErode = erode;
        // Recede inward along the normal, plus fine pitting jitter.
        float recess = erode * 0.06 + erode * pit * 0.03;
        transformed -= normal * recess;`,
      )

    // --- FRAGMENT -------------------------------------------------------
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uErosion;
        uniform float uTime;
        uniform vec3  uDentin;
        varying float vErode;
        varying vec3  vLocalPos;
        ${NOISE_GLSL}`,
      )
      // Frosted/dentin albedo + sloughing dissolve (run early so later PBR
      // chunks see the modified roughness via a varying-free global).
      .replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
        // Dissolve: where the erosion mask exceeds a receding threshold the
        // outer enamel has sloughed off — discard it so the dentin mesh
        // underneath shows through. A thin band near the cut glows (hot edge).
        float dnoise = fbm(vLocalPos * 9.0 + uTime * 0.05);
        float cut = vErode * (0.85 + 0.3 * dnoise);
        if (cut > 0.92) discard;
        float edge = smoothstep(0.78, 0.92, cut);

        // Glossy → matte → frosted: desaturate toward a chalky white as acid
        // etches the surface, then blend toward dentin where it's deeply eaten.
        vec3 frosted = mix(diffuseColor.rgb, vec3(0.93,0.92,0.88), smoothstep(0.0,0.5,uErosion)*0.7);
        vec3 dentin  = uDentin;
        diffuseColor.rgb = mix(frosted, dentin, smoothstep(0.45,0.95,vErode));

        // Cracks: thin dark ridged lines that spider outward as it erodes.
        float cr = ridged(vLocalPos * 14.0);
        float crack = smoothstep(0.92, 1.0, cr) * smoothstep(0.25, 0.8, uErosion);
        diffuseColor.rgb *= (1.0 - 0.7 * crack);

        // Hot dissolving edge (subtle warm rim where chunks break away).
        diffuseColor.rgb += vec3(1.0,0.55,0.2) * edge * 0.6;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        // Polished → matte. Pitting adds extra micro-roughness.
        float pitR = fbm(vLocalPos * 16.0);
        roughnessFactor = clamp(roughnessFactor + uErosion * (0.65 + 0.3*pitR) + vErode*0.2, 0.04, 1.0);`,
      )
    // NOTE: the wet clearcoat sheen is faded out from JS (material.clearcoat =
    // 1 - erosion) in the ErosionController — `clearcoat` is a read-only
    // uniform in the shader and can't be assigned there.
  }

  return { material, uniforms }
}
