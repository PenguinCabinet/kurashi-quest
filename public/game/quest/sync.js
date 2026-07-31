// 合言葉で、別の端末に続きを渡す。
//
// パソコンで準備して、スマホを持って窓口へ行く。これができるようにするためだけの機能です。
// ログインはありません。名前もメールも聞きません。
//
// ここは「何を送るか」「返ってきたものをどう読むか」だけを持ちます。
// 通信そのものは fetch を外から渡してもらうので、テストでサーバを立てずに済みます。
import { normalizeProfile } from "./profile.js";
import { normalizeProgress } from "./progress.js";
import { isPassphrase, normalizePassphrase } from "./passphrase.js";
export const ENDPOINT = "/api/save";
/**
 * いまの状態をサーバに預けて、合言葉を受け取る。
 *
 * @param code 合言葉。すでに持っているなら渡す。無ければサーバが作る
 */
export async function pushSave(fetcher, profile, progress, code) {
    let res;
    try {
        res = await fetcher(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, profile, progress }),
        });
    }
    catch {
        return { ok: false, reason: "network" }; // 圏外・機内モードなど
    }
    if (!res.ok)
        return { ok: false, reason: "server" };
    let body;
    try {
        body = await res.json();
    }
    catch {
        return { ok: false, reason: "server" };
    }
    const got = body?.code;
    if (typeof got !== "string" || !isPassphrase(got))
        return { ok: false, reason: "server" };
    return { ok: true, code: got };
}
/**
 * 合言葉で、預けたものを取り出す。
 *
 * 打ち間違いはここで弾きます。サーバまで行かせません。
 */
export async function pullSave(fetcher, input) {
    const code = normalizePassphrase(input);
    if (!isPassphrase(code))
        return { ok: false, reason: "badcode" };
    let res;
    try {
        res = await fetcher(`${ENDPOINT}?code=${encodeURIComponent(code)}`);
    }
    catch {
        return { ok: false, reason: "network" };
    }
    if (res.status === 404)
        return { ok: false, reason: "notfound" };
    if (!res.ok)
        return { ok: false, reason: "server" };
    let body;
    try {
        body = await res.json();
    }
    catch {
        return { ok: false, reason: "server" };
    }
    const data = readSave(body);
    if (!data)
        return { ok: false, reason: "server" };
    return { ok: true, data };
}
/**
 * サーバから返ってきたものを、信用せずに読み直す。
 *
 * 中身が壊れていても、欠けていても、画面が落ちないようにします。
 * 判断は normalizeProfile / normalizeProgress にまかせます。
 */
export function readSave(raw) {
    if (raw === null || typeof raw !== "object")
        return null;
    const o = raw;
    const savedAt = typeof o.savedAt === "string" ? o.savedAt : "";
    return {
        version: 1,
        profile: normalizeProfile(o.profile),
        progress: normalizeProgress(o.progress),
        savedAt,
    };
}
/** 画面に出す一行 */
export function syncLine(result) {
    if (result.ok) {
        return "code" in result
            ? `合言葉は ${result.code} です。書きとめてください`
            : "続きを読みこみました";
    }
    switch (result.reason) {
        case "badcode":
            return "合言葉は6文字です。打ち間違いがないか見てください";
        case "notfound":
            return "その合言葉は見つかりません。打ち間違いがないか見てください";
        case "network":
            return "つながりませんでした。電波を確かめて、もう一度ためしてください";
        default:
            return "うまくいきませんでした。少し待って、もう一度ためしてください";
    }
}
