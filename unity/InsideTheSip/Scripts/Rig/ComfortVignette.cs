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
        [Header("Vignette")]
        [Tooltip("Transform whose motion drives the vignette. Usually the XR Origin root the JourneyDirector moves.")]
        public Transform motionSource;

        [Range(0f, 1f)] public float maxVignette = 0.65f;
        [Tooltip("Rig speed (m/s) at which the vignette reaches full strength.")]
        public float speedForMaxVignette = 3f;
        [Tooltip("Rig yaw speed (deg/s) at which the vignette reaches full strength.")]
        public float turnSpeedForMaxVignette = 60f;
        [Tooltip("How quickly the vignette eases in/out (per second).")]
        public float response = 4f;

        [Header("Fade")]
        public Color fadeColor = Color.black;

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

            Shader shader = Shader.Find("InsideTheSip/VignetteFade");
            if (shader == null)
            {
                Debug.LogError("ComfortVignette: shader 'InsideTheSip/VignetteFade' not found. " +
                    "Ensure the InsideTheSip/Shaders folder is in the project.");
                enabled = false;
                return;
            }
            material = new Material(shader);
            material.SetColor(ColorId, fadeColor);

            // A quad just past the near plane, big enough to cover the widest
            // headset FOV with margin. Parented to the camera so it is always
            // head-locked (which is exactly what a comfort vignette should be).
            float distance = cam.nearClipPlane + 0.05f;
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
            material.SetFloat(VignetteAmountId, vignette);
            material.SetFloat(FadeAmountId, fade);

            // Skip drawing entirely when fully clear — saves fill rate on Quest.
            overlayRenderer.enabled = vignette > 0.005f || fade > 0.005f;
        }

        /// Fade the view toward `target` (0 = clear, 1 = fully covered).
        public void FadeTo(float target, float duration)
        {
            if (fadeRoutine != null) StopCoroutine(fadeRoutine);
            fadeRoutine = StartCoroutine(FadeRoutine(Mathf.Clamp01(target), Mathf.Max(0.01f, duration)));
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
