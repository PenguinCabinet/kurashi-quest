import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // public/game/ に置いた確認用の画面。
  // public の中は「そのままのファイル名」でしか配られないので、
  // /game で index.html が開くようにここで結び直す。
  async rewrites() {
    return [{ source: "/game", destination: "/game/index.html" }];
  },
};

export default nextConfig;
