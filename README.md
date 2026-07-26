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

## テスト

```bash
./test.sh      # npm install 不要。Node 24 以上
```

## Next.js を入れるとき

このリポジトリには `README.md` が既にあるので、`create-next-app` を直接ここで実行すると止まります。
別の場所で作ってから中身を移してください。

```bash
npx create-next-app@latest /tmp/app --ts --app --eslint --src-dir --import-alias "@/*"
cp -R /tmp/app/{package.json,next.config.*,tsconfig.json,eslint.config.*,public} .
cp -R /tmp/app/src/app src/app
npm install
```

`tsconfig.json` の `@/*` が `src/*` を指していれば、ロジックは `@/lib/quest` から使えます。

## 担当

| | |
|---|---|
| ロジック・実装 | src/lib/quest 以下 |
| 手続きデータ | src/data/procedures.json（未確認の項目は `verified: false`） |

データの直し方は [src/lib/quest/README.md](src/lib/quest/README.md) の「手続きを調べる人へ」を見てください。
