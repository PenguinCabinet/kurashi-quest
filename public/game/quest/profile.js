// キャラメイクの6問と、答えを条件に当てる部分。
// 画面は QUESTIONS を map するだけ。質問を増やすときもここだけ直せばいい。
import { isDateString } from "./dates.js";
/** キャラメイクの6問。この順に出す */
export const QUESTIONS = [
    {
        key: "occupation",
        kind: "choice",
        title: "学生ですか？",
        help: "学生と社会人で、必要な手続きが変わります",
        options: [
            { value: "student", label: "学生です", art: "student" },
            { value: "worker", label: "働いています", art: "worker" },
        ],
    },
    {
        key: "movedOn",
        kind: "date",
        title: "いつ引越しましたか？",
        help: "これから引越す人は、その予定日を入れてください",
    },
    {
        key: "hasMyNumberCard",
        kind: "choice",
        title: "マイナンバーカードは持っていますか？",
        help: "持っている人と持っていない人で、必要なものが変わります",
        options: [
            { value: true, label: "はい", art: "card-yes" },
            { value: false, label: "いいえ", note: "通知カードだけの人はこちら", art: "card-no" },
        ],
    },
    {
        key: "livingAlone",
        kind: "choice",
        title: "ひとり暮らしですか？",
        options: [
            { value: true, label: "はい", art: "alone" },
            { value: false, label: "いいえ、家族と住みます", art: "family" },
        ],
    },
    {
        key: "vehicle",
        kind: "choice",
        title: "車やバイクは持っていますか？",
        options: [
            { value: "none", label: "持っていません", art: "walk" },
            { value: "moped", label: "原付・バイク", art: "moped" },
            { value: "car", label: "車", art: "car" },
        ],
    },
    {
        // 年齢そのものは使わないので、20歳以上かどうかだけ聞く（年金の手続きの判定に使う）
        key: "age",
        kind: "choice",
        title: "20歳以上ですか？",
        help: "国民年金の手続きが要るかどうかが変わります",
        options: [
            { value: 20, label: "はい", art: "20over" },
            { value: 19, label: "いいえ、まだ19歳以下です", art: "under20" },
        ],
    },
];
/** 出し分けに使う項目。city は対象自治体が1つなので聞かない */
export const ASKED_KEYS = QUESTIONS.map((q) => q.key);
export function emptyProfile() {
    return {};
}
/** 保存された値を Profile にする。知らないキーと型が合わない値は捨てる */
export function normalizeProfile(raw) {
    const out = {};
    if (typeof raw !== "object" || raw === null)
        return out;
    const r = raw;
    if (typeof r.city === "string" && r.city !== "")
        out.city = r.city;
    if (typeof r.movedOn === "string" && isDateString(r.movedOn))
        out.movedOn = r.movedOn;
    if (r.occupation === "student" || r.occupation === "worker")
        out.occupation = r.occupation;
    if (typeof r.livingAlone === "boolean")
        out.livingAlone = r.livingAlone;
    if (r.vehicle === "none" || r.vehicle === "moped" || r.vehicle === "car")
        out.vehicle = r.vehicle;
    if (typeof r.hasMyNumberCard === "boolean")
        out.hasMyNumberCard = r.hasMyNumberCard;
    if (typeof r.age === "number" && Number.isFinite(r.age) && r.age >= 0 && r.age < 150) {
        out.age = Math.floor(r.age);
    }
    return out;
}
/** 1問に答える。値がおかしければ元の Profile をそのまま返す */
export function answer(profile, key, value) {
    if (value === undefined || value === null)
        return clearAnswer(profile, key);
    const merged = normalizeProfile({ ...profile, [key]: value });
    if (merged[key] === undefined)
        return profile; // 値がおかしいので何も変えない
    // 他の項目は元の値を優先して残す（1問の入力ミスで全部消えないように）
    return { ...profile, ...pick(merged, [key]) };
}
/** 答えを取り消す。やり直しボタン用 */
export function clearAnswer(profile, key) {
    const out = { ...profile };
    delete out[key];
    return out;
}
/** まだ答えていない項目。キャラメイクの進捗表示に使う */
export function missingAnswers(profile) {
    return ASKED_KEYS.filter((k) => profile[k] === undefined);
}
export function isComplete(profile) {
    return missingAnswers(profile).length === 0;
}
export function matchCond(cond, me) {
    let sawUnknown = false;
    for (const [key, want] of Object.entries(cond)) {
        const mine = me[key];
        if (mine === undefined) {
            sawUnknown = true;
            continue;
        }
        if (mine !== want)
            return "no";
    }
    return sawUnknown ? "unknown" : "yes";
}
/** 条件のうち、まだ答えていない項目の名前。unsure の理由文に使う */
export function unknownKeys(cond, me) {
    return Object.keys(cond).filter((k) => me[k] === undefined);
}
const LABELS = {
    city: "住んでいる市",
    movedOn: "引越した日",
    occupation: "学生か働いているか",
    livingAlone: "1人暮らしかどうか",
    vehicle: "乗り物",
    hasMyNumberCard: "マイナンバーカードの有無",
    age: "年齢",
};
export function labelOf(key) {
    return LABELS[key] ?? key;
}
function pick(obj, keys) {
    const out = {};
    for (const k of keys) {
        if (obj[k] !== undefined)
            out[k] = obj[k];
    }
    return out;
}
