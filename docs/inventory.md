# Исходные компендиумы

Снимок создан 12.11.2026 из оригинального Mistborn Handbook 1.0.1.
Контрольные суммы всех 846 исходных файлов совпали до и после извлечения.
Снимок `.local/source/snapshot.json` содержит документы с вложенными записями,
папки и контрольные суммы.

| Коллекция | Тип | Документы | Папки | Вложенные предметы | Эффекты | Страницы | Результаты |
|---|---|---:|---:|---:|---:|---:|---:|
| `handbook` | JournalEntry | 21 | 0 | 0 | 0 | 241 | 0 |
| `metallic-arts` | Item | 267 | 66 | 196 | 47 | 0 | 0 |
| `ancestries` | Item | 18 | 2 | 8 | 2 | 0 | 0 |
| `cultures` | Item | 15 | 2 | 0 | 0 | 0 | 0 |
| `heroic-paths` | Item | 180 | 42 | 99 | 20 | 0 | 0 |
| `metalborn-paths` | Item | 99 | 18 | 19 | 6 | 0 | 0 |
| `items` | Item | 246 | 32 | 93 | 47 | 0 | 0 |
| `actions` | Item | 21 | 3 | 0 | 0 | 0 | 0 |
| `roll-tables` | RollTable | 6 | 0 | 0 | 0 | 0 | 53 |
| `animal-companions` | Actor | 9 | 3 | 47 | 4 | 0 | 0 |
| `adversary-features` | Item | 33 | 2 | 0 | 8 | 0 | 0 |
| `macros` | Macro | 1 | 0 | 0 | 0 | 0 | 0 |
| **Всего** | | **916** | **170** | **462** | **134** | **241** | **53** |

Вложенные предметы включают действия из `system.__embedded.items`,
которые Cosmere передаёт клиенту как `items`. В колонке «Эффекты»
учтены эффекты основных и вложенных записей.

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
