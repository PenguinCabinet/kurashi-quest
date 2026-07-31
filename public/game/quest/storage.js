// 保存。ログインもDBも無いので、答えと進捗はブラウザに置くだけ。
// localStorage を直接呼ばないのは、サーバ側に window が無いのと、Safari のプライベートモードが例外を投げるため。
// 画面側は useEffect の中で読むこと。
import { normalizeProfile } from "./profile.js";
import { emptyProgress, normalizeProgress } from "./progress.js";
export const KEYS = {
    profile: "kurashi-quest.profile.v1",
    progress: "kurashi-quest.progress.v1",
};
/** ブラウザの localStorage。サーバ側や、使えない環境では null */
export function browserStorage() {
    try {
        if (typeof window === "undefined" || !window.localStorage)
            return null;
        const probe = "kurashi-quest.probe";
        window.localStorage.setItem(probe, "1");
        window.localStorage.removeItem(probe);
        return window.localStorage;
    }
    catch {
        return null; // プライベートモードなど。保存できないだけで、アプリは動く
    }
}
/** テストと、保存できない環境のための入れ物 */
export function memoryStorage(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        getItem: (key) => map.get(key) ?? null,
        setItem: (key, value) => void map.set(key, value),
        removeItem: (key) => void map.delete(key),
    };
}
export function loadProfile(storage) {
    return normalizeProfile(readJson(storage, KEYS.profile));
}
export function loadProgress(storage) {
    const raw = readJson(storage, KEYS.progress);
    return raw === null ? emptyProgress() : normalizeProgress(raw);
}
export function saveProfile(storage, profile) {
    writeJson(storage, KEYS.profile, profile);
}
export function saveProgress(storage, progress) {
    writeJson(storage, KEYS.progress, progress);
}
/** 最初からやり直す */
export function clearAll(storage) {
    if (!storage)
        return;
    try {
        storage.removeItem(KEYS.profile);
        storage.removeItem(KEYS.progress);
    }
    catch {
        // 消せなくても進める
    }
}
function readJson(storage, key) {
    if (!storage)
        return null;
    try {
        const text = storage.getItem(key);
        if (!text)
            return null;
        return JSON.parse(text);
    }
    catch {
        return null; // 壊れた保存データは無かったことにする
    }
}
function writeJson(storage, key, value) {
    if (!storage)
        return;
    try {
        storage.setItem(key, JSON.stringify(value));
    }
    catch {
        // 容量オーバーやプライベートモード。保存できないだけで進める
    }
}
