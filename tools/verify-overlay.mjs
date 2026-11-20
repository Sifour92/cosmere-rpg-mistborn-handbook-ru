import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Локальная интеграционная проверка с установленными Foundry 13 и Babele 2.9.1.
// HTTP, пользователь и настройки имитируются; движок и регистрация — настоящие.
const [appPath, babelePath] = process.argv.slice(2);
assert(appPath && babelePath,
  'Использование: npm run check:overlay -- <Foundry/app> <Data/modules/babele>');
const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const importFrom = (directory, file) => import(pathToFileURL(path.resolve(directory, file)));
const manifest = await readJson(path.join(root, 'module.json'));
const snapshot = await readJson(path.join(root, '.local/source/snapshot.json'));
const babeleManifest = await readJson(path.join(babelePath, 'module.json'));
const modulePrefix = `modules/${manifest.id}/`;

function localModulePath(url) {
  assert(url.startsWith(modulePrefix), `Неожиданный запрос: ${url}`);
  const resolved = path.resolve(root, url.slice(modulePrefix.length));
  assert(resolved.startsWith(root), `Запрос вне каталога перевода: ${url}`);
  return resolved;
}

const { default: Collection } = await importFrom(appPath, 'common/utils/collection.mjs');
globalThis.CONST = await importFrom(appPath, 'common/constants.mjs');
globalThis.foundry = {
  utils: { ...await importFrom(appPath, 'common/utils/helpers.mjs'), Collection },
  applications: { apps: { FilePicker: {
    async browse(source, directory) {
      assert.equal(source, 'data');
      const files = await readdir(localModulePath(directory), { withFileTypes: true });
      return { files: files.filter(file => file.isFile()).map(file => `${directory}/${file.name}`) };
    }
  } } }
};
globalThis.fetch = async url => ({ ok: true, json: () => readJson(localModulePath(url)) });
globalThis.game = {
  user: { isGM: true, hasPermission: permission => permission === 'FILES_BROWSE' },
  settings: { get: () => undefined },
  packs: new Collection(snapshot.manifest.packs.map(pack => [
    `${snapshot.manifest.id}.${pack.name}`, { documentName: pack.type }
  ])),
  data: { packs: snapshot.manifest.packs.map(pack => ({
    ...pack, packageName: snapshot.manifest.id, packageType: 'module'
  })) }
};
const hooks = [];
let renderCompendiumDirectory;
globalThis.Hooks = {
  once(event, callback) {
    assert.equal(event, 'babele.init');
    hooks.push(callback);
  },
  on(event, callback) {
    if (event === 'renderCompendiumDirectory') renderCompendiumDirectory = callback;
    else assert.equal(event, 'renderJournalEntrySheet');
  },
  callAll: () => true
};
await importFrom(root, 'scripts/register.mjs');
assert.equal(hooks.length, 1, 'Ожидается регистрация перевода через babele.init');
const { Babele } = await importFrom(babelePath, 'script/core/babele.js');
const { translateResult } = await importFrom(babelePath, 'script/foundry/wrapper.js');
assert.equal(typeof Babele.create, 'function', 'Нужен API Babele 2.9.1');

const collection = `${snapshot.manifest.id}.handbook`;
const translations = new Map(await Promise.all(Object.keys(snapshot.packs).map(async name => {
  const pack = `${snapshot.manifest.id}.${name}`;
  return [name, await readJson(path.join(root, `translations/ru/${pack}.json`))];
})));
const translation = translations.get('handbook');
const original = structuredClone(snapshot.packs.handbook.documents);
const artsCollection = `${snapshot.manifest.id}.metallic-arts`;
const artsTranslation = translations.get('metallic-arts');
const originalArts = structuredClone(snapshot.packs['metallic-arts'].documents);
const chapters = snapshot.packs.handbook.documents.flatMap(document => document.pages);

