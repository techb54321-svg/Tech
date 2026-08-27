using System;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Events;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace InsideTheSip.EditorTools
{
    /// One-click setup, so assembling the project is two menu items instead
    /// of a page of manual wiring:
    ///
    ///   Inside the Sip > Build Starter Scene (Graybox)
    ///       Creates the whole ride: XR rig (uses the XR Interaction Toolkit
    ///       "XR Origin (XR Rig)" starter prefab when its sample is imported,
    ///       otherwise a plain fallback rig), JourneyDirector, PulseDriver,
    ///       NarrationManager, ComfortVignette (shader reference properly
    ///       assigned so it survives device builds), a grabbable placeholder
    ///       can wired to SipTrigger -> Advance, and a labelled, lit graybox
    ///       station for each of the 11 beats. Saves the scene and adds it
    ///       to Build Settings.
    ///
    ///   Inside the Sip > Configure Project For Quest
    ///       IL2CPP, ARM64-only, Vulkan, Linear color, ASTC textures,
    ///       min SDK 32, MSAA 4x on the active URP asset.
    ///
    /// XR plug-in enabling (OpenXR + Meta Quest Support) still happens in
    /// Project Settings — the menus log exactly what remains.
    public static class SceneBootstrapper
    {
        const string ScenePath = "Assets/InsideTheSip/Scenes/Journey.unity";

        [MenuItem("Inside the Sip/Build Starter Scene (Graybox)")]
        public static void BuildStarterScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            // --- Mood lighting: dim, warm, foggy — an interior, not a void.
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.35f, 0.16f, 0.14f);
            RenderSettings.ambientEquatorColor = new Color(0.24f, 0.10f, 0.09f);
            RenderSettings.ambientGroundColor = new Color(0.10f, 0.04f, 0.04f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Exponential;
            RenderSettings.fogColor = new Color(0.16f, 0.05f, 0.05f);
            RenderSettings.fogDensity = 0.045f;

            var sun = new GameObject("Sun (dim warm key)").AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.85f, 0.7f);
            sun.intensity = 0.7f;
            sun.shadows = LightShadows.None; // no realtime shadows on Quest
            sun.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

            // --- Rig.
            GameObject rig = InstantiateXRRigPrefab() ?? CreateFallbackRig();
            var cam = rig.GetComponentInChildren<Camera>();
            if (cam != null)
            {
                cam.nearClipPlane = 0.05f;

                var vignette = cam.gameObject.GetComponent<ComfortVignette>()
                    ?? cam.gameObject.AddComponent<ComfortVignette>();
                vignette.motionSource = rig.transform;
                // Assign through SerializedObject so the shader asset reference
                // is saved in the scene — that's what keeps it in device builds.
                var so = new SerializedObject(vignette);
                so.FindProperty("vignetteShader").objectReferenceValue =
                    Shader.Find("InsideTheSip/VignetteFade");
                so.ApplyModifiedPropertiesWithoutUndo();
            }
            else
            {
                Debug.LogWarning("Inside the Sip: no Camera found in the rig — add ComfortVignette to your eye camera manually.");
            }

            // --- Core systems.
            var director = new GameObject("JourneyDirector").AddComponent<JourneyDirector>();
            director.rigRoot = rig.transform;

            var bootstrapGO = new GameObject("QuestBootstrap");
            bootstrapGO.AddComponent<QuestBootstrap>();

            var pulseGO = new GameObject("PulseDriver");
            var pulse = pulseGO.AddComponent<PulseDriver>();
            var heartbeatSource = pulseGO.AddComponent<AudioSource>();
            heartbeatSource.playOnAwake = false;
            heartbeatSource.spatialBlend = 0f;
            UnityEventTools.AddVoidPersistentListener(pulse.onBeat, heartbeatSource.Play);

            var narrGO = new GameObject("NarrationManager");
            var narration = narrGO.AddComponent<NarrationManager>();
            var voice = narrGO.AddComponent<AudioSource>();
            voice.playOnAwake = false;
            voice.spatialBlend = 0f;
            narration.voiceSource = voice;
            UnityEventTools.AddPersistentListener(director.onStepEnter,
                new UnityEngine.Events.UnityAction<int>(narration.PlayStep));

            // --- The sippable can.
            var can = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            can.name = "Cola Can (placeholder)";
            can.transform.position = new Vector3(0.35f, 0.95f, -0.45f);
            can.transform.localScale = new Vector3(0.066f, 0.06f, 0.066f);
            can.AddComponent<Rigidbody>();
            TryAddGrabInteractable(can);

            var sip = new GameObject("SipTrigger").AddComponent<SipTrigger>();
            sip.drink = can.transform;
            UnityEventTools.AddVoidPersistentListener(sip.onSip, director.Advance);

            // --- A labelled, lit graybox station per beat.
            var segments = new GameObject("Journey Segments (graybox)");
            var steps = JourneySteps.Steps;
            foreach (var step in steps)
            {
                var station = new GameObject("station-" + step.Id);
                station.transform.SetParent(segments.transform, false);
                station.transform.position = step.Position;

                var platform = GameObject.CreatePrimitive(PrimitiveType.Cube);
                platform.name = "platform";
                platform.transform.SetParent(station.transform, false);
                platform.transform.localPosition = new Vector3(0f, -1.2f, 0f);
                platform.transform.localScale = new Vector3(3f, 0.1f, 3f);
                Tint(platform, step.Accent * 0.55f);

                var marker = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                marker.name = "marker";
                marker.transform.SetParent(station.transform, false);
                marker.transform.localPosition = new Vector3(0f, 0f, 1.2f);
                marker.transform.localScale = Vector3.one * 0.4f;
                Tint(marker, step.Accent);

                var light = new GameObject("accent-light").AddComponent<Light>();
                light.type = LightType.Point;
                light.transform.SetParent(station.transform, false);
                light.transform.localPosition = new Vector3(0f, 0.8f, 0f);
                light.color = step.Accent;
                light.intensity = 2.2f;
                light.range = 6f;
                light.shadows = LightShadows.None;

                AddLabel(station.transform, step.Title, step.Accent);
            }

            // --- Save + register.
            EnsureFolder("Assets/InsideTheSip");
            EnsureFolder("Assets/InsideTheSip/Scenes");
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };

            Debug.Log("Inside the Sip: starter scene built and saved to " + ScenePath + ".\n" +
                "Still manual (one-time, in Project Settings):\n" +
                "  1. XR Plug-in Management -> tick OpenXR on the Android tab.\n" +
                "  2. OpenXR (Android): add the Oculus Touch interaction profile, enable Meta Quest Support " +
                "and Foveated Rendering, Render Mode = Single Pass Instanced.\n" +
                "  3. If the rig says 'fallback', install XR Interaction Toolkit and import its Starter Assets " +
                "sample, then re-run this menu item.\n" +
                "Then run 'Inside the Sip/Configure Project For Quest' and Build And Run.");
        }

        [MenuItem("Inside the Sip/Configure Project For Quest")]
        public static void ConfigureForQuest()
        {
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.minSdkVersion = (AndroidSdkVersions)32;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { GraphicsDeviceType.Vulkan });
            EditorUserBuildSettings.androidBuildSubtarget = MobileTextureSubtarget.ASTC;

            var urp = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
            if (urp != null)
            {
                urp.msaaSampleCount = 4;
                urp.supportsHDR = false;
                EditorUtility.SetDirty(urp);
            }
            else
            {
                Debug.LogWarning("Inside the Sip: no active URP asset found — set MSAA 4x / HDR off on your URP asset manually.");
            }

            AssetDatabase.SaveAssets();
            Debug.Log("Inside the Sip: Quest player settings applied (IL2CPP, ARM64, Vulkan, Linear, ASTC, minSdk 32, MSAA 4x). " +
                "Switch platform to Android in Build Settings/Build Profiles if you haven't yet.");
        }

        // ---------- helpers ----------

        static GameObject InstantiateXRRigPrefab()
        {
            // The XRIT Starter Assets sample ships a fully-wired rig prefab.
            foreach (var guid in AssetDatabase.FindAssets("\"XR Origin (XR Rig)\" t:Prefab"))
            {
                var path = AssetDatabase.GUIDToAssetPath(guid);
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                if (prefab == null) continue;
                var instance = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
                instance.transform.position = Vector3.zero;
                Debug.Log("Inside the Sip: using XRIT rig prefab from " + path);
                return instance;
            }
            return null;
        }

        static GameObject CreateFallbackRig()
        {
            // Head-tracks nothing by itself — good enough to press Play at a
            // desk. Swap for the XRIT prefab for real headset tracking.
            var root = new GameObject("XR Origin (FALLBACK - import XRIT Starter Assets and rebuild)");
            var offset = new GameObject("Camera Offset");
            offset.transform.SetParent(root.transform, false);
            offset.transform.localPosition = new Vector3(0f, 1.6f, 0f);
            var camGO = new GameObject("Main Camera");
            camGO.tag = "MainCamera";
            camGO.transform.SetParent(offset.transform, false);
            camGO.AddComponent<Camera>();
            camGO.AddComponent<AudioListener>();
            Debug.LogWarning("Inside the Sip: XRIT 'XR Origin (XR Rig)' prefab not found — built a non-tracking fallback rig. " +
                "Install XR Interaction Toolkit, import its Starter Assets sample, delete the fallback and re-run the menu.");
            return root;
        }

        static void TryAddGrabInteractable(GameObject go)
        {
            // XRIT 3.x moved the type into .Interactables; try both, and stay
            // compile-safe if the package isn't installed yet.
            var type =
                Type.GetType("UnityEngine.XR.Interaction.Toolkit.Interactables.XRGrabInteractable, Unity.XR.Interaction.Toolkit") ??
                Type.GetType("UnityEngine.XR.Interaction.Toolkit.XRGrabInteractable, Unity.XR.Interaction.Toolkit");
            if (type != null) go.AddComponent(type);
            else Debug.LogWarning("Inside the Sip: XR Interaction Toolkit not installed — the can has no XRGrabInteractable yet. " +
                "Install XRIT and add it to '" + go.name + "'.");
        }

        static void Tint(GameObject go, Color color)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null) return;
            var mat = new Material(shader);
            mat.SetColor("_BaseColor", color);
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
        }

        static void AddLabel(Transform parent, string title, Color color)
        {
            var go = new GameObject("label");
            go.transform.SetParent(parent, false);
            go.transform.localPosition = new Vector3(0f, 1.1f, 1.2f);
            var text = go.AddComponent<TextMesh>();
            text.text = title;
            text.characterSize = 0.06f;
            text.fontSize = 64;
            text.anchor = TextAnchor.MiddleCenter;
            text.color = Color.Lerp(color, Color.white, 0.5f);
            var font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (font != null)
            {
                text.font = font;
                go.GetComponent<MeshRenderer>().sharedMaterial = font.material;
            }
        }

        static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            var slash = path.LastIndexOf('/');
            AssetDatabase.CreateFolder(path.Substring(0, slash), path.Substring(slash + 1));
        }
    }
}
