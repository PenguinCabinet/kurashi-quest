// 持ち物準備ゲーム（取得コスト方式）。
//
// 考え方: コストは「持参」ではなく「取得」にかかる。
// 家にあるものは何個入れても損しない（現実と同じ）。
// わざわざ取りに行った書類にだけ、手数料と日数がかかる。
//
// 判定するのは3つ。
//   1. 必要なものをそろえたか（代わりになる書類も数える）
//   2. 取りに行ったものに、いくらかかったか
//   3. もっと安く済ませられたか
import { bringFor } from "./bring.js";
import { matchCond } from "./profile.js";
const FREE = { yen: 0, days: 0, verified: true };
export function categoryOf(item) {
    return item.category ?? "home";
}
export function costOf(item) {
    if ((item.category ?? "home") === "home")
        return FREE;
    return item.cost ?? { yen: 0, days: 0, verified: false };
}
/**
 * ゲームに並べる候補を作る。
 * その手続きに要るものと、その代わりになるものに加えて、
 * 他の手続きで使う書類も混ぜる（「要りそうに見えるが不要」があるから駆け引きになる）。
 */
export function packingCandidates(target, others, me) {
    const neededIds = new Set(bringFor(target, me).map((line) => line.id));
    const out = new Map();
    const add = (item, needed) => {
        const key = item.sameAs ?? item.id;
        if (out.has(key))
            return;
        // その人の条件に合わないものは、そもそも候補に出さない
        if (item.showIf && matchCond(item.showIf, me) === "no")
            return;
        out.set(key, {
            id: key,
            label: item.label,
            note: item.note,
            category: item.category ?? "home",
            cost: costOf(item),
            atHome: (item.category ?? "home") === "home",
            needed,
            insteadOf: item.insteadOf,
        });
    };
    // 代わりになる書類は「必要」とは数えない（本体が満たされていればいい）
    for (const item of target.bring)
        add(item, neededIds.has(item.sameAs ?? item.id) && !item.insteadOf);
    for (const p of others) {
        if (p.id === target.id)
            continue;
        for (const item of p.bring)
            add(item, false);
    }
    return [...out.values()];
}
/** 窓口での判定。持っていったものだけ渡す */
export function judgePacking(candidates, pickedIds) {
    const picked = new Set(pickedIds);
    const byId = new Map(candidates.map((c) => [c.id, c]));
    // 必要なもの1つにつき、それ自身と「代わりになるもの」が選択肢
    const groups = candidates
        .filter((c) => c.needed)
        .map((c) => [c, ...candidates.filter((x) => x.insteadOf === c.id)]);
    const missing = [];
    let bestYen = 0;
    let bestDays = 0;
    const usedIds = new Set();
    for (const options of groups) {
        const chosen = options.filter((o) => picked.has(o.id));
        if (chosen.length === 0) {
            missing.push({
                id: options[0].id,
                label: options[0].label,
                reason: `${options[0].label}がないと受付できません`,
            });
        }
        else {
            for (const o of chosen)
                usedIds.add(o.id);
        }
        // 一番安い選び方（家にあるものがあれば 0円0日）
        bestYen += Math.min(...options.map((o) => o.cost.yen));
        bestDays += Math.min(...options.map((o) => o.cost.days));
    }
    // 取りに行ったものだけ数える。家にあるものは何個入れても損しない
    const paidItems = [...picked]
        .map((id) => byId.get(id))
        .filter((c) => c !== undefined && !c.atHome);
    const wasted = paidItems.filter((c) => !usedIds.has(c.id));
    const sum = (list, key) => list.reduce((total, c) => total + c.cost[key], 0);
    const paidYen = sum(paidItems, "yen");
    const paidDays = sum(paidItems, "days");
    return {
        cleared: missing.length === 0,
        missing,
        wasted,
        paidYen,
        paidDays,
        bestYen,
        bestDays,
        perfect: missing.length === 0 && paidYen === bestYen && paidDays === bestDays,
        hasUnverifiedCost: paidItems.some((c) => c.cost.verified !== true),
    };
}
/** 結果画面の一行 */
export function verdictLine(verdict) {
    if (!verdict.cleared) {
        return `${verdict.missing.length}件足りません。${verdict.missing[0].reason}`;
    }
    if (verdict.perfect)
        return "受付できました。一番少ない手間でそろっています";
    const over = [];
    if (verdict.paidYen > verdict.bestYen)
        over.push(`${verdict.paidYen - verdict.bestYen}円`);
    if (verdict.paidDays > verdict.bestDays)
        over.push(`${verdict.paidDays - verdict.bestDays}日`);
    if (over.length === 0)
        return "受付できました";
    return `受付できました。ただし${over.join("と")}、余分にかかっています`;
}
