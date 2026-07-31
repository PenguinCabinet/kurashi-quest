// 日付は "YYYY-MM-DD" の文字列だけで扱う。
// Date オブジェクトを持ち回すと、時差で1日ずれる（JSTの深夜に日付が変わる）ので使わない。
// 内部の計算は UTC 固定。
const DAY_MS = 86_400_000;
const PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export function isDateString(value) {
    if (typeof value !== "string" || !PATTERN.test(value))
        return false;
    return toEpoch(value) !== null;
}
/** "2026-07-20" → epoch ms（UTC 0時）。壊れた文字列は null */
export function toEpoch(date) {
    if (typeof date !== "string" || !PATTERN.test(date))
        return null;
    const [y, m, d] = date.split("-").map(Number);
    const ms = Date.UTC(y, m - 1, d);
    if (Number.isNaN(ms))
        return null;
    // 2026-02-31 のような存在しない日付を弾く
    const back = new Date(ms);
    if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) {
        return null;
    }
    return ms;
}
export function fromEpoch(ms) {
    return new Date(ms).toISOString().slice(0, 10);
}
/** 日数を足した日付。日付が壊れていたら null */
export function addDays(date, days) {
    const ms = toEpoch(date);
    if (ms === null)
        return null;
    return fromEpoch(ms + days * DAY_MS);
}
/** to - from の日数。どちらかが壊れていたら null */
export function diffDays(from, to) {
    const a = toEpoch(from);
    const b = toEpoch(to);
    if (a === null || b === null)
        return null;
    return Math.round((b - a) / DAY_MS);
}
/** 画面用。"7月20日" */
export function formatJa(date) {
    const ms = toEpoch(date);
    if (ms === null)
        return date;
    const d = new Date(ms);
    return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}
/** 「あと3日」「3日すぎている」「今日」 */
export function formatDaysLeft(daysLeft) {
    if (daysLeft === null)
        return "";
    if (daysLeft === 0)
        return "今日まで";
    if (daysLeft > 0)
        return `あと${daysLeft}日`;
    return `${-daysLeft}日すぎている`;
}
