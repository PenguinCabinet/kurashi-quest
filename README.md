# 暮らしクエスト

引越したあとの行政手続きを、期限別のクエストとして出すWebアプリ。

## いま入っているもの

```
src/lib/quest/     ロジック（画面が無くても動く部分。React 非依存）
src/data/          手続きのデータ（procedures.json）
tests/quest/       ロジックのテスト 161件
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
