import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBoard, hiddenLine, routeLine } from "../../src/lib/quest/board";
import { complete, emptyProgress } from "../../src/lib/quest/progress";
import { TODAY, halfway, realData, student } from "./fixture";

const data = realData();

test("画面1つ分がまとめて出てくる", () => {
  const board = buildBoard(data, student, emptyProgress(), TODAY);

  assert.equal(board.quests.length, 6);
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
  ]);
  assert.equal(board.quests.length, 6);
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
