#!/bin/sh
# Собирает dist/cosmere-rpg-mistborn-handbook-ru.zip.
# Внутри архива одна папка с именем, равным id модуля, поэтому при любой
# распаковке получается Data/modules/cosmere-rpg-mistborn-handbook-ru/.
set -e
ID=cosmere-rpg-mistborn-handbook-ru
cd "$(dirname "$0")/.."
T=$(mktemp -d)
mkdir "$T/$ID"
cp -R AGENTS.md README.md docs lang module.json scripts styles translations "$T/$ID/"
mkdir -p dist
rm -f "dist/$ID.zip"
(cd "$T" && zip -qr "$OLDPWD/dist/$ID.zip" "$ID")
rm -rf "$T"
echo "dist/$ID.zip"
