using UnityEngine;
using UnityEngine.Events;

namespace InsideTheSip
{
    /// The body's heartbeat. Publishes a global shader float `_ITS_Pulse`
    /// (0..1, thumping at the current heart rate) that every InsideTheSip
    /// shader reads, so vessel walls, organs and lighting all breathe in sync.
    /// Also fires onBeat for the heartbeat audio thump and haptic ticks.
    ///
    /// The educational hook: call SetExcitement(1) after the sugar hits the
    /// bloodstream — the heart rate climbs, and the whole world visibly and
    /// audibly speeds up around the user.
    public class PulseDriver : MonoBehaviour
    {
        [Tooltip("Calm heart rate at the start of the journey.")]
        public float restingBpm = 62f;

        [Tooltip("Heart rate at full sugar rush.")]
        public float excitedBpm = 96f;

        [Range(0f, 1f)]
        [Tooltip("0 = resting, 1 = full sugar rush. Animate via SetExcitement().")]
        public float excitement;

        [Tooltip("How quickly excitement changes ease in (per second).")]
        public float response = 0.5f;

        [Range(1f, 8f)]
        [Tooltip("Higher = sharper, more thump-like pulse waveform.")]
        public float sharpness = 3f;

        public UnityEvent onBeat;

        public static float CurrentPulse { get; private set; }

        static readonly int PulseId = Shader.PropertyToID("_ITS_Pulse");

        float phase;      // 0..1 through the current beat
        float smoothedExcitement;
        float targetExcitement;

        void OnEnable()
        {
            targetExcitement = excitement;
        }

        public void SetExcitement(float value01)
        {
            targetExcitement = Mathf.Clamp01(value01);
        }

        void Update()
        {
            smoothedExcitement = Mathf.Lerp(smoothedExcitement, targetExcitement,
                1f - Mathf.Exp(-response * Time.deltaTime));
            excitement = smoothedExcitement;

            float bpm = Mathf.Lerp(restingBpm, excitedBpm, smoothedExcitement);
            phase += (bpm / 60f) * Time.deltaTime;

            if (phase >= 1f)
            {
                phase -= Mathf.Floor(phase);
                onBeat?.Invoke();
            }

            // A raised-cosine sharpened into a thump: rises fast, decays slow.
            float wave = 0.5f - 0.5f * Mathf.Cos(phase * 2f * Mathf.PI);
            CurrentPulse = Mathf.Pow(wave, sharpness);
            Shader.SetGlobalFloat(PulseId, CurrentPulse);
        }

        void OnDisable()
        {
            Shader.SetGlobalFloat(PulseId, 0f);
        }
    }
}
