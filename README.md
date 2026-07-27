# 暮らしクエスト

引越したあとの行政手続きを、期限別のクエストとして出すWebアプリ。

## いま入っているもの

```
src/lib/quest/     ロジック（画面が無くても動く部分。React 非依存）
src/data/          手続きのデータ（procedures.json）
tests/quest/       ロジックのテスト 61件
test.sh            テスト実行
```

画面（Next.js）はこれから入ります。ロジックの呼び方は [src/lib/quest/README.md](src/lib/quest/README.md) にまとめてあります。

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
