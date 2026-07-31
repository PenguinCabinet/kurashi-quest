// 確認用の画面（public/game）が読むロジックを、src/lib/quest から作り直す。
//
//   npm run game:build      手で作り直す
//   npm run build           ビルドの前に、自動でこれが走る（prebuild）
//
// 手で写すと必ずずれます。実際に一度ずれました。
// ロジックを直したら、何もしなくても public/game/quest が最新になるようにしてあります。

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const from = join(root, "src/lib/quest");
const data = join(root, "src/data/procedures.json");
const to = join(root, "public/game/quest");

/** 途中で失敗したときに、中途半端なものを残さないための作業場所 */
const work = mkdtempSync(join(tmpdir(), "game-logic-"));
const out = join(work, "out");

try {
  // ① .ts を作業場所に写して、import の拡張子をブラウザ用に直す
  //    （本体は "./types.ts" と書いてあるが、ブラウザは .js しか読めない）
  const files = readdirSync(from).filter((f) => f.endsWith(".ts"));
  if (files.length === 0) throw new Error(`${from} に .ts がありません`);

  for (const f of files) {
    const text = readFileSync(join(from, f), "utf8").replace(
      /(from\s+")(\.\.?\/[^"]+)\.ts(")/g,
      "$1$2.js$3",
    );
    writeFileSync(join(work, f), text);
  }

  // ② TypeScript を JavaScript にする
  const tsc = join(root, "node_modules/.bin/tsc");
  execFileSync(
    tsc,
    [
      "--outDir", out,
      "--target", "es2022",
      "--lib", "es2022,dom",
      "--module", "es2022",
      "--moduleResolution", "bundler",
      "--strict",
      "--skipLibCheck",
      // リポジトリの tsconfig.json を読ませない。
      // ここはブラウザ用に別の設定で作るので、混ざると壊れる
      "--ignoreConfig",
      ...files.map((f) => join(work, f)),
    ],
    { stdio: "inherit" },
  );

  // ③ 手続きのデータを、そのまま読める形にして置く
  const json = readFileSync(data, "utf8");
  JSON.parse(json); // 壊れていたらここで止める
  writeFileSync(join(out, "procedures.js"), `export default ${json}`);

  // ④ 作れたものが揃っているか確かめてから、置き換える
  const made = readdirSync(out).filter((f) => f.endsWith(".js"));
  const missing = files
    .map((f) => f.replace(/\.ts$/, ".js"))
    .filter((f) => !made.includes(f));
  if (missing.length > 0) throw new Error(`作れていないもの: ${missing.join(", ")}`);
  if (!made.includes("index.js")) throw new Error("index.js が作れていません");

  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  cpSync(out, to, { recursive: true });

  console.log(`public/game/quest を作り直しました（${made.length}件）`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
