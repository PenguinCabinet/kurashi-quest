import { test } from "node:test";
import assert from "node:assert/strict";
import {
  costOf,
  judgePacking,
  packingCandidates,
  verdictLine,
} from "../../src/lib/quest/packing.ts";
import type { PackCandidate } from "../../src/lib/quest/packing.ts";
import type { Procedure } from "../../src/lib/quest/types.ts";
import { realData, student, worker } from "./fixture.ts";

const data = realData();
const find = (id: string): Procedure => data.procedures.find((p) => p.id === id)!;
const candidatesFor = (id: string, me = student) =>
  packingCandidates(find(id), data.procedures, me);

test("家にあるものは、取得コストが0になる", () => {
  assert.deepEqual(costOf({ id: "x", label: "本人確認書類", verified: true }), {
    yen: 0,
    days: 0,
    verified: true,
  });
  assert.deepEqual(
    costOf({ id: "y", label: "在学証明書", verified: true, category: "school", cost: { yen: 300, days: 3 } }),
    { yen: 300, days: 3 },
  );
});

test("候補には、他の手続きの書類も混ざる（要りそうで要らないもの）", () => {
  const cands = candidatesFor("gakusei-nofu-tokurei");
  const ids = cands.map((c) => c.id);

  assert.ok(ids.includes("student-id-copy"), "この手続きに要るもの");
  assert.ok(ids.includes("old-address-proof"), "郵便の転送で使うもの＝ここでは不要");
  assert.equal(cands.find((c) => c.id === "old-address-proof")!.needed, false);
});

test("必要なものをそろえれば受付できる", () => {
  const cands = candidatesFor("gakusei-nofu-tokurei");
  const v = judgePacking(cands, ["student-id-copy", "mynumber-card", "id-doc"]);

  assert.equal(v.cleared, true);
  assert.equal(v.perfect, true, "家にあるものだけなので、これが最短");
  assert.equal(v.paidYen, 0);
  assert.equal(v.paidDays, 0);
});

test("足りないと差し戻される。理由が付く", () => {
  const cands = candidatesFor("gakusei-nofu-tokurei");
  const v = judgePacking(cands, ["mynumber-card", "id-doc"]);

  assert.equal(v.cleared, false);
  assert.deepEqual(v.missing.map((m) => m.id), ["student-id-copy"]);
  assert.match(v.missing[0].reason, /がないと受付できません$/);
  assert.match(verdictLine(v), /足りません/);
});

test("代わりになる書類でも受付できる。ただし取りに行った分だけ損する", () => {
  const cands = candidatesFor("gakusei-nofu-tokurei");

  // 在学証明書は「学生証の写し」の代わりになるが、学校で3日かかる
  const v = judgePacking(cands, ["zaigaku-shomei", "mynumber-card", "id-doc"]);
  assert.equal(v.cleared, true, "代わりの書類でも受け付けてもらえる");
  assert.equal(v.perfect, false);
  assert.equal(v.paidDays, 3);
  assert.equal(v.bestDays, 0, "学生証の写しなら0日で済んだ");
  assert.match(verdictLine(v), /余分/);
});

test("家にあるものを余分に入れても、損しない（現実と同じ）", () => {
  const cands = candidatesFor("gakusei-nofu-tokurei");
  const extras = cands.filter((c) => c.atHome).map((c) => c.id);

  const v = judgePacking(cands, extras);
  assert.equal(v.cleared, true);
  assert.equal(v.perfect, true, "家にあるものは何個入れても減点なし");
  assert.deepEqual(v.wasted, []);
});

test("要らない書類を取りに行くと、無駄として出る", () => {
  const cands: PackCandidate[] = [
    { id: "a", label: "必要なもの", category: "home", cost: { yen: 0, days: 0 }, atHome: true, needed: true },
    { id: "b", label: "要らない証明書", category: "cityOffice", cost: { yen: 300, days: 1 }, atHome: false, needed: false },
  ];
  const v = judgePacking(cands, ["a", "b"]);

  assert.equal(v.cleared, true);
  assert.deepEqual(v.wasted.map((w) => w.id), ["b"]);
  assert.equal(v.paidYen, 300);
  assert.equal(v.bestYen, 0);
  assert.equal(v.perfect, false);
});

test("その人に要らない書類は、そもそも候補に出ない", () => {
  // カードを持っている人に転出証明書は交付されない
  const cands = candidatesFor("tennyu-todoke", student);
  assert.ok(!cands.some((c) => c.id === "tenshutsu-shomeisho"));

  // 持っていない人には出る（取りに行く書類なのでコストがある）
  const forWorker = candidatesFor("tennyu-todoke", worker);
  const shomeisho = forWorker.find((c) => c.id === "tenshutsu-shomeisho")!;
  assert.equal(shomeisho.needed, true);
  assert.equal(shomeisho.atHome, false);
  assert.equal(shomeisho.cost.days, 1);
});

test("裏が取れていない手数料が混ざっていたら分かる", () => {
  const cands = candidatesFor("gakusei-nofu-tokurei");
  const v = judgePacking(cands, ["zaigaku-shomei", "mynumber-card", "id-doc"]);
  assert.equal(v.hasUnverifiedCost, true, "在学証明書の日数はまだ未確認");

  const home = judgePacking(cands, ["student-id-copy", "mynumber-card", "id-doc"]);
  assert.equal(home.hasUnverifiedCost, false, "家にあるものだけなら確認は要らない");
});