function verifyCompendiumDirectory(language) {
  const packageName = snapshot.manifest.id;
  const [rootFolder] = snapshot.manifest.packFolders;
  const mistborn = { id: 'mistborn', name: rootFolder.name, folder: null };
  const character = { id: 'character', name: rootFolder.folders[0].name, folder: mistborn };
  const rules = { id: 'rules', name: rootFolder.folders[1].name, folder: mistborn };
  const worldRules = { id: 'world-rules', name: 'Rules', folder: null };
  const labels = new Map([mistborn, character, rules, worldRules].map(folder => [
    `[data-folder-id="${folder.id}"] > .folder-header .folder-name`, { textContent: folder.name }
  ]));
  const originalPacks = game.packs;
  game.packs = [
    ...[mistborn, character, rules].map(folder => ({ metadata: { packageName }, folder })),
    { metadata: { packageName: 'world' }, folder: worldRules }
  ];
  game.i18n = { lang: language };
  try {
    renderCompendiumDirectory(null, { querySelector: selector => labels.get(selector) });
    const original = [mistborn.name, character.name, rules.name, worldRules.name];
    const expected = language === 'ru' ? [
      'Справочник «Рождённый туманом» (Mistborn Handbook)',
      'Особенности персонажа (Character Features)', 'Правила (Rules)', worldRules.name
    ] : original;
    assert.deepEqual([...labels.values()].map(label => label.textContent), expected);
    assert.deepEqual([mistborn.name, character.name, rules.name, worldRules.name], original);
  } finally {
    game.packs = originalPacks;
  }
}

function withoutBabele(document) {
  const clean = structuredClone(document);
  delete clean.translated;
  delete clean.hasTranslation;
  delete clean.originalName;
  if (clean.flags) delete clean.flags.babele;
  return clean;
}

function rulesMarkup(text) {
  const tokens = /<span class="cosmere-icon[^"]*">[^<]*<\/span>|<[^>]+>|@(?:UUID|Embed)\[[^\]]+\]|\[\[[^\]]+\]\]/g;
  return text.match(tokens) ?? [];
}

function verifyEffects(source, after, patch) {
  const effects = source.effects ?? [];
  assert.deepEqual(Object.keys(patch.effects ?? {}).sort(), effects.map(effect => effect._id).sort());
  assert.deepEqual(after.effects?.map(effect => effect._id), source.effects?.map(effect => effect._id));
  for (const [index, effect] of effects.entries()) {
    const translated = after.effects[index];
    const expected = patch.effects[effect._id];
    assert(/[а-яё]/i.test(expected.name), `Нет перевода эффекта: ${effect._id}`);
    assert.equal(translated.name, expected.name);
    if (effect.description) {
      assert(/[а-яё]/i.test(expected.description ?? ''), `Нет описания эффекта: ${effect._id}`);
      assert.equal(translated.description, expected.description);
      assert.deepEqual(rulesMarkup(translated.description), rulesMarkup(effect.description));
    }
  }
}

// Cosmere переносит system.__embedded.items в items при обработке ответа
// сервера. Babele получает результат getDocuments уже в таком виде.
function clientPower(source) {
  const power = structuredClone(source);
  power.items = power.system.__embedded.items;
  delete power.system.__embedded;
  return power;
}

function rulesValues(text) {
  const plain = text.replace(/<[^>]+>|@(?:UUID|Embed)\[[^\]]+\]|\[\[[^\]]+\]\]/g, '');
  return (plain.match(/\d+d\d+|[+−-]?\d+/g) ?? []).sort();
}

// Only these four links in the source target the right anchor on the wrong page.
const chapterSixIntro = 'Compendium.cosmere-rpg-mistborn-handbook.handbook.JournalEntry.Wdux6AlRp01Ox3EQ.JournalEntryPage.H0pYaTZr3enQNbMj';
const chapterSixRules = 'I0SSB8epbNJfzWkf';
const correctedLinks = new Map([
  ['7SWGoz46cr0lkATU.v6P4sMmKFcb1SoiD', new Set([
    'nascent-powers', 'power-scaling', 'durations-of-store-actions'
  ])],
  ['AyVQ17BzPLpNYwk8.ZOW2VjaPS4ACrrcN', new Set(['allomantically-inert-materials'])]
]);

function expectedJournalReference(reference, anchors) {
  for (const anchor of anchors ?? []) {
    if (reference === `@UUID[${chapterSixIntro}#${anchor}]`) {
      return `@UUID[${chapterSixIntro.replace(/[^.]+$/, chapterSixRules)}#${anchor}]`;
    }
  }
  return reference;
}

