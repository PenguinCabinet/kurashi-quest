// procedures.json の読み込みと検証。
//
// ロジックは JSON を自分で import しません（テストからも Next からも同じ形で使えるように）。
// 画面側:  import raw from "@/data/procedures.json";  const data = loadProcedures(raw);
//
// 手続きを調べる人が項目を足したり id を打ち間違えたとき、画面が黙って空になるのが一番困るので、
// 壊れているものは loadProcedures で例外にして、直すべき箇所を全部出します。

import type { ProcedureFile, Procedure, ProfileKey } from "./types";
import { isDateString } from "./dates";

export type DataProblem = {
  /** どの手続きか。ファイル全体の問題なら null */
  procedureId: string | null;
  field: string;
  message: string;
};

export type ValidationResult = {
  /** 直さないと動かないもの */
  errors: DataProblem[];
  /** 動くが、直した方がいいもの */
  warnings: DataProblem[];
  /** verified:false の箇所。画面では「要確認」と出す。調べる人の残作業リストでもある */
  unverified: DataProblem[];
};

const PHASES = ["before", "moveDay", "within14"];
const PROFILE_KEYS: ProfileKey[] = [
  "city",
  "movedOn",
  "occupation",
  "livingAlone",
  "vehicle",
  "hasMyNumberCard",
  "age",
];

/** 検証して型を付ける。errors が1件でもあれば例外。 */
export function loadProcedures(raw: unknown): ProcedureFile {
  const result = validateProcedures(raw);
  if (result.errors.length > 0) {
    const lines = result.errors.map(
      (e) => `  - ${e.procedureId ?? "(ファイル全体)"} / ${e.field}: ${e.message}`,
    );
    throw new Error(`procedures.json に直すところがあります:\n${lines.join("\n")}`);
  }
  return raw as ProcedureFile;
}

