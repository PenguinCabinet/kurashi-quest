import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBoard, hiddenLine, routeLine } from "../../src/lib/quest/board.ts";
import { complete, emptyProgress, loseDay } from "../../src/lib/quest/progress.ts";
import { TODAY, halfway, realData, student } from "./fixture.ts";

const data = realData();

test("画面1つ分がまとめて出てくる", () => {
  const board = buildBoard(data, student, emptyProgress(), TODAY);

  // ひとり暮らし・乗り物なしなので、世帯主の届と原付は出ない
  const forStudent = data.procedures.filter(
    (p) => !["setai-henko", "genki-hyoshiki"].includes(p.id),
  );
  assert.deepEqual(board.quests.map((q) => q.id).sort(), forStudent.map((p) => p.id).sort());
  assert.equal(board.phases.length, 2); // 引越し前 と 14日以内
  assert.equal(board.phases[0].label, "引越し前");
  assert.equal(board.stats.hidden, 4);
  assert.equal(board.next?.id, "lifeline");
  assert.ok(board.route.stops.length > 0);
  assert.deepEqual(board.missingAnswers, []);
});

test("キャラメイクの途中でも画面が作れる（残りの質問が分かる）", () => {
  const board = buildBoard(data, halfway, emptyProgress(), TODAY);
  assert.deepEqual(board.missingAnswers, [
    "occupation",
    "hasMyNumberCard",
    "livingAlone",
    "vehicle",
    "age",
  ]);
  assert.equal(board.quests.length, data.procedures.length, "答えていなくても、消さずに出す");
  assert.ok(board.stats.unsure > 0);
});

test("終わらせると残りが減る", () => {
  const progress = complete(emptyProgress(), "tennyu-todoke", TODAY);
  const board = buildBoard(data, student, progress, TODAY);
  assert.equal(board.stats.done, 1);
  assert.equal(board.stats.remaining, 5);
  assert.ok(!board.route.stops.some((s) => s.quests.some((q) => q.id === "tennyu-todoke")));
});

test("発表とトップで使う一行が出る", () => {
  const board = buildBoard(data, student, emptyProgress(), TODAY);
  assert.equal(hiddenLine(board), "6個のうち4個は、知らないと調べようもない手続きです");
  assert.match(routeLine(board), /出かけるのは3回/);
  assert.match(routeLine(board), /分/);
});

test("today が壊れていたら、黙って期限を消さずに落とす", () => {
  assert.throws(() => buildBoard(data, student, emptyProgress(), "きょう"), /YYYY-MM-DD/);
  assert.throws(() => buildBoard(data, student, emptyProgress(), "2026-02-31"), /YYYY-MM-DD/);
});

test("出直した回数は数えるが、期限は動かさない", () => {
  // このアプリは実際に窓口へ持っていける道具でもある。
  // ゲームの手応えのために残り日数を動かすと、そこで嘘をつくことになる。
  // 出直しの重さは「記録」として出すだけにとどめる。
  const before = buildBoard(data, student, emptyProgress(), TODAY);
  const tennyu = before.quests.find((q) => q.id === "tennyu-todoke")!;

  let progress = loseDay(emptyProgress());
  progress = loseDay(progress);
  const after = buildBoard(data, student, progress, TODAY);
  const tennyuAfter = after.quests.find((q) => q.id === "tennyu-todoke")!;

  assert.equal(after.lostDays, 2, "出直した日数は数える");
  assert.equal(after.today, TODAY, "今日は動かさない");
  assert.equal(tennyuAfter.deadline.dueOn, tennyu.deadline.dueOn, "期限も動かさない");
  assert.equal(
    tennyuAfter.deadline.daysLeft,
    tennyu.deadline.daysLeft,
    "残り日数も本物のまま",
  );
});

test("出直しを何回重ねても、期限切れの数は変わらない", () => {
  let progress = emptyProgress();
  const before = buildBoard(data, student, progress, TODAY);

  for (let i = 0; i < 40; i++) progress = loseDay(progress);
  const after = buildBoard(data, student, progress, TODAY);

  assert.equal(after.stats.overdue, before.stats.overdue, "本物の日付は狂わない");
  assert.equal(after.lostDays, 40);
});
