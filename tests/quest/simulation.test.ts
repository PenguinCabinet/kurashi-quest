import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advance,
  answerItem,
  predictStuck,
  restart,
  startSimulation,
  stuckPoints,
} from "../../src/lib/quest/simulation";
import { realData } from "./fixture";

const data = realData();
const tennyu = data.procedures.find((p) => p.id === "tennyu-todoke")!;

test("最後まで進むと cleared になる", () => {
  let sim = startSimulation(tennyu);
  sim = answerItem(sim, tennyu, "juki-pin", true); // 先に「持っている」と答えておく
  // 最後の歩で「次へ」を押すと終わるので、歩数 + 1 回進む
  for (let i = 0; i < tennyu.steps.length + 1; i++) sim = advance(sim, tennyu);
  assert.equal(sim.status, "cleared");
  assert.equal(sim.stepN, tennyu.steps.length);
});

test("詰まりポイントで手が止まり、持ち物を聞かれる", () => {
  let sim = startSimulation(tennyu);
  while (sim.status === "running" && sim.stepN < 5) sim = advance(sim, tennyu);

  assert.equal(sim.status, "asking");
  assert.equal(sim.stepN, 5);
  assert.equal(sim.question?.itemId, "juki-pin");
  assert.match(sim.question?.label ?? "", /暗証番号/);
  assert.match(sim.question?.ifMissing ?? "", /止まります/);
});

test("持っていないと答えると、その場で出直しになる", () => {
  let sim = startSimulation(tennyu);
  while (sim.status === "running") sim = advance(sim, tennyu);
  sim = answerItem(sim, tennyu, "juki-pin", false);

  assert.equal(sim.status, "stuck");
  assert.equal(sim.stuckAt?.stepN, 5);
  assert.match(sim.stuckAt?.message ?? "", /暗証番号/);
});

test("持っていると答えると、そのまま先に進める", () => {
  let sim = startSimulation(tennyu);
  while (sim.status === "running") sim = advance(sim, tennyu);
  sim = answerItem(sim, tennyu, "juki-pin", true);

  assert.equal(sim.status, "running");
  assert.equal(sim.stepN, 5);
  sim = advance(sim, tennyu);
  assert.equal(sim.status, "running");
  assert.equal(sim.stepN, 6);
  assert.equal(advance(sim, tennyu).status, "cleared");
});

test("出直すと最初に戻り、詰まった持ち物だけもう一度聞かれる", () => {
  let sim = startSimulation(tennyu);
  while (sim.status === "running") sim = advance(sim, tennyu);
  sim = answerItem(sim, tennyu, "juki-pin", false);
  sim = restart(sim);

  assert.equal(sim.stepN, 0);
  assert.equal(sim.status, "running");
  assert.equal(sim.attempts, 1);
  assert.equal(sim.answers["juki-pin"], undefined);
  assert.deepEqual(sim.log, []);
});

test("詰まっている間は「次へ」を押しても進まない", () => {
  let sim = startSimulation(tennyu);
  while (sim.status === "running") sim = advance(sim, tennyu);
  sim = answerItem(sim, tennyu, "juki-pin", false);
  assert.equal(advance(sim, tennyu), sim);
});

test("通ってきた手順が履歴に残る", () => {
  let sim = startSimulation(tennyu);
  sim = advance(sim, tennyu);
  sim = advance(sim, tennyu);
  assert.deepEqual(
    sim.log.map((l) => l.stepN),
    [1, 2],
  );
  assert.match(sim.log[0].text, /番号札/);
});

test("行く前に「このままだとどこで止まるか」が分かる", () => {
  assert.equal(predictStuck(tennyu, { "juki-pin": true }), null);
  const stuck = predictStuck(tennyu, { "juki-pin": false })!;
  assert.equal(stuck.step.n, 5);
  assert.equal(stuck.itemId, "juki-pin");
});

test("詰まりポイントの一覧が取れる", () => {
  const points = stuckPoints(tennyu);
  assert.deepEqual(
    points.map((p) => p.stepN),
    [5],
  );
});

test("手順が入っている手続きは、全部シミュレーションできる", () => {
  for (const p of data.procedures) {
    let sim = startSimulation(p);
    let guard = 0;
    while (sim.status !== "cleared" && guard++ < 50) {
      if (sim.status === "asking") sim = answerItem(sim, p, sim.question!.itemId, true);
      else sim = advance(sim, p);
    }
    assert.equal(sim.status, "cleared", `${p.id} が最後まで進まない`);
  }
});
