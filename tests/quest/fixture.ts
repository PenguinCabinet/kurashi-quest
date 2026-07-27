// テスト共通。本物の procedures.json を読んで使う。
// 作り物のデータでテストしても、本番のデータが壊れていたら意味がないので、
// できるだけ本物で確かめる。

import { readFileSync } from "node:fs";
import { loadProcedures } from "../../src/lib/quest/data.ts";
import type { ProcedureFile, Profile } from "../../src/lib/quest/types.ts";

export function realData(): ProcedureFile {
  const text = readFileSync(new URL("../../src/data/procedures.json", import.meta.url), "utf8");
  return loadProcedures(JSON.parse(text));
}

/** 20歳の学生。マイナンバーカードあり。2026-07-20 に引越した */
export const student: Profile = {
  movedOn: "2026-07-20",
  occupation: "student",
  livingAlone: true,
  vehicle: "none",
  hasMyNumberCard: true,
  age: 20,
};

/** 社会人。マイナンバーカードなし */
export const worker: Profile = {
  movedOn: "2026-07-20",
  occupation: "worker",
  livingAlone: true,
  vehicle: "car",
  hasMyNumberCard: false,
  age: 25,
};

/** 引越し日だけ答えた状態（キャラメイクの途中） */
export const halfway: Profile = { movedOn: "2026-07-20" };

export const TODAY = "2026-07-28";
