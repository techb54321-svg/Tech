using UnityEngine;

namespace InsideTheSip
{
    /// A Catmull-Rom spline through a set of control points, matching the
    /// behaviour of three.js CatmullRomCurve3 closely enough that the ride
    /// follows the same shape as the WebXR prototype:
    /// GetPoint(i / (N - 1)) passes exactly through control point i.
    public class CatmullRomPath
    {
        readonly Vector3[] points;

        public CatmullRomPath(Vector3[] controlPoints)
        {
            if (controlPoints == null || controlPoints.Length < 2)
            {
                Debug.LogError("CatmullRomPath needs at least 2 control points.");
                points = new[] { Vector3.zero, Vector3.forward };
                return;
            }
            points = controlPoints;
        }

        public int Count => points.Length;

        /// Normalized parameter for control point i, so the ride can travel
        /// exactly from one journey step to the next.
        public float ParameterAt(int index) =>
            Mathf.Clamp01(index / (float)(points.Length - 1));

        public Vector3 GetPoint(float t)
        {
            t = Mathf.Clamp01(t);
            int segments = points.Length - 1;
            float scaled = t * segments;
            int i = Mathf.Min(Mathf.FloorToInt(scaled), segments - 1);
            float u = scaled - i;

            // Clamp neighbours at the ends (open, non-looping curve).
            Vector3 p0 = points[Mathf.Max(i - 1, 0)];
            Vector3 p1 = points[i];
            Vector3 p2 = points[i + 1];
            Vector3 p3 = points[Mathf.Min(i + 2, points.Length - 1)];

            return Interpolate(p0, p1, p2, p3, u);
        }

        /// Forward direction of travel, via a small finite difference.
        public Vector3 GetTangent(float t)
        {
            const float h = 0.001f;
            Vector3 a = GetPoint(Mathf.Clamp01(t - h));
            Vector3 b = GetPoint(Mathf.Clamp01(t + h));
            Vector3 d = b - a;
            return d.sqrMagnitude < 1e-10f ? Vector3.forward : d.normalized;
        }

        static Vector3 Interpolate(Vector3 p0, Vector3 p1, Vector3 p2, Vector3 p3, float u)
        {
            // Standard uniform Catmull-Rom basis.
            float u2 = u * u;
            float u3 = u2 * u;
            return 0.5f * (
                2f * p1 +
                (-p0 + p2) * u +
                (2f * p0 - 5f * p1 + 4f * p2 - p3) * u2 +
                (-p0 + 3f * p1 - 3f * p2 + p3) * u3);
        }
    }
}
