using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

namespace InsideTheSip.EditorTools
{
    /// Builds the hero scene: you at roughly 2 mm tall, standing inside a
    /// mouth. A breathing tissue cavern, two arches of towering enamel that
    /// erode while you watch, a tongue underfoot, a cola pool, and the
    /// throat opening behind you.
    ///
    /// Everything is generated — no downloaded models — so this runs on a
    /// fresh project. Swap the meshes for real anatomy later (see
    /// docs/ASSETS.md); the materials and lighting stay as they are.
    public static class MouthSceneBuilder
    {
        const string ScenePath = "Assets/InsideTheSip/Scenes/Mouth.unity";
        const string JourneyScenePath = "Assets/InsideTheSip/Scenes/Journey.unity";

        // World scale: the user is ~2 mm tall, so a 9 mm molar reads as a
        // four-storey cliff. These numbers are in "shrunken" metres.
        const float CavernRadius = 11f;
        const float ArchRadius = 5.6f;
        const int TeethPerArch = 11;

        [MenuItem("Inside the Sip/Build Mouth Scene (Showcase)")]
        public static void BuildMouthScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            BuildLighting();
            var rig = BuildRig();
            BuildCavern();
            BuildTongue();
            var teeth = BuildTeeth();
            BuildColaPool();
            BuildThroat();
            BuildSystems(teeth);

            EnsureFolder("Assets/InsideTheSip");
            EnsureFolder("Assets/InsideTheSip/Scenes");
            EditorSceneManager.SaveScene(scene, ScenePath);

            // Put the mouth first so Build And Run launches straight into it.
            var scenes = System.IO.File.Exists(JourneyScenePath)
                ? new[]
                {
                    new EditorBuildSettingsScene(ScenePath, true),
                    new EditorBuildSettingsScene(JourneyScenePath, true),
                }
                : new[] { new EditorBuildSettingsScene(ScenePath, true) };
            EditorBuildSettings.scenes = scenes;

            Selection.activeGameObject = rig;
            Debug.Log("Inside the Sip: mouth showcase built and saved to " + ScenePath + ".\n" +
                "It is now the FIRST scene in Build Settings, so Build And Run launches into it. " +
                "To go back to the full ride, drag Journey above it in File > Build Profiles.\n" +
                "The enamel starts eroding a few seconds in — look up at the teeth.");
        }

        // ---------------------------------------------------------------

        static void BuildLighting()
        {
            // A mouth is a closed, wet, warm space lit by whatever leaks in.
            RenderSettings.skybox = null;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.30f, 0.10f, 0.09f);
            RenderSettings.ambientEquatorColor = new Color(0.22f, 0.07f, 0.07f);
            RenderSettings.ambientGroundColor = new Color(0.09f, 0.02f, 0.02f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Exponential;
            RenderSettings.fogColor = new Color(0.20f, 0.05f, 0.05f);
            RenderSettings.fogDensity = 0.026f;

            // Daylight through the lips, from in front and slightly above.
            var key = new GameObject("Key (light through the lips)").AddComponent<Light>();
            key.type = LightType.Directional;
            key.color = new Color(1f, 0.88f, 0.78f);
            key.intensity = 1.15f;
            key.shadows = LightShadows.None;
            key.transform.rotation = Quaternion.Euler(28f, 200f, 0f);

            // Warm bounce off the tongue, so faces pointing down aren't dead.
            var bounce = new GameObject("Bounce (off the tongue)").AddComponent<Light>();
            bounce.type = LightType.Point;
            bounce.color = new Color(1f, 0.42f, 0.34f);
            bounce.intensity = 3.2f;
            bounce.range = 26f;
            bounce.shadows = LightShadows.None;
            bounce.transform.position = new Vector3(0f, -2.5f, 0f);

            // Deep red glow from the throat behind you — depth cue and dread.
            var throatGlow = new GameObject("Glow (the throat)").AddComponent<Light>();
            throatGlow.type = LightType.Point;
            throatGlow.color = new Color(0.85f, 0.12f, 0.10f);
            throatGlow.intensity = 4.5f;
            throatGlow.range = 22f;
            throatGlow.shadows = LightShadows.None;
            throatGlow.transform.position = new Vector3(0f, 0.5f, 9.5f);
        }

