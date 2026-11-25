# openGym 1.4.11

**Release date:** 25 November 2026  
**Version:** `1.4.11`  
**Android versionCode:** `20053`  
**APK:** `openGym-1.4.11.apk` (Standard, 180 px animations built in)

This release brings the club flow into the app: clubs live in the main Settings list, the editor
opens 2GIS or Yandex Maps, a card keeps its name, address, map link and locker, and a saved club
can be removed with the same swipe as a workout set. The Russian release notes are below the
English ones, as they are for every fork release.

- A gold challenge month now says “Отличные результаты. Ты достоен похвалы” for a male profile and
  “Ты достойна похвалы” for a female one, using Settings → About you. The old “Золотой месяц.
  Можно и поклониться” line is gone from the Home card and the widget.
- Gym reminder: a club can keep an optional locker number, and Home shows one card per saved
  club, titled with the club's own name. The locker row says just “Locker number”, carries one
  lock icon, and is editable directly on Home; that saves to the phone's gym config. The Check-in
  card keeps its own locker field as before. A pencil opens the club editor to correct its name.
- Gym reminder: a saved club can be removed by swiping its row in Settings → Your gyms, the same
  gesture as a workout set, with the usual confirmation.
- After saving a club added from Home, the editor returns to Home; added from Settings, it returns
  to Your gyms. It no longer drops back on the search page.
- Home shows an “Add a club” card while no club is saved, and Settings now has “Your gyms” in the
  main Training list rather than hiding the club list inside Reminders.
- A saved 2GIS or Yandex card labels the editor's map button with that app (“Open in 2GIS”,
  “Open in Yandex Maps”); Google Maps and Apple Maps remain the fallback.
- A 2GIS or Yandex card with a bare link leaves the gym name empty instead of borrowing another
  club's name; the editor opens fresh for each card, so a previous club's name cannot stick.
- Gym reminder: 2GIS and Yandex Maps buttons open the installed map app or its website at the
  current search. After copying a gym card there, Paste a gym card reads the name, address and
  point from the clipboard and opens the gym editor. No map API key is used. The editor now has an
  editable optional address and a map link, and keeps the link with the gym.
- Settings → About now has one donation link, YooMoney. The author's Buy Me a Coffee, Ko-fi and
  GitHub Sponsors buttons are gone. The link is still hidden in the Google Play build, where Play
  billing rules apply. Source code and NOTICE.md links point at the fork, not upstream.
- The workout header has a clock: a Timer that starts a countdown on the rest timer and a
  Stopwatch that only counts. The Timer remembers its last length; the running stopwatch shows in
  the header, and neither writes anything into the workout.
- History: Type a workout reads a session written as text, one exercise per line, matches names
  against your own exercises and aliases, and saves it through the same path as a past workout.
- Routine editor: a slot's Copy action puts the same exercise, with its sets, reps, weight, rest
  and backups, at the end of another routine. A superset link stays with the routine it came from.
- The profile push during a workout is gzipped, so a three-year profile goes up as about 92 KB
  instead of 816 KB per set. The server only unzips `PUT /api/data`, after its session check.
- A workout left quiet for 15 minutes lets the screen lock, and typing counts as activity. A
  running circuit clock keeps the screen awake as before.
- The Android rest card steps every 5 seconds while the app is in front instead of every second.
- A set tick reuses each finished workout's Health record and fingerprint instead of rebuilding
  the whole history.
- Signing out also removes this browser's push subscription, and Sign out everywhere clears every
  browser's.
- The Android rest countdown service goes foreground before it can stop itself, so a rest that
  ends during the start no longer kills the app.
- One profile's stuck webhook no longer holds up other profiles' deliveries.
- The Cloudflare Access token is retried once if the secure store is not ready at startup, instead
  of staying unsent until it is saved again.

### По-русски

- После золотого месяца фраза зависит от пола в профиле: «Отличные результаты. Ты достоен
  похвалы» или «Ты достойна похвалы». Старое «Золотой месяц. Можно и поклониться» убрано с
  главной и из виджета.
