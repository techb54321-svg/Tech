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
Shader "InsideTheSip/Flesh"
{
    Properties
    {
        _BaseMap ("Albedo", 2D) = "white" {}
        _BaseColor ("Tint", Color) = (0.85, 0.45, 0.42, 1)
        _BumpMap ("Normal Map", 2D) = "bump" {}
        _BumpScale ("Normal Strength", Range(0, 3)) = 1

        [Header(Wetness)]
        _SpecPower ("Gloss Power", Range(4, 256)) = 48
        _SpecIntensity ("Specular Intensity", Range(0, 3)) = 1.2

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

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #pragma multi_compile_fog

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "Packages/com.unity.render-pipelines.core/ShaderLibrary/Packing.hlsl"

            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
            TEXTURE2D(_BumpMap); SAMPLER(sampler_BumpMap);

            // Global heartbeat published by PulseDriver.cs — deliberately NOT
            // in the material CBUFFER so Shader.SetGlobalFloat reaches it.
            float _ITS_Pulse;

            CBUFFER_START(UnityPerMaterial)
                float4 _BaseMap_ST;
                half4 _BaseColor;
                half _BumpScale;
                half _SpecPower;
                half _SpecIntensity;
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

                // Travelling peristalsis squeeze + heartbeat swell, both along
                // the surface normal. Amplitudes are small, so we keep the
                // original normals (recomputing them isn't worth it on Quest).
                float wave = sin((IN.positionOS.y / max(_WaveLength, 0.001)
                    - _Time.y * _WaveSpeed) * 6.2831853);
                float displacement = wave * _WaveAmplitude + _ITS_Pulse * _PulseSwell;
                float3 positionOS = IN.positionOS.xyz + IN.normalOS * displacement;

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
                float3x3 tbn = float3x3(IN.tangentWS, IN.bitangentWS, IN.normalWS);
                float3 N = normalize(TransformTangentToWorld(normalTS, tbn));
                float3 V = normalize(GetWorldSpaceViewDir(IN.positionWS));

                Light mainLight = GetMainLight();
                float3 L = mainLight.direction;
                half3 lightColor = mainLight.color * mainLight.distanceAttenuation;

                // Wrap diffuse — soft, fleshy light falloff.
                half wrapped = saturate((dot(N, L) + _WrapAmount) / (1.0 + _WrapAmount));
                half3 diffuse = lightColor * wrapped;
                half3 ambient = SampleSH(N);

                // Fake translucency at silhouettes.
                half rim = pow(1.0 - saturate(dot(N, V)), _RimPower);
                half3 subsurface = rim * _SubsurfaceColor.rgb;

                // Wet mucosa highlight.
                float3 H = normalize(L + V);
                half3 specular = lightColor
                    * pow(saturate(dot(N, H)), _SpecPower) * _SpecIntensity;

                // Blood flush on each heartbeat.
                half3 emission = _EmissionColor.rgb
                    * (_EmissionBase + _PulseEmission * _ITS_Pulse);

                half3 color = albedo * (ambient + diffuse) + subsurface + specular + emission;
                color = MixFog(color, IN.fogFactor);
                return half4(color, 1);
            }
            ENDHLSL
        }
    }
    Fallback Off
}
