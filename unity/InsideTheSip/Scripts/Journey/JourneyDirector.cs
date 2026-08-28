using System.Collections;
using UnityEngine;
using UnityEngine.Events;

namespace InsideTheSip
{
    /// Drives the whole experience: moves the XR rig along the journey spline,
    /// enters each step, waits (dwell or user action), and fires events other
    /// systems listen to (narration, tooth decay, pulse, scene dressing).
    ///
    /// Wiring:
    ///  - rigRoot        -> your "XR Origin (XR Rig)" root transform.
    ///  - onStepEnter    -> NarrationManager.PlayStep, scene activators, etc.
    ///  - Advance()      -> call from the Continue button, drink choice,
    ///                      or SipTrigger.onSip.
    public class JourneyDirector : MonoBehaviour
    {
        [Header("Rig")]
        [Tooltip("Root transform of the XR Origin. The director moves this, never the camera itself.")]
        public Transform rigRoot;

        [Tooltip("Added to every path position, e.g. to sink the whole ride or match your scene layout.")]
        public Vector3 worldOffset = Vector3.zero;

        [Header("Travel")]
        [Tooltip("Seconds per metre of path travelled. ~1.2 is a gentle glide; lower = faster.")]
        [Range(0.2f, 5f)] public float secondsPerMeter = 1.2f;

        [Tooltip("Shortest/longest a single hop between steps may take, whatever its length.")]
        public Vector2 travelDurationRange = new Vector2(2f, 10f);

        [Tooltip("Smoothly yaw the rig to face along the path while travelling. Yaw only — never pitch or roll the rig in VR (and keep the XR Origin level: a tilted rig would turn this yaw into pitch/roll).")]
        public bool alignYawToPath = true;

        [Tooltip("Maximum yaw rate in degrees per second. Uncommanded rotation is the harshest comfort stimulus — keep this modest.")]
        [Range(10f, 120f)] public float maxYawDegreesPerSecond = 45f;

        [Header("Events")]
        // NOTE: a raw UnityEvent<int> field is NOT serialized by Unity — it
        // stays null, never appears in the Inspector, and blows up anything
        // that tries to add a listener. A [Serializable] subclass fixes both.
        [System.Serializable] public class StepEvent : UnityEvent<int> { }

        public StepEvent onStepEnter = new StepEvent();
        public StepEvent onStepExit = new StepEvent();
        public UnityEvent onTravelStart = new UnityEvent();
        public UnityEvent onJourneyComplete = new UnityEvent();

        public JourneyStep[] Steps { get; private set; }
        public int CurrentStepIndex { get; private set; } = -1;
        public bool IsTraveling { get; private set; }

        /// 0..1 how fast the rig is currently moving relative to its peak
        /// travel speed — the ComfortVignette can also derive this itself.
        public float NormalizedSpeed { get; private set; }

        CatmullRomPath path;
        Coroutine activeRoutine;

        void Awake()
        {
            Steps = JourneySteps.Steps;
            var positions = new Vector3[Steps.Length];
            for (int i = 0; i < Steps.Length; i++)
                positions[i] = Steps[i].Position;
            path = new CatmullRomPath(positions);

            if (rigRoot == null)
            {
                Debug.LogWarning("JourneyDirector: rigRoot not assigned — using this transform.");
                rigRoot = transform;
            }
        }

        void Start()
        {
            rigRoot.position = path.GetPoint(0f) + worldOffset;
            EnterStep(0);
        }

        /// Advance to the next step. Safe to call repeatedly — ignored while
        /// already travelling or after the journey has completed.
        public void Advance()
        {
            if (IsTraveling) return;
            if (CurrentStepIndex >= Steps.Length - 1) return;
            if (activeRoutine != null) StopCoroutine(activeRoutine);
            activeRoutine = StartCoroutine(TravelTo(CurrentStepIndex + 1));
        }

