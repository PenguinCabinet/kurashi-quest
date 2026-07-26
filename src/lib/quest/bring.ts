// 持ち物。1手続き分（やり方カード用）と、まとめたもの（攻略シート用）を作る。

import type { BringItem, BringLine, Procedure, Profile } from "./types";
import { matchCond } from "./profile";

/** その人が実際に持っていく必要があるものだけを返す */
export function bringFor(p: Procedure, me: Profile): BringLine[] {
  const lines = p.bring
    .filter((b) => needsItem(b, me))
    .map((b) => toLine(b, p.id));
  return sortBring(dedupe(lines));
}

/** 複数の手続きの持ち物を1つにする。同じものは1行にまとめ、neededFor に用途を入れる */
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

/** その持ち物が要るか。答えていない項目があるときは「要る」に倒す（忘れて出直す方が困る） */
function needsItem(b: BringItem, me: Profile): boolean {
  if (!b.showIf) return true;
  return matchCond(b.showIf, me) !== "no";
}

/** sameAs 付き（別名）は primary:false。本来の名前の行があれば、そちらの言い方を残す */
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

    if (!found.primary && line.primary) {
      found.label = line.label;
      found.physical = line.physical;
      found.primary = true;
    }
    // 注記はどちらも残す（代わりになるものの説明が消えるため）
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

/** 物 → 物でないもの（暗証番号など）の順。同じなら多くの手続きで要るものを上に */
function sortBring(lines: BringLine[]): BringLine[] {
  return [...lines].sort((a, b) => {
    if (a.physical !== b.physical) return a.physical ? -1 : 1;
    if (a.neededFor.length !== b.neededFor.length) return b.neededFor.length - a.neededFor.length;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
