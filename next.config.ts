import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // public/game/ に置いた確認用の画面。
  // /game のままだと、中の ./common.js などが1つ上を指してしまうので、
  // アドレスごと /game/index.html に送る（rewrite ではなく redirect）。
  async redirects() {
    return [
      { source: "/game", destination: "/game/index.html", permanent: false },
      { source: "/game/", destination: "/game/index.html", permanent: false },
    ];
  },
};

export default nextConfig;
