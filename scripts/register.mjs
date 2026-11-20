import { LABELS } from './labels.mjs';

// Подписи в данных деревьев талантов (требования узлов) и заголовки диалогов выбора
// заменяются по точному совпадению английской строки; структура данных не меняется.
function translateKeys(value, keys) {
  if (Array.isArray(value)) return value.map(item => translateKeys(item, keys));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      typeof item === 'string' && keys.includes(key) && Object.hasOwn(LABELS, item)
        ? LABELS[item]
        : translateKeys(item, keys)
    ]));
  }
  return value;
}

function translateBonesCommand(command, _translation, macro) {
  if (macro?._id !== '4vNksvMjGfSp2KHg' || typeof command !== 'string') return command;
  // Подписи предмета и эффекта. Имена переменных и выражение с именем цели сохраняются.
  const originalName = "`${targetedActor.name}'s bones`";
  if (command.split(originalName).length !== 3) return command;
  return command
    .replaceAll(originalName, '`Кости (bones): ${targetedActor.name}`')
    .replace('"UNDEFINED ACTOR"', '"персонаж не указан"')
    .replace('"UNDEFINED TARGET"', '"цель не указана"');
}

Hooks.once('babele.init', babele => {
  babele.registerConverters({
    cosmereTreeLabels: value => translateKeys(value, ['label', 'description']),
    cosmereEventLabels: value => translateKeys(value, ['pickPromptTitle']),
    cosmereBonesCommand: translateBonesCommand
  });
  babele.register({
    module: 'cosmere-rpg-mistborn-handbook-ru',
    lang: 'ru',
    dir: 'translations/ru'
  });
});

const compendiumFolderNames = new Map([
  ['Mistborn Handbook', 'Справочник «Рождённый туманом» (Mistborn Handbook)'],
  ['Character Features', 'Особенности персонажа (Character Features)'],
  ['Rules', 'Правила (Rules)']
]);

Hooks.on('renderCompendiumDirectory', (_directory, element) => {
  if (game.i18n.lang !== 'ru') return;

  // Группы в боковой панели Foundry хранит как папки мира. Меняем подписи
  // только у групп исходного модуля, не затрагивая одноимённые папки мира.
  const folders = new Set();
  for (const pack of game.packs) {
    if (pack.metadata.packageName !== 'cosmere-rpg-mistborn-handbook' || !pack.folder) continue;
    const folder = pack.folder;
    const root = folder.folder ?? folder;
    if (root.folder || (root.originalName ?? root.name) !== 'Mistborn Handbook') continue;
    folders.add(root);
    folders.add(folder);
  }

  for (const folder of folders) {
    const name = compendiumFolderNames.get(folder.originalName ?? folder.name);
    if (!name) continue;
    const heading = element.querySelector(`[data-folder-id="${folder.id}"] > .folder-header .folder-name`);
    if (heading) heading.textContent = name;
  }
});

// Foundry прокручивает к якорю до того, как Mistborn Handbook оформляет журнал.
const chapterSixAnchors = new Map([
  ['allomantically-inert-materials', ['I0SSB8epbNJfzWkf', '#allomantically-inert-materials']],
  ['creative-uses', ['YbDRP2Xa253c7SEZ', '#creative-uses']],
  ['piercing-copperclouds', ['ATU0KOC4qdnXuQUn', '#piercing-copperclouds']]
]);

Hooks.on('renderJournalEntrySheet', (sheet, element, _context, options) => {
  if (game.i18n.lang !== 'ru'
      || sheet.document.uuid !== 'Compendium.cosmere-rpg-mistborn-handbook.handbook.JournalEntry.Wdux6AlRp01Ox3EQ') {
    return;
  }
  const target = chapterSixAnchors.get(options?.anchor);
  if (!target || options.pageId !== target[0]) return;

  const [pageId, selector] = target;
  requestAnimationFrame(() => {
    element.querySelector(`article[data-page-id="${pageId}"] ${selector}`)
      ?.scrollIntoView({ block: 'start', inline: 'nearest' });
  });
});
