using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

namespace InsideTheSip.EditorTools
{
    /// Drops real downloaded anatomy into the scene with the right material,
    /// scale, orientation and colliders — the step that takes the project
    /// from "clearly generated" to "clearly real".
    ///
    /// Usage: select any model in the Project window (or its instance in the
    /// scene) and pick a menu item under Inside the Sip > Use Selected Model
    /// As. Procedural geometry it replaces is disabled, not deleted, so you
    /// can flip back and compare.
    ///
    /// See docs/IMPORTING_ANATOMY.md for where to get the models and how to
    /// prepare them.
    public static class AnatomyImporter
    {
        /// Matches MouthSceneBuilder's arch: 2 * ArchX, so an imported jaw
        /// lands at the same width the scene was composed around.
        const float TargetArchWidth = 12.4f;

        /// Vertical centre of the bite gap in the showcase scene.
        const float ArchCentreY = 0.3f;

        /// For a model that is a whole dental arch in one mesh — the common
        /// case for scanned dentistry assets. Places it once, fits it to the
        /// arch, splits enamel from gum by mesh name, and retires the
        /// generated teeth rather than stacking on top of them.
        [MenuItem("Inside the Sip/Use Selected Model As/Full Dental Arch (whole jaw in one model)")]
        public static void UseAsDentalArch()
        {
            var source = RequireSelection();
            if (source == null) return;

            var generated = GameObject.Find("Teeth");
            if (generated == null)
            {
                Debug.LogError("Inside the Sip: no 'Teeth' object in the scene. " +
                    "Run 'Build Mouth Scene (Showcase)' first.");
                return;
            }

            // Keep the generated arch around but switched off, so you can
            // toggle it back on to compare.
            generated.SetActive(false);

            var existing = GameObject.Find("Dental Arch (imported)");
            if (existing != null) Object.DestroyImmediate(existing);

            var anchor = new GameObject("Dental Arch (imported)");
            var instance = (GameObject)PrefabUtility.InstantiatePrefab(source);
            if (instance == null) instance = Object.Instantiate(source);
            instance.transform.SetParent(anchor.transform, false);

            var renderers = instance.GetComponentsInChildren<MeshRenderer>(true);
            if (renderers.Length == 0)
            {
                Debug.LogError("Inside the Sip: '" + source.name + "' has no renderers.");
                Object.DestroyImmediate(anchor);
                return;
            }

            // Fit and centre by world bounds — downloaded models arrive at
            // arbitrary scales and are rarely centred on their own origin.
            var bounds = renderers[0].bounds;
            foreach (var r in renderers) bounds.Encapsulate(r.bounds);

            float widest = Mathf.Max(bounds.size.x, bounds.size.z);
            if (widest > 0.0001f)
            {
                float scale = TargetArchWidth / widest;
                instance.transform.localScale *= scale;
                bounds = renderers[0].bounds;
                foreach (var r in renderers) bounds.Encapsulate(r.bounds);
            }
            instance.transform.position -= bounds.center;
            anchor.transform.position = new Vector3(0f, ArchCentreY, 0f);

            // Enamel decays; gum does not. Split them by name, which is how
            // these models are almost always authored.
            var toothMaterial = ProceduralAssets.ToothMaterial();
            var gumMaterial = ProceduralAssets.FleshMaterial();
            var enamel = new List<Renderer>();

            foreach (var r in renderers)
            {
                string name = (r.name + " " + r.transform.parent?.name).ToLowerInvariant();
                bool isGum = name.Contains("gum") || name.Contains("gingiv");
                r.sharedMaterial = isGum ? gumMaterial : toothMaterial;
                r.shadowCastingMode = ShadowCastingMode.Off;
                r.receiveShadows = false;
                if (!isGum) enamel.Add(r);
            }

            var controller = Object.FindFirstObjectByType<ToothDecayController>();
            if (controller != null) controller.teeth = enamel.ToArray();

            Selection.activeGameObject = anchor;
            Debug.Log("Inside the Sip: imported '" + source.name + "' as the dental arch. " +
                enamel.Count + " enamel renderer(s) wired to the decay controller, " +
                (renderers.Length - enamel.Count) + " treated as gum.\n" +
                "The generated teeth are disabled, not deleted — re-enable 'Teeth' to compare.\n" +
                "Now nudge the 'Dental Arch (imported)' transform: rotate it if the bite " +
                "faces the wrong way, and adjust Y until your eyeline sits in the bite gap.\n" +
                "If the model has its own colour/normal textures, drag them into the " +
                "M_Tooth material's Healthy Albedo and Normal Map slots — they will beat " +
                "the generated ones every time.");
        }

