using System.Collections;
using UnityEngine;

namespace InsideTheSip
{
    /// Comfort tunnel-vignette + screen fade in one camera-locked overlay.
    ///
    /// Builds its own quad in front of the eye camera at runtime (no prefab
    /// needed) using the InsideTheSip/VignetteFade shader. The vignette
    /// tightens automatically with the rig's linear and angular speed — the
    /// single most effective motion-sickness mitigation for a rail ride.
    /// FadeTo() gives you black (or white) transitions for scene changes.
    [RequireComponent(typeof(Camera))]
    public class ComfortVignette : MonoBehaviour
    {
        [Header("Shader")]
        [Tooltip("Assign the InsideTheSip_VignetteFade shader asset here. A runtime Shader.Find is only a fallback — unreferenced shaders get STRIPPED from device builds, and the vignette would silently vanish on Quest.")]
        [SerializeField] Shader vignetteShader;

        [Header("Vignette")]
        [Tooltip("Transform whose motion drives the vignette. Usually the XR Origin root the JourneyDirector moves.")]
        public Transform motionSource;

        [Range(0f, 1f)] public float maxVignette = 0.65f;
        [Tooltip("Rig speed (m/s) at which the vignette reaches full strength. The ride's real peak hop speed at default JourneyDirector settings is ~1.2 m/s — keep this in that range or the vignette never truly engages.")]
        public float speedForMaxVignette = 1.2f;
        [Tooltip("Rig yaw speed (deg/s) at which the vignette reaches full strength.")]
        public float turnSpeedForMaxVignette = 45f;
        [Tooltip("How quickly the vignette eases in/out (per second).")]
        public float response = 4f;

        [Header("Overlay placement")]
        [Tooltip("Metres in front of the eyes. ZTest Always keeps it on top regardless, so keep this at arm's length: very close quads create heavy per-eye disparity and the tunnel edge double-images.")]
        public float overlayDistance = 0.75f;

        [Header("Fade")]
        public Color fadeColor = Color.black;
        [Tooltip("Duration used by the parameterless FadeToBlack()/FadeClear() helpers (those are wireable from UnityEvents in the Inspector; the two-argument FadeTo is not).")]
        public float defaultFadeDuration = 0.4f;

        Material material;
        MeshRenderer overlayRenderer;
        float vignette;
        float fade;
        Vector3 lastPosition;
        float lastYaw;
        Coroutine fadeRoutine;

        static readonly int FadeAmountId = Shader.PropertyToID("_FadeAmount");
        static readonly int VignetteAmountId = Shader.PropertyToID("_VignetteAmount");
        static readonly int ColorId = Shader.PropertyToID("_Color");

        public float CurrentFade => fade;

        void Start()
        {
            var cam = GetComponent<Camera>();

            Shader shader = vignetteShader != null
                ? vignetteShader
                : Shader.Find("InsideTheSip/VignetteFade");
            if (shader == null)
            {
                Debug.LogError("ComfortVignette: no shader. Assign the InsideTheSip_VignetteFade " +
                    "shader asset to the vignetteShader field (Shader.Find only works in the " +
                    "editor — the shader gets stripped from device builds unless referenced).");
                enabled = false;
                return;
            }
            material = new Material(shader);
            material.SetColor(ColorId, fadeColor);

            // A head-locked quad at arm's length (ZTest Always draws it over
            // everything, so it can sit at a comfortable vergence depth instead
            // of hugging the near plane). Sized to cover the widest headset FOV
            // with margin at any distance.
            float distance = Mathf.Max(overlayDistance, cam.nearClipPlane + 0.05f);
            float size = distance * 6f;

            var quad = GameObject.CreatePrimitive(PrimitiveType.Quad);
            quad.name = "ComfortVignetteOverlay";
            Destroy(quad.GetComponent<Collider>());
            quad.transform.SetParent(transform, false);
            quad.transform.localPosition = new Vector3(0f, 0f, distance);
            quad.transform.localRotation = Quaternion.identity;
            quad.transform.localScale = new Vector3(size, size, 1f);

            overlayRenderer = quad.GetComponent<MeshRenderer>();
            overlayRenderer.sharedMaterial = material;
            overlayRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            overlayRenderer.receiveShadows = false;

            if (motionSource == null && transform.root != null)
                motionSource = transform.root;
            if (motionSource != null)
            {
                lastPosition = motionSource.position;
                lastYaw = motionSource.eulerAngles.y;
            }
        }

        void LateUpdate()
        {
            if (material == null) return;

            float target = 0f;
            if (motionSource != null && Time.deltaTime > 0f)
            {
                float speed = (motionSource.position - lastPosition).magnitude / Time.deltaTime;
                float yaw = motionSource.eulerAngles.y;
                float turnSpeed = Mathf.Abs(Mathf.DeltaAngle(lastYaw, yaw)) / Time.deltaTime;
                lastPosition = motionSource.position;
                lastYaw = yaw;

                float fromSpeed = Mathf.Clamp01(speed / Mathf.Max(0.01f, speedForMaxVignette));
                float fromTurn = Mathf.Clamp01(turnSpeed / Mathf.Max(1f, turnSpeedForMaxVignette));
                target = maxVignette * Mathf.Max(fromSpeed, fromTurn);
            }

            vignette = Mathf.Lerp(vignette, target, 1f - Mathf.Exp(-response * Time.deltaTime));
            // Snap the exponential tail to zero so we don't keep blending an
            // invisible full-screen quad for a second after every hop.
            if (target <= 0f && vignette < 0.02f) vignette = 0f;
            material.SetFloat(VignetteAmountId, vignette);
            material.SetFloat(FadeAmountId, fade);

            // Skip drawing entirely when fully clear — saves fill rate on Quest.
            overlayRenderer.enabled = vignette > 0f || fade > 0.005f;
        }

        /// Fade the view toward `target` (0 = clear, 1 = fully covered).
        public void FadeTo(float target, float duration)
        {
            if (fadeRoutine != null) StopCoroutine(fadeRoutine);
            fadeRoutine = StartCoroutine(FadeRoutine(Mathf.Clamp01(target), Mathf.Max(0.01f, duration)));
        }

        /// Inspector-wireable helpers (UnityEvents can only pass one argument,
        /// so the two-argument FadeTo can't be wired directly).
        public void FadeToBlack() => FadeTo(1f, defaultFadeDuration);
        public void FadeClear() => FadeTo(0f, defaultFadeDuration);

        void OnDestroy()
        {
            if (material != null) Destroy(material);
        }

        IEnumerator FadeRoutine(float target, float duration)
        {
            float start = fade;
            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                fade = Mathf.Lerp(start, target, Mathf.Clamp01(elapsed / duration));
                yield return null;
            }
            fade = target;
            fadeRoutine = null;
        }
    }
}
