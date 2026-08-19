import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Media (foto's van panden, rendered video's) komt later van een externe
  // storage-bucket. Voeg hier de hostnames toe zodra die bekend zijn.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
