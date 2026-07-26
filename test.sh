#!/usr/bin/env bash
# テスト。npm install も tsc も要りません（Node 24 が .ts をそのまま動かせるため）。
#
#   ./test.sh
#
# やっていること:
#   src と tests を一時フォルダに写して、相対 import に .ts を足してから node --test を回します。
#   Node は import 先の拡張子を省略できませんが、Next.js は省略した形を求めるので、
#   本体は Next.js に合わせて書き、テストのときだけ写して直しています。
set -euo pipefail

root="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/src"
cp -R "$root/src/lib" "$tmp/src/lib"
cp -R "$root/src/data" "$tmp/src/data"
cp -R "$root/tests" "$tmp/tests"

# from "./x" / from "../x" → from "./x.ts" / from "../x.ts"
find "$tmp/src/lib" "$tmp/tests" -name '*.ts' -print0 |
  xargs -0 sed -i '' -E 's#(from ")(\.\.?/[^"]+)(")#\1\2.ts\3#g'

node --test "$tmp"/tests/quest/*.test.ts
