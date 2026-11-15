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
