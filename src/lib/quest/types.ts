// 引越しクエスト — 型定義
//
// 前半: procedures.json（データ担当が触るファイル）の型
// 後半: 画面に渡す型（ロジックが組み立てて返すもの）
//
// 画面側はこのファイルの型だけ見れば足ります。procedures.json を直接読む必要はありません。
//
// steps / stuckIf は TODO画面では使いませんが、あとからシミュレーションを足すとき
// データを作り直さずに済むよう最初から入れてあります。

// ── データの型 ──────────────────────────────────────────────

/** キャラメイクの答え。全部あとから埋まる前提なので、すべて任意。 */
export type Profile = {
  city?: string;
  /** 引越した（する）日。"2026-07-20" */
  movedOn?: string;
  occupation?: "student" | "worker";
  livingAlone?: boolean;
  vehicle?: "none" | "moped" | "car";
  hasMyNumberCard?: boolean;
  age?: number;
};

export type ProfileKey = keyof Profile;

export type Phase = "before" | "moveDay" | "within14";

export type Deadline =
  | { kind: "beforeMove"; days: number; label: string }
  /** 引越しの前後。days があれば「引越し日から◯日以内」として計算し、無ければ目安あつかい */
  | { kind: "aroundMove"; days?: number; label: string }
  | { kind: "afterMove"; days: number; label: string }
  | { kind: "afterProcedure"; afterId: string; days: number; label: string }
  | { kind: "anytime"; label: string };

/** 未確認の値には verified:false と todo を付ける。画面では「要確認」を出す */
export type Checked<T> = { text: T; verified: boolean; todo?: string };

/**
 * どこでやるか。
 * placeKey が同じものは「同じ場所で続けてやれる」＝1回の外出でまとめられる。
 * 未設定なら text の1文目から推測するが、攻略シートの精度が落ちるので入れてほしい。
 */
export type WhereField = Checked<string> & { placeKey?: string };

export type BringItem = {
  id: string;
  label: string;
  note?: string;
  /**
   * 別の手続きにある、実質同じ持ち物の id。
   * 攻略シートで持ち物をまとめるとき、同じものが2行に見えないようにする。
   * 例: 年金窓口の「マイナンバーカード（または基礎年金番号通知書）」→ sameAs: "mynumber-card"
   */
  sameAs?: string;
  /** 物でないもの（暗証番号など）。忘れやすいので画面で区別する。既定は物あつかい */
  physical?: boolean;
  verified: boolean;
  /** この条件のときだけ必要。無ければ常に必要 */
  showIf?: Partial<Profile>;
};

export type Step = {
  n: number;
  text: string;
  /** その持ち物が無いと、ここで止まる。シミュレーションの失敗分岐に使う */
  stuckIf?: { missing: string; message: string } | null;
};

export type Source = {
  name: string;
  url: string;
  /** "2026-07-26" */
  fetchedAt: string;
  verified: boolean;
};

export type Procedure = {
  id: string;
  phase: Phase;
  order: number;

  /** 役所の言い方。画面には出さない。検索と照合のために持つ */
  officialName: string;
  /** 画面に出す言い方 */
  displayName: string;
  what: string;
  ifNot: string;

  /** 本人が存在を知らない可能性が高い＝隠しクエスト */
  littleKnown: boolean;
  littleKnownReason?: string;

  deadline: Deadline;
  /** 先に終わっていないとできない手続きの id */
  requires: string[];

  where: WhereField;
  sayThis: Checked<string>;
  minutes: { value: number; verified: boolean };
  result: string;

  bring: BringItem[];

  /** 誰に出すか */
  showIf: Partial<Profile> & { always?: true; ageAtLeast?: number };
  /** 誰なら要らないか。消さずに「あなたは要りません」と出す */
  skipIf: (Partial<Profile> & { message: string }) | null;

  steps: Step[];
  sources: Source[];
};

export type ProcedureFile = {
  dataVersion: string;
  targetCity: string;
  procedures: Procedure[];
};

// ── 画面に渡す型 ────────────────────────────────────────────

/**
 * その人に必要かどうか。
 * 方針は「迷ったら出す」。判定できないものは unsure にして出す。
 * 出さなかった間違いは本人が気づけないが、余計に出した間違いは1タップで消せるため。
 */
export type Need = {
  status: "show" | "unsure" | "notNeeded";
  /** notNeeded のとき「あなたは要りません」の理由。unsure のとき何が分からないか */
  message?: string;
};

export type Urgency =
  /** 期限を過ぎている */
  | "overdue"
  /** 今日が期限 */
  | "today"
  /** 3日以内 */
  | "soon"
  /** まだ余裕がある */
  | "later"
  /** 前提の手続きが終わってから数え始める */
  | "waiting"
  /** 期限なし */
  | "anytime"
  /** 引越し日が未入力などで計算できない */
  | "unknown";

export type DeadlineInfo = {
  /** データに書いてある文言。「引越しから14日以内」 */
  label: string;
  /** 計算した期限日。"2026-08-03"。計算できなければ null */
  dueOn: string | null;
  /** 今日から見た残り日数。マイナスは超過 */
  daysLeft: number | null;
  urgency: Urgency;
  /** 目安であって厳密な期限ではない（「引越しの前後」など） */
  soft: boolean;
  note?: string;
};

