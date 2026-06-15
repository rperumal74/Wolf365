import type { NextConfig } from "next";

/**
 * Security-focused Next.js configuration.
 *
 * Security headers are applied globally. HSTS is only meaningful over HTTPS
 * (Vercel terminates TLS), and is safe to send everywhere because browsers
 * ignore it on plain HTTP.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Conservative CSP. `unsafe-inline` for styles is required by Tailwind's
    // injected styles; scripts are restricted to same-origin + Next's inline
    // bootstrap. Form posts and API calls stay same-origin; framing is denied.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Connector secrets must never leak to the client bundle. Server-only
  // packages stay on the server; we never import them from client components.
  serverExternalPackages: ["@prisma/client"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
