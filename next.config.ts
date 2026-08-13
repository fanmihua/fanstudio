import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 构建目录可经环境变量覆盖：零停机部署时先构建到 .next-build，再原子切换到 .next。
  // 运行时(next start)不设该变量 → 仍用 .next。
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // 避免 Turbopack/Webpack 打包 Prisma，使用 node_modules 中的 .prisma/client
  serverExternalPackages: ["@prisma/client", "prisma", "wechatpay-node-v3"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "cdn.jsdelivr.net" },
    ],
  },
  // 全站安全响应头（不含 CSP——严格 CSP 需逐页调试，避免误伤编辑器/内联样式）
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ]
  },
};

export default nextConfig;
