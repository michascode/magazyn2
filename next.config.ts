// next.config.ts
/** @type {import('next').NextConfig} */
const nextConfig = {
  // W devie React uruchamia efekty 2x — to wyłączamy,
  // żeby nie dublować requestów. W produkcji i tak jest 1x.
  reactStrictMode: false,
};

export default nextConfig;
