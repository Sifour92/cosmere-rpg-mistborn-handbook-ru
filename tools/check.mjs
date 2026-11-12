import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

async function readJson(relativePath) {
  const value = JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
  assert(value && typeof value === 'object' && !Array.isArray(value),
    `${relativePath}: ожидается JSON-объект`);
  return value;
}

async function requireFile(relativePath) {
  assert.equal(typeof relativePath, 'string', 'В манифесте отсутствует путь файла');
  assert((await stat(path.join(root, relativePath))).isFile(),
    `${relativePath}: файл не найден`);
}

function countStrings(value) {
  return Object.values(value).reduce((total, child) => {
    if (typeof child === 'string') return total + 1;
    assert(child && typeof child === 'object' && !Array.isArray(child),
      'Словарь локализации должен содержать строки или вложенные объекты');
    return total + countStrings(child);
  }, 0);
}

const manifest = await readJson('module.json');
const project = await readJson('package.json');
assert.equal(manifest.id, 'cosmere-rpg-mistborn-handbook-ru');
assert.equal(project.name, manifest.id, 'Имена пакетов должны совпадать');
assert.equal(project.version, manifest.version, 'Версии пакетов должны совпадать');
assert.equal(project.private, true);
assert.equal(manifest.compatibility.minimum, '13.346');
assert.equal(manifest.compatibility.maximum, '13');
assert(manifest.relationships.systems.some(system => system.id === 'cosmere-rpg'));
for (const id of ['cosmere-rpg-mistborn-handbook', 'babele']) {
  assert(manifest.relationships.requires.some(dependency => dependency.id === id),
    `Не объявлена зависимость: ${id}`);
}
assert(manifest.esmodules.includes('scripts/register.mjs'));
for (const script of manifest.esmodules) await requireFile(script);
await requireFile(manifest.readme);

const language = manifest.languages.find(entry => entry.lang === 'ru');
assert(language, 'Не объявлен русский язык');
const strings = countStrings(await readJson(language.path));
const directory = 'translations/ru';
const files = (await readdir(path.join(root, directory)))
  .filter(name => name.endsWith('.json'));
for (const file of files) {
  assert(file.startsWith('cosmere-rpg-mistborn-handbook.'),
    `Неожиданная коллекция перевода: ${file}`);
  await readJson(`${directory}/${file}`);
}

console.log(`Манифест, зависимости и файлы: OK (${manifest.version}).`);
console.log(`Строк интерфейса: ${strings}; файлов переводов компендиумов: ${files.length}.`);
console.log('Проверка в Foundry выполняется отдельно.');
