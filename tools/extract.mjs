import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const [foundryApp, original = path.resolve(root, '../cosmere-rpg-mistborn-handbook')] =
  process.argv.slice(2);

if (!foundryApp) {
  console.error('Использование: npm run extract -- <каталог Foundry Resources/app> [каталог оригинала]');
  process.exit(1);
}

const { ClassicLevel } = createRequire(path.resolve(foundryApp, 'package.json'))('classic-level');
const source = path.resolve(original);
const manifest = JSON.parse(await readFile(path.join(source, 'module.json'), 'utf8'));
assert.equal(manifest.id, 'cosmere-rpg-mistborn-handbook');
assert.equal(manifest.version, '1.0.1', 'Для другой версии требуется повторная сверка схемы');

async function checksums(directory, prefix = '') {
  const result = {};
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, entry.name);
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      Object.assign(result, await checksums(file, relative));
    } else if (entry.isFile()) {
      result[relative] = createHash('sha256').update(await readFile(file)).digest('hex');
    }
  }
  return result;
}

async function extractPack(directory) {
  const db = new ClassicLevel(directory, { createIfMissing: false, valueEncoding: 'json' });
  const records = new Map();
  const embeddedFields = new Map();
  try {
    for await (const [key, value] of db.iterator()) {
      const [, collection, identity] = /^!([^!]+)!([^!]+)$/.exec(key) ?? [];
      assert(collection && identity, `Неизвестный ключ LevelDB: ${key}`);
      assert.equal(value._id, identity.split('.').at(-1), key);
      records.set(key, { collection, identity, value });

      const separator = collection.lastIndexOf('.');
      if (separator !== -1) {
        const parent = collection.slice(0, separator);
        const fields = embeddedFields.get(parent) ?? new Set();
        fields.add(collection.slice(separator + 1));
        embeddedFields.set(parent, fields);
      }
    }
  } finally {
    await db.close();
  }

  const visited = new Set();
  function hydrate(key) {
    const record = records.get(key);
    assert(record, `Встроенный документ отсутствует: ${key}`);
    const { collection, identity, value } = record;
    visited.add(key);
    const document = { ...value };
    for (const field of embeddedFields.get(collection) ?? []) {
      assert(Array.isArray(value[field]), `Встроенное поле не является массивом: ${key}.${field}`);
      document[field] = value[field].map(id => {
        assert.equal(typeof id, 'string', `Ожидался ID в поле ${key}.${field}`);
        return hydrate(`!${collection}.${field}!${identity}.${id}`);
      });
    }
    return document;
  }

  const documents = [];
  const folders = [];
  for (const [key, { collection }] of records) {
    if (collection.includes('.')) continue;
    (collection === 'folders' ? folders : documents).push(hydrate(key));
  }
  assert.equal(visited.size, records.size, 'В базе остались записи без родительского документа');
  assert(documents.length > 0, 'В компендиуме нет документов');
  return { documents, folders };
}

const output = path.join(root, '.local/source');
await mkdir(output, { recursive: true });
const scratch = await mkdtemp(path.join(output, 'extract-'));
try {
  const before = await checksums(source);
  const packs = {};
  for (const { name, path: packPath, type } of manifest.packs) {
    assert.equal(packPath, `packs/${name}`);
    const copy = path.join(scratch, name);
    await cp(path.join(source, packPath), copy, { recursive: true });
    packs[name] = { type, ...await extractPack(copy) };
    console.log(`${name}: ${packs[name].documents.length} документов`);
  }
  assert.deepEqual(await checksums(source), before, 'Исходные файлы изменились во время извлечения');
  const snapshot = path.join(scratch, 'snapshot.json');
  await writeFile(snapshot, JSON.stringify({ manifest, checksums: before, packs }, null, 2) + '\n');
  await rename(snapshot, path.join(output, 'snapshot.json'));
  console.log(`Снимок сохранён. Проверено исходных файлов: ${Object.keys(before).length}.`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
