// 進捗。元の値は書き換えず、新しい値を返す（useState にそのまま入る）。
// 完了は true/false ではなく日付で持つ（「転入届の90日後」の起算に要るため）。
import { isDateString } from "./dates.js";
export function emptyProgress() {
    return { doneAt: {}, dismissed: [], brought: [] };
}
/** 保存されていた値を読む。壊れていたら捨てて空にする（古い形で画面が落ちないように） */
export function normalizeProgress(raw) {
    const out = emptyProgress();
    if (typeof raw !== "object" || raw === null)
        return out;
    const r = raw;
    if (typeof r.doneAt === "object" && r.doneAt !== null) {
        for (const [id, date] of Object.entries(r.doneAt)) {
            if (typeof id === "string" && id !== "" && isDateString(date))
                out.doneAt[id] = date;
        }
    }
    if (Array.isArray(r.dismissed)) {
        for (const id of r.dismissed) {
            if (typeof id === "string" && id !== "" && !out.dismissed.includes(id))
                out.dismissed.push(id);
        }
    }
    if (Array.isArray(r.brought)) {
        for (const id of r.brought) {
            if (typeof id === "string" && id !== "" && !out.brought.includes(id))
                out.brought.push(id);
        }
    }
    return out;
}
/** 終わったことにする。today は呼ぶ側が渡す（期限の起算日になるので、実際に終えた日を入れる） */
export function complete(progress, id, today) {
    if (!isDateString(today))
        return progress;
    return { ...progress, doneAt: { ...progress.doneAt, [id]: today } };
}
/** 終わっていないことに戻す */
export function uncomplete(progress, id) {
    if (progress.doneAt[id] === undefined)
        return progress;
    const doneAt = { ...progress.doneAt };
    delete doneAt[id];
    return { ...progress, doneAt };
}
/** チェックボックスの ON / OFF */
export function toggle(progress, id, today) {
    return isDone(progress, id) ? uncomplete(progress, id) : complete(progress, id, today);
}
/** 持ち物をそろえた／まだ、を切り替える。攻略シートのチェック用 */
export function toggleBrought(progress, itemId) {
    return isBrought(progress, itemId)
        ? { ...progress, brought: progress.brought.filter((x) => x !== itemId) }
        : { ...progress, brought: [...progress.brought, itemId] };
}
export function isBrought(progress, itemId) {
    return progress.brought.includes(itemId);
}
/** 「準備 2 / 4 そろった」の数。要らないものは数に入れない */
export function broughtCount(progress, lines) {
    return {
        ready: lines.filter((line) => isBrought(progress, line.id)).length,
        total: lines.length,
    };
}
/** 持ち物のチェックだけ外す（役所から帰ってきたときなど） */
export function clearBrought(progress) {
    return { ...progress, brought: [] };
}
/** 本人が「これは要らない」と消す。データからは消さないので、あとで戻せる */
export function dismiss(progress, id) {
    if (progress.dismissed.includes(id))
        return progress;
    return { ...progress, dismissed: [...progress.dismissed, id] };
}
/** 消したものを戻す */
export function restore(progress, id) {
    if (!progress.dismissed.includes(id))
        return progress;
    return { ...progress, dismissed: progress.dismissed.filter((x) => x !== id) };
}
export function reset() {
    return emptyProgress();
}
export function isDone(progress, id) {
    return progress.doneAt[id] !== undefined;
}
/** 鍵つきにチェックを付けるとき、確認を出すなら文言を返す（止めはしない） */
export function confirmBeforeComplete(quest) {
    if (!quest.lock.locked)
        return null;
    return `「${quest.lock.blockedByNames.join("」「")}」が終わっていません。それでも終わったことにしますか？`;
}
/** 進捗のうち、いま出ているクエストに無い id を捨てる（データから手続きが消えたとき用） */
export function pruneProgress(progress, knownIds) {
    const known = new Set(knownIds);
    const doneAt = {};
    for (const [id, date] of Object.entries(progress.doneAt)) {
        if (known.has(id))
            doneAt[id] = date;
    }
    // brought は手続きではなく持ち物の id なので、ここでは触らない
    return {
        doneAt,
        dismissed: progress.dismissed.filter((id) => known.has(id)),
        brought: progress.brought,
    };
}
