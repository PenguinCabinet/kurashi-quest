// 合言葉。
//
// ログインを作らずに「パソコンで準備して、スマホで窓口へ行く」を成り立たせるための札。
// 名前もメールも聞きません。合言葉そのものが鍵です。
//
// ここは形の決まりだけを持ちます。サーバとのやり取りは sync.ts、
// 実際に置く場所は src/app/api/save/route.ts にあります。

/**
 * 使う文字。
 *
 * 紙に書いて、口で言って、スマホで打ち直すものなので、
 * 見間違い・聞き間違いのもとになる文字を最初から入れていません。
 *
 *   0 と O、1 と I と L、8 と B、2 と Z、5 と S
 *
 * 母音も抜いてあります。偶然よくない言葉ができるのを避けるためです。
 */
const ALPHABET = "34679CDFGHJKMNPQRTVWXY";

/** 合言葉の長さ。6文字だと 22^6 ＝ 約1億1千万通り */
export const LENGTH = 6;

/**
 * 合言葉を1つ作る。
 *
 * 乱数はここでは作りません。日付と同じで、外から渡してもらいます。
 * ロジックの中で乱数を呼ぶと、テストが実行ごとに変わってしまうためです。
 *
 * @param random 0以上1未満の数を返すもの。ブラウザなら crypto を渡す
 */
export function makePassphrase(random: () => number): string {
  let out = "";
  for (let i = 0; i < LENGTH; i++) {
    const n = Math.floor(random() * ALPHABET.length);
    out += ALPHABET[Math.min(Math.max(n, 0), ALPHABET.length - 1)];
  }
  return out;
}

/**
 * 人が打ったものを、正しい形に直す。
 *
 * 小文字で打つ人、間に空白やハイフンを入れる人がいます。そこは吸収します。
 *
 * 見間違いも少しだけ直します。ただし直すのは
 * 「そもそも合言葉に使っていない文字」だけです。
 * 使っている文字を勝手に別の文字へ変えると、打ち間違いが黙って
 * 「他の誰かの合言葉」になってしまいます。それが一番まずい。
 *
 * 寄せ先の見当がつかない文字（S など）は、直さずに落とします。
 * 結果として6文字に足りなくなり、「見つかりません」と正直に出ます。
 */
const LOOKALIKE: Record<string, string> = {
  "0": "Q",
  O: "Q",
  "1": "J",
  I: "J",
  L: "J",
  "8": "6",
  B: "6",
  "2": "7",
  Z: "7",
  A: "4",
};

export function normalizePassphrase(input: string): string {
  let out = "";
  for (const ch of input.toUpperCase()) {
    if (ALPHABET.includes(ch)) {
      out += ch;
      continue;
    }
    const fixed = LOOKALIKE[ch];
    if (fixed) out += fixed;
    // それ以外（空白・ハイフン・寄せ先の無い文字）は落とす
  }
  return out.slice(0, LENGTH);
}

/** 合言葉として使える形か */
export function isPassphrase(input: string): boolean {
  return input.length === LENGTH && [...input].every((c) => ALPHABET.includes(c));
}

/** 目で読むとき用に、3文字ずつ区切る（KQ7F2M → KQ7 F2M） */
export function formatPassphrase(code: string): string {
  if (code.length !== LENGTH) return code;
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

/**
 * ブラウザの安全な乱数。
 * 無い環境（古いブラウザ・テスト）では null を返すので、呼ぶ側で決めてもらいます。
 */
export function browserRandom(): (() => number) | null {
  const c = typeof globalThis === "undefined" ? undefined : globalThis.crypto;
  if (!c || typeof c.getRandomValues !== "function") return null;
  return () => {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0]! / 2 ** 32;
  };
}