        static GameObject BuildRig()
        {
            GameObject rig = InstantiateXRRig();
            rig.transform.position = new Vector3(0f, -2.2f, -1.5f);

            var cam = rig.GetComponentInChildren<Camera>();
            if (cam != null)
            {
                cam.nearClipPlane = 0.05f;
                cam.farClipPlane = 120f;
                cam.clearFlags = CameraClearFlags.SolidColor;
                cam.backgroundColor = new Color(0.10f, 0.02f, 0.02f);

                var vignette = cam.gameObject.GetComponent<ComfortVignette>()
                    ?? cam.gameObject.AddComponent<ComfortVignette>();
                vignette.motionSource = rig.transform;
                var so = new SerializedObject(vignette);
                var prop = so.FindProperty("vignetteShader");
                if (prop != null)
                {
                    prop.objectReferenceValue = Shader.Find("InsideTheSip/VignetteFade");
                    so.ApplyModifiedPropertiesWithoutUndo();
                }
            }
            return rig;
        }

        static void BuildCavern()
        {
            var mesh = ProceduralAssets.Sphere("SM_MouthCavern", 72, 44,
                CavernRadius, inward: true, lumpiness: 0.16f, lumpScale: 2.1f, seed: 7);

            var go = new GameObject("Mouth Cavern");
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var renderer = go.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = ProceduralAssets.FleshMaterial();
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            renderer.receiveShadows = false;
            // Squash it: a mouth is wider than it is tall.
            go.transform.localScale = new Vector3(1f, 0.72f, 1.15f);
        }

        static void BuildTongue()
        {
            var mesh = ProceduralAssets.Sphere("SM_Tongue", 48, 30, 1f,
                inward: false, lumpiness: 0.09f, lumpScale: 5.5f, seed: 23);

            var go = new GameObject("Tongue");
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var renderer = go.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = ProceduralAssets.TongueMaterial();
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            renderer.receiveShadows = false;
            go.transform.position = new Vector3(0f, -6.2f, 1.5f);
            go.transform.localScale = new Vector3(6.4f, 2.1f, 9.5f);
        }

        static Renderer[] BuildTeeth()
        {
            var root = new GameObject("Teeth");
            var material = ProceduralAssets.ToothMaterial();
            var renderers = new System.Collections.Generic.List<Renderer>();

            // Upper arch hangs down from the palate, lower arch stands up.
            renderers.AddRange(BuildArch(root.transform, "Upper", 3.4f, true, material));
            renderers.AddRange(BuildArch(root.transform, "Lower", -5.0f, false, material));
            return renderers.ToArray();
        }

        static Renderer[] BuildArch(Transform parent, string label, float y, bool upper,
            Material material)
        {
            var archRoot = new GameObject(label + " Arch");
            archRoot.transform.SetParent(parent, false);
            var result = new System.Collections.Generic.List<Renderer>();

            for (int i = 0; i < TeethPerArch; i++)
            {
                // Spread across the front 200 degrees of the arch, incisors
                // at the front (facing -Z, where the light comes in).
                float t = i / (float)(TeethPerArch - 1);
                float angle = Mathf.Lerp(-100f, 100f, t) * Mathf.Deg2Rad;

                // Incisors are flat blades; molars are wide blocks.
                float toBack = Mathf.Abs(t - 0.5f) * 2f;
                float crownWidth = Mathf.Lerp(1.5f, 2.6f, toBack);
                float depth = Mathf.Lerp(0.75f, 2.4f, toBack);
                float height = Mathf.Lerp(4.6f, 3.2f, toBack);

                var mesh = ProceduralAssets.Tooth(
                    "SM_Tooth_" + label + "_" + i,
                    crownWidth, crownWidth * 0.66f, depth, height,
                    cuspRound: Mathf.Lerp(0.10f, 0.26f, toBack),
                    seed: (upper ? 100 : 200) + i);

                var tooth = new GameObject((upper ? "upper" : "lower") + "-tooth-" + i);
                tooth.transform.SetParent(archRoot.transform, false);
                tooth.transform.position = new Vector3(
                    Mathf.Sin(angle) * ArchRadius,
                    y,
                    -Mathf.Cos(angle) * ArchRadius * 1.15f);

                // Point the crown at the gap between the arches, and fan each
                // tooth outward so the arch reads as a curve, not a row.
                float lean = upper ? 180f : 0f;
                tooth.transform.rotation = Quaternion.Euler(
                    upper ? 8f : -8f,
                    Mathf.Rad2Deg * angle,
                    lean);

                tooth.AddComponent<MeshFilter>().sharedMesh = mesh;
                var renderer = tooth.AddComponent<MeshRenderer>();
                renderer.sharedMaterial = material;
                renderer.shadowCastingMode = ShadowCastingMode.Off;
                renderer.receiveShadows = false;
                result.Add(renderer);
            }
            return result.ToArray();
        }