- У клуба появился необязательный номер шкафчика. Home показывает отдельную карточку на каждый
  клуб с его названием, номер редактируется прямо на главной; у Check-in карты остался свой номер.
- Зал можно удалить свайпом влево в «Настройки → Твои залы», как подход; перед удалением
  приложение спрашивает подтверждение.
- После сохранения зала, добавленного с Home, приложение возвращается на Home; из настроек в
  «Твои залы», а не на поиск.
- Если залов нет, Home показывает карточку «Добавить клуб». Список залов вынесен в общий раздел
  настроек «Твои залы», а не спрятан в «Напоминаниях».
- Кнопка карты называется по сохранённой ссылке: «Открыть в 2ГИС», «Открыть в Яндекс.Картах»,
  Google или Apple Maps.
- Если вставить только ссылку 2GIS или Яндекса, имя зала остаётся пустым: приложение не
  подставляет имя предыдущего клуба.
- 2GIS и Яндекс.Карты открываются установленным приложением или сайтом с текущим поиском.
  «Вставить карточку зала» читает имя, адрес и точку из буфера; адрес можно менять, ссылка на
  карту сохраняется. Платные API и ключи не используются.
- В «О приложении» осталась одна ссылка на поддержку, YooMoney. Кнопки Buy Me a Coffee, Ko-fi и
  GitHub Sponsors убраны; в сборке Google Play ссылка скрыта. Ссылки на исходники и NOTICE.md
  ведут на форк.
- В шапке тренировки появились таймер и секундомер. Таймер запускает обратный отсчёт отдыха и
  помнит длительность, секундомер только считает; в тренировку они ничего не пишут.
- История: «Ввести тренировку текстом» разбирает тренировку по строкам, ищет упражнения по своим
  названиям и алиасам и сохраняет её как прошлую.
- В редакторе программы действие «Копировать» переносит упражнение с подходами, повторами, весом,
  отдыхом и запасными в конец другой программы. Связь суперсета остаётся с исходной программой.
- Профиль во время тренировки отправляется сжатым: трёхлетний профиль занимает около 92 КБ вместо
  816 КБ на каждый подход. Сервер распаковывает только `PUT /api/data` после проверки сессии.
- Если тренировка молчит 15 минут, экран может заблокироваться; ввод текста считается активностью.
  Часы круга по-прежнему держат экран включённым.
- Карточка отдыха на Android обновляется раз в 5 секунд, пока приложение на экране, а не каждую
  секунду.
- Отметка подхода переиспользует запись Health и отпечаток завершённой тренировки, а не
  пересобирает всю историю.
- Выход из аккаунта удаляет push-подписку этого браузера, а «Выйти везде» очищает подписки всех
  браузеров.
- Служба обратного отсчёта на Android переходит в foreground до того, как остановить себя, поэтому
  отдых, закончившийся во время запуска, больше не закрывает приложение.
- Застрявший webhook одного профиля больше не задерживает доставку остальным.
- Токен Cloudflare Access повторяется один раз, если защищённое хранилище не готово при запуске,
  вместо того чтобы оставаться неотправленным до следующего сохранения.

## Install

This is the **fork-signed Standard APK**, built from the `dagov42/openGym` tree on top of upstream
`v1.4.10`. It is signed with the same local fork key as the previous fork releases, so it installs
over them and keeps the data.

- If you are coming from the **official** openGym app, Android will refuse the APK because the
  signing key differs. Export a backup, uninstall the official app, install this APK and restore
  the backup.
- The APK has 180 px animations built in. Plus/HD variants are not part of this release.
- SHA-256: `9747f767e1af99ae00e9d5657ed6016d61e3b1b17905f91577989a89cf7541a6`

> **Updated 25 November 2026:** the APK and its checksums were replaced to include the fix for a
> Yandex card that has an address but no coordinates. The version stays 1.4.11.

## Verification

- Frontend: 960 test files, 10,637 passed, 11 skipped.
- API: 1,135 tests, 0 failures (5 skipped).
- CI on `724c0ad65`: success.
