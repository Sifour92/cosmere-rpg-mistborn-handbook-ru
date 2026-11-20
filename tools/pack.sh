#!/bin/sh
# Собирает ZIP и манифест релиза в dist/.
# Внутри архива одна папка с именем, равным id модуля, поэтому при любой
# распаковке получается Data/modules/cosmere-rpg-mistborn-handbook-ru/.
set -e
cd "$(dirname "$0")/.."
ID=$(node -p 'require("./module.json").id')
ROOT=$PWD
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
mkdir "$T/$ID"
cp -R AGENTS.md README.md docs lang scripts styles translations "$T/$ID/"
node --input-type=module <<'JS' > "$T/$ID/module.json"
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('module.json', 'utf8'));
manifest.download = `${manifest.url}/releases/download/v${manifest.version}/${manifest.id}.zip`;
console.log(JSON.stringify(manifest, null, 2));
JS
(cd "$T" && zip -q -r "$ID.zip" "$ID" -x '*/.DS_Store' '*/._*')
mkdir -p dist
cp "$T/$ID/module.json" "$ROOT/dist/module.json"
cp "$T/$ID.zip" "$ROOT/dist/$ID.zip"
printf '%s\n' "dist/module.json" "dist/$ID.zip"
