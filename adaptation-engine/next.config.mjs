/** @type {import('next').NextConfig} */
const nextConfig = {
  // The pipeline runs inside server actions and imports node built-ins.
  serverExternalPackages: ["@prisma/client", "@anthropic-ai/sdk"],
};

export default nextConfig;