export type LockInfo = {
  locked: boolean;
  /** 先に終わらせる必要がある手続きの id */
  blockedBy: string[];
  /** 同じ順の表示名。「転入届を出す」 */
  blockedByNames: string[];
  /**
   * 前提だが、その人には出ていないもの（要らない／本人が消した）の id。
   * 画面に無いものを待たせると永久に開かないので、鍵には数えない。
   * 「転入届は要らない判断なので、そのまま進めます」と添えたいとき用。
   */
  ignored: string[];
  /** 同じ順の表示名 */
  ignoredNames: string[];
};

export type BringLine = {
  id: string;
  label: string;
  note?: string;
  /** 物ではないもの（暗証番号など） */
  physical: boolean;
  verified: boolean;
  /** これが必要な手続きの id。持ち物をまとめたときに「何のために持つか」を出す用 */
  neededFor: string[];
};

/** 進捗。LocalStorage に入れるのはこの形だけ */
export type Progress = {
  /** 手続き id → 終わった日 "2026-07-28"。期限が「◯◯の後90日」の計算に使うので日付で持つ */
  doneAt: Record<string, string>;
  /** 本人が「これは要らない」と消したもの */
  dismissed: string[];
};

export type Quest = {
  id: string;
  /** 元データ。画面で自由に使ってよい */
  procedure: Procedure;
  name: string;
  what: string;
  ifNot: string;
  phase: Phase;
  order: number;

  need: Need;
  /** 隠しクエスト（本人が存在を知らない可能性が高い） */
  hidden: boolean;
  hiddenReason?: string;

  deadline: DeadlineInfo;
  lock: LockInfo;
  done: boolean;
  doneOn: string | null;
  /** 本人が「要らない」と消した */
  dismissed: boolean;

  where: string;
  sayThis: string;
  minutes: number;
  result: string;
  bring: BringLine[];

  /** 未確認の項目名。["どこで", "何て言う"]。画面で「要確認」を出す用 */
  unverified: string[];
};

export type PhaseGroup = {
  phase: Phase;
  label: string;
  quests: Quest[];
};

export type RouteStop = {
  placeKey: string;
  /** 場所の表示名 */
  place: string;
  /** 家でできる（Webか電話）。出かける必要がない */
  atHome: boolean;
  /** この場所でやる手続き。この順に回る */
  quests: Quest[];
  /** 合計の目安時間（分） */
  minutes: number;
  /** この外出で持っていくもの（手続きをまたいで重複を消したもの） */
  bring: BringLine[];
  /** 窓口で言うこと。手続きごとに1行 */
  say: string[];
};

export type RouteSheet = {
  stops: RouteStop[];
  /** 出かける回数（家でできるものを除いた場所の数）。「役所は1回で終わる」を出す用 */
  trips: number;
  minutes: number;
  /** 全部の外出で持っていくものをまとめたもの */
  bring: BringLine[];
  /** 「暗証番号は物じゃないので忘れやすい」など、画面に出す注意 */
  warnings: string[];
};

export type BoardStats = {
  total: number;
  done: number;
  remaining: number;
  hidden: number;
  hiddenRemaining: number;
  overdue: number;
  unsure: number;
};

/** クエストログ画面がこれ1つで描ける、という単位 */
export type Board = {
  today: string;
  targetCity: string;
  dataVersion: string;
  profile: Profile;
  /** キャラメイクが埋まっていない項目 */
  missingAnswers: ProfileKey[];
  /** 出すクエスト（show と unsure）。phase → order の順 */
  quests: Quest[];
  /** 「あなたは要りません」で見せるもの */
  notNeeded: Quest[];
  phases: PhaseGroup[];
  stats: BoardStats;
  /** 次にやるべき1件。無ければ null */
  next: Quest | null;
  route: RouteSheet;
};

// ── シミュレーション ────────────────────────────────────────

export type SimStatus =
  /** 次に進める */
  | "running"
  /** 持ち物を持っているか、本人に聞いている */
  | "asking"
  /** 持っていなかった。ここで出直し */
  | "stuck"
  /** 最後まで進んだ */
  | "cleared";

export type SimQuestion = {
  /** 聞いている持ち物の id */
  itemId: string;
  /** 「住民基本台帳用暗証番号（数字4桁）」 */
  label: string;
  note?: string;
  /** 何歩目で聞かれるか */
  stepN: number;
  /** 持っていなかったときに出す文 */
  ifMissing: string;
};

export type SimState = {
  procedureId: string;
  /** いま何歩目にいるか。0 は開始前 */
  stepN: number;
  status: SimStatus;
  /** 本人の答え。itemId → 持っている/いない */
  answers: Record<string, boolean>;
  question: SimQuestion | null;
  /** 止まったときの説明 */
  stuckAt: { stepN: number; itemId: string; message: string } | null;
  /** 出直した回数 */
  attempts: number;
  /** 通ってきた歩。画面の履歴表示用 */
  log: { stepN: number; text: string }[];
};
