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
        // A dental arch is an ellipse, not a circle — deeper front-to-back
        // than it is wide, which is why the old circular layout crowded and
        // overlapped the front teeth.
        const float ArchX = 6.2f;
        const float ArchZ = 7.4f;
        const float ArchDegrees = 92f;
        const int TeethPerArch = 11;
        const float ToothHeight = 4.2f;

        // Crown heights, chosen so your eyeline sits just below the lower
        // crowns: the teeth loom rather than sitting at eye level.
        const float LowerCrownY = -1.0f;
        const float UpperCrownY = 1.6f;

        /// Standing height: the top of the tongue. Puts your eyeline between
        /// the two arches, so the lower teeth rise past you and the upper
        /// ones hang overhead.
        const float FloorY = -4.1f;

        [MenuItem("Inside the Sip/Build Mouth Scene (Showcase)")]
        public static void BuildMouthScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            BuildLighting();
            BuildFloor();
            var rig = BuildRig();
            BuildCavern();
            BuildTongue();
            var teeth = BuildTeeth();
            BuildUvula();
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

        /// Invisible ground at the top of the tongue. Without this the rig's
        /// gravity drops you straight through the scene on load.
        static void BuildFloor()
        {
            var floor = new GameObject("Floor (invisible)");
            floor.transform.position = new Vector3(0f, FloorY - 0.25f, 1.5f);
            var box = floor.AddComponent<BoxCollider>();
            box.size = new Vector3(60f, 0.5f, 60f);
        }

        static GameObject BuildRig()
        {
            GameObject rig = InstantiateXRRig();
            // Stand ON the floor, not above it. The XRIT rig has gravity, so
            // spawning in mid-air means an unpleasant drop the moment the
            // scene loads — and falling is the fastest way to make someone
            // sick in VR.
            rig.transform.position = new Vector3(0f, FloorY, -1.5f);

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
            var mesh = ProceduralAssets.MouthCavity("SM_MouthCavity",
                halfLength: 14f, maxHalfWidth: 10.5f,
                ceilingHeight: 7.5f, floorDepth: 5.2f, seed: 7);

            var go = new GameObject("Mouth Cavern");
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var renderer = go.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = ProceduralAssets.FleshMaterial();
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            renderer.receiveShadows = false;

            // Solid cheeks, so thumbstick locomotion can't leave the mouth.
            var collider = go.AddComponent<MeshCollider>();
            collider.sharedMesh = mesh;

            BuildDaylight();
        }

        /// Daylight past the lips: a warm glowing disc filling the front
        /// opening. It gives the space somewhere to look, a reason for the
        /// key light, and the strongest possible depth cue — bright ahead of
        /// you, deep red behind.
        static void BuildDaylight()
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Quad);
            go.name = "Daylight (past the lips)";
            Object.DestroyImmediate(go.GetComponent<Collider>());
            go.transform.position = new Vector3(0f, 0.5f, -14.6f);
            go.transform.rotation = Quaternion.Euler(0f, 0f, 0f);
            go.transform.localScale = new Vector3(22f, 16f, 1f);

            var shader = Shader.Find("Universal Render Pipeline/Unlit");
            if (shader == null) return;
            var mat = new Material(shader);
            mat.SetColor("_BaseColor", new Color(1f, 0.86f, 0.72f));
            AssetDatabase.CreateAsset(mat, ProceduralAssets.Root + "/M_Daylight.mat");

            var renderer = go.GetComponent<MeshRenderer>();
            renderer.sharedMaterial = mat;
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            renderer.receiveShadows = false;
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
            // Top of the tongue sits at the standing height, and it stops
            // short of the arches so it reads as a tongue in a mouth rather
            // than a slab filling it.
            go.transform.position = new Vector3(0f, FloorY - 1.9f, 1.2f);
            go.transform.localScale = new Vector3(5.0f, 1.9f, 7.6f);
        }

        static Renderer[] BuildTeeth()
        {
            var root = new GameObject("Teeth");
            var material = ProceduralAssets.ToothMaterial();
            var renderers = new System.Collections.Generic.List<Renderer>();

            BuildGums(root.transform);
            renderers.AddRange(BuildArch(root.transform, "Upper", true, material));
            renderers.AddRange(BuildArch(root.transform, "Lower", false, material));
            return renderers.ToArray();
        }

        /// Ridges of gum for the teeth to emerge from, slightly inside the
        /// arch so the crowns sit in it rather than on it.
        static void BuildGums(Transform parent)
        {
            BuildGum(parent, "Upper Gum", UpperCrownY + ToothHeight * 0.82f, 21);
            BuildGum(parent, "Lower Gum", LowerCrownY - ToothHeight * 0.82f, 22);
        }

        static void BuildGum(Transform parent, string name, float y, int seed)
        {
            var mesh = ProceduralAssets.GumRidge("SM_" + name.Replace(" ", ""),
                ArchX, ArchZ, 1.35f, ArchDegrees, seed);

            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.position = new Vector3(0f, y, 0f);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var renderer = go.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = ProceduralAssets.FleshMaterial();
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            renderer.receiveShadows = false;
        }

        static Renderer[] BuildArch(Transform parent, string label, bool upper,
            Material material)
        {
            var archRoot = new GameObject(label + " Arch");
            archRoot.transform.SetParent(parent, false);
            var result = new System.Collections.Generic.List<Renderer>();

            for (int i = 0; i < TeethPerArch; i++)
            {
                float t = i / (float)(TeethPerArch - 1);
                float angle = Mathf.Deg2Rad * Mathf.Lerp(-ArchDegrees, ArchDegrees, t);

                // Incisors are flat blades at the front; molars are wide
                // blocks at the back. Width is capped by the gap to the next
                // tooth so they can never overlap, whatever the arch size.
                float toBack = Mathf.Abs(t - 0.5f) * 2f;
                var here = ArchPoint(angle);
                var next = ArchPoint(Mathf.Deg2Rad *
                    Mathf.Lerp(-ArchDegrees, ArchDegrees, t + 1f / (TeethPerArch - 1)));
                float spacing = Vector3.Distance(here, next);
                float crownWidth = Mathf.Min(Mathf.Lerp(1.5f, 2.6f, toBack), spacing * 0.88f);
                float depth = Mathf.Lerp(0.85f, 2.4f, toBack);

                var mesh = ProceduralAssets.Tooth(
                    "SM_Tooth_" + label + "_" + i,
                    crownWidth, crownWidth * 0.66f, depth, ToothHeight,
                    cuspRound: Mathf.Lerp(0.10f, 0.26f, toBack),
                    seed: (upper ? 100 : 200) + i);

                var tooth = new GameObject((upper ? "upper" : "lower") + "-tooth-" + i);
                tooth.transform.SetParent(archRoot.transform, false);

                // The mesh has its crown at +Y and root at -Y, so the upper
                // arch is the same tooth rolled 180 degrees. Position by the
                // crown, not the centre, so both rows meet the same gap.
                float centreY = upper
                    ? UpperCrownY + ToothHeight * 0.5f
                    : LowerCrownY - ToothHeight * 0.5f;
                tooth.transform.position = new Vector3(here.x, centreY, here.z);

                // Face each tooth along the arch normal, and tilt it slightly
                // inward the way real teeth lean toward the tongue.
                float yaw = Mathf.Rad2Deg * angle;
                tooth.transform.rotation = Quaternion.Euler(0f, yaw, upper ? 180f : 0f)
                    * Quaternion.Euler(upper ? 6f : -6f, 0f, 0f);

                tooth.AddComponent<MeshFilter>().sharedMesh = mesh;
                var renderer = tooth.AddComponent<MeshRenderer>();
                renderer.sharedMaterial = material;
                renderer.shadowCastingMode = ShadowCastingMode.Off;
                renderer.receiveShadows = false;
                result.Add(renderer);
            }
            return result.ToArray();
        }

        static Vector3 ArchPoint(float angle) =>
            new Vector3(Mathf.Sin(angle) * ArchX, 0f, -Mathf.Cos(angle) * ArchZ);

        /// The uvula. Nothing else in the scene says "mouth" so unmistakably,
        /// and it's the landmark that gives the throat its depth.
        static void BuildUvula()
        {
            var mesh = ProceduralAssets.Sphere("SM_Uvula", 24, 18, 1f,
                inward: false, lumpiness: 0.10f, lumpScale: 4f, seed: 41);

            var go = new GameObject("Uvula");
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var renderer = go.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = ProceduralAssets.TongueMaterial();
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            renderer.receiveShadows = false;
            go.transform.position = new Vector3(0f, 3.4f, 8.2f);
            go.transform.localScale = new Vector3(0.9f, 2.6f, 0.9f);
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
