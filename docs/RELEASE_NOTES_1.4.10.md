# openGym 1.4.10

**Release date:** 20 November 2026  
**Version:** `1.4.10`  
**Android versionCode:** `20052`  
**APK:** `openGym-1.4.10.apk` (Standard, 180 px animations built in)

This release is the largest fork update so far. It finishes the upstream P1 work, adds the first
P2 features, and brings the Russian catalogue, descriptions and interface terminology to a
consistent state.

## Highlights

- **Russian exercise catalogue:** names now follow the reviewed translation workbook and the
  CrossFit page, and every one of the 5,632 exercises has a Russian description.
- **Workout flow:** choose when the next exercise appears, open the rest timer full screen, and
  time a cardio set while you are doing it.
- **Goals and discovery:** set a target weight with a 3, 6 or 12 month horizon, and filter the
  exercise explorer by equipment groups instead of dozens of individual chips.
- **Coach and self-hosting:** pyramids survive the Coach payload and the plan fingerprint; the web
  image listens on IPv4 and IPv6.
- **Polish:** supersets up to four, replace-in-routine, collapse sets, translated period and unit
  labels, keyboard shortcuts, download-in-background updates.

## Workout and training

- **Move to the next exercise** in Settings → Workout now has three choices: Off, When the rest
  ends, or Right away. Right away moves the marker on the tick while the rest keeps counting for
  the exercise just finished. A saved old switch reads as When the rest ends.
- **Full-screen rest timer:** tap the rest clock for a large ring with −15 s, pause, +15 s and
  Skip. The time wheel opens from the big clock; the screen closes itself when the rest ends.
- **Cardio timing:** a ▶ button under the speed field starts a count-up clock. ■, ticking the row
  or finishing the workout writes the minutes rounded as if typed. The clock survives a reload and
  ignores the workout's pauses. The effort pill sits under time and the timer under speed, the same
  width.
- **Collapse sets** now folds only the set rows. The image, description and menu stay open; the
  folded block keeps its ticks and animates its height and opacity.
- **Supersets up to four members:** grow from the group, remove one member or unpair the whole
  group; a fifth member is refused with a toast. Circuits and imported groups keep working.
- **Replace in routine** from the swap sheet changes both today's entry and the routine slot,
  keeping the slot's numbers, superset group and position.
- **Keep one set's weight change:** Settings → Workout → Fine-tuning can stop a weight edit from
  cascading to the following sets.
- **Skip completed exercises** and **Next/Prev** continue to work across Cards and Focus.
- **Session length estimate** appears on Plan and the start preview, based on recent exact
  sessions with a plan fallback.

## Russian names, descriptions and interface

- **5,632 exercise names** taken from the workbook's «Ваше название» column, with 33 CrossFit
  slots taken from the CrossFit sheet.
- **Proper names** keep their capitals: Смит, Скотт, Зоттман, Свенд, Поликвин, Паллоф, Арнольд,
  Жиронде and the other eponyms already covered by the catalogue.
- **Machine names** use «тренажёр» instead of «машина»; the reviewed descriptions were normalised
  for Smith machine, leverage machine, «с отягощением», «петли для подвесных тренировок».
- **Full Russian description pack:** all 5,632 exercise descriptions are translated and shown in
  the exercise sheet. English fallback is no longer shown under a Russian name.
- **Sentence case for tags and chips:** «Рычажный тренажёр», «С отягощением», «Петли для
  подвесных тренировок», «Тяжёлая атлетика», «Всё тело»; only the first letter is capitalised,
  except proper names and acronyms.
- **Units:** goal target reads «Цель (кг)», the exercise weight unit reads «кг»/«фунт», cardio
  recap reads «23 мин @ 10,5 км/ч», and the workout progress bar reads «0 кг».
- **Stats periods:** translated short labels `30 д`, `90 д`, `1 г` instead of `30d`, `90d`, `1Y`.

## Goals and exercise discovery

- **Lift goals:** a reps exercise can carry a target weight and a 3, 6 or 12 month horizon. The
  sheet shows the due date, progress from the best set when the goal was set, a status and the
  weekly gain needed. Goals sync with the profile (`S.exGoals`).
- **Equipment groups in Explorer:** Body weight, Free weights, Barbells, Machines, Cables, Bands,
  Balls & rollers, Cardio machines, Bench & bar, Other. A group filters by all of it; the chevron
  opens its individual kinds.
