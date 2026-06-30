import { Color, DoubleSide, ShaderMaterial, type IUniform } from 'three'

// ---------------------------------------------------------------------------
// Cola fluid — a translucent caramel sheet that pours down over the enamel
// cliffs and pools in the grooves.
//
// It is a single custom ShaderMaterial (cheap, one draw call per surface):
//   • uFill (0..1) reveals the liquid top-down, so it cascades in during FLOOD
//   • a scrolling fbm flow-map gives moving caramel streaks and surface sheen
//   • a fresnel rim fakes translucency/refraction without a real refraction
//     pass (which won't hold framerate on Quest — see the brief's "fake it")
// ---------------------------------------------------------------------------

export interface FluidUniforms {
  uTime: IUniform<number>
  uFill: IUniform<number>
  uColor: IUniform<Color>
  uOpacity: IUniform<number>
}

const FLUID_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  uniform float uTime;
  void main(){
    vUv = uv;
    vec3 p = position;
    // Gentle surface swell so the sheet looks like moving liquid, not a decal.
    p += normal * sin(p.y*8.0 + uTime*3.0) * 0.006;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorldPos = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const FLUID_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  uniform float uTime;
  uniform float uFill;
  uniform vec3  uColor;
  uniform float uOpacity;

  float hash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float vnoise(vec3 x){
    vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5; } return s; }

  void main(){
    // Top-down fill: liquid appears at the top and the front descends as uFill
    // rises (vUv.y == 1 is the top of the sheet, the pour source).
    float front = 1.0 - uFill;
    if (vUv.y < front - 0.04) discard;                       // not yet reached
    float lead = 1.0 - smoothstep(front - 0.04, front + 0.04, vUv.y); // pour front

    // Flowing caramel streaks scrolling downward.
    float flow = fbm(vec3(vUv * vec2(6.0, 10.0), 0.0) + vec3(0.0, -uTime*0.6, uTime*0.1));
    vec3 base = uColor * (0.5 + 0.6*flow);

    // Fresnel rim → translucent caramel glow at grazing angles.
    float fres = pow(1.0 - max(dot(vNormalW, vViewDir), 0.0), 3.0);
    base += uColor * fres * 1.2;
    // Wet specular glints riding the flow.
    float glint = smoothstep(0.7, 1.0, flow) * 0.6;
    base += vec3(1.0, 0.85, 0.6) * glint;

    // Brighten the cascading leading edge (the pour front).
    base += vec3(0.9, 0.6, 0.35) * lead * 0.8;

    float alpha = uOpacity * (0.6 + 0.4*flow) * (0.55 + 0.45*lead);
    gl_FragColor = vec4(base, clamp(alpha, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createFluidMaterial(): { material: ShaderMaterial; uniforms: FluidUniforms } {
  const uniforms: FluidUniforms = {
    uTime: { value: 0 },
    uFill: { value: 0 },
    uColor: { value: new Color('#3a1d0e') }, // dark caramel cola
    uOpacity: { value: 0.85 },
  }

  const material = new ShaderMaterial({
    vertexShader: FLUID_VERT,
    fragmentShader: FLUID_FRAG,
    uniforms: uniforms as unknown as { [k: string]: IUniform },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  })

  return { material, uniforms }
}
