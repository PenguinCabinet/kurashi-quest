import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuests, notNeededQuests, pickNext, statsOf, visibleQuests } from "../../src/lib/quest/quests.ts";
import { complete, emptyProgress } from "../../src/lib/quest/progress.ts";
import { TODAY, halfway, realData, student, worker } from "./fixture.ts";

const data = realData();
const find = <T extends { id: string }>(list: T[], id: string): T =>
  list.find((q) => q.id === id)!;

test("学生には、その人に当てはまるものが全部出る", () => {
  const quests = visibleQuests(buildQuests(data, student, emptyProgress(), TODAY));
  // ひとり暮らしなので、世帯主の届は出ない。乗り物なしなので、原付も出ない
  assert.deepEqual(
    quests.map((q) => q.id).sort(),
    data.procedures
      .filter((p) => !["setai-henko", "genki-hyoshiki"].includes(p.id))
      .map((p) => p.id)
      .sort(),
  );
});

test("社会人には学生納付特例が出ない。ただし消さずに理由を出す", () => {
  const all = buildQuests(data, worker, emptyProgress(), TODAY);
  const shown = visibleQuests(all).map((q) => q.id);
  assert.ok(!shown.includes("gakusei-nofu-tokurei"));

  const hidden = find(notNeededQuests(all), "gakusei-nofu-tokurei");
  assert.equal(hidden.need.status, "notNeeded");
  assert.match(hidden.need.message ?? "", /厚生年金/);
});

test("マイナンバーカードが無い人には、カードの住所変更が出ず、代わりに転出証明書を持たされる", () => {
  const all = buildQuests(data, worker, emptyProgress(), TODAY);
  assert.equal(find(all, "mynumber-address").need.status, "notNeeded");

  const bring = find(all, "tennyu-todoke").bring.map((b) => b.id);
  assert.ok(bring.includes("tenshutsu-shomeisho"));
  assert.ok(!bring.includes("juki-pin"), "カードが無い人に暗証番号を持たせない");
});

test("カードを持っている人には暗証番号が出る。物ではないので区別される", () => {
  const all = buildQuests(data, student, emptyProgress(), TODAY);
  const pin = find(all, "tennyu-todoke").bring.find((b) => b.id === "juki-pin")!;
  assert.equal(pin.physical, false);
  assert.ok(!find(all, "tennyu-todoke").bring.some((b) => b.id === "tenshutsu-shomeisho"));
});

test("まだ答えていない項目があるときは、消さずに unsure で出す（迷ったら出す）", () => {
  const all = buildQuests(data, halfway, emptyProgress(), TODAY);
  const mynumber = find(all, "mynumber-address");
  assert.equal(mynumber.need.status, "unsure");
  assert.match(mynumber.need.message ?? "", /マイナンバーカード/);

  // 年齢を聞いていないので、年金も消さずに出す
  assert.equal(find(all, "gakusei-nofu-tokurei").need.status, "unsure");
  assert.equal(visibleQuests(all).length, data.procedures.length, "答えていないものは消さない");
});

test("期限が実際の日付になる", () => {
  const all = buildQuests(data, student, emptyProgress(), TODAY);

  // 引越し 7/20 から14日以内 → 8/3。今日 7/28 なので あと6日
  const tennyu = find(all, "tennyu-todoke").deadline;
  assert.equal(tennyu.dueOn, "2026-08-03");
  assert.equal(tennyu.daysLeft, 6);
  assert.equal(tennyu.urgency, "later");

  // 引越しの1週間前 → 7/13。もう過ぎている
  const lifeline = find(all, "lifeline").deadline;
  assert.equal(lifeline.dueOn, "2026-07-13");
  assert.equal(lifeline.urgency, "overdue");
});

test("引越し日を答えていないと、期限は unknown で、催促の文が出る", () => {
  const all = buildQuests(data, { occupation: "student" }, emptyProgress(), TODAY);
  const d = find(all, "tennyu-todoke").deadline;
  assert.equal(d.dueOn, null);
  assert.equal(d.urgency, "unknown");
  assert.match(d.note ?? "", /引越した日/);
});

test("「転入届の90日後」は、転入届を終えるまで数え始めない", () => {
  const before = find(buildQuests(data, student, emptyProgress(), TODAY), "mynumber-address");
  assert.equal(before.deadline.urgency, "waiting");
  assert.equal(before.deadline.dueOn, null);
  assert.match(before.deadline.note ?? "", /転入届/);

  const progress = complete(emptyProgress(), "tennyu-todoke", "2026-07-28");
  const after = find(buildQuests(data, student, progress, TODAY), "mynumber-address");
  assert.equal(after.deadline.dueOn, "2026-10-26");
  assert.equal(after.deadline.urgency, "later");
});

