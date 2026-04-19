import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
  allowedDevOrigins: ["http://10.1.1.34:3000", "http://10.1.1.*:3000", "http://192.168.*.*:3000"],
};

export default nextConfig;