for (const { language, enabled } of [
  { language: 'ru', enabled: true },
  { language: 'en', enabled: true },
  { language: 'ru', enabled: false }
]) {
  // При отключённом модуле Foundry не исполняет его esmodules.
  const engine = Babele.create({ registerConfiguredDirectory: false });
  if (enabled) hooks[0](engine);
  const session = await engine.session(language);
  const translated = language === 'ru' && enabled;
  assert.equal(session.isTranslated(collection), translated);
  assert.equal(session.isTranslated(artsCollection), translated);
  assert.equal(session.isTranslated(`${manifest.id}.handbook`), false,
    'Перевод должен относиться к коллекции официального модуля');
  assert.equal(session.mappedCompendiums.packs.size, snapshot.manifest.packs.length);

  for (const [name, pack] of Object.entries(snapshot.packs)) {
    const packCollection = `${snapshot.manifest.id}.${name}`;
    const payload = translations.get(name);
    assert.deepEqual(new Set(Object.keys(payload.entries)), new Set(pack.documents.map(document => document._id)));
    const folders = new Map(pack.folders.map(folder => [folder._id, structuredClone(folder)]));
    assert.deepEqual(new Set(Object.keys(payload.folders ?? {})), new Set(pack.folders.map(folder => folder.name)));
    session.translatePackFolders({ collection: packCollection, folders });
    for (const source of pack.folders) {
      const actual = folders.get(source._id);
      const title = payload.folders[source.name];
      assert(title.endsWith(` (${source.name})`) && /[а-яё]/i.test(title));
      assert.deepEqual(actual, translated ? { ...source, name: title, originalName: source.name } : source);
    }
  }
  if (enabled) verifyCompendiumDirectory(language);

  for (const [id, expected] of Object.entries(translation.entries)) {
    const source = snapshot.packs.handbook.documents.find(document => document._id === id);
    assert(source, `Нет документа оригинала: ${id}`);
    const result = session.translate(collection, source);
    if (!translated) {
      assert.deepEqual(result, source, 'Без активного русского перевода нужен оригинал');
      continue;
    }
    assert.equal(result._id, source._id);
    assert.equal(result.name, expected.name);
    assert.deepEqual(Object.keys(expected.pages).sort(), source.pages.map(page => page._id).sort());
    assert.equal(result.pages.length, source.pages.length);
    for (const [index, page] of source.pages.entries()) {
      const after = result.pages[index];
      const patch = expected.pages[page._id];
      assert.equal(after._id, page._id);
      assert.equal(after.name, patch.name);
      assert.equal(after.text.content, patch.text);
      // Тексты могут добавлять явные HTML-якоря. У четырёх ссылок исправлена страница назначения.
      const references = text => Array.from(text.matchAll(
        /@(?:UUID|Embed)\[[^\]]+\]|(?:href|src)="[^"]*"|\[\[[^\]]+\]\]/g
      ), match => match[0]);
      const anchors = correctedLinks.get(`${id}.${page._id}`);
      assert.deepEqual(references(after.text.content),
        references(page.text.content).map(reference => expectedJournalReference(reference, anchors)));
      for (const [, anchor] of page.text.content.matchAll(/\bid="([^"]*)"/g)) {
        assert(after.text.content.includes(`id="${anchor}"`), `Утрачен якорь ${anchor}`);
      }
    }
  }
  assert.deepEqual(snapshot.packs.handbook.documents, original, 'Исходные данные изменены');

  for (const [id, entry] of Object.entries(artsTranslation.entries)) {
    const originalPower = snapshot.packs['metallic-arts'].documents.find(document => document._id === id);
    assert(originalPower, `Нет исходной силы: ${id}`);
    // Таланты и деревья талантов (chat, short, вложенные копии) проверяются отдельно; здесь только силы.
    if (originalPower.type !== 'power') continue;
    const source = clientPower(originalPower);
    // Карточка может содержать и действия, которые открываются только из самой силы.
    // «Зачаточные» силы выдаются талантами и в книгу не вставлены.
    if (!/^Nascent /.test(originalPower.name)) assert(source.items.some(item => chapters.some(page => page.text.content?.includes(
      `@Embed[Compendium.${artsCollection}.Item.${id}.Item.${item._id} `
    ))), `Сила не представлена во вставках книги: ${id}`);
    const [result] = await translateResult([{ toObject: () => structuredClone(source) }], {
      pack: artsCollection,
      documentClass: { fromSource: data => data }
    }, {
      init: async () => true,
      translatedCompendiumFor: pack => session.translatedCompendiumFor(pack)
    });
    if (!translated) {
      assert.deepEqual(result.toObject(), source, 'Без активного русского перевода нужна исходная сила');
      continue;
    }

    assert.equal(result.name, entry.name);
    assert.equal(result.system.description.value, entry.description);
    assert.deepEqual(rulesMarkup(result.system.description.value), rulesMarkup(source.system.description.value));
    assert.deepEqual(rulesValues(result.system.description.value), rulesValues(source.system.description.value));
    const sourceActions = source.items;
    const resultActions = result.items;
    assert.deepEqual(resultActions.map(item => item._id), sourceActions.map(item => item._id));
    for (const [actionId, patch] of Object.entries(entry.actions)) {
      const action = sourceActions.find(item => item._id === actionId);
      const after = resultActions.find(item => item._id === actionId);
      assert(action && after, `Нет вложенного действия: ${id}.${actionId}`);
      assert.equal(after.name, patch.name);
      assert.equal(after.system.description.value, patch.description);
      assert.deepEqual(rulesMarkup(after.system.description.value), rulesMarkup(action.system.description.value));
      assert.deepEqual(rulesValues(after.system.description.value), rulesValues(action.system.description.value));
    }

    const mechanics = withoutBabele(result);
    mechanics.name = source.name;
    mechanics.system.description.value = source.system.description.value;
    mechanics.effects = source.effects;
    mechanics.items = resultActions.map((item, index) => {
      if (!entry.actions[item._id]) return item;
      const clean = withoutBabele(item);
      const originalItem = sourceActions[index];
      clean.name = originalItem.name;
      clean.system.description.value = originalItem.system.description.value;
      clean.system.description.chat = originalItem.system.description.chat;
      clean.system.description.short = originalItem.system.description.short;
      clean.effects = originalItem.effects;
      return clean;
    });
    assert.deepEqual(mechanics, source, `Изменились поля силы вне перевода: ${source.name}`);
  }
  assert.deepEqual(snapshot.packs['metallic-arts'].documents, originalArts, 'Исходные силы изменены');

  // Сравниваем данные остальных компендиумов после прохождения через обёртку Babele.
  for (const packName of Object.keys(snapshot.packs).filter(name => name !== 'handbook')) {
    const collectionName = `${snapshot.manifest.id}.${packName}`;
    const packTranslation = translations.get(packName);
    let labelsTranslated = 0;
    let actionsTranslated = 0;
    for (const originalDocument of snapshot.packs[packName].documents) {
      const source = originalDocument.system?.__embedded ? clientPower(originalDocument) : structuredClone(originalDocument);
      const [result] = await translateResult([{ toObject: () => structuredClone(source) }], {
        pack: collectionName,
        documentClass: { fromSource: data => data }
      }, {
        init: async () => true,
        translatedCompendiumFor: pack => session.translatedCompendiumFor(pack)
      });
      const after = typeof result.toObject === 'function' ? result.toObject() : result;
      if (!translated) {
        assert.deepEqual(after, source, `Без перевода нужен оригинал: ${packName}/${source.name}`);
        continue;
      }
      const entry = packTranslation.entries[source._id];
      assert.equal(after.name, entry.name, `${packName}/${source.name}`);
      verifyEffects(source, after, entry);
      if (packName === 'macros' && source._id === '4vNksvMjGfSp2KHg') {
        const localizedName = '`Кости (bones): ${targetedActor.name}`';
        assert.equal(after.command.split(localizedName).length, 3);
        assert.equal(after.command
          .replaceAll(localizedName, "`${targetedActor.name}'s bones`")
          .replace('"персонаж не указан"', '"UNDEFINED ACTOR"')
          .replace('"цель не указана"', '"UNDEFINED TARGET"'), source.command);
        after.command = source.command;
      }
      for (const key of ['value', 'chat', 'short']) {
        const patch = entry[key === 'value' ? 'description' : key];
        if (patch !== undefined) assert.equal(after.system.description[key], patch);
      }
      const items = source.items ?? [];
      const embedded = entry.actions ?? entry.items ?? {};
      assert.deepEqual(new Set(Object.keys(embedded)), new Set(items.map(item => item._id)),
        `Покрытие вложенных предметов: ${packName}/${source._id}`);
      for (const item of items) {
        const patch = embedded[item._id];
        const actual = after.items.find(candidate => candidate._id === item._id);
        assert.equal(actual.name, patch.name);
        assert.equal(actual.system.description.value, patch.description);
        verifyEffects(item, actual, patch);
        if (packName === 'items') {
          assert.deepEqual(rulesMarkup(actual.system.description.value), rulesMarkup(item.system.description.value));
        }
        for (const key of ['chat', 'short']) {
          const originalText = item.system.description[key];
          if (!originalText) continue;
          const location = `${packName}/${source._id}/${item._id}/${key}`;
          assert(/[а-яё]/i.test(patch[key] ?? ''), `Нет перевода поля: ${location}`);
          assert.equal(actual.system.description[key], patch[key], `Babele пропустил поле: ${location}`);
          assert.deepEqual(rulesMarkup(actual.system.description[key]), rulesMarkup(originalText), location);
        }
      }
      for (const row of source.results ?? []) {
        const patch = entry.results[row._id];
        const actual = after.results.find(candidate => candidate._id === row._id);
        assert.equal(actual.name, patch.name ?? row.name);
        assert.equal(actual.description, patch.description ?? row.description);
      }
      if (source.prototypeToken?.name) {
        assert(/[а-яё]/i.test(entry.tokenName ?? ''), `Нет имени токена: ${source._id}`);
        assert.equal(after.prototypeToken.name, entry.tokenName);
      }
      const allowed = [
        /^name$/, /^system\.description\.(value|chat|short)$/,
        /^system\.(nodes|events)\..*\.(label|description|pickPromptTitle)$/,
        /^items\.\d+\.name$/, /^items\.\d+\.system\.description\.(value|chat|short)$/,
        /^(?:items\.\d+\.)?effects\.\d+\.(name|description)$/,
        /^prototypeToken\.name$/, /^results\.\d+\.(name|description)$/
      ];
      const walk = (before, now, where) => {
        if (typeof before === 'string' && typeof now === 'string') {
          if (before === now) return;
          assert(allowed.some(rule => rule.test(where)), `Изменено вне перевода: ${packName}/${source.name}: ${where}`);
          if (/^system\.(nodes|events)\./.test(where)) labelsTranslated += 1;
          if (/^items\./.test(where)) actionsTranslated += 1;
          return;
        }
        assert.equal(typeof now, typeof before, `Изменён тип: ${where}`);
        if (before && typeof before === 'object') {
          assert.deepEqual(Object.keys(now), Object.keys(before), `Изменён состав полей: ${packName}/${source.name}: ${where}`);
          for (const key of Object.keys(before)) walk(before[key], now[key], where ? `${where}.${key}` : key);
        } else assert.equal(now, before, `Изменено значение: ${where}`);
      };
      const stripBabele = value => {
        const clean = structuredClone(value);
        delete clean.translated; delete clean.hasTranslation; delete clean.originalName;
        if (clean.flags) delete clean.flags.babele;
        if (Array.isArray(clean.items)) clean.items = clean.items.map(stripBabele);
        if (Array.isArray(clean.results)) clean.results = clean.results.map(stripBabele);
        if (Array.isArray(clean.effects)) clean.effects = clean.effects.map(stripBabele);
        return clean;
      };
      walk(source, stripBabele(after), '');
    }
    if (translated) {
      if (['heroic-paths', 'metalborn-paths', 'metallic-arts'].includes(packName)) assert(labelsTranslated > 0, `Подписи узлов не переведены: ${packName}`);
      if (packName === 'cultures') {
        const lists = snapshot.packs.cultures.documents.filter(document => /Names/.test(document.system?.description?.value ?? ''));
        assert(lists.length >= 12, 'Нет культур со списками имён');
        for (const document of lists) {
          const [result] = await translateResult([{ toObject: () => structuredClone(document) }], { pack: collectionName, documentClass: { fromSource: data => data } }, { init: async () => true, translatedCompendiumFor: pack => session.translatedCompendiumFor(pack) });
          const text = (typeof result.toObject === 'function' ? result.toObject() : result).system.description.value;
          assert(!/<p>(?:[A-Z][A-Za-z’'-]+, ){3,}/.test(text), `Список имён не переведён: ${document.name}`);
        }
      }
      console.log(`  ${packName}: подписей ${labelsTranslated}, строк вложенных действий ${actionsTranslated}`);
    }
  }
  console.log(`Перевод ${enabled ? 'подключён' : 'отключён'}, язык ${language}: OK.`);
}

console.log(`Babele ${babeleManifest.version}: регистрация, исходная коллекция и сохранность данных — OK.`);
console.log('Включение модулей, интерфейс и доступ игрока в игровом мире проверяются отдельно.');
