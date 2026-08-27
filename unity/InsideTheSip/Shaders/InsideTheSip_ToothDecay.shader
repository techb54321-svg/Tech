// Enamel-erosion shader: blends a healthy tooth surface into a stained,
// eroded one under an animated noise mask, with a discoloured "attack ring"
// at the erosion front and the wet enamel gloss dying off as decay spreads.
// The surface also physically recedes along its normals — up close in VR you
// can *see* material being lost, which sells the effect far more than a
// colour change alone.
//
// Drive the _Erosion property (0 = healthy, 1 = fully eroded) from
// ToothDecayController.cs.
//
// One _ST (tiling/offset) is shared from the Healthy Albedo slot across all
// four maps — the Tiling/Offset fields on the other slots are intentionally
// unused. A DepthOnly pass with the SAME recession keeps the teeth present
// under depth priming / _CameraDepthTexture; no ShadowCaster by design
// (this kit runs without realtime shadows on Quest).
Shader "InsideTheSip/ToothDecay"
{
    Properties
    {
        _HealthyMap ("Healthy Albedo", 2D) = "white" {}
        _DecayMap ("Decayed Albedo", 2D) = "gray" {}
        _BumpMap ("Normal Map", 2D) = "bump" {}
        _BumpScale ("Normal Strength", Range(0, 2)) = 1
        _NoiseMap ("Erosion Noise (R)", 2D) = "gray" {}

        _Erosion ("Erosion", Range(0, 1)) = 0
        _EdgeWidth ("Erosion Edge Width", Range(0.01, 0.5)) = 0.12
        _EdgeColor ("Erosion Edge Tint", Color) = (0.45, 0.29, 0.1, 0.85)
        _StainTint ("Decay Stain Tint", Color) = (0.9, 0.78, 0.55, 1)
        _RecessionDepth ("Surface Recession (m)", Range(0, 0.02)) = 0.003

        _HealthyGloss ("Healthy Gloss Power", Range(4, 256)) = 96
        _DecayGloss ("Decayed Gloss Power", Range(1, 64)) = 6
        _SpecIntensity ("Specular Intensity", Range(0, 2)) = 0.8
    }

    SubShader
    {
        Tags
        {
            "RenderType" = "Opaque"
            "Queue" = "Geometry"
            "RenderPipeline" = "UniversalPipeline"
        }

        HLSLINCLUDE
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

        TEXTURE2D(_HealthyMap);  SAMPLER(sampler_HealthyMap);
        TEXTURE2D(_DecayMap);    SAMPLER(sampler_DecayMap);
        TEXTURE2D(_BumpMap);     SAMPLER(sampler_BumpMap);
        TEXTURE2D(_NoiseMap);    SAMPLER(sampler_NoiseMap);

        CBUFFER_START(UnityPerMaterial)
            float4 _HealthyMap_ST;
            half _BumpScale;
            half _Erosion;
            half _EdgeWidth;
            half4 _EdgeColor;
            half4 _StainTint;
            half _RecessionDepth;
            half _HealthyGloss;
            half _DecayGloss;
            half _SpecIntensity;
        CBUFFER_END

        // 0 = healthy, 1 = decayed, sweeping through the noise mask so
        // erosion creeps across the surface instead of fading uniformly.
        half DecayBlend(half noise)
        {
            half t = _Erosion * (1.0 + _EdgeWidth) - noise;
            return saturate(t / _EdgeWidth);
        }

        // Sink the surface where it has eroded (small values — enough to read
        // as pitting at VR close-up scale). Every pass MUST use this same
        // function so the animated recession matches its own depth.
        float3 RecedeTooth(float3 positionOS, float3 normalOS, float2 uv)
        {
            half noise = SAMPLE_TEXTURE2D_LOD(_NoiseMap, sampler_NoiseMap, uv, 0).r;
            return positionOS - normalOS * (_RecessionDepth * DecayBlend(noise));
        }
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #pragma multi_compile_fog

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "Packages/com.unity.render-pipelines.core/ShaderLibrary/Packing.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float4 tangentOS : TANGENT;
                float2 uv : TEXCOORD0;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct Varyings
            {
                float4 positionHCS : SV_POSITION;
                float2 uv : TEXCOORD0;
                float3 positionWS : TEXCOORD1;
                float3 normalWS : TEXCOORD2;
                float3 tangentWS : TEXCOORD3;
                float3 bitangentWS : TEXCOORD4;
                float fogFactor : TEXCOORD5;
                UNITY_VERTEX_INPUT_INSTANCE_ID
                UNITY_VERTEX_OUTPUT_STEREO
            };

            Varyings vert (Attributes IN)
            {
                Varyings OUT;
                UNITY_SETUP_INSTANCE_ID(IN);
                UNITY_TRANSFER_INSTANCE_ID(IN, OUT);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(OUT);

                float2 uv = TRANSFORM_TEX(IN.uv, _HealthyMap);
                float3 positionOS = RecedeTooth(IN.positionOS.xyz, IN.normalOS, uv);

                VertexPositionInputs posInputs = GetVertexPositionInputs(positionOS);
                VertexNormalInputs normInputs = GetVertexNormalInputs(IN.normalOS, IN.tangentOS);

                OUT.positionHCS = posInputs.positionCS;
                OUT.positionWS = posInputs.positionWS;
                OUT.normalWS = normInputs.normalWS;
                OUT.tangentWS = normInputs.tangentWS;
                OUT.bitangentWS = normInputs.bitangentWS;
                OUT.uv = uv;
                OUT.fogFactor = ComputeFogFactor(posInputs.positionCS.z);
                return OUT;
            }

            half4 frag (Varyings IN) : SV_Target
            {
                UNITY_SETUP_INSTANCE_ID(IN);
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(IN);

                half noise = SAMPLE_TEXTURE2D(_NoiseMap, sampler_NoiseMap, IN.uv).r;
                half blend = DecayBlend(noise);
                half edgeBand = blend * (1.0 - blend) * 4.0; // peaks at the erosion front

                half3 healthy = SAMPLE_TEXTURE2D(_HealthyMap, sampler_HealthyMap, IN.uv).rgb;
                half3 decayed = SAMPLE_TEXTURE2D(_DecayMap, sampler_DecayMap, IN.uv).rgb * _StainTint.rgb;
                half3 albedo = lerp(healthy, decayed, blend);
                albedo = lerp(albedo, _EdgeColor.rgb, edgeBand * _EdgeColor.a);

                half3 normalTS = UnpackNormalScale(
                    SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, IN.uv), _BumpScale);
                float3x3 tbn = float3x3(IN.tangentWS, IN.bitangentWS, IN.normalWS);
                float3 N = normalize(TransformTangentToWorld(normalTS, tbn));
                float3 V = normalize(GetWorldSpaceViewDir(IN.positionWS));

                Light mainLight = GetMainLight();
                float3 L = mainLight.direction;
                half3 lightColor = mainLight.color * mainLight.distanceAttenuation;

                half ndotl = saturate(dot(N, L));
                half3 diffuse = lightColor * ndotl;
                half3 ambient = SampleSH(N);

                // Wet enamel is glossy; decay turns it chalky and matte.
                half glossPower = lerp(_HealthyGloss, _DecayGloss, blend);
                half specStrength = _SpecIntensity * lerp(1.0, 0.25, blend);
                float3 H = normalize(L + V);
                half3 specular = lightColor * pow(saturate(dot(N, H)), glossPower) * specStrength;

                half3 color = albedo * (ambient + diffuse) + specular;
                color = MixFog(color, IN.fogFactor);
                return half4(color, 1);
            }
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode" = "DepthOnly" }
            ZWrite On
            ColorMask R

            HLSLPROGRAM
            #pragma vertex depthVert
            #pragma fragment depthFrag
            #pragma multi_compile_instancing

            struct DepthAttributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float2 uv : TEXCOORD0;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct DepthVaryings
            {
                float4 positionHCS : SV_POSITION;
                UNITY_VERTEX_OUTPUT_STEREO
            };

            DepthVaryings depthVert (DepthAttributes IN)
            {
                DepthVaryings OUT;
                UNITY_SETUP_INSTANCE_ID(IN);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(OUT);
                float2 uv = TRANSFORM_TEX(IN.uv, _HealthyMap);
                float3 positionOS = RecedeTooth(IN.positionOS.xyz, IN.normalOS, uv);
                OUT.positionHCS = TransformObjectToHClip(positionOS);
                return OUT;
            }

            half depthFrag (DepthVaryings IN) : SV_Target
            {
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(IN);
                return 0;
            }
            ENDHLSL
        }
    }
    Fallback Off
}
