/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === "development";

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: blob: https:;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self' https://integrate.api.nvidia.com https://timeapi.io https://worldtimeapi.org https://accounts.google.com https://oauth2.googleapis.com https://sheets.googleapis.com https://docs.googleapis.com https://www.googleapis.com https://*.supabase.co;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  media-src 'self';
  child-src 'none';
  worker-src 'self' blob:;
  upgrade-insecure-requests;
  block-all-mixed-content;
`;

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Download-Options", value: "noopen" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy", value: ContentSecurityPolicy.replace(/\n/g, " ").trim() },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
];

const corsHeaders = [
  { key: "Access-Control-Allow-Origin", value: "null" },
  { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
  { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
  { key: "Access-Control-Max-Age", value: "86400" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  crossOrigin: "anonymous",
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  serverExternalPackages: [
    "three",
    "@react-three/fiber",
    "@react-three/drei",
    // DB adapters are loaded conditionally at runtime based on DATABASE_URL
    // scheme — keep them out of the bundle so a Postgres-only deploy doesn't
    // try to evaluate SQLite's `node:sqlite` import (and vice versa).
    "prisma-adapter-sqlite",
    "@prisma/adapter-pg",
    "pg",
    "pg-pool",
  ],
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          ...securityHeaders,
          ...corsHeaders,
        ]
      },
      {
        source: "/(.*)",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;