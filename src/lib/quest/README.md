# 引越しクエスト — ロジック層

画面が無くても動く部分を全部ここに入れてあります。React も Next.js も import していないので、
画面側は関数を呼ぶだけです。**期限の計算・順番・持ち物・出し分けを画面側で書く必要はありません。**

```
src/lib/quest/         ロジック（このフォルダ）
src/data/procedures.json   手続きのデータ（手続きを調べる人が触るファイル）
tests/quest/           テスト
npm run test:quest         テスト実行
```

import は `@/lib/quest` から。中のファイルを直接 import しなくて大丈夫です
（`tsconfig.json` の `@/*` が `src/*` を指している前提。create-next-app の既定どおりです）。

## いちばん短い使い方

```tsx
import raw from "@/data/procedures.json";
import { loadProcedures, buildBoard, toggle, emptyProgress } from "@/lib/quest";

const data = loadProcedures(raw);              // 1回だけでいい
const board = buildBoard(data, profile, progress, "2026-07-28");

board.phases.map((group) => (
  <section key={group.phase}>
    <h2>{group.label}</h2>                     {/* 引越し前 / 14日以内 */}
    {group.quests.map((q) => (
      <label key={q.id}>
        <input
          type="checkbox"
          checked={q.done}
          disabled={false}
          onChange={() => setProgress(toggle(progress, q.id, today))}
        />
        {q.name}
        {q.hidden && <span>隠しクエスト</span>}
        {q.lock.locked && <span>先に「{q.lock.blockedByNames[0]}」</span>}
        <small>{q.deadline.label}（{q.deadline.dueOn} / あと{q.deadline.daysLeft}日）</small>
      </label>
    ))}
  </section>
));
```

`board` に入っているもの:

| 中身 | 使う画面 |
|---|---|
| `board.phases` | クエストログ（期限別のまとまり） |
| `board.quests` | 出すクエスト全部（`phases` と同じものが平らに入っている） |
| `board.notNeeded` | 「あなたは要りません」の一覧。消さずに理由付きで見せる |
| `board.stats` | 6個中4個が隠しクエスト、残り5件、期限切れ1件 など |
| `board.next` | 次にやるべき1件（トップに大きく出す用） |
| `board.route` | 役所攻略シート |
| `board.missingAnswers` | キャラメイクの残りの質問 |

## 画面5枚と、そこで呼ぶもの（早見表）

画面を作るときは、この表の右側だけ見れば足ります。**期限の計算・順番・持ち物のまとめ・出し分けは、全部この中で終わっています。**

| # | 画面 | 呼ぶもの |
|---|---|---|
| ① | キャラメイク | `QUESTIONS` / `answer(profile, key, value)` / `missingAnswers` / `isComplete` / `labelOf` |
| ② | クエストログ | `buildBoard(...)` の `phases` `next` `stats` `notNeeded` / `toggle` / `dismiss` / `restore` / `hiddenLine` / `formatDaysLeft` |
| ③ | やり方カード | `quest`（1件）の `where` `bring` `sayThis` `minutes` `result` `deadline` `lock` `unverified` `procedure.steps` `procedure.sources` / `stuckPoints` |
| ④ | 役所攻略シート | `board.route` の `stops` `trips` `minutes` `bring` `warnings` / `routeLine` |
| ⑤ | 窓口の練習 | `startSimulation` / `advance` / `answerItem` / `restart` / `resetSimulation` / `ratio` |
| ⑥ | 窓口の会話ゲーム | `startCounter` / `say` / `show` / `comeAgain` / `questionsOf` |
| ⑦ | 役所の言葉に意味を出す | `buildGlossary` / `markTerms` / `lookup` |

②③④は `buildBoard` を1回呼べば全部そろいます。③は `board.quests.find((q) => q.id === id)` で1件取り出すだけです。

表に無いけれど、要るときに使えるものです。

| やりたいこと | 呼ぶもの |
|---|---|
| 攻略シートで、終わったものも残す | `buildRoute(board.quests, profile, { includeDone: true })` |
| その人には要らない持ち物を出す | `notNeededBring(procedures, profile)` |
| 持ち物のチェック（そろえた／まだ） | `toggleBrought` / `isBrought` / `broughtCount` / `clearBrought` |
| 「このままだとどこで止まるか」を先に出す | `predictStuck(procedure, answers)` / `stuckPoints(procedure)` |
| データから消えた手続きの進捗を捨てる | `pruneProgress(progress, 生きているid)` |
| 鍵つきにチェックを付けるときの確認文 | `confirmBeforeComplete(quest)` |
| 日付の計算・表示 | `addDays` / `diffDays` / `formatJa` / `formatDaysLeft` / `isDateString` |
| データの残作業を一覧にする | `validateProcedures(raw).unverified` |

全部の関数は `src/lib/quest/index.ts` にまとめてあります。

画面が持つ状態は **`profile`（キャラメイクの答え）と `progress`（進捗）の2つだけ**です。どちらも新しい値が返る形なので、`useState` にそのまま入ります。

