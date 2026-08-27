using UnityEngine;

namespace InsideTheSip
{
    /// How a step hands over to the next one.
    ///  - Auto:   a guided beat that advances by itself after DwellSeconds.
    ///  - Manual: waits until something calls JourneyDirector.Advance()
    ///            (the Continue button, the drink choice, the sip trigger...).
    public enum AdvanceMode
    {
        Auto,
        Manual,
    }

    /// One beat of the journey. Mirrors steps.ts from the WebXR prototype so
    /// both builds tell the same story.
    [System.Serializable]
    public class JourneyStep
    {
        public string Id;
        public string Title;

        [TextArea]
        public string Caption;

        /// Accent colour for lighting/UI tinting in this beat.
        public Color Accent;

        /// World-space position the rig travels to for this step.
        public Vector3 Position;

        public AdvanceMode Advance;

        /// Seconds to dwell before auto-advancing (Auto steps only).
        public float DwellSeconds;

        public JourneyStep(string id, string title, string caption, Color accent,
            Vector3 position, AdvanceMode advance, float dwellSeconds = 0f)
        {
            Id = id;
            Title = title;
            Caption = caption;
            Accent = accent;
            Position = position;
            Advance = advance;
            DwellSeconds = dwellSeconds;
        }
    }
}
