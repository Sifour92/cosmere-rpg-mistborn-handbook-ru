# Как предложить изменение

Для каждой правки или новой функции создавайте отдельную ветку от актуальной
`translation-0.1.9`. Эта ветка основная и защищена. Изменения попадают в неё
через pull request.

## Создайте рабочую ветку

Если у вас есть право записи в репозиторий, обновите основную ветку и создайте
от неё рабочую. Здесь `docs/fix-install-guide` служит примером имени.

```bash
git switch translation-0.1.9
git pull --ff-only origin translation-0.1.9
git switch -c docs/fix-install-guide
```

Если права записи нет, создайте **Fork** на GitHub и клонируйте свою копию.
Добавьте исходный репозиторий как `upstream` и начните ветку с его актуальной
основной ветки:

```bash
git remote add upstream https://github.com/Sifour92/cosmere-rpg-mistborn-handbook-ru.git
git fetch upstream
git switch -c docs/fix-install-guide upstream/translation-0.1.9
```

## Проверьте и отправьте изменения

1. Для правок текста сверяйтесь с [руководством по переводу](translation.md) и
   [правилами проекта](../AGENTS.md).
2. Запустите `npm run check`, соберите ZIP и проверьте его в запущенном
   локальном тестовом мире. Запишите результат в журнал проверок.
   [Обязательная проверка в локальной Foundry](development.md#обязательная-проверка-в-локальной-foundry)
3. Сделайте коммит и отправьте рабочую ветку в `origin`. В примере меняется
   только `README.md`. Укажите файлы своей правки.

   ```bash
   git status --short
   git add README.md
   git commit -m "Уточнить инструкцию по установке"
   git push -u origin docs/fix-install-guide
   ```

## Откройте pull request

1. На GitHub нажмите **Compare & pull request** рядом с отправленной веткой.
   Можно также открыть вкладку **Pull requests** и нажать **New pull request**.
2. В качестве **base** выберите `Sifour92/cosmere-rpg-mistborn-handbook-ru` и
   ветку `translation-0.1.9`. В качестве **compare** выберите свою рабочую ветку.
   Для форка воспользуйтесь **compare across forks**.
3. Кратко напишите, что изменилось и зачем. Укажите версию Foundry,
   фактически проверенные сценарии и их результат. Для правки перевода
   укажите компендиум, документ или страницу. Проверьте список изменённых
   файлов и нажмите **Create pull request**.
4. Если понадобятся доработки, отправляйте дополнительные коммиты в ту же
   рабочую ветку. Они появятся в открытом PR.
