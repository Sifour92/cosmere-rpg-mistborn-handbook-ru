# Разработка, проверка и выпуск

Для проверки нужен Node.js 20 или новее с npm. Команды можно запускать сразу
после клонирования проекта.

## Проверка и сборка

Из корня модуля запустите:

```bash
npm run check
npm run pack
```

`npm run check` проверяет JSON, согласованность версии, объявленные зависимости,
отсутствие собственных компендиумов, наличие подключённых файлов и синтаксис
скриптов. Сборка создаёт `dist/module.json` и
`dist/cosmere-rpg-mistborn-handbook-ru.zip`.

Для проверки в игре распакуйте ZIP в `Data/modules/` тестовой установки,
перезапустите Foundry и откройте тестовый мир. [Сценарии проверки в Foundry](foundry-check.md)

## Снимок оригинала

Чтобы получить читаемый снимок оригинала 1.0.1, укажите каталог `app`
установленного Foundry. Пример для macOS:

```bash
npm run extract -- '/Applications/Foundry Virtual Tabletop.app/Contents/Resources/app'
```

Вторым аргументом можно передать путь к оригиналу. По умолчанию используется
соседняя папка `cosmere-rpg-mistborn-handbook`. Команда читает копии LevelDB
через библиотеку установленного Foundry и сохраняет снимок в
`.local/source/snapshot.json`. В снимке есть контрольные суммы оригинальных файлов.

## Проверка через Babele

После извлечения снимка запустите проверку на Babele 2.9.1. Пример для macOS:

```bash
npm run check:overlay -- \
  '/Applications/Foundry Virtual Tabletop.app/Contents/Resources/app' \
  "$HOME/Library/Application Support/FoundryVTT/Data/modules/babele"
```

Проверка выполняет `scripts/register.mjs`, обнаруживает файлы перевода
через движок установленной Babele и применяет их к исходной коллекции.
Проверяются русский и английский языки, отсутствие регистрации перевода,
сохранность исходных данных. Это проверка в Node.js с имитацией файловых
запросов Foundry. Интерфейс и включение модулей проверяются в игровом мире.

## Выпуск версии

1. Увеличьте `version` в `module.json` и `package.json` до одного и того же
   номера. Запустите `npm run check`.
2. Влейте изменение в основную ветку `translation-0.1.9` через pull request.
   [Как отправить pull request](CONTRIBUTING.md)
3. Откройте **Actions → Publish Foundry module → Run workflow** и укажите
   основную ветку. GitHub Actions создаст тег, соберёт ZIP, прикрепит его и
   `module.json` к релизу и отметит релиз как **Latest**. [GitHub Actions](https://github.com/Sifour92/cosmere-rpg-mistborn-handbook-ru/actions/workflows/release.yml)
4. Откройте последний релиз и проверьте, что ZIP и манифест скачиваются.
   [Последний релиз](https://github.com/Sifour92/cosmere-rpg-mistborn-handbook-ru/releases/latest)

Выпуск также запускается отправкой тега. После слияния переключитесь
на основную ветку, обновите её и поставьте тег на коммите с новой версией.
Например, для следующей версии `0.2.2`:

```bash
git switch translation-0.1.9
git pull --ff-only origin translation-0.1.9
git tag v0.2.2
git push origin v0.2.2
```

## Внешние материалы

Оригинальный справочник, общий глоссарий и прежние переводы хранятся отдельно
от этого проекта. В текущей общей рабочей папке они находятся здесь
(пути относительно корня этого проекта):

- `../cosmere-rpg-mistborn-handbook/` — исходный модуль версии 1.0.1.
- `../../../../glossary/README.md` — основной глоссарий проекта.
- `../../../../translations/mistborn/` — прежние тексты и выгрузки.
- `../../../../CLAUDE.md` — общие правила родительского проекта.

Если репозиторий перенесён в другое место, расположение этих входных
материалов нужно определить заново. `npm run check` от них не зависит.
Для рабочих копий исходников предусмотрен каталог `.local/`, исключённый из Git.
