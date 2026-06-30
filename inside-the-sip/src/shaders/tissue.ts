import { Color, MeshStandardMaterial, type IUniform } from 'three'

// ---------------------------------------------------------------------------
// Oral tissue (the tongue and surrounding flesh): wet, translucent, fleshy.
//
// True subsurface scattering won't hold 72 fps on Quest, so we fake it (per the
// brief): a real PBR MeshStandardMaterial patched with
//   • a cheap wrap-lighting / translucency tint added to the albedo (the warm
//     "light bleeding through flesh" glow)
//   • a moving saliva-film glint (animated fbm gated by a fresnel term) so the
//     surface always looks freshly wet and slick.
// ---------------------------------------------------------------------------

export interface TissueUniforms {
  uTime: IUniform<number>
  uWet: IUniform<number> // strength of the moving saliva sheen
}

const NOISE_GLSL = /* glsl */ `
  float thash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float tnoise(vec3 x){
    vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(thash(i),thash(i+vec3(1,0,0)),f.x),mix(thash(i+vec3(0,1,0)),thash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(thash(i+vec3(0,0,1)),thash(i+vec3(1,0,1)),f.x),mix(thash(i+vec3(0,1,1)),thash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float tfbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*tnoise(p); p*=2.03; a*=0.5; } return s; }
`

export function createTissueMaterial(color = '#c25666'): {
  material: MeshStandardMaterial
  uniforms: TissueUniforms
} {
  const uniforms: TissueUniforms = {
    uTime: { value: 0 },
    uWet: { value: 1 },
  }

  const material = new MeshStandardMaterial({
    color: new Color(color),
    roughness: 0.45,
    metalness: 0.0,
    envMapIntensity: 1.1,
    emissive: new Color('#3a0a14'),
    emissiveIntensity: 0.25,
  })

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime
    shader.uniforms.uWet = uniforms.uWet

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        varying vec3 vTWorld;
        varying vec3 vTViewDir;
        varying vec3 vTLocal;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        /* glsl */ `#include <worldpos_vertex>
        vec4 twp = modelMatrix * vec4(transformed, 1.0);
        vTWorld = twp.xyz;
        vTViewDir = normalize(cameraPosition - twp.xyz);
        vTLocal = position;`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uTime;
        uniform float uWet;
        varying vec3 vTWorld;
        varying vec3 vTViewDir;
        varying vec3 vTLocal;
        ${NOISE_GLSL}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        // Fake translucency: warm light bleeding through thin flesh.
        float fres = pow(1.0 - max(dot(normal, vTViewDir), 0.0), 2.0);
        totalEmissiveRadiance += vec3(0.6, 0.12, 0.18) * fres * 0.35;
        // Moving saliva film: animated glints that ride over the surface.
        float film = tfbm(vTLocal * 22.0 + vec3(0.0, -uTime*0.4, uTime*0.2));
        float glint = smoothstep(0.72, 1.0, film) * fres * uWet;
        totalEmissiveRadiance += vec3(1.0, 0.9, 0.92) * glint * 0.8;`,
      )
  }

  return { material, uniforms }
}
