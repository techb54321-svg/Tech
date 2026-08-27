// The cola/acid liquid: stomach pool, mouth wash, swallowed slug.
// Two counter-scrolling normal layers give a live, churning surface; a
// fresnel term brightens grazing angles like a real liquid film; emission
// breathes with the heartbeat so the pool feels like part of the body's
// rhythm. Transparent, ZWrite off — place over an opaque basin mesh, and
// keep the pool's on-screen coverage modest: transparent pixels pay full
// overdraw on Quest's tiled GPU. Cull is off so the surface stays visible
// if the ride path dips through it (mouth wash, the swallowed slug).
Shader "InsideTheSip/AcidLiquid"
{
    Properties
    {
        _DeepColor ("Deep Color", Color) = (0.13, 0.05, 0.01, 0.95)
        _ShallowColor ("Grazing Color", Color) = (0.85, 0.4, 0.08, 1)
        _NormalMap ("Ripple Normal Map", 2D) = "bump" {}
        _NormalScale ("Ripple Strength", Range(0, 3)) = 1
        _Scroll1 ("Layer 1 Scroll (xy) Tiling (z)", Vector) = (0.03, 0.02, 1, 0)
        _Scroll2 ("Layer 2 Scroll (xy) Tiling (z)", Vector) = (-0.02, 0.04, 2.3, 0)

        _FresnelPower ("Fresnel Power", Range(0.5, 8)) = 3
        // Very high gloss powers alias into a shimmering sparkle in VR; ~96
        // still reads as liquid-sharp through MSAA without the crawl.
        _SpecPower ("Gloss Power", Range(8, 512)) = 96
        _SpecIntensity ("Specular Intensity", Range(0, 4)) = 1.6

        _EmissionColor ("Emission Color", Color) = (0.5, 0.18, 0.02, 1)
        _EmissionStrength ("Emission Strength", Range(0, 3)) = 0.4
        _PulseEmission ("Emission Per Pulse", Range(0, 3)) = 0.5

        _WaveHeight ("Wave Height (m)", Range(0, 0.3)) = 0.03
        _WaveFrequency ("Wave Frequency", Range(0.1, 10)) = 1.6
        _Opacity ("Base Opacity", Range(0, 1)) = 0.85
    }

    SubShader
    {
        Tags
        {
            "RenderType" = "Transparent"
            "Queue" = "Transparent"
            "RenderPipeline" = "UniversalPipeline"
            "IgnoreProjector" = "True"
        }

        Pass
        {
            Name "AcidForward"
            Tags { "LightMode" = "UniversalForward" }
            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite Off
            Cull Off

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #pragma multi_compile_fog

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "Packages/com.unity.render-pipelines.core/ShaderLibrary/Packing.hlsl"

            TEXTURE2D(_NormalMap); SAMPLER(sampler_NormalMap);

            float _ITS_Pulse; // global heartbeat from PulseDriver.cs

            CBUFFER_START(UnityPerMaterial)
                half4 _DeepColor;
                half4 _ShallowColor;
                half _NormalScale;
                float4 _Scroll1;
                float4 _Scroll2;
                half _FresnelPower;
                half _SpecPower;
                half _SpecIntensity;
                half4 _EmissionColor;
                half _EmissionStrength;
                half _PulseEmission;
                half _WaveHeight;
                half _WaveFrequency;
                half _Opacity;
            CBUFFER_END

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

                // Gentle interfering swells across the pool surface.
                float t = _Time.y;
                float swell = sin(IN.positionOS.x * _WaveFrequency + t * 1.1)
                            * cos(IN.positionOS.z * _WaveFrequency * 0.8 + t * 1.4);
                float3 positionOS = IN.positionOS.xyz
                    + IN.normalOS * (swell * _WaveHeight);

                VertexPositionInputs posInputs = GetVertexPositionInputs(positionOS);
                VertexNormalInputs normInputs = GetVertexNormalInputs(IN.normalOS, IN.tangentOS);

                OUT.positionHCS = posInputs.positionCS;
                OUT.positionWS = posInputs.positionWS;
                OUT.normalWS = normInputs.normalWS;
                OUT.tangentWS = normInputs.tangentWS;
                OUT.bitangentWS = normInputs.bitangentWS;
                OUT.uv = IN.uv;
                OUT.fogFactor = ComputeFogFactor(posInputs.positionCS.z);
                return OUT;
            }

            half4 frag (Varyings IN) : SV_Target
            {
                UNITY_SETUP_INSTANCE_ID(IN);
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(IN);

                float t = _Time.y;
                float2 uv1 = IN.uv * _Scroll1.z + _Scroll1.xy * t;
                float2 uv2 = IN.uv * _Scroll2.z + _Scroll2.xy * t;

                half3 n1 = UnpackNormalScale(
                    SAMPLE_TEXTURE2D(_NormalMap, sampler_NormalMap, uv1), _NormalScale);
                half3 n2 = UnpackNormalScale(
                    SAMPLE_TEXTURE2D(_NormalMap, sampler_NormalMap, uv2), _NormalScale);
                half3 normalTS = normalize(half3(n1.xy + n2.xy, n1.z * n2.z));

                float3x3 tbn = float3x3(IN.tangentWS, IN.bitangentWS, IN.normalWS);
                float3 N = normalize(TransformTangentToWorld(normalTS, tbn));
                float3 V = normalize(GetWorldSpaceViewDir(IN.positionWS));

                half fresnel = pow(1.0 - saturate(dot(N, V)), _FresnelPower);
                half3 color = lerp(_DeepColor.rgb, _ShallowColor.rgb, fresnel);

                Light mainLight = GetMainLight();
                float3 H = normalize(mainLight.direction + V);
                half3 specular = mainLight.color
                    * pow(saturate(dot(N, H)), _SpecPower) * _SpecIntensity;

                half3 emission = _EmissionColor.rgb
                    * (_EmissionStrength + _PulseEmission * _ITS_Pulse);

                color += specular + emission;
                half alpha = saturate(_Opacity + fresnel * 0.2) * _DeepColor.a;

                color = MixFog(color, IN.fogFactor);
                return half4(color, alpha);
            }
            ENDHLSL
        }
    }
    Fallback Off
}
