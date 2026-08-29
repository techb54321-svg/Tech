using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace InsideTheSip.EditorTools
{
    /// Generates every texture, material and mesh the showcase scenes need,
    /// so the project looks organic before a single asset is downloaded.
    /// Everything lands in Assets/InsideTheSip/Generated and is only built
    /// once — delete that folder to force a regenerate.
    public static class ProceduralAssets
    {
        public const string Root = "Assets/InsideTheSip/Generated";
        // Base maps get the resolution; detail and mask maps tile heavily
        // so they stay small without looking soft.
        const int BaseSize = 1024;
        const int DetailSize = 512;

        // ---------------------------------------------------------------
        // Materials
        // ---------------------------------------------------------------

        public static Material FleshMaterial()
        {
            string path = Root + "/M_Flesh.mat";
            var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (existing != null) return existing;

            var mat = new Material(RequireShader("InsideTheSip/Flesh"));
            mat.SetTexture("_BaseMap", FleshAlbedo());
            mat.SetTextureScale("_BaseMap", new Vector2(4f, 2f));
            mat.SetTexture("_BumpMap", FleshNormal());
            mat.SetFloat("_BumpScale", 1.4f);
            mat.SetTexture("_DetailNormalMap", FleshDetailNormal());
            mat.SetFloat("_DetailTiling", 26f);
            mat.SetFloat("_DetailStrength", 1.1f);
            mat.SetTexture("_MaskMap", FleshMask());
            mat.SetFloat("_MaskTiling", 3f);
            mat.SetFloat("_OcclusionStrength", 0.9f);
            mat.SetColor("_BaseColor", new Color(0.86f, 0.42f, 0.40f));
            mat.SetFloat("_SpecPower", 42f);        // wet, but not a mirror
            mat.SetFloat("_SpecIntensity", 1.6f);
            mat.SetFloat("_SpecVariation", 0.85f);  // puddles glint, dry patches don't
            mat.SetFloat("_WrapAmount", 0.6f);
            mat.SetColor("_SubsurfaceColor", new Color(0.85f, 0.16f, 0.12f));
            mat.SetFloat("_RimPower", 2.2f);
            mat.SetColor("_EmissionColor", new Color(0.55f, 0.06f, 0.04f));
            mat.SetFloat("_EmissionBase", 0.14f);
            mat.SetFloat("_PulseEmission", 0.55f);
            mat.SetFloat("_PulseSwell", 0.035f);    // the cavern breathes
            Save(mat, path);
            return mat;
        }

        public static Material TongueMaterial()
        {
            string path = Root + "/M_Tongue.mat";
            var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (existing != null) return existing;

            var mat = new Material(FleshMaterial());
            mat.SetTextureScale("_BaseMap", new Vector2(8f, 4f)); // finer papillae
            mat.SetColor("_BaseColor", new Color(0.78f, 0.36f, 0.36f));
            mat.SetFloat("_BumpScale", 2.2f);
            mat.SetFloat("_DetailTiling", 44f);     // papillae are tiny
            mat.SetFloat("_DetailStrength", 1.5f);
            mat.SetFloat("_MaskTiling", 5f);
            mat.SetFloat("_SpecIntensity", 2.2f);
            mat.SetFloat("_PulseSwell", 0.012f);
            Save(mat, path);
            return mat;
        }

        public static Material ThroatMaterial()
        {
            string path = Root + "/M_Throat.mat";
            var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (existing != null) return existing;

            var mat = new Material(FleshMaterial());
            mat.SetColor("_BaseColor", new Color(0.66f, 0.26f, 0.27f));
            mat.SetFloat("_WaveAmplitude", 0.22f);  // peristalsis: it swallows
            mat.SetFloat("_WaveLength", 3.5f);
            mat.SetFloat("_WaveSpeed", 0.55f);
            Save(mat, path);
            return mat;
        }

        public static Material ToothMaterial()
        {
            string path = Root + "/M_Tooth.mat";
            var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (existing != null) return existing;

            var mat = new Material(RequireShader("InsideTheSip/ToothDecay"));
            mat.SetTexture("_HealthyMap", ToothHealthy());
            mat.SetTexture("_DecayMap", ToothDecayed());
            mat.SetTexture("_BumpMap", ToothNormal());
            mat.SetTexture("_NoiseMap", ToothNoise());
            mat.SetTexture("_DetailNormalMap", ToothDetailNormal());
            mat.SetFloat("_DetailTiling", 30f);
            mat.SetFloat("_DetailStrength", 0.75f);
            mat.SetFloat("_BumpScale", 0.8f);
            mat.SetFloat("_Erosion", 0f);
            mat.SetFloat("_EdgeWidth", 0.16f);
            mat.SetColor("_EdgeColor", new Color(0.42f, 0.24f, 0.08f, 0.9f));
            mat.SetColor("_StainTint", new Color(0.88f, 0.74f, 0.5f, 1f));
            mat.SetFloat("_RecessionDepth", 0.016f); // teeth are huge here
            mat.SetFloat("_HealthyGloss", 110f);
            mat.SetFloat("_DecayGloss", 5f);
            mat.SetFloat("_SpecIntensity", 1.1f);
            Save(mat, path);
            return mat;
        }

        public static Material ColaMaterial()
        {
            string path = Root + "/M_Cola.mat";
            var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (existing != null) return existing;

            var mat = new Material(RequireShader("InsideTheSip/AcidLiquid"));
            mat.SetTexture("_NormalMap", RippleNormal());
            mat.SetFloat("_NormalScale", 1.3f);
            mat.SetColor("_DeepColor", new Color(0.10f, 0.035f, 0.012f, 0.94f));
            mat.SetColor("_ShallowColor", new Color(0.75f, 0.34f, 0.07f, 1f));
            mat.SetVector("_Scroll1", new Vector4(0.02f, 0.015f, 3f, 0f));
            mat.SetVector("_Scroll2", new Vector4(-0.017f, 0.026f, 6.5f, 0f));
            mat.SetColor("_EmissionColor", new Color(0.42f, 0.14f, 0.02f));
            mat.SetFloat("_EmissionStrength", 0.3f);
            mat.SetFloat("_WaveHeight", 0.06f);
            mat.SetFloat("_WaveFrequency", 0.7f);
            Save(mat, path);
            return mat;
        }

        // ---------------------------------------------------------------
        // Textures
        // ---------------------------------------------------------------

        public static Texture2D FleshAlbedo() => Cached("/T_FleshAlbedo.png", false, BaseSize, () =>
            Paint(BaseSize, (u, v) =>
            {
                float blotch = Fbm(u, v, 4, 4, 0.55f, new Vector2(11f, 3f));
                float fine = Fbm(u, v, 16, 3, 0.5f, new Vector2(41f, 17f));
                float veins = 1f - Mathf.Abs(Fbm(u, v, 3, 3, 0.6f, new Vector2(7f, 29f)) - 0.5f) * 2f;
                veins = Mathf.Pow(Mathf.Clamp01(veins), 9f);

                var deep = new Color(0.42f, 0.13f, 0.13f);
                var mid = new Color(0.80f, 0.40f, 0.38f);
                var pale = new Color(0.94f, 0.66f, 0.60f);
                Color c = Color.Lerp(deep, mid, Mathf.Clamp01(blotch * 1.3f));
                c = Color.Lerp(c, pale, fine * 0.35f);
                c = Color.Lerp(c, new Color(0.55f, 0.07f, 0.09f), veins * 0.5f);
                return c;
            }));

        public static Texture2D FleshNormal() => Cached("/T_FleshNormal.png", true, BaseSize, () =>
            NormalFromHeight(BaseSize, (u, v) =>
            {
                float lumps = Fbm(u, v, 5, 4, 0.55f, new Vector2(11f, 3f));
                float pores = Fbm(u, v, 24, 3, 0.5f, new Vector2(63f, 5f));
                return lumps * 0.75f + pores * 0.25f;
            }, 5.5f));

        public static Texture2D ToothHealthy() => Cached("/T_ToothHealthy.png", false, BaseSize, () =>
            Paint(BaseSize, (u, v) =>
            {
                // Enamel: near-white, faintly translucent-blue at the tip,
                // warmer toward the root, with vertical growth striations.
                float striation = Fbm(u * 6f, v, 10, 3, 0.5f, new Vector2(19f, 2f));
                var tip = new Color(0.96f, 0.96f, 0.98f);
                var root = new Color(0.93f, 0.88f, 0.76f);
                Color c = Color.Lerp(tip, root, Mathf.Clamp01(v * 1.15f));
                return Color.Lerp(c, c * 0.94f, striation * 0.5f);
            }));

        public static Texture2D ToothDecayed() => Cached("/T_ToothDecayed.png", false, BaseSize, () =>
            Paint(BaseSize, (u, v) =>
            {
                float grime = Fbm(u, v, 8, 4, 0.55f, new Vector2(31f, 13f));
                float pit = Fbm(u, v, 20, 3, 0.5f, new Vector2(5f, 47f));
                var stain = new Color(0.55f, 0.40f, 0.20f);
                var rot = new Color(0.22f, 0.14f, 0.07f);
                Color c = Color.Lerp(stain, rot, Mathf.Clamp01(grime * 1.4f));
                return Color.Lerp(c, rot * 0.6f, Mathf.Pow(pit, 3f));
            }));

        public static Texture2D ToothNormal() => Cached("/T_ToothNormal.png", true, BaseSize, () =>
            NormalFromHeight(BaseSize, (u, v) =>
                Fbm(u * 5f, v, 12, 3, 0.5f, new Vector2(19f, 2f)) * 0.6f +
                Fbm(u, v, 26, 2, 0.5f, new Vector2(3f, 61f)) * 0.4f, 2.5f));

        /// Mask that drives where erosion starts. Low values go first, so the
        /// bias toward the gum line makes decay creep up from the roots.
        public static Texture2D ToothNoise() => Cached("/T_ToothNoise.png", false, BaseSize, () =>
            Paint(BaseSize, (u, v) =>
            {
                float n = Fbm(u, v, 6, 4, 0.55f, new Vector2(23f, 71f));
                float gumBias = Mathf.Clamp01(1f - v);   // v=1 is the root end
                float m = Mathf.Clamp01(n * 0.65f + gumBias * 0.35f);
                return new Color(m, m, m, 1f);
            }), linear: true);

        /// R = ambient occlusion, G = wetness. One texture, one sample:
        /// crevices go dark, and only some patches glint.
        public static Texture2D FleshMask() => Cached("/T_FleshMask.png", false, DetailSize, () =>
            Paint(DetailSize, (u, v) =>
            {
                float height = Fbm(u, v, 5, 4, 0.55f, new Vector2(11f, 3f));
                float ao = 0.30f + 0.70f * Mathf.Pow(Mathf.Clamp01(height), 0.65f);
                // Wetness pools in the low spots and varies on a larger scale
                // than the bumps, so glints read as puddles, not noise.
                float pooling = 1f - Mathf.Clamp01(height);
                float patches = Fbm(u, v, 3, 3, 0.6f, new Vector2(57f, 91f));
                float wetness = Mathf.Clamp01(patches * 0.6f + pooling * 0.55f);
                return new Color(ao, wetness, 0f, 1f);
            }), linear: true);

        /// Fine pores, sampled at high tiling so surfaces keep texture when
        /// your face is 20 cm away — which in VR is most of the time.
        public static Texture2D FleshDetailNormal() =>
            Cached("/T_FleshDetail.png", true, DetailSize, () =>
                NormalFromHeight(DetailSize, (u, v) =>
                    Fbm(u, v, 14, 3, 0.5f, new Vector2(101f, 17f)) * 0.6f +
                    Fbm(u, v, 34, 2, 0.5f, new Vector2(7f, 133f)) * 0.4f, 2.8f));

        /// Micro-scratches for enamel — polished, never optically perfect.
        public static Texture2D ToothDetailNormal() =>
            Cached("/T_ToothDetail.png", true, DetailSize, () =>
                NormalFromHeight(DetailSize, (u, v) =>
                {
                    float scratches = Fbm(u * 14f, v * 0.6f, 20, 2, 0.5f, new Vector2(3f, 88f));
                    float grain = Fbm(u, v, 40, 2, 0.5f, new Vector2(45f, 12f));
                    return scratches * 0.65f + grain * 0.35f;
                }, 1.6f));

        public static Texture2D RippleNormal() => Cached("/T_RippleNormal.png", true, DetailSize, () =>
            NormalFromHeight(DetailSize, (u, v) =>
                Fbm(u, v, 6, 4, 0.55f, new Vector2(83f, 7f)) * 0.7f +
                Mathf.Sin((u + v) * Mathf.PI * 8f) * 0.15f + 0.15f, 3.5f));

        // ---------------------------------------------------------------
        // Meshes
        // ---------------------------------------------------------------

        /// A lumpy UV sphere. `inward` builds it inside-out, so you stand
        /// within it and see the walls — that's the mouth cavern.
        public static Mesh Sphere(string assetName, int lon, int lat, float radius,
            bool inward, float lumpiness, float lumpScale, int seed)
        {
            string path = Root + "/" + assetName + ".asset";
            var existing = AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if (existing != null) return existing;

            var verts = new List<Vector3>((lon + 1) * (lat + 1));
            var uvs = new List<Vector2>((lon + 1) * (lat + 1));
            var tris = new List<int>(lon * lat * 6);
            var rng = new System.Random(seed);
            var offset = new Vector3(rng.Next(0, 900), rng.Next(0, 900), rng.Next(0, 900));

            for (int y = 0; y <= lat; y++)
            {
                float v = y / (float)lat;
                float phi = v * Mathf.PI;
                for (int x = 0; x <= lon; x++)
                {
                    float u = x / (float)lon;
                    float theta = u * Mathf.PI * 2f;
                    var dir = new Vector3(
                        Mathf.Sin(phi) * Mathf.Cos(theta),
                        Mathf.Cos(phi),
                        Mathf.Sin(phi) * Mathf.Sin(theta));

                    // Lumps from 3D-ish noise so there is no visible seam.
                    Vector3 p = dir * lumpScale + offset;
                    float n = (Mathf.PerlinNoise(p.x, p.y) + Mathf.PerlinNoise(p.y, p.z)
                        + Mathf.PerlinNoise(p.z, p.x)) / 3f;
                    verts.Add(dir * (radius * (1f + lumpiness * (n - 0.5f))));
                    uvs.Add(new Vector2(u, v));
                }
            }

            for (int y = 0; y < lat; y++)
            {
                for (int x = 0; x < lon; x++)
                {
                    int a = y * (lon + 1) + x;
                    int b = a + 1;
                    int c = a + lon + 1;
                    int d = c + 1;
                    tris.Add(a); tris.Add(c); tris.Add(b);
                    tris.Add(b); tris.Add(c); tris.Add(d);
                }
            }

            // Rather than reason about winding conventions, measure it: a
            // triangle's facing is the direction of Cross(b-a, c-a). Compare
            // that with which way the surface bulges and flip if needed.
            Vector3 p0 = verts[tris[0]], p1 = verts[tris[1]], p2 = verts[tris[2]];
            Vector3 facing = Vector3.Cross(p1 - p0, p2 - p0);
            bool facesOutward = Vector3.Dot(facing, (p0 + p1 + p2) / 3f) > 0f;
            if (facesOutward == inward)
            {
                for (int i = 0; i < tris.Count; i += 3)
                {
                    int t = tris[i];
                    tris[i] = tris[i + 2];
                    tris[i + 2] = t;
                }
            }

            var mesh = new Mesh { name = assetName };
            mesh.indexFormat = verts.Count > 65000
                ? UnityEngine.Rendering.IndexFormat.UInt32
                : UnityEngine.Rendering.IndexFormat.UInt16;
            mesh.SetVertices(verts);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateNormals();
            mesh.RecalculateTangents();
            mesh.RecalculateBounds();

            EnsureFolder();
            AssetDatabase.CreateAsset(mesh, path);
            return mesh;
        }

        /// An elliptical gum ridge for teeth to emerge from. Without this the
        /// teeth read as tiles floating in space — sockets are what make a
        /// row of enamel look like a jaw.
        public static Mesh GumRidge(string assetName, float archX, float archZ,
            float thickness, float arcDegrees, int seed)
        {
            string path = Root + "/" + assetName + ".asset";
            var existing = AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if (existing != null) return existing;

            const int along = 80;   // steps around the arch
            const int around = 14;  // steps around the tube
            var verts = new List<Vector3>();
            var uvs = new List<Vector2>();
            var tris = new List<int>();
            var rng = new System.Random(seed);
            float wobble = (float)rng.NextDouble() * 90f;

            for (int i = 0; i <= along; i++)
            {
                float t = i / (float)along;
                float angle = Mathf.Deg2Rad * Mathf.Lerp(-arcDegrees, arcDegrees, t);
                var centre = new Vector3(Mathf.Sin(angle) * archX, 0f, -Mathf.Cos(angle) * archZ);
                // Tangent of the ellipse, so the tube stays perpendicular.
                var tangent = new Vector3(Mathf.Cos(angle) * archX, 0f,
                    Mathf.Sin(angle) * archZ).normalized;
                var outward = new Vector3(-tangent.z, 0f, tangent.x);

                for (int j = 0; j <= around; j++)
                {
                    float a = j / (float)around * Mathf.PI * 2f;
                    float bump = 1f + 0.10f * (Mathf.PerlinNoise(i * 0.22f + wobble, j * 0.3f) - 0.5f);
                    Vector3 offset = (outward * Mathf.Cos(a) + Vector3.up * Mathf.Sin(a))
                        * thickness * bump;
                    verts.Add(centre + offset);
                    uvs.Add(new Vector2(t * 6f, j / (float)around));
                }
            }

            for (int i = 0; i < along; i++)
            {
                for (int j = 0; j < around; j++)
                {
                    int a = i * (around + 1) + j;
                    int b = a + 1;
                    int c = a + around + 1;
                    int d = c + 1;
                    tris.Add(a); tris.Add(c); tris.Add(b);
                    tris.Add(b); tris.Add(c); tris.Add(d);
                }
            }

            var mesh = new Mesh { name = assetName };
            mesh.SetVertices(verts);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateNormals();
            mesh.RecalculateTangents();
            mesh.RecalculateBounds();

            EnsureFolder();
            AssetDatabase.CreateAsset(mesh, path);
            return mesh;
        }

        /// A tooth: a tapered, rounded block. Crown at +Y, root at -Y, with
        /// UVs running v=0 at the biting edge to v=1 at the gum line so the
        /// erosion mask can creep upward from the root.
        public static Mesh Tooth(string assetName, float crownWidth, float rootWidth,
            float depth, float height, float cuspRound, int seed)
        {
            string path = Root + "/" + assetName + ".asset";
            var existing = AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if (existing != null) return existing;

            const int rings = 14;
            const int segments = 16;
            var verts = new List<Vector3>();
            var uvs = new List<Vector2>();
            var tris = new List<int>();
            var rng = new System.Random(seed);
            float wobble = (float)rng.NextDouble() * 100f;

            for (int r = 0; r <= rings; r++)
            {
                float t = r / (float)rings;              // 0 = crown, 1 = root
                float y = height * (0.5f - t);
                // Rounded biting surface, then a taper down to the root.
                float shape = t < cuspRound
                    ? Mathf.Sin(t / cuspRound * Mathf.PI * 0.5f)
                    : 1f;
                float w = Mathf.Lerp(crownWidth, rootWidth, t) * shape;
                float d = Mathf.Lerp(depth, depth * 0.72f, t) * shape;

                for (int s = 0; s <= segments; s++)
                {
                    float a = s / (float)segments * Mathf.PI * 2f;
                    // Superellipse: blockier than a circle, like a real crown.
                    float ca = Mathf.Cos(a), sa = Mathf.Sin(a);
                    float px = Mathf.Sign(ca) * Mathf.Pow(Mathf.Abs(ca), 0.65f) * w * 0.5f;
                    float pz = Mathf.Sign(sa) * Mathf.Pow(Mathf.Abs(sa), 0.65f) * d * 0.5f;
                    float bump = Mathf.PerlinNoise(s * 0.3f + wobble, r * 0.35f) * 0.04f;
                    verts.Add(new Vector3(px * (1f + bump), y, pz * (1f + bump)));
                    uvs.Add(new Vector2(s / (float)segments, t));
                }
            }

            for (int r = 0; r < rings; r++)
            {
                for (int s = 0; s < segments; s++)
                {
                    int a = r * (segments + 1) + s;
                    int b = a + 1;
                    int c = a + segments + 1;
                    int d = c + 1;
                    tris.Add(a); tris.Add(c); tris.Add(b);
                    tris.Add(b); tris.Add(c); tris.Add(d);
                }
            }

            Vector3 q0 = verts[tris[0]], q1 = verts[tris[1]], q2 = verts[tris[2]];
            Vector3 face = Vector3.Cross(q1 - q0, q2 - q0);
            Vector3 radial = (q0 + q1 + q2) / 3f;
            radial.y = 0f;
            if (Vector3.Dot(face, radial) < 0f)
            {
                for (int i = 0; i < tris.Count; i += 3)
                {
                    int t = tris[i];
                    tris[i] = tris[i + 2];
                    tris[i + 2] = t;
                }
            }

            var mesh = new Mesh { name = assetName };
            mesh.SetVertices(verts);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateNormals();
            mesh.RecalculateTangents();
            mesh.RecalculateBounds();

            EnsureFolder();
            AssetDatabase.CreateAsset(mesh, path);
            return mesh;
        }

        // ---------------------------------------------------------------
        // Plumbing
        // ---------------------------------------------------------------

        static Shader RequireShader(string name)
        {
            var shader = Shader.Find(name);
            if (shader == null)
                throw new FileNotFoundException("Shader '" + name + "' not found. Is the " +
                    "InsideTheSip/Shaders folder in the project?");
            return shader;
        }

        static void EnsureFolder()
        {
            if (!AssetDatabase.IsValidFolder("Assets/InsideTheSip"))
                AssetDatabase.CreateFolder("Assets", "InsideTheSip");
            if (!AssetDatabase.IsValidFolder(Root))
                AssetDatabase.CreateFolder("Assets/InsideTheSip", "Generated");
        }

        static void Save(Object asset, string path)
        {
            EnsureFolder();
            AssetDatabase.CreateAsset(asset, path);
        }

        delegate Color Shade(float u, float v);
        delegate float Height(float u, float v);

        static Texture2D Cached(string file, bool isNormalMap, int size,
            System.Func<Color[]> build, bool linear = false)
        {
            EnsureFolder();
            string path = Root + file;
            var existing = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            if (existing != null) return existing;

            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            tex.SetPixels(build());
            tex.Apply();
            File.WriteAllBytes(path, tex.EncodeToPNG());
            Object.DestroyImmediate(tex);

            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            // Let Unity do the platform-correct normal encoding rather than
            // guessing at it ourselves.
            importer.textureType = isNormalMap
                ? TextureImporterType.NormalMap
                : TextureImporterType.Default;
            if (!isNormalMap) importer.sRGBTexture = !linear;
            importer.wrapMode = TextureWrapMode.Repeat;
            importer.mipmapEnabled = true;
            importer.SaveAndReimport();

            return AssetDatabase.LoadAssetAtPath<Texture2D>(path);
        }

        static Color[] Paint(int size, Shade shade)
        {
            var pixels = new Color[size * size];
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                    pixels[y * size + x] = shade(x / (float)size, y / (float)size);
            return pixels;
        }

        static Color[] NormalFromHeight(int size, Height height, float strength)
        {
            var h = new float[size, size];
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                    h[x, y] = height(x / (float)size, y / (float)size);

            var pixels = new Color[size * size];
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float left = h[(x - 1 + size) % size, y];
                    float right = h[(x + 1) % size, y];
                    float down = h[x, (y - 1 + size) % size];
                    float up = h[x, (y + 1) % size];
                    var n = new Vector3((left - right) * strength,
                        (down - up) * strength, 1f).normalized;
                    pixels[y * size + x] = new Color(
                        n.x * 0.5f + 0.5f, n.y * 0.5f + 0.5f, n.z * 0.5f + 0.5f, 1f);
                }
            }
            return pixels;
        }

        /// Fractal noise that tiles seamlessly over the texture, by blending
        /// four shifted samples of Unity's Perlin across the wrap.
        static float Fbm(float u, float v, int basePeriod, int octaves, float gain, Vector2 seed)
        {
            float sum = 0f, amplitude = 1f, total = 0f;
            int period = Mathf.Max(1, basePeriod);
            for (int i = 0; i < octaves; i++)
            {
                sum += amplitude * TileNoise(u, v, period, seed);
                total += amplitude;
                amplitude *= gain;
                period *= 2;
            }
            return Mathf.Clamp01(sum / Mathf.Max(total, 0.0001f));
        }

        static float TileNoise(float u, float v, int period, Vector2 seed)
        {
            u -= Mathf.Floor(u);
            v -= Mathf.Floor(v);
            float x = u * period + seed.x;
            float y = v * period + seed.y;
            float n00 = Mathf.PerlinNoise(x, y);
            float n10 = Mathf.PerlinNoise(x - period, y);
            float n01 = Mathf.PerlinNoise(x, y - period);
            float n11 = Mathf.PerlinNoise(x - period, y - period);
            return Mathf.Lerp(Mathf.Lerp(n00, n10, u), Mathf.Lerp(n01, n11, u), v);
        }
    }
}
