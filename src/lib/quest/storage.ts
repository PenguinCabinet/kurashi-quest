// 保存。ログインもDBも無いので、答えと進捗はブラウザに置くだけです。
//
// localStorage を直接呼ばずにアダプタ越しにしているのは3つの理由です。
//   ・Next.js はサーバ側でも同じコードを動かすので、window が無い場所で落ちる
//   ・Safari のプライベートモードは setItem で例外を投げる
//   ・テストで localStorage を用意したくない
//
// 画面側は useEffect の中で loadState() を呼んでください（最初の描画はサーバでも動く形にするため）。

import type { Profile, Progress } from "./types";
import { normalizeProfile } from "./profile";
import { emptyProgress, normalizeProgress } from "./progress";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const KEYS = {
  profile: "hikkoshi-quest.profile.v1",
  progress: "hikkoshi-quest.progress.v1",
} as const;

/** ブラウザの localStorage。サーバ側や、使えない環境では null */
export function browserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = "hikkoshi-quest.probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null; // プライベートモードなど。保存できないだけで、アプリは動く
  }
}

/** テストと、保存できない環境のための入れ物 */
export function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

export function loadProfile(storage: StorageLike | null): Profile {
  return normalizeProfile(readJson(storage, KEYS.profile));
}

export function loadProgress(storage: StorageLike | null): Progress {
  const raw = readJson(storage, KEYS.progress);
  return raw === null ? emptyProgress() : normalizeProgress(raw);
}

export function saveProfile(storage: StorageLike | null, profile: Profile): void {
  writeJson(storage, KEYS.profile, profile);
}

export function saveProgress(storage: StorageLike | null, progress: Progress): void {
  writeJson(storage, KEYS.progress, progress);
}

/** 最初からやり直す */
export function clearAll(storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.removeItem(KEYS.profile);
    storage.removeItem(KEYS.progress);
  } catch {
    // 消せなくても進める
  }
}

function readJson(storage: StorageLike | null, key: string): unknown {
  if (!storage) return null;
  try {
    const text = storage.getItem(key);
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null; // 壊れた保存データは無かったことにする
  }
}

function writeJson(storage: StorageLike | null, key: string, value: unknown): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // 容量オーバーやプライベートモード。保存できないだけで進める
  }
}
