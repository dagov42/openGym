# Cardio records and pace trends

Status: candidate, designed 2026-11-16. Open questions at the end must be answered before an implementation
plan. Nothing implemented.

## Why

Strength has records, 1RM curves and per-exercise progress. Cardio has weekly goals (`cardio-goals.js`) and a
weekly bar (`components/CardioWeek.jsx`), but no answer to "what is my best 5 km?" or "am I getting faster at
the same effort?". The data is already stored: cardio sets carry minutes, speed, distance and incline, and
activities imported from Health/Strava carry minutes and kilometres.

## Goals

1. A "Cardio records" card or sheet in Stats, only when there is cardio data.
2. Per sport: longest duration, longest distance, and the best average pace for a session above a minimum
   distance (so a 400 m sprint does not beat a 10 km run).
3. A simple pace trend for the main sports over the last 12 weeks.
4. Honest labels: these are session records, not chip-timed 5 km PRs.
5. No new profile field and no server call; computed from the history.

## Non-goals

- True best-effort splits (fastest 5 km inside a 10 km run): the app stores totals, not per-second samples.
- GPS maps, elevation profiles, cadence, power or VO2max.
- Heart-rate zone time (the watch shows live zones; the stored HR is per set/session, not a series).
- A training-plan or race predictor.
- Replacing the existing weekly cardio goals.

## Data

- Activities (`S.activities`, `frontend/src/lib/activities.js`): `{ d, sport, min, km, at, title, src }` from
  Health/Health Connect, Strava through Health, an import or by hand.
- Workout cardio entries: `isCardio(entry.id)` sets with `min`, `speed`, `km`/`m`, `incline`; a session's
  cardio minutes/distance come from `entryCardio`/`cardioMinOf`.
- Sport kinds: reuse `cardio-kind.js` / `cardio-goals.js` `kindOfEntry`, `kindOfSport` (`run`, `ride`, `swim`,
  `walk`, `hike`, `row`, `elliptical`, `stairs`, `rope`, `ski`).
- Heart rate, if present: `w.hr` and `s.hr` (`{ avg, max, src, n }`). Not used in v1 records; available for a
  later "pace at effort" line.

## Records

Per sport, over all history:

- **Longest duration:** the largest `min` of one session (activity or the sum of the workout's cardio sets for
  that kind). A workout with two cardio exercises of the same kind sums them.
- **Longest distance:** the largest `km` (converted from `m`/`mi` at read time; always stored in km).
- **Best average pace:** among sessions with `km >= MIN_KM[kind]` and `min > 0`:
  - run/walk/hike: 3 km;
  - ride: 10 km;
  - row: 2 km;
  - swim: 0.5 km (shown as min/100 m);
  - elliptical/ski: only when the session carries a distance; no record from minutes alone;
  - stairs/rope: no distance record (distance means nothing for them).
  Pace = `min / km` in min/km (or min/mi in imperial), shown with the app's existing pace formatter.
- Ties: the most recent session wins; the record line names the date.
- A record only shows once there is at least one qualifying session for that sport.

## Where it shows

- Stats, in the cardio area near the weekly goals: a **Records** button opening a sheet (or an inline card
  with the top three) grouped by sport: `Longest run 14.2 km · 12 Oct`, `Fastest 5 km+ run 5:12 /km · 3 Nov`,
  `Longest ride 42 km · 2 Nov`.
- A 12-week pace trend (a single line per sport with enough sessions) in the same sheet, using the existing
  `LineChart`.
- Nothing on Home, the watch or the share card in v1.

## Edge cases

- Treadmill vs outdoor: both count; the treadmill's incline is ignored in the pace.
- Imported activities with `src: 'hc'|'ah'|'strava'|'import'` count the same; a duplicate (the same run
  imported twice with different ids) is a data problem, not solved here.
- A workout with a run and a ride: each kind gets its own total; the combined session is not one record.
- A swim logged in metres: converted to km; the pace is shown per 100 m.
- Imperial profiles: the record is stored in km and shown in mi/min; the trend follows the profile's unit.
- No HR: records still work; the v1 does not require it.
- Zero-minute or zero-distance rows are ignored.
- A workout's cardio set with distance but no minutes, or minutes but no distance, contributes only where the
  record needs that field.

## Tests

- Each record picks the right session; the minimum distance excludes short efforts; ties pick the latest.
- Unit conversion (km/mi, swim m/yd) and the picture in the sheet.
- Workout sets vs activities; two cardio exercises of one kind summed; a combined session split by kind.
- No data: no card; one sport only: only that sport.
- A 12-week trend with gaps (weeks without sessions are gaps, not zeros).

## Open questions

1. **Which records:** duration, distance, best pace (proposed). Add "best pace at a heart-rate band" later,
   when there is enough HR data to avoid noise.
2. **Thresholds:** the minimum distances are a guess; they should be constants at the top of the module and
   easy to tune. Proposal: start with the values above.
3. **Placement:** a sheet from the Stats cardio area (proposed) or a full card? Proposal: a sheet; Stats is
   already crowded.
4. **Activities vs workout sets:** count both (proposed). A user who logs runs only in Health still gets
   records.
