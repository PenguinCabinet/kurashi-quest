// 窓口の練習。手順を1歩ずつ進め、持ち物が無いところで止めて出直しにする。
// 使うデータは攻略シートと同じ（steps と bring）。使い方は README を参照。

import type { Procedure, SimQuestion, SimState, Step } from "./types.ts";

export function startSimulation(p: Procedure): SimState {
  return {
    procedureId: p.id,
    stepN: 0,
    status: p.steps.length === 0 ? "cleared" : "running",
    answers: {},
    question: null,
    stuckAt: null,
    attempts: 0,
    log: [],
  };
}

/** 1歩進める。聞くことがあれば asking で止まり、持っていなければ stuck になる */
export function advance(sim: SimState, p: Procedure): SimState {
  if (sim.status !== "running") return sim; // 聞いている / 詰まった / 終わった ときは進めない
  return enter(sim, p, sim.stepN + 1);
}

/** 「持ってますか？」に答える */
export function answerItem(
  sim: SimState,
  p: Procedure,
  itemId: string,
  has: boolean,
): SimState {
  const answered: SimState = { ...sim, answers: { ...sim.answers, [itemId]: has } };
  if (sim.status !== "asking") return answered; // 先に答えておくだけ、も許す
  return enter(answered, p, sim.stepN); // いま聞かれている歩を、答えを入れてやり直す
}

/** 出直す。持っていなかったものだけ、もう一度聞く */
export function restart(sim: SimState): SimState {
  const answers = { ...sim.answers };
  if (sim.stuckAt) delete answers[sim.stuckAt.itemId];
  return {
    ...sim,
    stepN: 0,
    status: "running",
    answers,
    question: null,
    stuckAt: null,
    attempts: sim.attempts + 1,
    log: [],
  };
}

/** 最初からやり直す（答えも全部消す） */
export function resetSimulation(sim: SimState, p: Procedure): SimState {
  return { ...startSimulation(p), attempts: sim.attempts + 1 };
}

/** いまの答えのままだとどこで止まるか。止まらなければ null */
export function predictStuck(
  p: Procedure,
  answers: Record<string, boolean>,
): { step: Step; itemId: string; message: string } | null {
  for (const step of p.steps) {
    const stuck = step.stuckIf;
    if (stuck && answers[stuck.missing] === false) {
      return { step, itemId: stuck.missing, message: stuck.message };
    }
  }
  return null;
}

/** 詰まりポイントの一覧。「この手続きは2か所で止まる可能性があります」 */
export function stuckPoints(p: Procedure): { stepN: number; itemId: string; message: string }[] {
  return p.steps
    .filter((s): s is Step & { stuckIf: { missing: string; message: string } } => !!s.stuckIf)
    .map((s) => ({ stepN: s.n, itemId: s.stuckIf.missing, message: s.stuckIf.message }));
}

export function totalSteps(p: Procedure): number {
  return p.steps.length;
}

/** 0〜1。進捗バー用 */
export function ratio(sim: SimState, p: Procedure): number {
  if (p.steps.length === 0) return 1;
  return Math.min(1, Math.max(0, sim.stepN / p.steps.length));
}

/** stepN に入る。その歩の詰まり判定までやる */
function enter(sim: SimState, p: Procedure, stepN: number): SimState {
  const step = p.steps.find((s) => s.n === stepN);
  if (!step) {
    return { ...sim, stepN: p.steps.length, status: "cleared", question: null, stuckAt: null };
  }

  const stuck = step.stuckIf;
  if (stuck) {
    const answer = sim.answers[stuck.missing];
    if (answer === undefined) {
      return {
        ...sim,
        stepN,
        status: "asking",
        question: questionFor(p, step, stuck.missing, stuck.message),
        stuckAt: null,
      };
    }
    if (answer === false) {
      return {
        ...sim,
        stepN,
        status: "stuck",
        question: null,
        stuckAt: { stepN, itemId: stuck.missing, message: stuck.message },
      };
    }
  }

  return {
    ...sim,
    stepN,
    status: "running",
    question: null,
    stuckAt: null,
    log: [...sim.log.filter((l) => l.stepN !== stepN), { stepN, text: step.text }],
  };
}

function questionFor(p: Procedure, step: Step, itemId: string, ifMissing: string): SimQuestion {
  const item = p.bring.find((b) => b.id === itemId);
  return {
    itemId,
    label: item?.label ?? itemId,
    note: item?.note,
    stepN: step.n,
    ifMissing,
  };
}
