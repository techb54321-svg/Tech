using UnityEngine;
using UnityEngine.Events;
using UnityEngine.XR;

namespace InsideTheSip
{
    /// Fires when the user actually "drinks": the grabbed can/bottle is close
    /// to their face AND tilted back, like a real sip. This is the magic
    /// moment that launches the journey — pair it with a gulp sound, a strong
    /// haptic pulse, and JourneyDirector.Advance().
    ///
    /// Setup: make the drink an XR Grab Interactable (XR Interaction Toolkit)
    /// so the user can pick it up; assign its transform here.
    public class SipTrigger : MonoBehaviour
    {
        [Tooltip("The drink object the user grabs and raises to their mouth.")]
        public Transform drink;

        [Tooltip("The head/eye camera transform. Auto-found from Camera.main if empty.")]
        public Transform head;

        [Tooltip("How close (metres) the drink must be to the face. ~0.20 works with typical can models.")]
        public float sipDistance = 0.20f;

        [Tooltip("How far (degrees) the drink must tilt from upright to count as drinking.")]
        public float sipTiltDegrees = 35f;

        [Tooltip("Seconds the pose must be held — filters out accidental passes near the face.")]
        public float holdSeconds = 0.35f;

        public UnityEvent onSip;

        [Header("Haptics")]
        [Range(0f, 1f)] public float hapticAmplitude = 0.7f;
        public float hapticDuration = 0.25f;

        bool fired;
        float heldFor;

        void Update()
        {
            if (fired || drink == null) return;

            if (head == null)
            {
                if (Camera.main != null) head = Camera.main.transform;
                else return;
            }

            bool nearFace = Vector3.Distance(drink.position, head.position) <= sipDistance;
            bool tilted = Vector3.Angle(drink.up, Vector3.up) >= sipTiltDegrees;

            if (nearFace && tilted)
            {
                heldFor += Time.deltaTime;
                if (heldFor >= holdSeconds)
                {
                    fired = true;
                    PulseBothHands();
                    onSip?.Invoke();
                }
            }
            else
            {
                heldFor = 0f;
            }
        }

        /// Allow another sip (e.g. for the "return" step at the end).
        public void ResetTrigger()
        {
            fired = false;
            heldFor = 0f;
        }

        void PulseBothHands()
        {
            SendHaptic(XRNode.LeftHand);
            SendHaptic(XRNode.RightHand);
        }

        void SendHaptic(XRNode node)
        {
            InputDevice device = InputDevices.GetDeviceAtXRNode(node);
            if (device.isValid &&
                device.TryGetHapticCapabilities(out HapticCapabilities caps) &&
                caps.supportsImpulse)
            {
                device.SendHapticImpulse(0u, hapticAmplitude, hapticDuration);
            }
        }
    }
}
