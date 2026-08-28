using System.Collections;
using UnityEngine;

namespace InsideTheSip
{
    /// Animates the enamel-erosion effect on the teeth (materials using the
    /// InsideTheSip/ToothDecay shader). Call BeginDecay() when the mouth scene
    /// starts — typically wired to JourneyDirector.onStepEnter via a small
    /// relay, or directly from a Timeline signal.
    ///
    /// All listed renderers are switched to ONE shared runtime material and
    /// _Erosion is animated on that. (One material across all teeth keeps the
    /// SRP batcher happy — per-renderer MaterialPropertyBlocks would actually
    /// opt every tooth out of it in URP.) The shared material asset on disk is
    /// never mutated.
    public class ToothDecayController : MonoBehaviour
    {
        [Tooltip("Renderers of the teeth using the ToothDecay shader.")]
        public Renderer[] teeth;

        [Tooltip("Seconds for the full healthy -> eroded transition.")]
        public float decayDuration = 10f;

        [Tooltip("Shape of the transition. Default eases in slowly (the acid 'takes hold') then accelerates.")]
        public AnimationCurve decayCurve = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);

        [Range(0f, 1f)]
        [Tooltip("Starting/current erosion. Applied on Start, and scrubbable in Play mode while tuning the shader.")]
        public float erosion;

        [Header("Auto-start")]
        [Tooltip("Begin eroding by itself when the scene loads — handy for a showcase scene with no interaction yet.")]
        public bool beginOnStart;

        [Tooltip("Seconds to wait before auto-starting, so the user has a moment to look up at healthy enamel first.")]
        public float startDelay = 3f;

        static readonly int ErosionId = Shader.PropertyToID("_Erosion");

        Material runtimeMaterial;
        Coroutine routine;

        void Start()
        {
            if (teeth == null || teeth.Length == 0) return;

            var source = teeth[0] != null ? teeth[0].sharedMaterial : null;
            if (source == null)
            {
                Debug.LogWarning("ToothDecayController: no material found on the first tooth renderer.");
                return;
            }

            runtimeMaterial = new Material(source);
            foreach (var r in teeth)
                if (r != null) r.sharedMaterial = runtimeMaterial;

            Apply(erosion);

            if (beginOnStart) StartCoroutine(BeginAfterDelay());
        }

        IEnumerator BeginAfterDelay()
        {
            yield return new WaitForSeconds(Mathf.Max(0f, startDelay));
            BeginDecay();
        }

        void OnValidate()
        {
            // Live-scrub support while the game runs (edit mode has no runtime material).
            if (Application.isPlaying && runtimeMaterial != null)
                Apply(erosion);
        }

        [ContextMenu("Begin decay (debug)")]
        public void BeginDecay()
        {
            if (routine != null) StopCoroutine(routine);
            routine = StartCoroutine(DecayRoutine());
        }

        public void ResetTeeth()
        {
            if (routine != null) StopCoroutine(routine);
            routine = null;
            Apply(0f);
        }

        IEnumerator DecayRoutine()
        {
            float elapsed = 0f;
            while (elapsed < decayDuration)
            {
                elapsed += Time.deltaTime;
                float u = Mathf.Clamp01(elapsed / decayDuration);
                Apply(decayCurve.Evaluate(u));
                yield return null;
            }
            Apply(decayCurve.Evaluate(1f));
            routine = null;
        }

        void Apply(float value)
        {
            erosion = Mathf.Clamp01(value);
            if (runtimeMaterial != null)
                runtimeMaterial.SetFloat(ErosionId, erosion);
        }

        void OnDestroy()
        {
            if (runtimeMaterial != null) Destroy(runtimeMaterial);
        }
    }
}
