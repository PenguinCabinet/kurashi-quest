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
  const lines: Line[] = [];
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

/**
 * sameAs が付いているものは、まとめる時のキーを付け替える。
 * 別名の側（sameAs あり）は primary:false にして、
 * 本来の名前の行が1つでもあれば、そちらの言い方を残す。
 */
type Line = BringLine & { primary: boolean };

function toLine(b: BringItem, procedureId: string): Line {
  return {
    id: b.sameAs ?? b.id,
    label: b.label,
    note: b.note,
    physical: b.physical !== false, // 既定は物あつかい
    verified: b.verified === true,
    neededFor: [procedureId],
    primary: b.sameAs === undefined,
  };
}

function dedupe(lines: Line[]): BringLine[] {
  const byId = new Map<string, Line>();
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

    // 別名で入っていたものに、本来の言い方が来たら、そちらを表に出す
    if (!found.primary && line.primary) {
      found.label = line.label;
      found.physical = line.physical;
      found.primary = true;
    }
    // 注記はどちらも残す。まとめた側の説明（「基礎年金番号通知書でも可」など）を
    // 落とすと、代わりになるものが分からなくなるため
    found.note = joinNotes(found.note, line.note);
  }
  return [...byId.values()].map(({ primary: _p, ...line }) => line);
}

/** 注記を1つにまとめる。同じ文は2回書かない */
function joinNotes(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b || a.includes(b)) return a;
  return `${a}。${b}`;
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
