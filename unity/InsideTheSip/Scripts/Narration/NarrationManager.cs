using System.Collections;
using UnityEngine;
using TMPro;

namespace InsideTheSip
{
    /// Plays the narration line and shows the caption for each journey step.
    /// Wire JourneyDirector.onStepEnter -> NarrationManager.PlayStep.
    ///
    /// Captions come straight from JourneySteps (same lines as the WebXR
    /// build); narrationClips is an optional parallel array of voice-over
    /// clips in step order — leave entries empty while you don't have VO yet.
    public class NarrationManager : MonoBehaviour
    {
        [Tooltip("AudioSource for voice-over. 2D (spatialBlend 0) so narration is always clear.")]
        public AudioSource voiceSource;

        [Tooltip("One clip per journey step, in JourneySteps order. Entries may be empty.")]
        public AudioClip[] narrationClips;

        [Header("Caption")]
        [Tooltip("World-space TextMeshPro label, ideally on a slightly curved canvas ~2m ahead, lazily following the head.")]
        public TMP_Text captionText;

        [Tooltip("Seconds the caption stays fully visible before fading.")]
        public float captionHold = 4f;

        public float captionFade = 0.6f;

        Coroutine captionRoutine;

        public void PlayStep(int stepIndex)
        {
            var steps = JourneySteps.Steps;
            if (stepIndex < 0 || stepIndex >= steps.Length) return;

            if (voiceSource != null && narrationClips != null &&
                stepIndex < narrationClips.Length && narrationClips[stepIndex] != null)
            {
                voiceSource.Stop();
                voiceSource.clip = narrationClips[stepIndex];
                voiceSource.Play();
            }

            ShowCaption(steps[stepIndex].Caption);
        }

        public void ShowCaption(string text)
        {
            if (captionText == null) return;
            if (captionRoutine != null) StopCoroutine(captionRoutine);
            captionRoutine = StartCoroutine(CaptionRoutine(text));
        }

        IEnumerator CaptionRoutine(string text)
        {
            captionText.text = text;
            yield return Fade(0f, 1f, captionFade);
            yield return new WaitForSeconds(captionHold);
            yield return Fade(1f, 0f, captionFade);
            captionRoutine = null;
        }

        IEnumerator Fade(float from, float to, float duration)
        {
            float elapsed = 0f;
            Color c = captionText.color;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                c.a = Mathf.Lerp(from, to, Mathf.Clamp01(elapsed / duration));
                captionText.color = c;
                yield return null;
            }
            c.a = to;
            captionText.color = c;
        }
    }
}