/** 例外を投げずに全部の問題を返す。テストと、データを直す人向けのチェッカーで使う。 */
export function validateProcedures(raw: unknown): ValidationResult {
  const errors: DataProblem[] = [];
  const warnings: DataProblem[] = [];
  const unverified: DataProblem[] = [];

  const err = (procedureId: string | null, field: string, message: string) =>
    errors.push({ procedureId, field, message });
  const warn = (procedureId: string | null, field: string, message: string) =>
    warnings.push({ procedureId, field, message });

  if (!isObject(raw)) {
    err(null, "root", "オブジェクトではありません");
    return { errors, warnings, unverified };
  }
  if (typeof raw.dataVersion !== "string") warn(null, "dataVersion", "文字列で入れてください");
  if (typeof raw.targetCity !== "string") warn(null, "targetCity", "文字列で入れてください");
  if (!Array.isArray(raw.procedures)) {
    err(null, "procedures", "配列ではありません");
    return { errors, warnings, unverified };
  }

  const list = raw.procedures;
  const ids = new Set<string>();
  const seenPhaseOrder = new Set<string>();

  // 持ち物をファイル全体で見るためのもの（sameAs の解決と、同じものの二重登録の検出）
  const allItemIds = new Set<string>();
  const aliasIds = new Set<string>();
  const idsByLabel = new Map<string, Set<string>>();
  const sameAsRefs: { at: string; id: string; target: string }[] = [];

  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const at = isObject(p) && typeof p.id === "string" ? p.id : `#${i}`;
    if (!isObject(p)) {
      err(at, "root", "オブジェクトではありません");
      continue;
    }
    if (typeof p.id !== "string" || p.id === "") {
      err(at, "id", "id が空です");
    } else if (ids.has(p.id)) {
      err(at, "id", "id が重複しています");
    } else {
      ids.add(p.id);
    }

    for (const field of ["officialName", "displayName", "what", "ifNot", "result"]) {
      if (typeof p[field] !== "string" || p[field] === "") {
        err(at, field, "文字列で入れてください");
      }
    }
    if (typeof p.phase !== "string" || !PHASES.includes(p.phase)) {
      err(at, "phase", `before / moveDay / within14 のどれかです（今: ${String(p.phase)}）`);
    }
    if (typeof p.order !== "number") {
      err(at, "order", "数値で入れてください");
    } else if (typeof p.phase === "string") {
      const key = `${p.phase}:${p.order}`;
      if (seenPhaseOrder.has(key)) {
        warn(at, "order", `同じ phase の中で order ${p.order} が重複しています`);
      }
      seenPhaseOrder.add(key);
    }
    if (typeof p.littleKnown !== "boolean") err(at, "littleKnown", "true / false で入れてください");
    if (p.littleKnown === true && !p.littleKnownReason) {
      warn(at, "littleKnownReason", "隠しクエストなのに理由が空です。画面で理由を出すので入れてください");
    }

    checkDeadline(p, at, err, warn);
    checkChecked(p.where, at, "where", err, unverified);
    checkChecked(p.sayThis, at, "sayThis", err, unverified);

    if (!isObject(p.minutes) || typeof p.minutes.value !== "number") {
      err(at, "minutes", "{ value: 数値, verified: true/false } で入れてください");
    } else if (p.minutes.verified !== true) {
      unverified.push({ procedureId: at, field: "minutes", message: "所要時間が未確認" });
    }

    if (!isObject(p.where) || typeof (p.where as { placeKey?: unknown }).placeKey !== "string") {
      warn(at, "where.placeKey", "同じ場所でまとめる判定に使うので入れてください（例: city-hall）");
    }

    // 持ち物
    const itemIds = new Set<string>();
    if (!Array.isArray(p.bring)) {
      err(at, "bring", "配列ではありません");
    } else {
      for (const b of p.bring) {
        if (!isObject(b) || typeof b.id !== "string" || typeof b.label !== "string") {
          err(at, "bring", "id と label が要ります");
          continue;
        }
        if (itemIds.has(b.id)) warn(at, `bring.${b.id}`, "同じ手続きの中で持ち物 id が重複しています");
        itemIds.add(b.id);
        allItemIds.add(b.id);

        const sameLabel = idsByLabel.get(b.label) ?? new Set<string>();
        sameLabel.add(b.id);
        idsByLabel.set(b.label, sameLabel);

        if (b.sameAs !== undefined && b.sameAs !== null) {
          aliasIds.add(b.id);
          if (typeof b.sameAs !== "string" || b.sameAs === "") {
            err(at, `bring.${b.id}.sameAs`, "同じものとしてまとめたい持ち物の id を入れてください");
          } else if (b.sameAs === b.id) {
            err(at, `bring.${b.id}.sameAs`, "自分自身を指しています");
          } else {
            sameAsRefs.push({ at, id: b.id, target: b.sameAs });
          }
        }

        if (b.verified !== true) {
          unverified.push({ procedureId: at, field: `bring.${b.id}`, message: `${b.label} が未確認` });
        }
        checkCond(b.showIf, at, `bring.${b.id}.showIf`, err);
      }
    }

    // 出し分け条件
    checkCond(p.showIf, at, "showIf", err);
    if (isObject(p.showIf) && p.showIf.always !== true && Object.keys(p.showIf).length === 0) {
      warn(at, "showIf", "空です。誰に出すのか決まっていません");
    }
    if (p.skipIf !== null) {
      if (!isObject(p.skipIf)) {
        err(at, "skipIf", "オブジェクトか null です");
      } else {
        if (typeof p.skipIf.message !== "string" || p.skipIf.message === "") {
          err(at, "skipIf.message", "「あなたは要りません」の理由を入れてください");
        }
        const { message: _m, ...cond } = p.skipIf;
        checkCond(cond, at, "skipIf", err);
      }
    }

    // 手順とその詰まりポイント
    if (!Array.isArray(p.steps)) {
      err(at, "steps", "配列ではありません");
    } else {
      if (p.steps.length === 0) warn(at, "steps", "手順が空です。シミュレーションが作れません");
      for (let s = 0; s < p.steps.length; s++) {
        const step = p.steps[s];
        if (!isObject(step) || typeof step.text !== "string") {
          err(at, `steps[${s}]`, "text が要ります");
          continue;
        }
        if (step.n !== s + 1) {
          err(at, `steps[${s}]`, `n は上から 1,2,3… の順です（今: ${String(step.n)}）`);
        }
        const stuck = step.stuckIf;
        if (stuck !== undefined && stuck !== null) {
          if (!isObject(stuck) || typeof stuck.missing !== "string" || typeof stuck.message !== "string") {
            err(at, `steps[${s}].stuckIf`, "{ missing: 持ち物id, message: 文 } で入れてください");
          } else if (!itemIds.has(stuck.missing)) {
            err(
              at,
              `steps[${s}].stuckIf.missing`,
              `"${stuck.missing}" が bring にありません。持ち物として先に入れてください`,
            );
          }
        }
      }
    }

    if (!Array.isArray(p.sources) || p.sources.length === 0) {
      warn(at, "sources", "出典が空です。発表で聞かれるので入れてください");
    } else {
      for (const s of p.sources) {
        if (isObject(s) && s.verified !== true) {
          unverified.push({
            procedureId: at,
            field: "sources",
            message: `${String(s.name ?? "出典")} が未確認`,
          });
        }
      }
    }
  }

  // 持ち物の sameAs（別名の指す先が実在するか）
  for (const ref of sameAsRefs) {
    if (!allItemIds.has(ref.target)) {
      err(ref.at, `bring.${ref.id}.sameAs`, `"${ref.target}" という持ち物がどの手続きにもありません`);
    } else if (aliasIds.has(ref.target)) {
      err(
        ref.at,
        `bring.${ref.id}.sameAs`,
        `"${ref.target}" にも sameAs が付いています。別名の別名は解決しないので、本来の id を直接指してください`,
      );
    }
  }

  // 同じ名前なのに id が違う持ち物（攻略シートで同じものが2行に見えます）
  for (const [label, sameLabel] of idsByLabel) {
    if (sameLabel.size > 1) {
      warn(
        null,
        "bring",
        `「${label}」が別の id（${[...sameLabel].join(" / ")}）で入っています。同じものなら id を揃えるか sameAs でまとめてください`,
      );
    }
  }

  // requires の整合性（存在するか・循環していないか）
  for (const p of list) {
    if (!isObject(p) || typeof p.id !== "string") continue;
    if (!Array.isArray(p.requires)) {
      err(p.id, "requires", "配列ではありません（無ければ [] ）");
      continue;
    }
    for (const r of p.requires) {
      if (typeof r !== "string" || !ids.has(r)) {
        err(p.id, "requires", `"${String(r)}" という手続きはありません`);
      }
      if (r === p.id) err(p.id, "requires", "自分自身を前提にしています");
    }
    const d = p.deadline;
    if (isObject(d) && d.kind === "afterProcedure") {
      if (typeof d.afterId !== "string" || !ids.has(d.afterId)) {
        err(p.id, "deadline.afterId", `"${String(d.afterId)}" という手続きはありません`);
      } else if (Array.isArray(p.requires) && !p.requires.includes(d.afterId)) {
        warn(
          p.id,
          "requires",
          `期限が ${d.afterId} 起算なのに requires に入っていません。順番が守られません`,
        );
      }
    }
  }
  for (const id of findCycle(list as Procedure[])) {
    err(id, "requires", "requires が循環しています");
  }

  return { errors, warnings, unverified };
}

