// 使える制度（家賃補助・無料健診など）。
// 出し分けは手続きと同じ仕組みを使う（迷ったら出す）。
// データはまだ空でよく、入った分だけ画面に出る。

import type {
  Benefit,
  BenefitBoard,
  BenefitCard,
  BenefitFile,
  Need,
  Profile,
} from "./types.ts";
import { matchCond, labelOf, unknownKeys } from "./profile.ts";

/** 制度データの読み込み。壊れていたら、直すところを並べて例外にする */
export function loadBenefits(raw: unknown): BenefitFile {
  const problems = validateBenefits(raw);
  if (problems.length > 0) {
    throw new Error(`benefits.json に直すところがあります:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  }
  return raw as BenefitFile;
}

/** 例外を投げずに問題を並べる。データを足す人向け */
export function validateBenefits(raw: unknown): string[] {
  const out: string[] = [];
  if (typeof raw !== "object" || raw === null) return ["オブジェクトではありません"];

  const file = raw as Record<string, unknown>;
  if (!Array.isArray(file.benefits)) return ["benefits が配列ではありません"];

  const ids = new Set<string>();
  for (const [i, b] of file.benefits.entries()) {
    const at = typeof (b as Benefit)?.id === "string" ? (b as Benefit).id : `#${i}`;
    if (typeof b !== "object" || b === null) {
      out.push(`${at}: オブジェクトではありません`);
      continue;
    }
    const item = b as Record<string, unknown>;

    if (typeof item.id !== "string" || item.id === "") out.push(`${at}: id が空です`);
    else if (ids.has(item.id)) out.push(`${at}: id が重複しています`);
    else ids.add(item.id);

    for (const field of ["name", "what"]) {
      if (typeof item[field] !== "string" || item[field] === "") {
        out.push(`${at}: ${field} を入れてください`);
      }
    }
    if (typeof item.showIf !== "object" || item.showIf === null) {
      out.push(`${at}: showIf を入れてください（誰が使えるか）`);
    }
    if (typeof item.deadline !== "object" || item.deadline === null) {
      out.push(`${at}: deadline.text を入れてください（「入居から3か月以内」など）`);
    }
  }
  return out;
}

/** その人が使えるか。手続きと同じで、判定できないものは消さずに出す */
export function decideEligibility(b: Benefit, me: Profile): Need {
  const { always, ageAtLeast, ...cond } = b.showIf;

  if (ageAtLeast !== undefined) {
    if (me.age === undefined) {
      return { status: "unsure", message: `${ageAtLeast}歳以上の人向けです。念のため出しています` };
    }
    if (me.age < ageAtLeast) {
      return { status: "notNeeded", message: `${ageAtLeast}歳以上の人向けです` };
    }
  }

  if (always) return { status: "show" };
  if (Object.keys(cond).length === 0) return { status: "show" };

  switch (matchCond(cond, me)) {
    case "yes":
      return { status: "show" };
    case "no":
      return { status: "notNeeded", message: "あなたは対象外です" };
    default:
      return {
        status: "unsure",
        message: `${unknownKeys(cond, me).map(labelOf).join("・")}が分からないので、念のため出しています`,
      };
  }
}

export function toCard(b: Benefit, me: Profile): BenefitCard {
  return {
    id: b.id,
    name: b.name,
    what: b.what,
    ifNot: b.ifNot,
    need: decideEligibility(b, me),
    deadline: b.deadline.text,
    where: b.where.text,
    howTo: b.howTo.text,
    // 金額はまだ裏が取れていないので、入っているものだけ出す
    amount: b.amount ? { text: b.amount.text, yearlyYen: b.amount.yearlyYen ?? null } : null,
    unverified: unverifiedFields(b),
  };
}

/** 「使える制度」の画面ぶんを作る */
export function buildBenefitBoard(data: BenefitFile, me: Profile): BenefitBoard {
  const cards = data.benefits.map((b) => toCard(b, me));
  const usable = cards.filter((c) => c.need.status !== "notNeeded");

  const known = usable
    .map((c) => c.amount?.yearlyYen)
    .filter((yen): yen is number => typeof yen === "number");

  return {
    targetCity: data.targetCity,
    cards: usable,
    notEligible: cards.filter((c) => c.need.status === "notNeeded"),
    // 1件も金額が分かっていなければ、合計は出さない（0円と出すと嘘になる）
    yearlyTotalYen: known.length > 0 ? known.reduce((sum, yen) => sum + yen, 0) : null,
  };
}

/** 「使える制度が3件あります」の一行。金額が分かっていれば足す */
export function benefitLine(board: BenefitBoard): string | null {
  if (board.cards.length === 0) return null;
  const head = `使える制度が${board.cards.length}件あります`;
  return board.yearlyTotalYen === null
    ? head
    : `${head}（分かっているだけで年${board.yearlyTotalYen.toLocaleString("ja-JP")}円）`;
}

function unverifiedFields(b: Benefit): string[] {
  const out: string[] = [];
  if (!b.where.verified) out.push("どこで");
  if (!b.howTo.verified) out.push("やり方");
  if (!b.sources.some((s) => s.verified)) out.push("出典");
  return out;
}
