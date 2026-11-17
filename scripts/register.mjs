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

Hooks.once('babele.init', babele => {
  babele.registerConverters({
    cosmereTreeLabels: value => translateKeys(value, ['label', 'description']),
    cosmereEventLabels: value => translateKeys(value, ['pickPromptTitle'])
  });
  babele.register({
    module: 'cosmere-rpg-mistborn-handbook-ru',
    lang: 'ru',
    dir: 'translations/ru'
  });
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
