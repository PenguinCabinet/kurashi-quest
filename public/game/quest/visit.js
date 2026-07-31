// 1回の来庁。
//
// 攻略シートは「市役所で3件まとめてやる」形なので、窓口も続けて回る。
// 途中で持ち物が足りないと、その日はそこで終わり（出直し）。
// 「役所に1回で終わらせる」の裏返しで、ここが一番効く。
//
//   準備（持ち物にチェック）→ 来庁 → 1件目 → 2件目 → … → 帰る
//                                        ↓ 足りない
//                                      出直し（済んだ分は残る）
import { startCounter, comeAgain } from "./counter.js";
import { isBrought } from "./progress.js";
import { isReady } from "./bring.js";
/** 攻略シートの1か所ぶんを、その日の予定にする */
export function startVisit(stopQuests, procedures, me, place) {
    const plan = stopQuests.filter((q) => !q.done).map((q) => q.id);
    const first = procedures.find((p) => p.id === plan[0]);
    return {
        placeKey: place.placeKey,
        place: place.place,
        plan,
        index: 0,
        done: [],
        status: plan.length === 0 ? "finished" : "atCounter",
        counter: first
            ? startCounter(first, procedures, me)
            : startCounter(procedures[0], procedures, me),
        trips: 0,
    };
}
/** いまやっている手続き */
export function currentProcedure(visit, procedures) {
    const id = visit.plan[visit.index];
    return procedures.find((p) => p.id === id) ?? null;
}
/**
 * 窓口のやり取りが1件終わったら呼ぶ。
 * 完了なら次の手続きへ、出直しならその日は終わり。
 */
export function afterCounter(visit, counter, procedures, me) {
    if (counter.status === "turnedAway") {
        // 済んだ分は残る。まだの分は次の来庁に持ち越し
        return { ...visit, counter, status: "wentHome" };
    }
    if (counter.status !== "cleared") {
        return { ...visit, counter };
    }
    const done = [...visit.done, visit.plan[visit.index]];
    const next = visit.index + 1;
    const nextProcedure = procedures.find((p) => p.id === visit.plan[next]);
    if (!nextProcedure) {
        return { ...visit, counter, done, index: next, status: "finished" };
    }
    return {
        ...visit,
        done,
        index: next,
        status: "atCounter",
        counter: startCounter(nextProcedure, procedures, me),
    };
}
/** 出直す。終わった分はそのまま、残りをやり直す */
export function goAgain(visit, procedures, me) {
    const rest = visit.plan.filter((id) => !visit.done.includes(id));
    const first = procedures.find((p) => p.id === rest[0]);
    if (!first)
        return { ...visit, status: "finished" };
    return {
        ...visit,
        plan: rest,
        index: 0,
        status: "atCounter",
        counter: comeAgain(visit.counter, first, procedures, me),
        trips: visit.trips + 1,
    };
}
/**
 * 行く前に「このままだと何件目で止まるか」を出す。
 * 準備画面で「まだ2つ足りません」と言うための計算。
 */
export function predictVisit(plan, progress) {
    const missing = [];
    let stopAt = null;
    for (const quest of plan) {
        for (const item of quest.bring) {
            // 「学生証の写し または 在学証明書」は、どちらか一方あれば足りている
            if (isReady(quest.bring, item, (id) => isBrought(progress, id)))
                continue;
            missing.push({ questId: quest.id, label: item.label });
            if (!stopAt)
                stopAt = quest;
        }
    }
    return { stopAt, missing };
}
/** 結果の一行 */
export function visitLine(visit) {
    if (visit.status === "finished") {
        const trips = visit.trips === 0 ? "1回で" : `${visit.trips + 1}回かかって`;
        return `${visit.place}での手続きが ${trips}終わりました（${visit.done.length}件）`;
    }
    if (visit.status === "wentHome") {
        const rest = visit.plan.length - visit.done.length;
        return `今日はここまでです。残り${rest}件は、持ち物をそろえてから出直しになります`;
    }
    return `${visit.place}　${visit.index + 1}件目 / ${visit.plan.length}件`;
}
