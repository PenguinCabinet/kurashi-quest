// 持ち物。1手続き分（やり方カード用）と、まとめたもの（攻略シート用）を作る。
import { matchCond } from "./profile.js";
/** その人が実際に持っていく必要があるものだけを返す */
export function bringFor(p, me) {
    const lines = p.bring
        .filter((b) => needsItem(b, me))
        .map((b) => toLine(b, p.id));
    return sortBring(dedupe(lines));
}
/** 複数の手続きの持ち物を1つにする。同じものは1行にまとめ、neededFor に用途を入れる */
export function mergeBring(procedures, me) {
    const lines = [];
    for (const p of procedures) {
        for (const b of p.bring) {
            if (needsItem(b, me))
                lines.push(toLine(b, p.id));
        }
    }
    return sortBring(dedupe(lines));
}
/**
 * その人には要らない持ち物。
 * 「カードがあるので転出証明書は要りません」のように、
 * 外れたことが分かる形で画面に出すためのもの。
 */
export function notNeededBring(procedures, me) {
    const needed = new Set(mergeBring(procedures, me).map((line) => line.id));
    const out = new Map();
    for (const p of procedures) {
        for (const b of p.bring) {
            const key = b.sameAs ?? b.id;
            if (needed.has(key) || out.has(key))
                continue;
            if (!b.showIf || matchCond(b.showIf, me) !== "no")
                continue;
            out.set(key, {
                ...toLine(b, p.id),
                reason: `${describeCondForItem(b.showIf)}が持っていくものです`,
            });
        }
    }
    return [...out.values()];
}
/** 「マイナンバーカードを持っていない人」のような言い方にする */
function describeCondForItem(cond) {
    const parts = [];
    if (cond.occupation === "student")
        parts.push("学生の人");
    if (cond.occupation === "worker")
        parts.push("働いている人");
    if (cond.livingAlone === true)
        parts.push("1人暮らしの人");
    if (cond.livingAlone === false)
        parts.push("家族と住む人");
    if (cond.hasMyNumberCard === true)
        parts.push("マイナンバーカードを持っている人");
    if (cond.hasMyNumberCard === false)
        parts.push("マイナンバーカードを持っていない人");
    if (cond.vehicle === "car")
        parts.push("車を持っている人");
    if (cond.vehicle === "moped")
        parts.push("原付・バイクを持っている人");
    if (cond.vehicle === "none")
        parts.push("乗り物がない人");
    return parts.length > 0 ? parts.join("で") : "一部の人";
}
/** 物ではないもの（暗証番号など）。忘れやすいので画面で分けて出す */
export function nonPhysical(lines) {
    return lines.filter((l) => !l.physical);
}
/** 未確認のものだけ。画面で「要確認」を出す用 */
export function unverifiedBring(lines) {
    return lines.filter((l) => !l.verified);
}
/** その持ち物が要るか。答えていない項目があるときは「要る」に倒す（忘れて出直す方が困る） */
function needsItem(b, me) {
    if (!b.showIf)
        return true;
    return matchCond(b.showIf, me) !== "no";
}
function toLine(b, procedureId) {
    return {
        id: b.sameAs ?? b.id,
        label: b.label,
        note: b.note,
        physical: b.physical !== false, // 既定は物あつかい
        verified: b.verified === true,
        neededFor: [procedureId],
        insteadOf: b.insteadOf,
        primary: b.sameAs === undefined,
    };
}
/**
 * その持ち物が用意できているか。
 * 「どちらか一方でよい」ものは、相方が用意できていれば足りている。
 * 片方だけ持って窓口に行った人を、間違って止めないための判定。
 */
export function isReady(lines, item, brought) {
    if (brought(item.id))
        return true;
    // 自分が「代わりのもの」で、本体を持っている
    if (item.insteadOf && brought(item.insteadOf))
        return true;
    // 自分が本体で、代わりのものを持っている
    return lines.some((other) => other.insteadOf === item.id && brought(other.id));
}
function dedupe(lines) {
    const byId = new Map();
    for (const line of lines) {
        const found = byId.get(line.id);
        if (!found) {
            byId.set(line.id, { ...line, neededFor: [...line.neededFor] });
            continue;
        }
        for (const id of line.neededFor) {
            if (!found.neededFor.includes(id))
                found.neededFor.push(id);
        }
        // 1か所でも未確認なら未確認あつかい（安全側）
        found.verified = found.verified && line.verified;
        if (!found.primary && line.primary) {
            found.label = line.label;
            found.physical = line.physical;
            found.primary = true;
        }
        // 注記はどちらも残す（代わりになるものの説明が消えるため）
        found.note = joinNotes(found.note, line.note);
    }
    return [...byId.values()].map(({ primary: _p, ...line }) => line);
}
/** 注記を1つにまとめる。同じ文は2回書かない */
function joinNotes(a, b) {
    if (!a)
        return b;
    if (!b || a.includes(b))
        return a;
    return `${a}。${b}`;
}
/** 物 → 物でないもの（暗証番号など）の順。同じなら多くの手続きで要るものを上に */
function sortBring(lines) {
    return [...lines].sort((a, b) => {
        if (a.physical !== b.physical)
            return a.physical ? -1 : 1;
        if (a.neededFor.length !== b.neededFor.length)
            return b.neededFor.length - a.neededFor.length;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}
