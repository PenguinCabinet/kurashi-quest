// 合言葉で、続きを預かる／返す。
//
//   POST /api/save          預ける。合言葉が返る
//   GET  /api/save?code=…   合言葉で取り出す
//
// ログインはありません。合言葉そのものが鍵です。
// なので、置き場所は非公開（private）にしてあります。合言葉を知られても、
// このサーバを通さずに中身を直接読むことはできません。
//
// 中身に名前・住所・連絡先は入りません。入るのは
// キャラメイクの6つの答えと、チェックの印と、出直した回数だけです。

import { get, put } from "@vercel/blob";

import { normalizeProfile } from "@/lib/quest/profile";
import { normalizeProgress } from "@/lib/quest/progress";
import { isPassphrase, makePassphrase, normalizePassphrase } from "@/lib/quest/passphrase";

/** 毎回サーバで動かす。前の人の結果を返さないため */
export const dynamic = "force-dynamic";

/** 置き場所。合言葉ひとつにつき1ファイル */
function pathOf(code: string): string {
  return `save/${code}.json`;
}

/** 預かるものの上限。これ以上は受け取らない（いたずら対策） */
const MAX_BYTES = 20_000;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = normalizePassphrase(url.searchParams.get("code") ?? "");
  if (!isPassphrase(code)) {
    return Response.json({ error: "合言葉の形が違います" }, { status: 400 });
  }

  try {
    // useCache: false。書いた直後に別の端末で読むので、古いものを返させない
    const found = await get(pathOf(code), { access: "private", useCache: false });
    if (!found) return Response.json({ error: "見つかりません" }, { status: 404 });

    const text = await new Response(found.stream).text();
    return Response.json(JSON.parse(text));
  } catch {
    // 「無い」も例外で来ることがある。中身の話はせず、無いとだけ返す
    return Response.json({ error: "見つかりません" }, { status: 404 });
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "読めませんでした" }, { status: 400 });
  }

  const o = (body ?? {}) as Record<string, unknown>;

  // 合言葉。持っていれば上書き、無ければ新しく作る
  const asked = typeof o.code === "string" ? normalizePassphrase(o.code) : "";
  const code = isPassphrase(asked) ? asked : makePassphrase(browserSafeRandom);

  // 送られてきたものは信用しない。こちらで読み直してから置く。
  // 画面側と同じ関数を通すので、変な値が入り込む道がない
  const data = {
    version: 1 as const,
    profile: normalizeProfile(o.profile),
    progress: normalizeProgress(o.progress),
    savedAt: new Date().toISOString(),
  };

  const text = JSON.stringify(data);
  if (text.length > MAX_BYTES) {
    return Response.json({ error: "大きすぎます" }, { status: 413 });
  }

  try {
    await put(pathOf(code), text, {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false, // 合言葉がそのまま置き場所の名前になる
      allowOverwrite: true, // 同じ合言葉で預け直せる
    });
  } catch {
    return Response.json({ error: "預けられませんでした" }, { status: 502 });
  }

  return Response.json({ code, savedAt: data.savedAt });
}

/** 安全な乱数。Vercel でも手元の Node でも動く */
function browserSafeRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / 2 ** 32;
}
