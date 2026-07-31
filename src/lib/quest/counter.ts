// 窓口の会話。
//
// 「何て言えばいいか分からない」が課題なので、職員とのやり取りを選択肢にする。
// 選択肢は他の手続きの「何て言う」から作るので、データを足す必要はない。
//
//   職員「本日はどのようなご用件ですか？」
//     1. 転入届を出したいです        ← 正解
//     2. 転居届を出したいです        ← 郵便局の言い方（紛らわしい）
//     3. マイナンバーカードの住所も変更したいです
//
// 持ち物を聞かれて持っていなければ、その場で出直しになる。

import type { Procedure, Profile, Progress } from "./types.ts";
import { bringFor, isReady } from "./bring.ts";
import { isBrought } from "./progress.ts";

export type CounterStatus =
  /** 用件を聞かれている */
  | "purpose"
  /** 持ち物を聞かれている */
  | "item"
  /** 出直しになった */
  | "turnedAway"
  /** 受付できた */
  | "cleared";

export type Choice = { text: string; correct: boolean };

export type CounterState = {
  procedureId: string;
  status: CounterStatus;
  /** いま職員が言っていること */
  clerk: string;
  /** 選択肢。用件を聞かれているときだけ入る */
  choices: Choice[];
  /** 聞かれている持ち物 */
  asking: { itemId: string; label: string; ifMissing: string } | null;
  /** 出直しの理由 */
  turnedAwayReason: string | null;
  /** 言い間違えた回数 */
  mistakes: number;
  /** 出直した回数 */
  attempts: number;
  /** 会話のログ。画面にそのまま並べられる */
  log: { who: "clerk" | "me"; text: string }[];
};

const FIRST_LINE = "本日はどのようなご用件ですか？";

/** 窓口に行く */
export function startCounter(target: Procedure, others: Procedure[], me: Profile): CounterState {
  return {
    procedureId: target.id,
    status: "purpose",
    clerk: FIRST_LINE,
    choices: purposeChoices(target, others, me),
    asking: null,
    turnedAwayReason: null,
    mistakes: 0,
    attempts: 0,
    log: [{ who: "clerk", text: FIRST_LINE }],
  };
}

/**
 * 用件の選択肢。
 * 正解はその手続きの「何て言う」、間違いは他の手続きの「何て言う」。
 * 同じ場所でやる手続きを優先して混ぜる（本当に紛らわしいのはそこなので）。
 */
export function purposeChoices(
  target: Procedure,
  others: Procedure[],
  _me: Profile,
  limit = 3,
): Choice[] {
  const samePlace = others.filter(
    (p) => p.id !== target.id && p.where.placeKey === target.where.placeKey,
  );
  const rest = others.filter(
    (p) => p.id !== target.id && p.where.placeKey !== target.where.placeKey,
  );

  const wrong = [...samePlace, ...rest]
    .slice(0, Math.max(0, limit - 1))
    .map((p) => ({ text: p.sayThis.text, correct: false }));

  // 正解の位置を混ぜる。いつも1番目だと、読まずに1番目を押すだけの画面になる
  return shuffle([{ text: target.sayThis.text, correct: true }, ...wrong]);
}

/** 並びを混ぜる。元の配列は変えない */
function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 用件を選ぶ */
export function say(state: CounterState, target: Procedure, index: number, me: Profile): CounterState {
  if (state.status !== "purpose") return state;
  const choice = state.choices[index];
  if (!choice) return state;

  const log = [...state.log, { who: "me" as const, text: choice.text }];

  if (!choice.correct) {
    const line = "それでしたら、こちらの窓口ではありません。もう一度おっしゃっていただけますか？";
    return {
      ...state,
      mistakes: state.mistakes + 1,
      clerk: line,
      log: [...log, { who: "clerk", text: line }],
    };
  }

  return askNext({ ...state, log }, target, me, 0);
}

/**
 * 鞄から出す。持っているかは、準備画面でそろえたかどうかで決まる。
 * 「持っていないのに あります と答える」ができないようにするための入口。
 */
export function openBag(
  state: CounterState,
  target: Procedure,
  progress: Progress,
  me: Profile,
): CounterState {
  if (state.status !== "item" || !state.asking) return state;
  const asking = state.asking;
  const lines = bringFor(target, me);
  const item = lines.find((line) => line.id === asking.itemId);

  // 「どちらか一方でよい」ものは、代わりを用意していれば足りている。
  // ここを isBrought だけで見ると、在学証明書を用意した人を学生証の写しが無いと言って追い返す
  const has = item
    ? isReady(lines, item, (id) => isBrought(progress, id))
    : isBrought(progress, asking.itemId);

  return show(state, target, has, me);
}

/** 持ち物の質問に答える（持っているかを自分で渡す形） */
export function show(
  state: CounterState,
  target: Procedure,
  has: boolean,
  me: Profile,
): CounterState {
  if (state.status !== "item" || !state.asking) return state;
  const asking = state.asking;
  const log = [...state.log, { who: "me" as const, text: has ? "あります" : "持っていません" }];

  if (!has) {
    return {
      ...state,
      status: "turnedAway",
      clerk: asking.ifMissing,
      choices: [],
      asking: null,
      turnedAwayReason: asking.ifMissing,
      log: [...log, { who: "clerk", text: asking.ifMissing }],
    };
  }

  const answered = questionsOf(target, me).findIndex((q) => q.itemId === asking.itemId) + 1;
  return askNext({ ...state, log }, target, me, answered);
}

/** 出直す。もう一度並び直し */
export function comeAgain(state: CounterState, target: Procedure, others: Procedure[], me: Profile): CounterState {
  const fresh = startCounter(target, others, me);
  return { ...fresh, attempts: state.attempts + 1, mistakes: state.mistakes };
}

/**
 * 窓口で聞かれる持ち物。その人が実際に持っていくもの全部。
 *
 * 詰まりポイント（stuckIf）だけから作ると、そこが1件しか書かれていない手続きでは
 * 鍵が1本で開いてしまい、残りを家に忘れていても受付が通る。
 * 断り文は stuckIf にあればそれを使い、無ければ持ち物の名前から作る。
 */
export function questionsOf(target: Procedure, me: Profile): { itemId: string; label: string; ifMissing: string }[] {
  const messages = new Map<string, string>();
  for (const step of target.steps) {
    if (step.stuckIf) messages.set(step.stuckIf.missing, step.stuckIf.message);
  }

  const lines = bringFor(target, me);
  return lines
    // 「どちらか一方でよい」ものは、本体だけ聞く。代わりを持っていれば openBag で足りる
    .filter((line) => !(line.insteadOf && lines.some((other) => other.id === line.insteadOf)))
    .map((line) => ({
      itemId: line.id,
      label: line.label,
      ifMissing:
        messages.get(line.id) ??
        `${line.label}がないと、こちらはお受けできません。おそろえのうえ、もう一度お越しください。`,
    }));
}

function askNext(
  state: CounterState,
  target: Procedure,
  me: Profile,
  from: number,
): CounterState {
  const questions = questionsOf(target, me);
  const next = questions[from];

  if (!next) {
    const line = `手続きが完了しました。${target.result}`;
    return {
      ...state,
      status: "cleared",
      clerk: line,
      choices: [],
      asking: null,
      log: [...state.log, { who: "clerk", text: line }],
    };
  }

  const line = `${next.label}はお持ちですか？`;
  return {
    ...state,
    status: "item",
    clerk: line,
    choices: [],
    asking: next,
    log: [...state.log, { who: "clerk", text: line }],
  };
}
