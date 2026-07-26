// クエスト生成。出し分け・期限・順番はここ。
// today は必ず引数で受ける（中で new Date() を呼ぶとテストが日によって落ちるため）。

import type {
  BoardStats,
  DeadlineInfo,
  LockInfo,
  Need,
  Phase,
  PhaseGroup,
  Procedure,
  ProcedureFile,
  Profile,
  Progress,
  Quest,
  Urgency,
} from "./types";
import { addDays, diffDays } from "./dates";
import { labelOf, matchCond, unknownKeys } from "./profile";
import { bringFor } from "./bring";

export const PHASE_LABELS: Record<Phase, string> = {
  before: "引越し前",
  moveDay: "引越し当日",
  within14: "引越してから14日以内",
};

const PHASE_RANK: Record<Phase, number> = { before: 0, moveDay: 1, within14: 2 };
const URGENCY_RANK: Record<Urgency, number> = {
  overdue: 0,
  today: 1,
  soon: 2,
  later: 3,
  waiting: 4,
  anytime: 5,
  unknown: 6,
};

/** その人に必要か。迷ったら出す（答えていない項目があれば unsure にして消さない） */
export function decideNeed(p: Procedure, me: Profile): Need {
  if (p.skipIf) {
    const { message, ...cond } = p.skipIf;
    if (matchCond(cond, me) === "yes") return { status: "notNeeded", message };
  }

  const { always, ageAtLeast, ...cond } = p.showIf;

  if (ageAtLeast !== undefined) {
    if (me.age === undefined) {
      return {
        status: "unsure",
        message: `${ageAtLeast}歳以上の人向けです。年齢を聞いていないので、いちおう出しています`,
      };
    }
    if (me.age < ageAtLeast) {
      return { status: "notNeeded", message: `${ageAtLeast}歳以上の人向けです` };
    }
  }

  if (always) return { status: "show" };
  if (Object.keys(cond).length === 0) return { status: "show" };

  switch (matchCond(cond, me)) {
    case "yes":
      return { status: "show" };
    case "no":
      return { status: "notNeeded", message: `${describeCond(cond)}向けです` };
    default:
      return {
        status: "unsure",
        message: `${unknownKeys(cond, me).map(labelOf).join("・")}が分からないので、いちおう出しています`,
      };
  }
}

/** 条件を日本語にする。「学生の人」「マイナンバーカードを持っている人」 */
export function describeCond(cond: Partial<Profile>): string {
  const parts: string[] = [];
  if (cond.occupation === "student") parts.push("学生の人");
  if (cond.occupation === "worker") parts.push("働いている人");
  if (cond.livingAlone === true) parts.push("1人暮らしの人");
  if (cond.livingAlone === false) parts.push("家族と住む人");
  if (cond.hasMyNumberCard === true) parts.push("マイナンバーカードを持っている人");
  if (cond.hasMyNumberCard === false) parts.push("マイナンバーカードを持っていない人");
  if (cond.vehicle === "car") parts.push("車を持っている人");
  if (cond.vehicle === "moped") parts.push("原付・バイクを持っている人");
  if (cond.vehicle === "none") parts.push("乗り物がない人");
  if (cond.city) parts.push(`${cond.city}の人`);
  return parts.length > 0 ? parts.join("で") : "一部の人";
}

/** 期限の文言を、実際の日付と残り日数にする */
export function resolveDeadline(
  p: Procedure,
  me: Profile,
  progress: Progress,
  today: string,
  byId: Map<string, Procedure>,
): DeadlineInfo {
  const d = p.deadline;
  const base = (dueOn: string | null, soft: boolean, note?: string): DeadlineInfo => {
    const daysLeft = dueOn ? diffDays(today, dueOn) : null;
    // 目安の期限は過ぎても overdue にしない。ただし残り日数はマイナスになるので note で補う
    const passed =
      soft && daysLeft !== null && daysLeft < 0
        ? "目安の日を過ぎています。厳密な期限ではありませんが、早めに出してください"
        : undefined;
    return {
      label: d.label,
      dueOn,
      daysLeft,
      urgency: urgencyOf(daysLeft, soft),
      soft,
      note: passed ?? note,
    };
  };

  switch (d.kind) {
    case "beforeMove": {
      if (!me.movedOn) return unknownDeadline(d.label, "引越す日を入れると、期限が出ます");
      return base(addDays(me.movedOn, -d.days), false);
    }
    case "aroundMove": {
      if (!me.movedOn) return unknownDeadline(d.label, "引越した日を入れると、期限が出ます");
      // days があれば「引越し日から◯日以内」。無ければ引越し日を目安にする
      if (d.days !== undefined) return base(addDays(me.movedOn, d.days), false);
      return base(me.movedOn, true, "厳密な期限ではありません。早いほどよい手続きです");
    }
    case "afterMove": {
      if (!me.movedOn) return unknownDeadline(d.label, "引越した日を入れると、期限が出ます");
      return base(addDays(me.movedOn, d.days), false);
    }
    case "afterProcedure": {
      const doneOn = progress.doneAt[d.afterId];
      const afterName = byId.get(d.afterId)?.displayName ?? d.afterId;
      if (!doneOn) {
        return {
          label: d.label,
          dueOn: null,
          daysLeft: null,
          urgency: "waiting",
          soft: false,
          note: `「${afterName}」が終わってから${d.days}日以内。まだ数え始めていません`,
        };
      }
      return base(addDays(doneOn, d.days), false, `「${afterName}」を終えた日から${d.days}日以内`);
    }
    case "anytime":
      return { label: d.label, dueOn: null, daysLeft: null, urgency: "anytime", soft: true };
  }
}