- **Muscle and body-part chips** use the same sentence-case rule and keep their filter when you
  switch body parts, where the new part still has exercises.

## Coach, sync and self-hosting

- **Coach pyramids:** pyramid targets, per-set rest and planned load survive the payload,
  validation, review and the plan fingerprint. A review cannot flatten a pyramid slot.
- **Custom exercise names** in the Coach payload follow the profile's own names.
- **Health Connect** receives measured heart-rate samples beside a workout; the Wear APK's
  versionCode can no longer outrank the phone APK.
- **Per-side bands:** per-side exercises keep their band chips and planned starting bands.
- **IPv6:** the web image listens on both IPv4 and IPv6, so a self-hosted install can be reached
  over either.
- **Warm-up effort:** with effort logging on, warm-up rows can hide their rating column; an opt-in
  can ask for a set's effort before ticking.
- **Weekly sets** can count main muscles only for the 10–20 range comparison.

## Fixes and polish

- Update downloads run in the background; the app asks Install or Later when ready and keeps a
  toast during a workout.
- The installer verifies the release checksum before opening it.
- Keyboard shortcuts: `?` for help, `/` to search the current screen, Escape to close a sheet.
- The cardio Rate it pill no longer touches the time row.
- The collapse action uses a chevron, not the finish tick, so the two actions read differently.
- The workout volume shows the language's weight unit.
- The Russian description for assisted exercises no longer loses the support wording.
- Explored equipment labels no longer capitalise every word.
- CI keeps the 25 locale packs in sync; pt-BR inheritance fingerprint updated.

## По-русски

Русское описание функций релиза. Оно повторяет английские разделы выше, чтобы обновление было
понятно без переключения на английский.

### Главное

- **Русский каталог упражнений:** названия приведены к проверенной таблице и странице CrossFit,
  у всех 5 632 упражнений есть русское описание.
- **Тренировка:** выбор, когда показывать следующее упражнение, полноэкранный таймер отдыха и
  отсчёт времени подхода кардио прямо во время выполнения.
- **Цели и поиск:** цель по весу на 3, 6 или 12 месяцев и фильтр упражнений по группам
  оборудования вместо десятков отдельных чипов.
- **AI-тренер и свой сервер:** пирамиды сохраняются в данных тренера и отпечатке плана; веб-образ
  слушает IPv4 и IPv6.
- **Мелочи:** суперсеты до четырёх упражнений, замена упражнения в программе, сворачивание
  подходов, переведённые периоды и единицы, горячие клавиши, обновление в фоне.

### Тренировка

- **Переход к следующему упражнению** в Настройки → Тренировка: выключено, после отдыха или
  сразу. При «сразу» отметка переходит на следующее упражнение, а отдых по прошлому продолжает
  идти. Старый переключатель читается как «после отдыха».
- **Полноэкранный таймер отдыха:** нажмите на часы отдыха, чтобы открыть большое кольцо с
  −15 с, паузой, +15 с и пропуском. Колесо времени открывается с больших часов, экран
  закрывается сам, когда отдых заканчивается.
- **Время кардио:** кнопка ▶ под полем скорости запускает прямой отсчёт. ■, отметка подхода или
  завершение тренировки записывают минуты так же, как если бы их ввели вручную. Отсчёт переживает
  перезагрузку и не учитывает паузы тренировки.
- **Сворачивание подходов** складывает только строки подходов; картинка, описание и меню остаются
  открытыми, отметки и анимация высоты сохраняются.
- **Суперсеты до четырёх упражнений:** можно добавить участника, убрать одного или расформировать
  группу; пятое упражнение отклоняется с сообщением. Круги и импортированные группы работают.
- **Замена в программе** из листа замены меняет и сегодняшнюю запись, и слот программы, сохраняя
  числа, группу суперсета и позицию.
- **Одно изменение веса:** в Настройки → Тренировка → Тонкая настройка можно отключить перенос
  нового веса на следующие подходы.
- **Пропуск выполненных упражнений** и кнопки «Следующее/Предыдущее» работают в карточном и
  фокусном видах.
- **Оценка длины тренировки** показывается в плане и предпросмотре старта по последним точным
  тренировкам, с запасным вариантом по плану.

### Русские названия, описания и интерфейс

- **5 632 названия упражнений** взяты из колонки «Ваше название» проверенной таблицы, 33 слота
  CrossFit взяты с листа CrossFit.