## 画面ごとの呼び方

### キャラメイク

```tsx
import { QUESTIONS, answer, isComplete } from "@/lib/quest";

QUESTIONS.map((q) => q.kind === "choice"
  ? q.options.map((o) => <button onClick={() => setProfile(answer(profile, q.key, o.value))}>{o.label}</button>)
  : <input type="date" onChange={(e) => setProfile(answer(profile, q.key, e.target.value))} />);
```

質問の増減はこのファイル（`src/profile.ts`）だけで済みます。画面は触らなくて大丈夫です。
`options[].art` にキャラ画像用の名前が入っているので、デザインが上がったら差し替えてください。

### やり方カード

`quest.procedure.steps` と `quest.bring` をそのまま出すだけです。
`quest.unverified` に `["どこで", "何て言う"]` のような未確認の項目名が入っているので、
そこは「要確認」と出してください（発表で聞かれたとき、嘘をつかない作りだと説明できます）。

### 役所攻略シート

```tsx
board.route.stops.map((stop) => (
  <div key={stop.placeKey}>
    <h3>{stop.place}（{stop.minutes}分）</h3>       {/* 市役所 / 郵便局 / 家（Webか電話） */}
    <ol>{stop.quests.map((q) => <li>{q.name}「{q.sayThis}」</li>)}</ol>
    <ul>{stop.bring.map((b) => <li>{b.label}{!b.physical && "（物ではありません）"}</li>)}</ul>
  </div>
));
board.route.warnings.map((w) => <p>{w}</p>);
```

- 同じ場所（`placeKey`）の手続きは1か所にまとまり、**前提のある順**に並んでいます（転入届 → カードの住所変更 → 年金）
- 持ち物は手続きをまたいで1行にまとめてあり、`neededFor` に何のために持つかが入っています
- 家でできるものは最後、`route.trips` が出かける回数です

### シミュレーション（練習）

```tsx
let sim = startSimulation(quest.procedure);
sim = advance(sim, p);                                   // 「次へ」
if (sim.status === "asking")  /* 「{sim.question.label} 持ってますか？」を出す */
  sim = answerItem(sim, p, sim.question.itemId, true);
if (sim.status === "stuck")   /* 「{sim.stuckAt.message}」＋出直しボタン */
  sim = restart(sim);
```

`status` は `running` / `asking` / `stuck` / `cleared` の4つだけです。
使うデータは攻略シートと同じ（`steps` と `bring`）なので、新しいデータは要りません。

### 保存

```tsx
useEffect(() => {                       // サーバ側では localStorage が無いので useEffect の中で
  const s = browserStorage();
  setProfile(loadProfile(s));
  setProgress(loadProgress(s));
}, []);
```

`browserStorage()` はサーバ側や Safari のプライベートモードでは `null` を返します。
`null` を渡しても全部の関数が動くので、分岐は要りません（保存されないだけ）。

## 窓口の会話ゲーム

職員とのやり取りを選択肢で進めます。**選択肢は他の手続きの「何て言う」から自動で作る**ので、
データを足す必要はありません。

```tsx
import { startCounter, say, show, comeAgain } from "@/lib/quest";

let s = startCounter(target, data.procedures, profile);

s.clerk     // 「本日はどのようなご用件ですか？」
s.choices   // [{ text: "転入届を出したいです", correct: true }, ...]
s.log       // 会話の履歴。[{ who: "clerk" | "me", text }] をそのまま並べられる
s.status    // purpose / item / turnedAway / cleared

s = say(s, target, i, profile);              // 用件の選択肢を選ぶ
s = show(s, target, true, profile);          // 「あります」/「持っていません」
s = comeAgain(s, target, others, profile);   // 出直す（回数は残る）
```

| status | 画面 |
|---|---|
| `purpose` | `s.choices` をボタンで並べる。間違えても終わらず、言い直しになる |
| `item` | `s.asking.label` を「◯◯はお持ちですか？」と聞かれている。はい／いいえ |
| `turnedAway` | `s.turnedAwayReason` を出して、出直しボタン |
| `cleared` | `s.clerk` に完了の言葉が入る |

聞かれる持ち物は `questionsOf(target, profile)` で先に取れます（その人に必要なものだけ）。

## 役所の言葉に意味を出す

`officialName`（役所の言い方）と `displayName` / `what` が対になっているので、用語集は自動で作れます。

```tsx
import { buildGlossary, markTerms } from "@/lib/quest";

const glossary = buildGlossary(data);   // 1回だけでいい

markTerms(s.clerk, glossary).map((part) =>
  typeof part === "string"
    ? part
    : <button title={part.term.plain}>{part.term.word}</button>
);
```

`markTerms` は文を「ふつうの文字」と「用語」に分けて返します。つなげると元の文に戻るので、
用語のところだけボタンにすれば済みます。

```
個人番号カードの券面記載事項変更 → マイナンバーカードの住所を書き換える
住民基本台帳用暗証番号（数字4桁） → カードを作ったときに決めた番号。物ではないので忘れがち
```

