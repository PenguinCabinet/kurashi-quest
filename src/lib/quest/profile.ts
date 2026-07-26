// キャラメイクの5問と、答えを条件に当てる部分。
// 画面は QUESTIONS を map するだけ。質問を増やすときもここだけ直せばいい。

import type { Profile, ProfileKey } from "./types";
import { isDateString } from "./dates";

export type Choice = {
  value: string | boolean;
  label: string;
  note?: string;
  /** キャラ画像などのファイル名。デザイン担当が差し替える */
  art?: string;
};

export type Question =
  | { key: ProfileKey; kind: "choice"; title: string; help?: string; options: Choice[] }
  | { key: ProfileKey; kind: "date"; title: string; help?: string };

/** キャラメイクの5問。この順に出す */
export const QUESTIONS: Question[] = [
  {
    key: "occupation",
    kind: "choice",
    title: "どっちですか？",
    help: "手続きの中身が変わります",
    options: [
      { value: "student", label: "学生", art: "student" },
      { value: "worker", label: "働いている", art: "worker" },
    ],
  },
  {
    key: "movedOn",
    kind: "date",
    title: "引越した日（引越す日）はいつですか？",
    help: "ここから期限を数えます",
  },
  {
    key: "hasMyNumberCard",
    kind: "choice",
    title: "マイナンバーカードは持っていますか？",
    help: "持っている人と持っていない人で、必要なものが変わります",
    options: [
      { value: true, label: "持っている" },
      { value: false, label: "持っていない", note: "通知カードだけの人はこちら" },
    ],
  },
  {
    key: "livingAlone",
    kind: "choice",
    title: "1人で住みますか？",
    options: [
      { value: true, label: "1人暮らし" },
      { value: false, label: "家族と住む" },
    ],
  },
  {
    key: "vehicle",
    kind: "choice",
    title: "乗り物はありますか？",
    options: [
      { value: "none", label: "なし" },
      { value: "moped", label: "原付・バイク" },
      { value: "car", label: "車" },
    ],
  },
];

/** 出し分けに使う項目。city は対象自治体が1つなので聞かない */
export const ASKED_KEYS: ProfileKey[] = QUESTIONS.map((q) => q.key);

export function emptyProfile(): Profile {
  return {};
}

/** 保存された値を Profile にする。知らないキーと型が合わない値は捨てる */
export function normalizeProfile(raw: unknown): Profile {
  const out: Profile = {};
  if (typeof raw !== "object" || raw === null) return out;
  const r = raw as Record<string, unknown>;

  if (typeof r.city === "string" && r.city !== "") out.city = r.city;
  if (typeof r.movedOn === "string" && isDateString(r.movedOn)) out.movedOn = r.movedOn;
  if (r.occupation === "student" || r.occupation === "worker") out.occupation = r.occupation;
  if (typeof r.livingAlone === "boolean") out.livingAlone = r.livingAlone;
  if (r.vehicle === "none" || r.vehicle === "moped" || r.vehicle === "car") out.vehicle = r.vehicle;
  if (typeof r.hasMyNumberCard === "boolean") out.hasMyNumberCard = r.hasMyNumberCard;
  if (typeof r.age === "number" && Number.isFinite(r.age) && r.age >= 0 && r.age < 150) {
    out.age = Math.floor(r.age);
  }
  return out;
}

/** 1問に答える。値がおかしければ元の Profile をそのまま返す */
export function answer(profile: Profile, key: ProfileKey, value: unknown): Profile {
  if (value === undefined || value === null) return clearAnswer(profile, key);
  const merged = normalizeProfile({ ...profile, [key]: value });
  if (merged[key] === undefined) return profile; // 値がおかしいので何も変えない
  // 他の項目は元の値を優先して残す（1問の入力ミスで全部消えないように）
  return { ...profile, ...pick(merged, [key]) };
}

/** 答えを取り消す。やり直しボタン用 */
export function clearAnswer(profile: Profile, key: ProfileKey): Profile {
  const out = { ...profile };
  delete out[key];
  return out;
}

/** まだ答えていない項目。キャラメイクの進捗表示に使う */
export function missingAnswers(profile: Profile): ProfileKey[] {
  return ASKED_KEYS.filter((k) => profile[k] === undefined);
}

export function isComplete(profile: Profile): boolean {
  return missingAnswers(profile).length === 0;
}

/** 3値で判定する。答えていない項目を「違う」にすると必要な手続きが消えるため */
export type Match = "yes" | "no" | "unknown";

export function matchCond(cond: Partial<Profile>, me: Profile): Match {
  let sawUnknown = false;
  for (const [key, want] of Object.entries(cond)) {
    const mine = me[key as ProfileKey];
    if (mine === undefined) {
      sawUnknown = true;
      continue;
    }
    if (mine !== want) return "no";
  }
  return sawUnknown ? "unknown" : "yes";
}

/** 条件のうち、まだ答えていない項目の名前。unsure の理由文に使う */
export function unknownKeys(cond: Partial<Profile>, me: Profile): ProfileKey[] {
  return Object.keys(cond).filter((k) => me[k as ProfileKey] === undefined) as ProfileKey[];
}

const LABELS: Record<ProfileKey, string> = {
  city: "住んでいる市",
  movedOn: "引越した日",
  occupation: "学生か働いているか",
  livingAlone: "1人暮らしかどうか",
  vehicle: "乗り物",
  hasMyNumberCard: "マイナンバーカードの有無",
  age: "年齢",
};

export function labelOf(key: ProfileKey): string {
  return LABELS[key] ?? key;
}

function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}