- **Имена собственные** сохраняют заглавные буквы: Смит, Скотт, Зоттман, Свенд, Поликвин, Паллоф,
  Арнольд, Жиронда и другие эпонимы.
- **Названия тренажёров** используют слово «тренажёр», а не «машина»; описания нормализованы для
  Смита, рычажного тренажёра, «с отягощением» и «петель для подвесных тренировок».
- **Полный русский пакет описаний:** переведены все 5 632 описания; под русским названием больше
  не показывается английский текст.
- **Строчные буквы в тегах и чипах:** «Рычажный тренажёр», «С отягощением», «Петли для подвесных
  тренировок», «Тяжёлая атлетика», «Всё тело»; заглавная только первая буква, кроме имён и
  аббревиатур.
- **Единицы:** цель читается как «Цель (кг)», вес упражнения как «кг»/«фунт», итог кардио как
  «23 мин @ 10,5 км/ч», полоса прогресса тренировки как «0 кг».
- **Периоды статистики:** «30 д», «90 д», «1 г» вместо `30d`, `90d`, `1Y`.

### Цели и поиск упражнений

- **Цели по весу:** у упражнения с повторами можно задать целевой вес и срок 3, 6 или 12 месяцев.
  Лист показывает дату, прогресс от лучшего подхода на момент постановки цели, статус и недельный
  прирост. Цели синхронизируются в профиле (`S.exGoals`).
- **Группы оборудования в обзоре:** собственный вес, свободные веса, штанги, тренажёры, блочные,
  резинки, мячи и ролики, кардиотренажёры, скамья и гриф, другое. Группа фильтрует по всем видам,
  шеврон раскрывает отдельные.
- **Чипы мышц и частей тела** используют то же правило строчных букв и сохраняют фильтр при смене
  части тела, если в новой есть упражнения.

### AI-тренер, синхронизация и свой сервер

- **Пирамиды в AI-тренере:** цели по подходам, отдых по подходам и запланированная нагрузка
  сохраняются в данных, проверке, обзоре и отпечатке плана; обзор не может «сплющить» пирамиду.
- **Свои названия упражнений** в данных тренера берутся из названий профиля.
- **Health Connect** получает измеренные образцы пульса рядом с тренировкой; versionCode
  приложения Wear больше не может обогнать versionCode телефона.
- **Резинки по сторонам:** упражнения на каждую сторону сохраняют чипы резинок и стартовые
  значения.
- **IPv6:** веб-образ слушает IPv4 и IPv6, поэтому свой сервер доступен по любому из них.
- **Усилие на разминке:** при включённом журнале усилий столбец оценки можно скрыть на разминочных
  подходах; можно включить вопрос об усилии до отметки подхода.
- **Недельные подходы** можно считать только по основным мышцам для сравнения с диапазоном 10–20.

### Исправления и мелочи

- Загрузка обновлений идёт в фоне: приложение предлагает «Установить» или «Позже» и показывает
  сообщение во время тренировки.
- Установщик проверяет контрольную сумму релиза до открытия файла.
- Горячие клавиши: `?` открывает справку, `/` переводит фокус в поиск текущего экрана, Escape
  закрывает лист.
- Плашка оценки кардио больше не касается строки времени.
- Сворачивание использует шеврон, а не галочку завершения, чтобы действия не путались.
- Объём тренировки показывает единицу веса текущего языка.
- Русское описание упражнений с поддержкой больше не теряет слова о поддержке.
- Названия оборудования в обзоре больше не пишут каждое слово с заглавной буквы.
- CI проверяет синхронность 25 языковых пакетов; отпечаток наследования pt-BR обновлён.

## Install

This is the **fork-signed Standard APK**, built from the `dagov42/openGym` tree on top of upstream
`v1.4.9`. It is signed with the same local fork key as the previous fork releases, so it installs
over them and keeps the data.

- If you are coming from the **official** openGym app, Android will refuse the APK because the
  signing key differs. Export a backup, uninstall the official app, install this APK and restore
  the backup.
- The APK has 180 px animations built in. Plus/HD variants are not part of this release.
- SHA-256: `1f3d890e14c16417061889d55344fe29fd27fff956dc4ca3df87ca3293e0980a`

## Verification

- Frontend: 948 test files, 10,543 passed, 11 skipped.
- API: 1,129 tests, 0 failures (5 skipped).
- CI on `8cbddc3cd`: success.
- `npm run verify` and the catalogue build check passed before packaging.
