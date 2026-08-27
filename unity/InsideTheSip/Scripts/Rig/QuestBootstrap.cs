using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR;

namespace InsideTheSip
{
    /// One-time device setup. Put this on any always-alive object.
    ///
    /// Fixed foveated rendering must be REQUESTED at runtime: ticking the
    /// OpenXR "Foveated Rendering" / Meta Quest Support checkboxes only
    /// exposes the capability — the level defaults to 0 and nothing is
    /// actually foveated until the app sets it. On this fill-rate-heavy
    /// project (full-screen flesh walls, transparent liquid, vignette) that
    /// is roughly 10-25% of fragment budget left on the table. Requires the
    /// Vulkan graphics API on Quest. Verify with the OVR Metrics Tool overlay
    /// (its FFR level readout) on device.
    public class QuestBootstrap : MonoBehaviour
    {
        [Range(0f, 1f)]
        [Tooltip("0 = off, 1 = strongest peripheral downsampling. 1 is barely noticeable inside these soft organic scenes — near-free GPU savings.")]
        public float foveationLevel = 1f;

        void Start()
        {
            var displays = new List<XRDisplaySubsystem>();
            SubsystemManager.GetSubsystems(displays);
            foreach (var display in displays)
            {
                display.foveatedRenderingLevel = foveationLevel;
                // Fixed (head-locked) foveation; no eye-tracked gaze region.
                display.foveatedRenderingFlags = XRDisplaySubsystem.FoveatedRenderingFlags.None;
            }
            if (displays.Count == 0)
                Debug.LogWarning("QuestBootstrap: no XRDisplaySubsystem found (running without XR?).");
        }
    }
}
