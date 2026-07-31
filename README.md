> [!IMPORTANT]
> 本作品は、[技育CAMP2026 ハッカソン Vol.4](https://talent.supporterz.jp/events/b96e07e6-6e17-4c2b-89c5-36e162b7ea20/)で**チーム開発された**プロダクトです           
> 本作品は、東急株式会社の「暮らしクエスト」とは**関係ありません**

# 暮らしクエスト

**引越しの行政手続きを、窓口で出直さないためのゲーム。**

6つの質問に答えると、あなたに要る手続きだけが出ます。
持ち物をそろえずに窓口へ行くと、その場で断られて出直しになります。

```
さわる    https://kurashi-quest.vercel.app
```

引越しで人が困るのは、**手続きの存在を知らないこと**と、**窓口で出直しになること**の2つです。
いま入っている8件のうち6件は、知らなければ調べようもないものです。

| | |
|---|---|
| 対象自治体 | 渋谷区（窓口の階・課まで公式サイトで確認） |
| 手続き | 8件 |
| 確かめていない項目 | 22件（画面に「未確認」と出しています） |
| テスト | 164件 |

- [しくみ.md](docs/しくみ.md) — 抽出 → 並べ替え → 集約 の中身
- [デモの撮り方.md](docs/デモの撮り方.md) — 45秒の台本

---

## いま入っているもの

```
src/lib/quest/     ロジック（画面が無くても動く部分。React 非依存）
src/data/          手続きのデータ（procedures.json）
tests/quest/       ロジックのテスト 164件
public/game/       確認用の画面（素の HTML/CSS/JS。本番のデザインではありません）
```

ロジックの呼び方は [src/lib/quest/README.md](src/lib/quest/README.md) にまとめてあります。

## 確認用の画面

ロジックが動くことを目で見るための画面です。`npm run dev` して開きます。

```
/game              タイトルから窓口まで
/game/phone.html   パソコンから、スマホでの見え方を確認する
```

中身は [public/game/README.md](public/game/README.md) を見てください。

`public/game/quest/` は `src/lib/quest/` から自動で作られます（`npm run build` の前に走ります）。
手で直さないでください。

## 初期設定
```bash
npm install
```

## テスト

```bash
npm run test:quest     # Node 24 以上
```

## 担当

| | |
|---|---|
| ロジック・実装 | src/lib/quest 以下 |
| 手続きデータ | src/data/procedures.json（未確認の項目は `verified: false`） |

データの直し方は [src/lib/quest/README.md](src/lib/quest/README.md) の「手続きを調べる人へ」を見てください。
