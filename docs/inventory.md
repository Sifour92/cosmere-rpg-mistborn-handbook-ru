# Исходные компендиумы

Снимок создан 12.11.2026 из оригинального Mistborn Handbook 1.0.1.
Контрольные суммы всех 846 исходных файлов совпали до и после извлечения.
Снимок `.local/source/snapshot.json` содержит документы с вложенными записями,
папки и контрольные суммы.

| Коллекция | Тип | Документы | Папки | Вложенные записи |
|---|---|---:|---:|---|
| `handbook` | JournalEntry | 21 | 0 | 241 страница |
| `metallic-arts` | Item | 267 | 66 | |
| `ancestries` | Item | 18 | 2 | 2 эффекта |
| `cultures` | Item | 15 | 2 | |
| `heroic-paths` | Item | 180 | 42 | 20 эффектов |
| `metalborn-paths` | Item | 99 | 18 | 6 эффектов |
| `items` | Item | 246 | 32 | 47 эффектов |
| `actions` | Item | 21 | 3 | |
| `roll-tables` | RollTable | 6 | 0 | 53 результата |
| `animal-companions` | Actor | 9 | 3 | 47 предметов и 4 эффекта этих предметов |
| `adversary-features` | Item | 33 | 2 | 8 эффектов |
| `macros` | Macro | 1 | 0 | |
| **Всего** | | **916** | **170** | **428** |

## Поля для перевода

| Запись | Поля для сверки |
|---|---|
| Журнал | `name`, вложенные `pages[].name` и `pages[].text.content`, подписи изображений |
| Предмет | `name`, `system.description.value`, `system.description.chat`, `system.description.short` |
| Вложенный эффект | `name`, `description`; параметры в `changes` сохраняются |
| Актёр | `name`, `prototypeToken.name`, `system.appearance`, `system.biography`, `system.notes`, вложенные предметы |
| Таблица | `name`, `description`, вложенные `results[].name` и `results[].description` |
| Макрос | `name` и видимые пользователю строки в `command` после отдельной сверки |
| Папка | `name`, `description` при наличии текста |

Поля специфичных подтипов, например дерева талантов и целей, уточняются
по данным соответствующего компендиума перед переводом.

## Глава 6

Документ `Wdux6AlRp01Ox3EQ`. У всех 38 страниц совпали ID и английские
названия с прежней выгрузкой. HTML 34 страниц совпал побайтно как строка.
На четырёх страницах разница сводится к пробелам:

- `I0SSB8epbNJfzWkf` — Using Metallic Arts
- `HURnGlIenINWoul4` — Brass Allomancy
- `eBsLkktgVVjJ3Imo` — Bronze Allomancy
- `kRwqALF2FDIJt3PW` — Gold Allomancy

Данные оригинала служат основой при сверке разметки и ссылок.
