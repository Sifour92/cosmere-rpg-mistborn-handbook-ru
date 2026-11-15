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
globalThis.Hooks = {
  once(event, callback) {
    assert.equal(event, 'babele.init');
    hooks.push(callback);
  },
  callAll: () => true
};
await importFrom(root, 'scripts/register.mjs');
assert.equal(hooks.length, 1, 'Ожидается регистрация перевода через babele.init');
const { Babele } = await importFrom(babelePath, 'script/core/babele.js');
const { translateResult } = await importFrom(babelePath, 'script/foundry/wrapper.js');
assert.equal(typeof Babele.create, 'function', 'Нужен API Babele 2.9.1');

const collection = `${snapshot.manifest.id}.handbook`;
const translation = await readJson(path.join(root, `translations/ru/${collection}.json`));
const original = structuredClone(snapshot.packs.handbook.documents);
const artsCollection = `${snapshot.manifest.id}.metallic-arts`;
const artsTranslation = await readJson(path.join(root, `translations/ru/${artsCollection}.json`));
const originalArts = structuredClone(snapshot.packs['metallic-arts'].documents);
const chapters = snapshot.packs.handbook.documents.flatMap(document => document.pages);

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

  for (const [id, expected] of Object.entries(translation.entries)) {
    const source = snapshot.packs.handbook.documents.find(document => document._id === id);
    assert(source, `Нет документа оригинала: ${id}`);
    const result = session.translate(collection, source);
    if (!translated) {
      assert.deepEqual(result, source, 'Без активного русского перевода нужен оригинал');
      continue;
    }
    assert.equal(result._id, source._id);
    assert.equal(result.name, expected.name ?? source.name);
    assert.equal(result.pages.length, source.pages.length);
    for (const [index, page] of source.pages.entries()) {
      const after = result.pages[index];
      const patch = expected.pages[page._id];
      assert.equal(after._id, page._id);
      assert.equal(after.name, patch?.name ?? page.name);
      assert.equal(after.text.content, patch?.text ?? page.text.content);
      // Тексты могут добавлять явные HTML-якоря; пути и команды сохраняются.
      const references = text => Array.from(text.matchAll(
        /@(?:UUID|Embed)\[[^\]]+\]|(?:href|src)="[^"]*"|\[\[[^\]]+\]\]/g
      ), match => match[0]);
      assert.deepEqual(references(after.text.content), references(page.text.content));
      for (const [, anchor] of page.text.content.matchAll(/\bid="([^"]*)"/g)) {
        assert(after.text.content.includes(`id="${anchor}"`), `Утрачен якорь ${anchor}`);
      }
    }
  }
  assert.deepEqual(snapshot.packs.handbook.documents, original, 'Исходные данные изменены');

  for (const [id, entry] of Object.entries(artsTranslation.entries)) {
    const originalPower = snapshot.packs['metallic-arts'].documents.find(document => document._id === id);
    assert(originalPower, `Нет исходной силы: ${id}`);
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
    mechanics.items = resultActions.map((item, index) => {
      if (!entry.actions[item._id]) return item;
      const clean = withoutBabele(item);
      const originalItem = sourceActions[index];
      clean.name = originalItem.name;
      clean.system.description.value = originalItem.system.description.value;
      return clean;
    });
    assert.deepEqual(mechanics, source, `Изменились поля силы вне перевода: ${source.name}`);
  }
  assert.deepEqual(snapshot.packs['metallic-arts'].documents, originalArts, 'Исходные силы изменены');
  console.log(`Перевод ${enabled ? 'подключён' : 'отключён'}, язык ${language}: OK.`);
}

console.log(`Babele ${babeleManifest.version}: регистрация, исходная коллекция и сохранность данных — OK.`);
console.log('Включение модулей, интерфейс и доступ игрока в игровом мире проверяются отдельно.');