// ── 中で使う小物 ────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

type Report = (id: string | null, field: string, message: string) => void;

function checkChecked(
  value: unknown,
  at: string,
  field: string,
  err: Report,
  unverified: DataProblem[],
) {
  if (!isObject(value) || typeof value.text !== "string" || value.text === "") {
    err(at, field, "{ text: 文字列, verified: true/false } で入れてください");
    return;
  }
  if (value.verified !== true) {
    unverified.push({
      procedureId: at,
      field,
      message: typeof value.todo === "string" && value.todo ? value.todo : `${field} が未確認`,
    });
  }
}

function checkDeadline(p: Record<string, any>, at: string, err: Report, warn: Report) {
  const d = p.deadline;
  if (!isObject(d) || typeof d.kind !== "string") {
    err(at, "deadline", "kind が要ります");
    return;
  }
  if (typeof d.label !== "string" || d.label === "") {
    err(at, "deadline.label", "画面に出す文言なので入れてください");
  }
  switch (d.kind) {
    case "beforeMove":
    case "afterMove":
      if (typeof d.days !== "number") err(at, "deadline.days", "数値で入れてください");
      break;
    case "afterProcedure":
      if (typeof d.days !== "number") err(at, "deadline.days", "数値で入れてください");
      break;
    case "aroundMove":
    case "anytime":
      break;
    default:
      err(at, "deadline.kind", `知らない kind です: ${d.kind}`);
  }
  if (d.kind === "anytime" && p.littleKnown === true) {
    warn(at, "deadline", "期限なしの隠しクエストは埋もれます。画面で目立たせる必要があります");
  }
}

/** showIf / skipIf / bring.showIf の中身が Profile のキーになっているか */
function checkCond(cond: unknown, at: string, field: string, err: Report) {
  if (cond === undefined || cond === null) return;
  if (!isObject(cond)) {
    err(at, field, "オブジェクトではありません");
    return;
  }
  for (const key of Object.keys(cond)) {
    if (key === "always" || key === "ageAtLeast") continue;
    if (!PROFILE_KEYS.includes(key as ProfileKey)) {
      err(at, field, `"${key}" はキャラメイクの項目にありません（${PROFILE_KEYS.join(" / ")}）`);
    }
  }
  if ("movedOn" in cond && typeof cond.movedOn === "string" && !isDateString(cond.movedOn)) {
    err(at, field, "movedOn は YYYY-MM-DD です");
  }
}

/** requires の循環を見つける。循環に含まれる id を返す */
function findCycle(list: Procedure[]): string[] {
  const byId = new Map<string, string[]>();
  for (const p of list) {
    if (p && typeof p.id === "string") byId.set(p.id, Array.isArray(p.requires) ? p.requires : []);
  }
  const state = new Map<string, "visiting" | "done">();
  const bad = new Set<string>();

  const walk = (id: string, trail: string[]) => {
    const s = state.get(id);
    if (s === "done") return;
    if (s === "visiting") {
      // trail の中で id が出てきた位置から後ろが循環
      const from = trail.indexOf(id);
      for (const x of trail.slice(from === -1 ? 0 : from)) bad.add(x);
      return;
    }
    state.set(id, "visiting");
    for (const r of byId.get(id) ?? []) {
      if (byId.has(r)) walk(r, [...trail, id]);
    }
    state.set(id, "done");
  };

  for (const id of byId.keys()) walk(id, []);
  return [...bad];
}
