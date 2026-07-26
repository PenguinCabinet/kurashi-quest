// 持ち物。
//
// 1つの手続きに必要なもの（やり方カード用）と、
// 複数の手続きをまとめて回るときに持っていくもの（役所攻略シート用）を作ります。
//
// 「役所に1回で終わらせる」がこのアプリの売りなので、まとめる側が本番です。

import type { BringItem, BringLine, Procedure, Profile } from "./types";
import { matchCond } from "./profile";

/** その人が実際に持っていく必要があるものだけを返す */
export function bringFor(p: Procedure, me: Profile): BringLine[] {
  const lines = p.bring
    .filter((b) => needsItem(b, me))
    .map((b) => toLine(b, p.id));
  return sortBring(dedupe(lines));
}

/**
 * 複数の手続きの持ち物を1つのリストにする。
 * 同じものは1行にまとめて、neededFor に「何のために持つか」を全部入れる。
 */
export function mergeBring(procedures: Procedure[], me: Profile): BringLine[] {
  const lines: BringLine[] = [];
  for (const p of procedures) {
    for (const b of p.bring) {
      if (needsItem(b, me)) lines.push(toLine(b, p.id));
    }
  }
  return sortBring(dedupe(lines));
}

/** 物ではないもの（暗証番号など）。忘れやすいので画面で分けて出す */
export function nonPhysical(lines: BringLine[]): BringLine[] {
  return lines.filter((l) => !l.physical);
}

/** 未確認のものだけ。画面で「要確認」を出す用 */
export function unverifiedBring(lines: BringLine[]): BringLine[] {
  return lines.filter((l) => !l.verified);
}

// ── 中身 ────────────────────────────────────────────────────

/**
 * その持ち物が要るか。
 * 条件に使う項目にまだ答えていない場合は「要る」に倒す。
 * 持っていったのに使わなかった、は困らないが、忘れて出直すのは困るため。
 */
function needsItem(b: BringItem, me: Profile): boolean {
  if (!b.showIf) return true;
  return matchCond(b.showIf, me) !== "no";
}

function toLine(b: BringItem, procedureId: string): BringLine {
  return {
    id: b.id,
    label: b.label,
    note: b.note,
    physical: b.physical !== false, // 既定は物あつかい
    verified: b.verified === true,
    neededFor: [procedureId],
  };
}

function dedupe(lines: BringLine[]): BringLine[] {
  const byId = new Map<string, BringLine>();
  for (const line of lines) {
    const found = byId.get(line.id);
    if (!found) {
      byId.set(line.id, { ...line, neededFor: [...line.neededFor] });
      continue;
    }
    for (const id of line.neededFor) {
      if (!found.neededFor.includes(id)) found.neededFor.push(id);
    }
    // 1か所でも未確認なら未確認あつかい（安全側）
    found.verified = found.verified && line.verified;
    // 注記は、書いてある方を残す
    if (!found.note && line.note) found.note = line.note;
  }
  return [...byId.values()];
}

/**
 * 並び順: 物 → 物でないもの（暗証番号など）。
 * 同じ区分の中では、多くの手続きで要るものを上に。
 */
function sortBring(lines: BringLine[]): BringLine[] {
  return [...lines].sort((a, b) => {
    if (a.physical !== b.physical) return a.physical ? -1 : 1;
    if (a.neededFor.length !== b.neededFor.length) return b.neededFor.length - a.neededFor.length;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
