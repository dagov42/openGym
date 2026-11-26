# Cardio timer: stop from the Lock Screen

Status: superseded 2026-11-26 by `2026-11-26-cardio-block-design.md` (A1: one cardio block
inside the existing workout notification). The separate cardio notification described here was
removed from the product direction; the file remains as history of the rejected approach.

## Why

The cardio set counts up while the phone is in a pocket or the screen is locked. A runner who
stops has to unlock the phone, open openGym and hit the square, and the seconds spent doing that
land in the set. The stop itself should be one tap on the Lock Screen, and the recorded time
should be when the finger stopped, not when the phone was unlocked.

## Behaviour

- Starting a cardio clock posts an ongoing notification on the `cardio-timer` channel: title
  "Cardio timer", the exercise name, and one **Stop** action.
- The notification is visible on the Lock Screen (`VISIBILITY_PUBLIC`), has no sound and no
  vibration, and opens the app when its body is tapped. It uses an `IMPORTANCE_DEFAULT` channel
  (`cardio-timer-v2`) and a `RemoteViews` card with its own Stop button: MIUI hid a standard
  notification action on the earlier low-importance ongoing card.
- Tapping **Stop** does not open the app. It stores `startedAt` and `stopAt` in a small
  device-only preference, and replaces the notification with "Cardio stopped" at that time.
- The page checks `consumeStop` when it comes back to the foreground (and on a cold start once the
  workout is loaded). When the stored `startedAt` matches the clock's run, it calls the normal
  `useCardioClock.stop(stopAt)`, so the minutes come from the exact stop instant and the usual
  rounding and speed settle apply. A mismatch is left for the in-app clock and consumes nothing.
- Stopping in the app, dropping the run or finishing the workout clears the notification and the
  stored stop.
- Logging the current cardio set from the workout card while its timer runs carries the elapsed
  minutes into the `setDone` event (`min`), so the row is not saved with no time. The workout
  card's `min`/seconds text goes through the page language (`{0} min`, `{0} s`), not a hardcoded
  English `min`.
- The web and iOS call the same JS functions, which fall back to a no-op when the native plugin
  is not there; their cardio clock is unchanged.

## Native files

- `frontend/android/app/src/main/java/ch/duartesantos/opengym/CardioTimer.java` — preferences,
  channel, notification and actions.
- `CardioTimerReceiver.java` — the Lock Screen **Stop** broadcast.
- `CardioTimerPlugin.java` — `start({ startedAt, label })`, `stop()`, `consumeStop()`.
- `MainActivity` registers the plugin; the manifest declares the receiver.

## Limits

- No foreground service: the ongoing notification is enough for the stop action, and the page
  already keeps the run in `localStorage` across a reload.
- A stop tapped while the app process is dead is saved by the receiver and applied at the next
  cold start.
- The notification uses the app's existing notification permission; if notifications are off,
  the in-app stop is unchanged.
