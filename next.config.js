// Statischer Export für GitHub Pages. Auf Pages liegt die App unter
// /<repo-name>/ – der Pfad kommt im CI über NEXT_PUBLIC_BASE_PATH rein.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  reactStrictMode: true,
  images: { unoptimized: true },
};

module.exports = nextConfig;