## 持ち物の準備（展望）

取得コスト方式の判定も入れてあります（発表で「今後やりたいこと」として使う想定）。

```tsx
const candidates = packingCandidates(target, data.procedures, profile);
const verdict = judgePacking(candidates, picked);   // picked は選んだ持ち物の id
verdictLine(verdict);   // 「受付できました。ただし3日、余分にかかっています」
```

家にあるものは何個入れても減点なし、取りに行った書類だけコストがかかります。

## 決めごと（ここだけ守ってもらえれば壊れません）

1. **今日の日付は引数で渡す。** ロジックの中で `new Date()` を呼んでいません。サーバとブラウザで結果が変わって画面がちらつくのと、テストが日によって落ちるのを避けるためです。`const today = new Date().toISOString().slice(0, 10)` を画面側で1回作ってください。`"YYYY-MM-DD"` 以外を渡すと `buildBoard` が例外を投げます（黙って全部の期限が「不明」になると、原因が分からなくなるため）。
2. **値は書き換えず、新しい値が返る。** `toggle` などは新しい `progress` を返すので、`setProgress(toggle(...))` でそのまま動きます。
3. **迷ったら出す。** 答えていない項目があるクエストは消さずに `need.status === "unsure"` で出ます。理由が `need.message` に入っているので、小さく添えてください。消したい人は `dismiss()` で消せます。
4. **要らないものも消えない。** `board.notNeeded` に理由付きで残ります（「マイナンバーカードを持っていないので要りません」）。存在ごと消すと、本人が判断を間違ったときに気づけません。
5. **データが壊れていたら起動時に落ちる。** `loadProcedures` が直すべき箇所を全部並べて例外を投げます。画面が黙って空になるより、開発中に落ちた方が早く直せます。
6. **画面に出ていない前提は待たない。** 前提の手続きが「あなたは要りません」だったり、本人が消した場合、鍵はかかりません（`lock.locked` は false のまま、`lock.ignoredNames` にその名前が入ります）。画面に出ていないものを待たせると、そのクエストが永久に開けなくなるためです。「『転入届』は要らない判断なので、そのまま進めます」と添えたいときは `ignoredNames` を使ってください。

## 手続きを調べる人へ

- `verified: false` の項目は画面に「要確認」と出ます。確認できたら `true` にしてください。残りは `validateProcedures(raw).unverified` で一覧になります（いま21件）
- **未確認のままでも動きます。**画面に「要確認」と出るだけなので、埋まる前でも作業は止まりません
- `where.placeKey` は「同じ場所でまとめる」判定に使います（`city-hall` / `prev-city-hall` / `post-office` / `online`）。無いと攻略シートの精度が落ちます
- `steps` の `stuckIf.missing` は、その手続きの `bring` にある id しか書けません（テストで落ちます）
- **別の手続きに出てくる同じ持ち物は、id を揃えてください。** 揃えられない（言い方を変えたい）場合は `sameAs` にまとめ先の id を書くと、攻略シートで1行になります。同じ名前なのに id が違うと警告が出ます

```json
{ "id": "pension-number", "label": "マイナンバーカード（または基礎年金番号通知書）",
  "sameAs": "mynumber-card", "note": "年金の窓口では、基礎年金番号通知書でも代わりになります" }
```
- 手続きを増やすときは `steps` と `stuckIf` まで入れてください。あとから足すと全件やり直しになります

## テスト

```bash
npm install          # 初回だけ
npm run test:quest   # 161件（Node 24 以上）
```

型チェックは Next.js プロジェクトに入れたあと `npx tsc --noEmit` で通ります（strict で確認済み）。

## クエストログ以外も入っている理由

画面を作る順番はクエストログからで変わりません。ただしロジックは、その先の分も一緒に入れてあります。

- **期限を実際の日付にするのに、引越し日が要る。** 無いと「引越しから14日以内」という文言しか出せず、残り日数も期限切れの判定も出せません
- **全員に同じ一覧を出すと、社会人に学生納付特例が出ます。** 誰に出すかの判定は、クエストログの正しさそのものです
- **手続きデータに `"skipIf": { "occupation": "worker" }` のような条件を書く時点で、何を聞くかが決まっている必要があります。** 決めた内容をそのまま書いたのが `profile.ts` の質問一覧（47行）です

**このリポジトリには画面のコードを入れていません**（`.tsx` も `.css` もありません）。動きの確認は、手元の簡易ページでロジックを呼んで見ています。持ち物・攻略シート・窓口の練習も、あとで画面を作るときに関数を呼ぶだけで済むようにしてあります。

## まだ決まっていないこと

- **使える制度**（家賃補助・無料健診）はまだデータにありません。手続きとは別の型になるので、やるなら追加で作ります
- **年齢を聞くか**。いまは聞いていないので、20歳以上向けの年金の手続きが「判定できません」付きで全員に出ます。1問足せば消えます
