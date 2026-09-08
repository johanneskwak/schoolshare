import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      // beforeFiles: 페이지 라우트보다 먼저 검사되므로
      // 기존 /newforeignpolicy 페이지가 남아 있어도 이쪽이 우선합니다.
      beforeFiles: [
        {
          source: "/newforeignpolicy",
          destination: "/newforeignpolicy.html",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