        /// Jump the rig instantly (e.g. for debugging a single scene).
        public void TeleportToStep(int index)
        {
            index = Mathf.Clamp(index, 0, Steps.Length - 1);
            if (activeRoutine != null) StopCoroutine(activeRoutine);
            activeRoutine = null;
            IsTraveling = false;
            NormalizedSpeed = 0f;
            if (CurrentStepIndex >= 0) onStepExit?.Invoke(CurrentStepIndex);
            rigRoot.position = path.GetPoint(path.ParameterAt(index)) + worldOffset;
            EnterStep(index);
        }

        IEnumerator TravelTo(int nextIndex)
        {
            IsTraveling = true;
            onStepExit?.Invoke(CurrentStepIndex);
            onTravelStart?.Invoke();

            float t0 = path.ParameterAt(CurrentStepIndex);
            float t1 = path.ParameterAt(nextIndex);

            // Estimate hop length to give long slides more time than short hops.
            float length = EstimateLength(t0, t1, 16);
            float duration = Mathf.Clamp(length * secondsPerMeter,
                travelDurationRange.x, travelDurationRange.y);

            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float u = Mathf.Clamp01(elapsed / duration);
                float eased = u * u * (3f - 2f * u); // smoothstep: gentle in/out

                float t = Mathf.Lerp(t0, t1, eased);
                rigRoot.position = path.GetPoint(t) + worldOffset;

                // Peak of d(smoothstep)/du is 1.5 at the middle of the hop.
                NormalizedSpeed = 6f * u * (1f - u) / 1.5f;

                if (alignYawToPath)
                {
                    // Only steer by the horizontal part of the tangent, and only
                    // when it is a meaningful fraction of the full direction:
                    // on near-vertical segments (the esophagus drop) the
                    // horizontal remainder is numerical noise, and chasing it
                    // whips the rig into fast uncommanded yaw at the exact
                    // moment the user is also falling — worst-case comfort.
                    Vector3 tangent = path.GetTangent(t);
                    Vector3 horizontal = new Vector3(tangent.x, 0f, tangent.z);
                    if (horizontal.magnitude > 0.25f * tangent.magnitude &&
                        horizontal.sqrMagnitude > 1e-6f)
                    {
                        float targetYaw = Quaternion.LookRotation(horizontal.normalized, Vector3.up)
                            .eulerAngles.y;
                        float yaw = Mathf.MoveTowardsAngle(rigRoot.eulerAngles.y, targetYaw,
                            maxYawDegreesPerSecond * Time.deltaTime);
                        rigRoot.rotation = Quaternion.Euler(0f, yaw, 0f);
                    }
                }
                yield return null;
            }

            rigRoot.position = path.GetPoint(t1) + worldOffset;
            NormalizedSpeed = 0f;
            IsTraveling = false;
            activeRoutine = null; // this coroutine is done — don't let EnterStep stop it
            EnterStep(nextIndex);
        }

        void EnterStep(int index)
        {
            CurrentStepIndex = index;
            onStepEnter?.Invoke(index);

            // A listener may have called Advance() synchronously from the
            // event above (StartCoroutine runs to its first yield, setting
            // IsTraveling). That hop wins — starting a dwell now would stop
            // the fresh coroutine and soft-lock the state machine.
            if (IsTraveling) return;

            if (index >= Steps.Length - 1)
            {
                onJourneyComplete?.Invoke();
                return;
            }

            if (Steps[index].Advance == AdvanceMode.Auto)
            {
                if (activeRoutine != null) StopCoroutine(activeRoutine);
                activeRoutine = StartCoroutine(DwellThenAdvance(Steps[index].DwellSeconds));
            }
        }

        IEnumerator DwellThenAdvance(float seconds)
        {
            yield return new WaitForSeconds(Mathf.Max(0.1f, seconds));
            activeRoutine = null;
            Advance();
        }

        float EstimateLength(float t0, float t1, int samples)
        {
            float length = 0f;
            Vector3 prev = path.GetPoint(t0);
            for (int i = 1; i <= samples; i++)
            {
                Vector3 p = path.GetPoint(Mathf.Lerp(t0, t1, i / (float)samples));
                length += Vector3.Distance(prev, p);
                prev = p;
            }
            return length;
        }
    }
}
