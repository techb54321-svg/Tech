// Head-locked comfort vignette + screen fade overlay for VR.
// Used by ComfortVignette.cs on a quad parented to the eye camera.
// Fully URP + single-pass-instanced (Multiview) safe.
Shader "InsideTheSip/VignetteFade"
{
    Properties
    {
        _Color ("Fade Color", Color) = (0, 0, 0, 1)
        _FadeAmount ("Fade Amount", Range(0, 1)) = 0
        _VignetteAmount ("Vignette Amount", Range(0, 1)) = 0
        _VignetteSoftness ("Vignette Softness", Range(0.01, 1)) = 0.35
    }

    SubShader
    {
        Tags
        {
            "RenderType" = "Transparent"
            "Queue" = "Overlay"
            "RenderPipeline" = "UniversalPipeline"
            "IgnoreProjector" = "True"
        }

        Pass
        {
            Name "VignetteFade"
            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite Off
            ZTest Always
            Cull Off

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                float2 uv : TEXCOORD0;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct Varyings
            {
                float4 positionHCS : SV_POSITION;
                float2 uv : TEXCOORD0;
                UNITY_VERTEX_OUTPUT_STEREO
            };

            CBUFFER_START(UnityPerMaterial)
                half4 _Color;
                half _FadeAmount;
                half _VignetteAmount;
                half _VignetteSoftness;
            CBUFFER_END

            Varyings vert (Attributes IN)
            {
                Varyings OUT;
                UNITY_SETUP_INSTANCE_ID(IN);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(OUT);
                OUT.positionHCS = TransformObjectToHClip(IN.positionOS.xyz);
                OUT.uv = IN.uv;
                return OUT;
            }

            half4 frag (Varyings IN) : SV_Target
            {
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(IN);

                // 0 at quad centre, 1 at edge midpoints, ~1.41 in the corners.
                half d = length(IN.uv - 0.5) * 2.0;

                // The clear opening shrinks from off-screen (1.3) to a tight
                // tunnel (0.35) as _VignetteAmount rises; edge stays soft.
                half edge = lerp(1.3, 0.35, _VignetteAmount);
                half vignette = smoothstep(edge - _VignetteSoftness, edge, d);
                vignette *= saturate(_VignetteAmount * 8.0);

                half alpha = max(vignette, _FadeAmount) * _Color.a;
                return half4(_Color.rgb, alpha);
            }
            ENDHLSL
        }
    }
    Fallback Off
}