function unknownDeadline(label: string, note: string): DeadlineInfo {
  return { label, dueOn: null, daysLeft: null, urgency: "unknown", soft: false, note };
}

function urgencyOf(daysLeft: number | null, soft: boolean): Urgency {
  if (daysLeft === null) return "unknown";
  if (daysLeft < 0) return soft ? "soon" : "overdue"; // 目安の期限で「期限切れ」とは言わない
  if (daysLeft === 0) return "today";
  if (daysLeft <= 3) return "soon";
  return "later";
}

/**
 * 前提が終わっていなければ鍵をかける。
 * ただし画面に出ていない前提（要らない・本人が消した）は待たない。永久に開かなくなるため。
 */
export function lockOf(
  p: Procedure,
  me: Profile,
  progress: Progress,
  byId: Map<string, Procedure>,
): LockInfo {
  const blockedBy: string[] = [];
  const ignored: string[] = [];

  for (const id of p.requires) {
    if (progress.doneAt[id]) continue; // 終わっている
    const prereq = byId.get(id);
    const gone =
      progress.dismissed.includes(id) ||
      (prereq !== undefined && decideNeed(prereq, me).status === "notNeeded");
    (gone ? ignored : blockedBy).push(id);
  }

  const nameOf = (id: string) => byId.get(id)?.displayName ?? id;
  return {
    locked: blockedBy.length > 0,
    blockedBy,
    blockedByNames: blockedBy.map(nameOf),
    ignored,
    ignoredNames: ignored.map(nameOf),
  };
}

export function toQuest(
  p: Procedure,
  me: Profile,
  progress: Progress,
  today: string,
  byId: Map<string, Procedure>,
): Quest {
  const doneOn = progress.doneAt[p.id] ?? null;
  return {
    id: p.id,
    procedure: p,
    name: p.displayName,
    what: p.what,
    ifNot: p.ifNot,
    phase: p.phase,
    order: p.order,

    need: decideNeed(p, me),
    hidden: p.littleKnown === true,
    hiddenReason: p.littleKnownReason,

    deadline: resolveDeadline(p, me, progress, today, byId),
    lock: lockOf(p, me, progress, byId),
    done: doneOn !== null,
    doneOn,
    dismissed: progress.dismissed.includes(p.id),

    where: p.where.text,
    sayThis: p.sayThis.text,
    minutes: p.minutes.value,
    result: p.result,
    bring: bringFor(p, me),

    unverified: unverifiedFields(p),
  };
}

/** 全部の手続きをクエストにして、phase → order の順に並べる */
export function buildQuests(
  data: ProcedureFile,
  me: Profile,
  progress: Progress,
  today: string,
): Quest[] {
  const byId = new Map(data.procedures.map((p) => [p.id, p]));
  return sortQuests(data.procedures.map((p) => toQuest(p, me, progress, today, byId)));
}

export function sortQuests(quests: Quest[]): Quest[] {
  return [...quests].sort((a, b) => {
    const phase = PHASE_RANK[a.phase] - PHASE_RANK[b.phase];
    if (phase !== 0) return phase;
    if (a.order !== b.order) return a.order - b.order;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** 画面に出すもの（必要／判定できない、かつ本人が消していないもの） */
export function visibleQuests(quests: Quest[]): Quest[] {
  return quests.filter((q) => q.need.status !== "notNeeded" && !q.dismissed);
}

/** 「あなたは要りません」で見せるもの。消すのではなく、消えたことが分かるように出す */
export function notNeededQuests(quests: Quest[]): Quest[] {
  return quests.filter((q) => q.need.status === "notNeeded" || q.dismissed);
}

export function groupByPhase(quests: Quest[]): PhaseGroup[] {
  const order: Phase[] = ["before", "moveDay", "within14"];
  return order
    .map((phase) => ({
      phase,
      label: PHASE_LABELS[phase],
      quests: quests.filter((q) => q.phase === phase),
    }))
    .filter((g) => g.quests.length > 0);
}

/**
 * 次にやるべき1件。
 * 鍵がかかっていないもののうち、いちばん急ぐもの。
 */
export function pickNext(quests: Quest[]): Quest | null {
  const candidates = visibleQuests(quests).filter((q) => !q.done && !q.lock.locked);
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const u = URGENCY_RANK[a.deadline.urgency] - URGENCY_RANK[b.deadline.urgency];
    if (u !== 0) return u;
    if (a.deadline.dueOn && b.deadline.dueOn && a.deadline.dueOn !== b.deadline.dueOn) {
      return a.deadline.dueOn < b.deadline.dueOn ? -1 : 1;
    }
    const phase = PHASE_RANK[a.phase] - PHASE_RANK[b.phase];
    if (phase !== 0) return phase;
    return a.order - b.order;
  })[0];
}

export function statsOf(quests: Quest[]): BoardStats {
  const shown = visibleQuests(quests);
  const done = shown.filter((q) => q.done);
  const hidden = shown.filter((q) => q.hidden);
  return {
    total: shown.length,
    done: done.length,
    remaining: shown.length - done.length,
    hidden: hidden.length,
    hiddenRemaining: hidden.filter((q) => !q.done).length,
    overdue: shown.filter((q) => !q.done && q.deadline.urgency === "overdue").length,
    unsure: shown.filter((q) => q.need.status === "unsure").length,
  };
}

/** 未確認の項目名。画面で「要確認」を出す用 */
function unverifiedFields(p: Procedure): string[] {
  const out: string[] = [];
  if (!p.where.verified) out.push("どこで");
  if (!p.sayThis.verified) out.push("何て言う");
  if (!p.minutes.verified) out.push("かかる時間");
  if (p.bring.some((b) => b.verified !== true)) out.push("持ち物");
  if (!p.sources.some((s) => s.verified === true)) out.push("出典");
  return out;
}