test("前提が終わるまで鍵がかかり、終わると開く", () => {
  const locked = find(buildQuests(data, student, emptyProgress(), TODAY), "gakusei-nofu-tokurei");
  assert.equal(locked.lock.locked, true);
  assert.deepEqual(locked.lock.blockedByNames, ["転入届を出す"]);

  const progress = complete(emptyProgress(), "tennyu-todoke", TODAY);
  const opened = find(buildQuests(data, student, progress, TODAY), "gakusei-nofu-tokurei");
  assert.equal(opened.lock.locked, false);
});

test("隠しクエストの数が出る（発表で使う一行の元になる）", () => {
  const stats = statsOf(buildQuests(data, student, emptyProgress(), TODAY));
  assert.equal(stats.total, 6);
  assert.equal(stats.hidden, 4);
  assert.equal(stats.done, 0);
  assert.equal(stats.remaining, 6);
});

test("次にやることは、鍵がかかっていないもののうち一番急ぐもの", () => {
  const quests = buildQuests(data, student, emptyProgress(), TODAY);
  const next = pickNext(quests)!;
  assert.equal(next.id, "lifeline"); // 期限を過ぎている
  assert.equal(next.lock.locked, false);
});

test("本人が消したものは一覧から外れるが、消えたことは分かる", () => {
  const progress = { ...emptyProgress(), dismissed: ["yubin-tenso"] };
  const all = buildQuests(data, student, progress, TODAY);
  assert.equal(visibleQuests(all).length, 5);
  assert.ok(notNeededQuests(all).some((q) => q.id === "yubin-tenso"));
});

test("未確認の項目が画面に渡る", () => {
  const q = find(buildQuests(data, student, emptyProgress(), TODAY), "tennyu-todoke");

  // 窓口は渋谷区の公式ページで確認済み。まだ確認できていないものだけ残る
  assert.ok(!q.unverified.includes("どこで"));
  assert.ok(q.unverified.includes("何て言う"), "窓口で通じるかは実際に行かないと分からない");
  assert.ok(q.unverified.includes("かかる時間"));
});

test("確認できたものは「要確認」から外れる", () => {
  const quests = buildQuests(data, student, emptyProgress(), TODAY);

  // 渋谷区の窓口が分かっている3件
  for (const id of ["tennyu-todoke", "mynumber-address", "gakusei-nofu-tokurei"]) {
    assert.ok(!find(quests, id).unverified.includes("どこで"), `${id} の窓口は確定済み`);
    assert.ok(!find(quests, id).unverified.includes("出典"), `${id} は出典つき`);
  }

  // 前に住んでいた自治体の窓口は、渋谷区の資料では分からない
  assert.ok(find(quests, "tenshutsu-todoke").unverified.includes("どこで"));
});

test("前提が「あなたは要りません」の人には、鍵をかけない（開ける手段が画面に無いため）", () => {
  // 転入届を「車を持っている人だけ」にして、車なしの学生には出ない状態を作る
  const modified = structuredClone(data);
  modified.procedures.find((p) => p.id === "tennyu-todoke")!.showIf = { vehicle: "car" };

  const all = buildQuests(modified, student, emptyProgress(), TODAY);
  assert.equal(find(all, "tennyu-todoke").need.status, "notNeeded");

  const mynumber = find(all, "mynumber-address");
  assert.equal(mynumber.lock.locked, false, "画面に出ていない前提を待たせると永久に開かない");
  assert.deepEqual(mynumber.lock.blockedBy, []);
  assert.deepEqual(mynumber.lock.ignoredNames, ["転入届を出す"], "待たなかった理由は残す");
});

test("前提を本人が消したときも、鍵をかけない", () => {
  const progress = { ...emptyProgress(), dismissed: ["tennyu-todoke"] };
  const all = buildQuests(data, student, progress, TODAY);

  assert.ok(!visibleQuests(all).some((q) => q.id === "tennyu-todoke"), "消したものは一覧から消える");
  const mynumber = find(all, "mynumber-address");
  assert.equal(mynumber.lock.locked, false);
  assert.deepEqual(mynumber.lock.ignored, ["tennyu-todoke"]);
});

test("前提が普通に残っているときは、これまでどおり鍵がかかる", () => {
  const mynumber = find(buildQuests(data, student, emptyProgress(), TODAY), "mynumber-address");
  assert.equal(mynumber.lock.locked, true);
  assert.deepEqual(mynumber.lock.blockedByNames, ["転入届を出す"]);
  assert.deepEqual(mynumber.lock.ignored, []);
});

test("目安の期限は過ぎても「期限切れ」と言わないが、過ぎたことは分かる", () => {
  // 郵便の転送届は「引越しの前後。早いほどよい」＝ 厳密な期限ではない
  const all = buildQuests(data, student, emptyProgress(), TODAY);
  const yubin = find(all, "yubin-tenso").deadline;

  assert.equal(yubin.soft, true);
  assert.ok(yubin.daysLeft !== null && yubin.daysLeft < 0, "引越し日 7/20 は今日 7/28 より前");
  assert.notEqual(yubin.urgency, "overdue");
  assert.match(yubin.note ?? "", /過ぎています/, "残り日数だけ見て「あと-8日」と出させない");
});
