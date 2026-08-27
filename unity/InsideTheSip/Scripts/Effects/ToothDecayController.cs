using System.Collections;
using UnityEngine;

namespace InsideTheSip
{
    /// Animates the enamel-erosion effect on the teeth (materials using the
    /// InsideTheSip/ToothDecay shader). Call BeginDecay() when the mouth scene
    /// starts — typically wired to JourneyDirector.onStepEnter via a small
    /// relay, or directly from a Timeline signal.
    ///
    /// Uses MaterialPropertyBlocks so the shared material asset is never
    /// mutated and every tooth can share one material (one draw-call-friendly
    /// batch, important on Quest).
    public class ToothDecayController : MonoBehaviour
    {
        [Tooltip("Renderers of the teeth using the ToothDecay shader.")]
        public Renderer[] teeth;

        [Tooltip("Seconds for the full healthy -> eroded transition.")]
        public float decayDuration = 10f;

        [Tooltip("Shape of the transition. Default eases in slowly (the acid 'takes hold') then accelerates.")]
        public AnimationCurve decayCurve = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);

        [Range(0f, 1f)]
        [Tooltip("Current erosion, exposed so you can scrub it in the Inspector while tuning the shader.")]
        public float erosion;

        static readonly int ErosionId = Shader.PropertyToID("_Erosion");

        MaterialPropertyBlock block;
        Coroutine routine;

        void Awake()
        {
            block = new MaterialPropertyBlock();
        }

        void OnValidate()
        {
            // Live-scrub support in the editor.
            if (block == null) block = new MaterialPropertyBlock();
            Apply(erosion);
        }

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
            if (teeth == null) return;
            foreach (var r in teeth)
            {
                if (r == null) continue;
                r.GetPropertyBlock(block);
                block.SetFloat(ErosionId, erosion);
                r.SetPropertyBlock(block);
            }
        }
    }
}
