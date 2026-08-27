using UnityEngine;

namespace InsideTheSip
{
    /// The 11-beat sequence, ported 1:1 from the WebXR prototype's steps.ts.
    /// Positions trace a gentle path that descends and curves "through the
    /// body", returning to the table at the end.
    public static class JourneySteps
    {
        public static readonly JourneyStep[] Steps =
        {
            new JourneyStep("choice", "The Choice",
                "Reach out and choose a drink.",
                Hex(0xCA, 0xA1, 0x5A), new Vector3(0f, 0f, 0f), AdvanceMode.Manual),

            new JourneyStep("spin", "The Spin",
                "Here we go — inside the sip...",
                Hex(0x7D, 0x5B, 0xD0), new Vector3(0f, 0f, -3f), AdvanceMode.Auto, 2.5f),

            new JourneyStep("mouth", "The Mouth",
                "The mouth. Sugar and acid wash over your teeth.",
                Hex(0xE5, 0x8A, 0x9A), new Vector3(0f, -1.5f, -6f), AdvanceMode.Manual),

            new JourneyStep("esophagus", "The Esophagus",
                "Whoosh — sliding down...",
                Hex(0xCF, 0x6B, 0x78), new Vector3(0f, -5f, -8f), AdvanceMode.Auto, 2.5f),

            new JourneyStep("stomach", "The Stomach",
                "Splash! The churning stomach.",
                Hex(0xDF, 0x8A, 0x4A), new Vector3(2.5f, -8f, -8f), AdvanceMode.Manual),

            new JourneyStep("bloodstream", "The Bloodstream",
                "Into the blood — glucose races through.",
                Hex(0xC0, 0x39, 0x4A), new Vector3(6.5f, -9f, -5.5f), AdvanceMode.Manual),

            new JourneyStep("pancreas", "The Pancreas",
                "The pancreas sends out insulin \"keys\".",
                Hex(0xE3, 0xB4, 0x4A), new Vector3(9.5f, -9f, -1.5f), AdvanceMode.Manual),

            new JourneyStep("liver", "The Liver",
                "The liver stores the extra sugar as fat.",
                Hex(0xA0, 0x6A, 0x38), new Vector3(11.5f, -8f, 2.5f), AdvanceMode.Manual),

            new JourneyStep("brain", "The Brain",
                "A buzzy sugar \"high\" lights up the brain.",
                Hex(0x4A, 0xA0, 0xE6), new Vector3(9f, -5f, 6.5f), AdvanceMode.Manual),

            new JourneyStep("spinback", "Rising Back Out",
                "And back out you rise...",
                Hex(0x7D, 0x5B, 0xD0), new Vector3(4.5f, -2.5f, 4f), AdvanceMode.Auto, 2.5f),

            new JourneyStep("return", "The Choice, Again",
                "Back at the table. The same choice — now you know.",
                Hex(0xCA, 0xA1, 0x5A), new Vector3(0f, 0f, 0f), AdvanceMode.Manual),
        };

        static Color Hex(byte r, byte g, byte b) => new Color32(r, g, b, 255);
    }
}