        [MenuItem("Inside the Sip/Use Selected Model As/Tooth (one tooth, cloned to all 22)")]
        public static void UseAsTooth()
        {
            var source = RequireSelection();
            if (source == null) return;

            var teeth = GameObject.Find("Teeth");
            if (teeth == null)
            {
                Debug.LogError("Inside the Sip: no 'Teeth' object in the scene. " +
                    "Run 'Build Mouth Scene (Showcase)' first.");
                return;
            }

            var material = ProceduralAssets.ToothMaterial();
            var replaced = new List<Renderer>();

            // Every generated tooth is a MeshFilter under Teeth. Swap each
            // one's mesh for the real model, keeping the arch layout — the
            // positions and rotations are the part worth keeping.
            foreach (var filter in teeth.GetComponentsInChildren<MeshFilter>(true))
            {
                var mesh = FirstMesh(source);
                if (mesh == null) return;

                filter.sharedMesh = mesh;
                var renderer = filter.GetComponent<MeshRenderer>();
                if (renderer != null)
                {
                    renderer.sharedMaterial = material;
                    replaced.Add(renderer);
                }
                FitToHeight(filter.transform, mesh, targetHeight: 4.0f);
            }

            var controller = Object.FindFirstObjectByType<ToothDecayController>();
            if (controller != null) controller.teeth = replaced.ToArray();

            Debug.Log("Inside the Sip: swapped " + replaced.Count + " teeth for '" +
                source.name + "'.\nIf they look wrong-way-up, set the model's " +
                "import rotation in its Inspector, or rotate the 'Teeth' object.\n" +
                "IMPORTANT: the decay shader needs UVs where v=0 is the biting edge " +
                "and v=1 the root. If the stain creeps the wrong way, flip V in Blender.");
        }

        [MenuItem("Inside the Sip/Use Selected Model As/Mouth Cavern")]
        public static void UseAsCavern() =>
            Swap("Mouth Cavern", ProceduralAssets.FleshMaterial(), addMeshCollider: true);

        [MenuItem("Inside the Sip/Use Selected Model As/Tongue")]
        public static void UseAsTongue() =>
            Swap("Tongue", ProceduralAssets.TongueMaterial(), addMeshCollider: false);

        [MenuItem("Inside the Sip/Use Selected Model As/Throat")]
        public static void UseAsThroat() =>
            Swap("Throat (peristalsis)", ProceduralAssets.ThroatMaterial(), addMeshCollider: false);

        // ---------------------------------------------------------------

        static void Swap(string targetName, Material material, bool addMeshCollider)
        {
            var source = RequireSelection();
            if (source == null) return;

            var target = GameObject.Find(targetName);
            if (target == null)
            {
                Debug.LogError("Inside the Sip: no '" + targetName + "' in the scene. " +
                    "Run 'Build Mouth Scene (Showcase)' first.");
                return;
            }

            var mesh = FirstMesh(source);
            if (mesh == null) return;

            var filter = target.GetComponent<MeshFilter>() ?? target.AddComponent<MeshFilter>();
            var renderer = target.GetComponent<MeshRenderer>() ?? target.AddComponent<MeshRenderer>();

            filter.sharedMesh = mesh;
            renderer.sharedMaterial = material;
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            renderer.receiveShadows = false;

            if (addMeshCollider)
            {
                var collider = target.GetComponent<MeshCollider>()
                    ?? target.AddComponent<MeshCollider>();
                collider.sharedMesh = mesh;
            }

            EditorUtility.SetDirty(target);
            Debug.Log("Inside the Sip: '" + targetName + "' now uses mesh '" + mesh.name +
                "' from '" + source.name + "'. Adjust its Scale in the Inspector until it " +
                "surrounds you correctly — the generated version was " +
                target.transform.localScale + ".");
        }

        static GameObject RequireSelection()
        {
            var go = Selection.activeGameObject;
            if (go == null)
            {
                Debug.LogError("Inside the Sip: select a model first — click the .fbx, " +
                    ".obj or .glb in the Project window, then use this menu.");
                return null;
            }
            return go;
        }

        /// Anatomy downloads are usually a hierarchy with the mesh buried a
        /// few levels down, so search rather than expecting it at the root.
        static Mesh FirstMesh(GameObject source)
        {
            var filter = source.GetComponentInChildren<MeshFilter>(true);
            if (filter != null && filter.sharedMesh != null) return filter.sharedMesh;

            var skinned = source.GetComponentInChildren<SkinnedMeshRenderer>(true);
            if (skinned != null && skinned.sharedMesh != null) return skinned.sharedMesh;

            Debug.LogError("Inside the Sip: no mesh found inside '" + source.name +
                "'. Select the model asset itself, not a folder or a texture.");
            return null;
        }

        /// Downloaded models arrive at wildly different scales — millimetres,
        /// centimetres, arbitrary units. Normalise by bounding box so a tooth
        /// is a tooth whatever the exporter thought.
        static void FitToHeight(Transform transform, Mesh mesh, float targetHeight)
        {
            float sourceHeight = mesh.bounds.size.y;
            if (sourceHeight <= 0.0001f) return;
            float scale = targetHeight / sourceHeight;
            transform.localScale = Vector3.one * scale;
        }
    }
}
