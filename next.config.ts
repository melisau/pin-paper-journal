import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  allowedDevOrigins: ["172.23.176.1", "192.168.1.46"],
};

export default nextConfig;
