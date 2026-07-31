// 画面1枚分をまとめて作る。期限も順番も持ち物もここで計算済み。
//   const board = buildBoard(data, profile, progress, "2026-07-28");
import { isDateString } from "./dates.js";
import { buildQuests, groupByPhase, notNeededQuests, pickNext, statsOf, visibleQuests, } from "./quests.js";
import { buildRoute } from "./route.js";
import { missingAnswers } from "./profile.js";
export function buildBoard(data, profile, progress, today) {
    // ここで弾かないと、全部の期限が黙って「不明」になって原因が分からなくなります。
    // 画面側は new Date().toISOString().slice(0, 10) を渡してください。
    if (!isDateString(today)) {
        throw new Error(`today は "YYYY-MM-DD" で渡してください（今: ${String(today)}）`);
    }
    // 出直した日数は、期限の計算には使いません。
    //
    // このアプリは実際に窓口へ持っていける道具でもあるので、
    // 残り日数が本物とずれると、そこで嘘をつくことになります。
    // 出直しの重さは「記録」として画面に出すだけにとどめます。
    const quests = buildQuests(data, profile, progress, today);
    const shown = visibleQuests(quests);
    return {
        today,
        lostDays: progress.lostDays ?? 0,
        targetCity: data.targetCity,
        dataVersion: data.dataVersion,
        profile,
        missingAnswers: missingAnswers(profile),
        quests: shown,
        notNeeded: notNeededQuests(quests),
        phases: groupByPhase(shown),
        stats: statsOf(quests),
        next: pickNext(quests),
        route: buildRoute(quests, profile),
    };
}
/** 「7個のうち2個は、知らないと調べようもない手続きです」の一行 */
export function hiddenLine(board) {
    const { total, hidden } = board.stats;
    if (hidden === 0)
        return null;
    return `${total}個のうち${hidden}個は、知らないと調べようもない手続きです`;
}
/** 「役所は1回、家でできるものが2件」の文 */
export function routeLine(board) {
    const { trips, stops, minutes } = board.route;
    const atHome = stops.filter((s) => s.atHome).length;
    if (stops.length === 0)
        return "やることは全部終わっています";
    const parts = [trips === 0 ? "出かける用事はありません" : `出かけるのは${trips}回`];
    if (atHome > 0)
        parts.push(`家でできるものが${atHome}件`);
    parts.push(`合計の目安は${minutes}分`);
    return parts.join("、");
}
