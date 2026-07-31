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
import { bringFor } from "./bring.js";
import { isBrought } from "./progress.js";
const FIRST_LINE = "本日はどのようなご用件ですか？";
/** 窓口に行く */
export function startCounter(target, others, me) {
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
export function purposeChoices(target, others, _me, limit = 3) {
    const samePlace = others.filter((p) => p.id !== target.id && p.where.placeKey === target.where.placeKey);
    const rest = others.filter((p) => p.id !== target.id && p.where.placeKey !== target.where.placeKey);
    const wrong = [...samePlace, ...rest]
        .slice(0, Math.max(0, limit - 1))
        .map((p) => ({ text: p.sayThis.text, correct: false }));
    return [{ text: target.sayThis.text, correct: true }, ...wrong];
}
/** 用件を選ぶ */
export function say(state, target, index, me) {
    if (state.status !== "purpose")
        return state;
    const choice = state.choices[index];
    if (!choice)
        return state;
    const log = [...state.log, { who: "me", text: choice.text }];
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
export function openBag(state, target, progress, me) {
    if (state.status !== "item" || !state.asking)
        return state;
    return show(state, target, isBrought(progress, state.asking.itemId), me);
}
/** 持ち物の質問に答える（持っているかを自分で渡す形） */
export function show(state, target, has, me) {
    if (state.status !== "item" || !state.asking)
        return state;
    const asking = state.asking;
    const log = [...state.log, { who: "me", text: has ? "あります" : "持っていません" }];
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
export function comeAgain(state, target, others, me) {
    const fresh = startCounter(target, others, me);
    return { ...fresh, attempts: state.attempts + 1, mistakes: state.mistakes };
}
/** 窓口で聞かれる持ち物。手順の詰まりポイントから作る */
export function questionsOf(target, me) {
    const mine = new Map(bringFor(target, me).map((line) => [line.id, line]));
    return target.steps
        .filter((step) => step.stuckIf)
        .map((step) => {
        const stuck = step.stuckIf;
        const line = mine.get(stuck.missing);
        return { itemId: stuck.missing, label: line?.label ?? stuck.missing, ifMissing: stuck.message };
    })
        .filter((q) => mine.has(q.itemId));
}
function askNext(state, target, me, from) {
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
