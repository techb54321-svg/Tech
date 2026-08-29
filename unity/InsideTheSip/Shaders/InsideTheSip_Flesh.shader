// The workhorse "living tissue" shader for every organic surface in the
// journey: mouth, esophagus, stomach, vessel walls, organs.
//
// What makes it read as *alive* on Quest, where true subsurface scattering
// is unaffordable:
//  - Wrap lighting: light bleeds past the terminator like lit flesh does.
//  - A rim "translucency" glow in a blood tone, so silhouettes feel backlit.
//  - Tight Blinn-Phong specular: mucous membranes are WET, and a sharp moving
//    highlight is the cheapest, strongest realism cue in VR.
//  - Everything throbs with the global heartbeat (_ITS_Pulse from
//    PulseDriver.cs): emission flushes and the surface physically swells.
//  - Optional peristalsis: a travelling squeeze wave along object-space Y —
//    model tubes (esophagus, intestine) with their length along local Y.
//    Keep amplitude + pulse swell comfortably below the tube radius minus the
//    ride path's clearance, or the wall will push through the user's face.
//
// A DepthOnly pass (with the SAME displaced vertices) keeps the mesh present
// under depth priming / _CameraDepthTexture. There is deliberately no
// ShadowCaster pass: on Quest this kit runs without realtime shadows.
Shader "InsideTheSip/Flesh"
{
    Properties
    {
        _BaseMap ("Albedo", 2D) = "white" {}
        _BaseColor ("Tint", Color) = (0.85, 0.45, 0.42, 1)
        _BumpMap ("Normal Map", 2D) = "bump" {}
        _BumpScale ("Normal Strength", Range(0, 3)) = 1

        [Header(Close up detail)]
        _DetailNormalMap ("Detail Normal", 2D) = "bump" {}
        _DetailTiling ("Detail Tiling", Range(1, 80)) = 22
        _DetailStrength ("Detail Strength", Range(0, 3)) = 1

        [Header(Mask   R equals AO   G equals wetness)]
        _MaskMap ("AO / Wetness Mask", 2D) = "white" {}
        _MaskTiling ("Mask Tiling", Range(0.25, 16)) = 2
        _OcclusionStrength ("Occlusion Strength", Range(0, 1)) = 0.85

        [Header(Wetness)]
        _SpecPower ("Gloss Power", Range(4, 256)) = 48
        _SpecIntensity ("Specular Intensity", Range(0, 3)) = 1.2
        _SpecVariation ("Wetness Variation", Range(0, 1)) = 0.8

        [Header(Translucency)]
        _WrapAmount ("Light Wrap", Range(0, 1)) = 0.5
        _SubsurfaceColor ("Subsurface Rim Color", Color) = (0.9, 0.15, 0.1, 1)
        _RimPower ("Rim Power", Range(0.5, 8)) = 2.5

        [Header(Heartbeat)]
        _EmissionColor ("Emission Color", Color) = (0.6, 0.05, 0.03, 1)
        _EmissionBase ("Emission Base", Range(0, 2)) = 0.15
        _PulseEmission ("Emission Per Pulse", Range(0, 4)) = 0.6
        _PulseSwell ("Swell Per Pulse (m)", Range(0, 0.1)) = 0.008

        [Header(Peristalsis along local Y)]
        _WaveAmplitude ("Wave Amplitude (m)", Range(0, 0.5)) = 0
        _WaveLength ("Wave Length (m)", Range(0.05, 10)) = 1.5
        _WaveSpeed ("Wave Speed", Range(-5, 5)) = 0.8
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

        TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
        TEXTURE2D(_BumpMap); SAMPLER(sampler_BumpMap);
        TEXTURE2D(_DetailNormalMap); SAMPLER(sampler_DetailNormalMap);
        TEXTURE2D(_MaskMap); SAMPLER(sampler_MaskMap);

        // Global heartbeat published by PulseDriver.cs — deliberately NOT
        // in the material CBUFFER so Shader.SetGlobalFloat reaches it.
        float _ITS_Pulse;

        CBUFFER_START(UnityPerMaterial)
            float4 _BaseMap_ST;
            half4 _BaseColor;
            half _BumpScale;
            half _DetailTiling;
            half _DetailStrength;
            half _MaskTiling;
            half _OcclusionStrength;
            half _SpecPower;
            half _SpecIntensity;
            half _SpecVariation;
            half _WrapAmount;
            half4 _SubsurfaceColor;
            half _RimPower;
            half4 _EmissionColor;
            half _EmissionBase;
            half _PulseEmission;
            half _PulseSwell;
            half _WaveAmplitude;
            half _WaveLength;
            half _WaveSpeed;
        CBUFFER_END

        // Travelling peristalsis squeeze + heartbeat swell, both along the
        // surface normal. Every pass MUST use this same function or animated
        // geometry falls out of sync with its own depth. Amplitudes are small,
        // so we keep the original normals (recomputing isn't worth it on Quest).
        float3 DisplaceFlesh(float3 positionOS, float3 normalOS)
        {
            float wave = sin((positionOS.y / max(_WaveLength, 0.001)
                - _Time.y * _WaveSpeed) * 6.2831853);
            float displacement = wave * _WaveAmplitude + _ITS_Pulse * _PulseSwell;
            return positionOS + normalOS * displacement;
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

                float3 positionOS = DisplaceFlesh(IN.positionOS.xyz, IN.normalOS);

                VertexPositionInputs posInputs = GetVertexPositionInputs(positionOS);
                VertexNormalInputs normInputs = GetVertexNormalInputs(IN.normalOS, IN.tangentOS);

                OUT.positionHCS = posInputs.positionCS;
                OUT.positionWS = posInputs.positionWS;
                OUT.normalWS = normInputs.normalWS;
                OUT.tangentWS = normInputs.tangentWS;
                OUT.bitangentWS = normInputs.bitangentWS;
                OUT.uv = TRANSFORM_TEX(IN.uv, _BaseMap);
                OUT.fogFactor = ComputeFogFactor(posInputs.positionCS.z);
                return OUT;
            }

            half4 frag (Varyings IN) : SV_Target
            {
                UNITY_SETUP_INSTANCE_ID(IN);
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(IN);

                half3 albedo = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, IN.uv).rgb
                    * _BaseColor.rgb;

                half3 normalTS = UnpackNormalScale(
                    SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, IN.uv), _BumpScale);

                // Detail normal at high tiling. Without this, surfaces are
                // smooth and featureless once your face is 20cm from them —
                // which in VR is most of the time, and reads as plastic.
                half3 detailTS = UnpackNormalScale(
                    SAMPLE_TEXTURE2D(_DetailNormalMap, sampler_DetailNormalMap,
                        IN.uv * _DetailTiling), _DetailStrength);
                // Whiteout blend: keeps both sets of bumps instead of one
                // flattening the other.
                normalTS = normalize(half3(normalTS.xy + detailTS.xy,
                    normalTS.z * detailTS.z));

                float3x3 tbn = float3x3(IN.tangentWS, IN.bitangentWS, IN.normalWS);
                float3 N = normalize(TransformTangentToWorld(normalTS, tbn));
                float3 V = normalize(GetWorldSpaceViewDir(IN.positionWS));

                half2 mask = SAMPLE_TEXTURE2D(_MaskMap, sampler_MaskMap,
                    IN.uv * _MaskTiling).rg;
                half occlusion = lerp(1.0, mask.r, _OcclusionStrength);
                half wetness = mask.g;

                Light mainLight = GetMainLight();
                float3 L = mainLight.direction;
                half3 lightColor = mainLight.color * mainLight.distanceAttenuation;

                // Wrap diffuse — soft, fleshy light falloff.
                half wrapped = saturate((dot(N, L) + _WrapAmount) / (1.0 + _WrapAmount));
                half3 diffuse = lightColor * wrapped;
                // Ambient is what crevices see, so occlusion belongs here
                // most of all — this is what gives folds their depth.
                half3 ambient = SampleSH(N) * occlusion;

                // Fake translucency at silhouettes.
                half rim = pow(1.0 - saturate(dot(N, V)), _RimPower);
                half3 subsurface = rim * _SubsurfaceColor.rgb;

                // Wet mucosa highlight. Real tissue is not uniformly wet:
                // pooled saliva glints hard while drier patches stay dull.
                // A single constant gloss over a whole surface is the single
                // biggest "this is plastic" giveaway.
                float3 H = normalize(L + V);
                half wetLerp = lerp(1.0 - _SpecVariation, 1.0, wetness);
                half gloss = _SpecPower * lerp(0.35, 1.0, wetLerp);
                half3 specular = lightColor * pow(saturate(dot(N, H)), gloss)
                    * _SpecIntensity * wetLerp * occlusion;

                // Blood flush on each heartbeat.
                half3 emission = _EmissionColor.rgb
                    * (_EmissionBase + _PulseEmission * _ITS_Pulse);

                half3 color = albedo * (ambient + diffuse)
                    + subsurface * occlusion + specular + emission;
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
                float3 positionOS = DisplaceFlesh(IN.positionOS.xyz, IN.normalOS);
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