        static void BuildColaPool()
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Plane);
            go.name = "Cola Pool";
            Object.DestroyImmediate(go.GetComponent<Collider>());
            go.transform.position = new Vector3(0f, -6.6f, 1f);
            go.transform.localScale = new Vector3(1.5f, 1f, 1.9f);

            var renderer = go.GetComponent<MeshRenderer>();
            renderer.sharedMaterial = ProceduralAssets.ColaMaterial();
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            renderer.receiveShadows = false;
        }

        static void BuildThroat()
        {
            // A tube behind you, squeezing with peristalsis — where you go next.
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            go.name = "Throat (peristalsis)";
            Object.DestroyImmediate(go.GetComponent<Collider>());
            go.transform.position = new Vector3(0f, -1.5f, 12.5f);
            go.transform.rotation = Quaternion.Euler(90f, 0f, 0f);
            go.transform.localScale = new Vector3(7f, 9f, 7f);

            var renderer = go.GetComponent<MeshRenderer>();
            renderer.sharedMaterial = ProceduralAssets.ThroatMaterial();
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            renderer.receiveShadows = false;
        }

        static void BuildSystems(Renderer[] teeth)
        {
            var bootstrapGO = new GameObject("QuestBootstrap");
            bootstrapGO.AddComponent<QuestBootstrap>();

            // The heartbeat every shader breathes with.
            var pulseGO = new GameObject("PulseDriver");
            var pulse = pulseGO.AddComponent<PulseDriver>();
            pulse.restingBpm = 68f;

            var decayGO = new GameObject("ToothDecayController");
            var decay = decayGO.AddComponent<ToothDecayController>();
            decay.teeth = teeth;
            decay.decayDuration = 16f;
            decay.beginOnStart = true;
            decay.startDelay = 4f;
        }

        // ---------------------------------------------------------------

        static GameObject InstantiateXRRig()
        {
            foreach (var guid in AssetDatabase.FindAssets("\"XR Origin (XR Rig)\" t:Prefab"))
            {
                var path = AssetDatabase.GUIDToAssetPath(guid);
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                if (prefab == null) continue;
                return (GameObject)PrefabUtility.InstantiatePrefab(prefab);
            }

            var root = new GameObject("XR Origin (FALLBACK - import XRIT Starter Assets)");
            var offset = new GameObject("Camera Offset");
            offset.transform.SetParent(root.transform, false);
            offset.transform.localPosition = new Vector3(0f, 1.6f, 0f);
            var camGO = new GameObject("Main Camera");
            camGO.tag = "MainCamera";
            camGO.transform.SetParent(offset.transform, false);
            camGO.AddComponent<Camera>();
            camGO.AddComponent<AudioListener>();
            Debug.LogWarning("Inside the Sip: XRIT rig prefab not found — using a non-tracking fallback.");
            return root;
        }

        static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            int slash = path.LastIndexOf('/');
            AssetDatabase.CreateFolder(path.Substring(0, slash), path.Substring(slash + 1));
        }
    }
}
