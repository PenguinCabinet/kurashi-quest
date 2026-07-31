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
import { bringFor, isReady } from "./bring.js";
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
    // 正解の位置を混ぜる。いつも1番目だと、読まずに1番目を押すだけの画面になる
    return shuffle([{ text: target.sayThis.text, correct: true }, ...wrong]);
}
/** 並びを混ぜる。元の配列は変えない */
function shuffle(list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
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
/**
 * 窓口で聞かれる持ち物。その人が実際に持っていくもの全部。
 *
 * 詰まりポイント（stuckIf）だけから作ると、そこが1件しか書かれていない手続きでは
 * 鍵が1本で開いてしまい、残りを家に忘れていても受付が通る。
 * 断り文は stuckIf にあればそれを使い、無ければ持ち物の名前から作る。
 */
export function questionsOf(target, me) {
    const messages = new Map();
    for (const step of target.steps) {
        if (step.stuckIf)
            messages.set(step.stuckIf.missing, step.stuckIf.message);
    }
    const lines = bringFor(target, me);
    return lines
        // 「どちらか一方でよい」ものは、本体だけ聞く。代わりを持っていれば openBag で足りる
        .filter((line) => !(line.insteadOf && lines.some((other) => other.id === line.insteadOf)))
        .map((line) => ({
        itemId: line.id,
        label: line.label,
        ifMissing: messages.get(line.id) ??
            `${line.label}がないと、こちらはお受けできません。おそろえのうえ、もう一度お越しください。`,
    }));
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
