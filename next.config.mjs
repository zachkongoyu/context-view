/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  output: "export",
  images: {
    unoptimized: true,
  },
  poweredByHeader: false,
};

export default nextConfig;
