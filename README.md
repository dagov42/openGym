<div align="center">

<p>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/hero-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="assets/readme/hero-light.png">
  <img src="assets/readme/hero-dark.png" alt="openGym: the gym tracker you host yourself" width="100%">
</picture>
</p>

<a href="https://github.com/dagov42/openGym/stargazers"><img src="https://img.shields.io/github/stars/dagov42/openGym?logo=github&logoColor=white&label=stars&style=flat-square&labelColor=0c0e12&color=a3e635" alt="Stars"></a>
<a href="https://github.com/dagov42/openGym/releases"><img src="https://img.shields.io/github/v/release/dagov42/openGym?label=release&style=flat-square&labelColor=0c0e12&color=a3e635" alt="Release"></a>
<a href="https://github.com/dagov42/openGym/releases"><img src="https://img.shields.io/github/downloads/dagov42/openGym/total?label=downloads&style=flat-square&labelColor=0c0e12&color=a3e635" alt="Downloads"></a>
<a href="https://github.com/dagov42/openGym/actions/workflows/test.yml"><img src="https://img.shields.io/github/actions/workflow/status/dagov42/openGym/test.yml?branch=main&label=tests&style=flat-square&labelColor=0c0e12&color=a3e635" alt="Tests"></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-a3e635?style=flat-square&labelColor=0c0e12&color=a3e635" alt="AGPL-3.0"></a>

<a href="https://github.com/dagov42/openGym/releases/latest"><img src="assets/readme/badge-android.svg" alt="Download the Android APK" height="40"></a>
<a href="docs/SELF_HOSTING.md"><img src="assets/readme/badge-selfhost.svg" alt="Self-host with Docker" height="40"></a>

[Releases](https://github.com/dagov42/openGym/releases) · [Fork roadmap](FORK_ROADMAP.md) · [Changelog](CHANGELOG.md) · [Self-hosting](docs/SELF_HOSTING.md)

</div>

> **This is a fork.** `dagov42/openGym` is a personal fork of
> [DuarteSantos8/openGym](https://github.com/DuarteSantos8/openGym), built and released by its
> maintainer. Releases here are the fork's own APKs, not the upstream store apps. Upstream remains
> the original project and keeps its own website, stores, community spaces and sponsors.
>
> This fork does not collect donations, sponsorship or payments. It has no paid tier and no paid
> support.

## Why openGym

Most workout apps keep your data on their servers, push you towards a subscription, or vanish
when the company does. openGym runs on your own box, keeps your data in a folder you control, and
is yours to fork. It still behaves like a modern app: installable on the home screen, passkey
sign-in, works offline, syncs between your phone and your laptop.

No account on someone else's server, no subscription, no ads, no telemetry. One
`docker compose up` and it's running.

The upstream project has a public demo at <https://opengym.ch/demo/>; this fork does not host a
separate one. Run it locally from the quick start below to try it.

## Features

**Planning**

- A routine per weekday over a library of **over 5,600 exercises** with animated demos, searchable and
  browsable by muscle on a body map. Filter by the equipment you own.
- Four starter plans (Push/Pull/Legs, Upper/Lower, Full Body, 5×5) that load as ordinary,
  editable routines.
- Every session on the Plan page and today's on Home carries a tiny body map with the muscles it
  works lit up, so you know Leg Day is legs before you open it.
- Move a session to another day without touching the weekly plan. The week starts on Monday,
  Sunday or Saturday, your choice.
- Or skip the weekdays altogether: a **rotation** (A, B, C, A, ...) where the next session is
  simply the next one you haven't done, however the week went.
- Supersets, warm-up sets, drop sets and rest-pause, timed exercises (planks, hangs, carries),
  cardio by time and speed, rest time per exercise, planned deloads.
- Your own exercises, with your own photo, GIF or short video. Location data is stripped on the
  device before upload.

**Training**

- Guided sessions: today's workout starts itself, weights are pre-filled from last time, a rest
  timer runs between sets, PRs are detected as you go. On a rest day it tells you when the next
  session is.
- A quiet workout screen: one menu per exercise, the set number as the set's own menu, card or
  list view. Switches in Settings bring the old button rows back if you liked them.
- Optional effort column as RIR or RPE, colour-coded, with a plain-language line per level.
- Plate math for barbell, EZ bar, trap bar and Smith machine, worked out from the plates you own.
  Train in more than one place? Each gym keeps its own plates, dumbbells, bars and machine stacks,
  and the phone can switch to the gym you just walked into.
- Bodyweight exercises know they carry no load: log reps, add a dip belt if you use one.
- Per-side reps for lunges and single-arm work, the screen stays awake while you train, and a
  rest-timer alert can flash the screen for loud gyms.
- Swipe a set left to delete it (with Undo) or right to copy it. Pyramid sets with their own reps
  and rest per set, and a scroll wheel for any rest time up to 15 minutes, or no timer at all.
- Machine taken? A planned backup exercise swaps in with one tap and keeps the slot's sets and reps.
  Machines can carry their real weight stack, odd steps included, and progression sticks to it.
- The session's volume runs live at the end of the progress bar.

**Progress**

- Progression rules per routine or per exercise: linear, Greyskull LP, double progression through a
  visible rep range, triple progression (reps, then sets, then load), or adding time. Each target explains why it is that number; missed reps never
  add load, stalls trigger a deload.
- Estimated 1RM per exercise with its own curve, Structural Balance ratios (Poliquin, Thibaudeau,
  ATG), a year-long activity heatmap.
- A muscle map in three modes: where your volume went, what is still recovering, and what has gone
  untrained.
- Body-weight chart against a goal line, with your weekly rate and an optional lose, gain or hold
  range, and progress photos on a timeline with a before/after slider.
- Lifts as a percentage of body weight, and a running total of everything you've ever lifted.
- Edit any saved workout after the fact, log one you did on paper, or move it to the right date.
  Records are re-read from the corrected history.

**Accounts and data**

- Passkeys (Face ID, Touch ID, fingerprint) with per-profile data synced across devices. Password
  sign-in can be switched on per instance; new devices pair with a one-time code or QR.
- Two devices editing at once merge field by field instead of overwriting each other (see
  [sync](#how-sync-works)).
- Import from FitNotes, Strong, Hevy (CSV or API key), Anneal and Apple Health weight exports. Export
  everything as one JSON file, or your workouts and body data as a spreadsheet (CSV).
- Share a plan as a small file or print it as a PDF.
- Optional admin dashboard with invite-only signup and an activity log.
- 26 languages, including right-to-left Arabic and Persian, and Traditional Chinese. Exercise names and
  instructions are translated for most of them.

**On the phone**

- The Android app from this fork works on its own (no server, no account) or connected to yours.
  Rest timer in the notification shade, reminders, and Health Connect in both directions:
  workouts go out, weigh-ins and heart rate per set come back in.
- A gym reminder, off by default: walk into one of your gyms and the phone nudges you to hit
  Start. Once a day at most, never after you trained, and your gyms stay on the phone.
- The codebase also carries the upstream iPhone, iPad, Apple Watch, widget and Wear OS work, but this
  fork publishes no iOS, watch or store builds. Those come from upstream, not from here.

**Only what you use**

- [Modules](docs/MODULES.md): switch whole parts of the app on and off in Settings → Modules, from
  "Just training" to "Everything". Body, Health, Motivation, the Coach, seasonal themes and more
  each disappear completely while they're off, and nothing is deleted.

**Optional extras, off by default**

- An [AI coach](docs/AI_COACH.md) that drafts a week of routines and later suggests changes based on
  what you logged, and answers questions about your training. You approve every change. It runs
  on your server, or on the phone alone, with your own provider key (Anthropic, OpenAI, Gemini or
  any OpenAI-compatible endpoint, Ollama included).
- An [MCP server](mcp/README.md) so an assistant like Claude Desktop can answer questions about your
  training history, and log a workout you describe to it. Local; not part of the Docker build.
- [Integrations](docs/INTEGRATIONS.md) in one place: Apple Health, Health Connect (Garmin, Fitbit,
  Withings and friends come in through them), imports, and signed webhooks to Home Assistant, n8n or
  ntfy when you finish a workout, set a record or weigh in.

The full list of what changed release by release is in the [changelog](CHANGELOG.md).

## Quick start

You need [Docker](https://docs.docker.com/get-docker/) with Compose.

```bash
git clone https://github.com/dagov42/openGym
cd openGym
cp .env.example .env
docker compose pull      # prebuilt images, amd64 + arm64 (skip this to build from source)
docker compose up -d
```

Open <http://localhost:8080>, tap **Create profile**, and you're in. The exercise animations are
part of the image, so there's nothing else to download.

To reach it from your phone with passkeys you need HTTPS on a domain; that's a two-line change in
`.env`. The [self-hosting guide](docs/SELF_HOSTING.md) walks through Cloudflare Tunnel, Caddy,
Traefik and nginx, and there are separate guides for
[HTTPS on a LAN](docs/SELF_HOSTING_HTTPS.md), [a Mac with Tailscale](docs/SELF_HOSTING_MAC.md) and [Kubernetes](docs/SELF_HOSTING_KUBERNETES.md).

> [!NOTE]
> Images are published from this fork's release tags to
> `ghcr.io/dagov42/opengym-{api,web}` (what `docker-compose.yml` pulls). Run
> `docker compose up -d --build` to build locally without a registry. Either way you don't need
> Node on the host.

<details>
<summary><b>Configuration reference</b> (all through <code>.env</code>)</summary>

| Variable | What it does | Default |
|---|---|---|
| `RP_ID` | Hostname passkeys are bound to | `localhost` |
| `ORIGIN` | Full URL the app is served from | `http://localhost:8080` |
| `WEB_PORT` | Host port for the web UI | `8080` |
| `NGINX_PORT` | Port the web container listens on inside the container | `80` |
| `BACKEND` | Name of the API service that `/api` is proxied to | `api` |
| `PORT` | Port the API listens on; the web container proxies to the same value | `3000` |
| `RP_NAME` | Name shown in the passkey prompt | `openGym` |
| `SESSION_DAYS` | How long a sign-in lasts, in days | `90` |
| `ADMIN_UIDS` | User ids that get the admin dashboard, comma-separated | *(none)* |
| `FIRST_USER_ADMIN` | `1`: the first profile created on an empty instance becomes its admin | *(off)* |
| `INVITE_ONLY` | Require an invite code to create a profile | *(off)* |
| `ALLOW_GUEST` | Offer "Continue without account"; `0` requires a profile | *(on)* |
| `PASSWORD_LOGIN` | Offer name-and-password sign-in next to passkeys | *(off)* |
| `TRUST_PROXY` | Let the sign-in throttle read the client address from proxy headers | `1` in `docker-compose.yml` |
| `AUDIT_LOG` | Record sign-ins and admin actions; `0` records nothing | *(on)* |
| `AUDIT_MAX` | Events kept in the activity log; `0` for no limit | `5000` |
| `AUDIT_DAYS` | Days kept in the activity log; `0` keeps until `AUDIT_MAX` | `90` |
| `AUDIT_IP` | Record the caller's address: `off`, `net` (network only) or `full` | `off` |
| `ALLOWED_PRIVATE_IPS` | Private addresses push endpoints may resolve to (FakeDNS, split-horizon DNS): comma-separated IPs, `a-b` ranges or CIDR blocks | *(none)* |
| `INTEGRATIONS` | Server integrations to offer, comma-separated: `webhook` ([integrations](docs/INTEGRATIONS.md)) | *(none)* |
| `INTEGRATIONS_ALLOW_LAN` | `1`: webhooks may reach your home network (Home Assistant), http included; never loopback | *(off)* |
| `VAPID_SUBJECT` | Contact URL sent with push notifications | your `ORIGIN` |
| `API_TARGET` | API image to build: `default`, or `coach` with the Claude Agent SDK and Codex CLI | `default` |
| `COACH_DISABLED` | `1` forces the AI coach off instance-wide | *(unset)* |
| `COACH_EFFORT` | Effort level for the Claude (Anthropic) Coach provider: `low`, `medium`, `high`, `xhigh` or `max` | the model's default |

Push-notification keys are generated on first run into `./data/vapid.json`. `DATA_DIR` is pinned to
`/data` inside the container and mapped to `./data` on the host; change the volume, not the
variable. The [self-hosting guide](docs/SELF_HOSTING.md) covers every option in detail.

</details>

## Phone app

The same codebase builds the phone apps with Capacitor. This fork publishes **Android APKs only**;
it has no App Store, Google Play, F-Droid or watch release of its own.

| | Get it |
|---|---|
| **Android** | The signed **Standard** APK (`openGym-X.Y.Z.apk`, animations at 180 px, about 229 MB) from the [fork's latest release](https://github.com/dagov42/openGym/releases/latest). It updates itself. There is no Plus or HD APK in this fork. |
| **iPhone, iPad, Apple Watch, Wear OS, Google Play, F-Droid** | Not published by this fork. The [upstream project](https://github.com/DuarteSantos8/openGym) maintains its own store releases; those are not this fork's builds. |

Every APK sits next to its `.sha256`, and the release also carries `SHA256SUMS` with a GPG
signature. The fork signs its APK with its own Android key, **not the upstream key**: a phone on an
older upstream APK has to back up, uninstall that app, and install this one, because Android will
not replace a differently signed package. Details, building it yourself and connecting to your
server: [docs/MOBILE.md](docs/MOBILE.md).

## How it works

<p align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/diagrams/architecture-dark.png">
  <img src="docs/diagrams/architecture.png" alt="Architecture: the phone talks HTTPS to nginx (web), which serves the app and proxies /api to the Node api; the api stores JSON in ./data. The exercise media ship inside the web image; the AI coach and MCP server are optional." width="520">
</picture>
</p>

- **`frontend/`** is React 19 and Vite (React Router, Zustand), built to static files inside Docker.
- **`api/`** is plain `node:http` with three dependencies: `@simplewebauthn/server` for passkeys,
  `web-push` for notifications and `undici` for the AI coach's provider calls. Everything is
  stored as JSON under `./data`.
- **`web/`** builds the frontend and serves it with nginx, proxying `/api` so the whole app sits on
  one origin, which passkeys require.

The [architecture overview](docs/ARCHITECTURE.md) has the longer version, with diagrams of the
frontend, sync, the exercise media and the watch.

The training logic (progression rules, 1RM, how a logged session is read back) lives in pure
functions under `frontend/src/lib/` with tests beside them. The HTTP API is documented as an
OpenAPI spec in [`api/openapi.yaml`](api/openapi.yaml).

### How sync works

Each profile's data is one document with a server revision. A device sends the revision it last
saw along with its changes; if another device wrote in between, the server refuses and returns the
current document so the device can merge and retry. Every change carries its own stamp, down to a
single setting or routine field, so the merge keeps the newest edit of each one and a deletion stays
deleted.

<p align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/diagrams/sync-dark.png">
  <img src="docs/diagrams/sync.png" alt="Sync: a device saves with the revision it last saw; if another device wrote in between, the server answers 409 with the current document, the device merges and saves again." width="560">
</picture>
</p>

Nothing that hasn't reached the server is discarded on disconnect or sign-out, and the app shows a
banner whenever it's working offline.

### Your data

Everything lives in `./data` on your host:

| File | Contents |
|---|---|
| `db.json` | Profiles and public passkey data |
| `db.json.bak` | A copy of the last good `db.json`, used if the main file can't be read |
| `state-<user>.json` | Each user's plan, workouts, body weight and settings |
| `audit.log` | Admin activity log (no IP addresses unless you turn that on) |
| `secret` | Session-cookie signing key |

Back up `./data` and you've backed up everything. Passkey private keys never reach the server; they
stay in your phone's secure hardware or your password manager.

## Documentation

The [documentation index](docs/README.md) sorts every guide by who it's for. The most used ones:

| I want to | Read |
|---|---|
| Get a quick answer | [FAQ](docs/FAQ.md) |
| Set up my own instance | [Self-hosting](docs/SELF_HOSTING.md) |
| Use the Android app | [Phone app](docs/MOBILE.md) |
| Bring my history from another app | [Importing data](docs/DATA_IMPORTS.md) |
| Turn on the AI coach | [AI coach](docs/AI_COACH.md) |
| Contribute code | [Contributing](CONTRIBUTING.md) |
| Report a security problem | [Security](SECURITY.md) |

## Roadmap

The fork's plan is in [FORK_ROADMAP.md](FORK_ROADMAP.md); its releases are on the
[fork's releases page](https://github.com/dagov42/openGym/releases). Upstream's own roadmap is not
this fork's plan.

| Release | When | Theme |
|---|---|---|
| v1.4.6 | Nov 2026 | Fork release based on this codebase; Android key changed after it |
| v1.4.8.1 | 17 Nov 2026 | Update check refresh and four-part version comparison |
| v1.4.9 | 18 Nov 2026 | History search, What's new, recent routines, Save to device |
| v1.4.10 | next | Background update download, keyboard shortcuts, session length, Collapse sets |

## Community

- **[Issues in this fork](https://github.com/dagov42/openGym/issues)** for reproducible bugs and
  fork-specific requests. Login trouble is almost always an `RP_ID`/`ORIGIN` mismatch; the
  [self-hosting guide](docs/SELF_HOSTING.md) covers it.
- **[Pull requests in this fork](https://github.com/dagov42/openGym/pulls)** are welcome; start with
  [CONTRIBUTING.md](CONTRIBUTING.md).
- The upstream [Discord, Discussions and Issues](https://github.com/DuarteSantos8/openGym) belong to
  upstream, not to this fork. Use them for the original project or for upstream releases.

### Where the code lives

This fork lives on GitHub at [dagov42/openGym](https://github.com/dagov42/openGym). Its history comes
from [DuarteSantos8/openGym](https://github.com/DuarteSantos8/openGym); upstream remains the original
project. The fork's releases are built and signed here, and its changelog is [CHANGELOG.md](CHANGELOG.md);
the detailed fork history is [FORK_CHANGELOG.md](FORK_CHANGELOG.md).

## How openGym is built

People have asked about this, so plainly: **openGym is developed with
[Claude Code](https://claude.com/claude-code)**, Anthropic's coding agent. A large share of the
code, tests and documentation is drafted in Claude Code sessions, and the repository carries a
[`CLAUDE.md`](CLAUDE.md) with the project context those sessions start from.

What that does and doesn't mean:

- **A person decides and ships.** What goes in, what gets reviewed and merged, and every release
  are the maintainer's call. Changes are tested on a staging instance and on real phones before
  they are tagged.
- **Tests hold the logic in place.** The training logic is covered by unit tests, and pull requests
  run the frontend, API and MCP suites in CI. That is the guard against plausible-looking code
  that is wrong, whoever or whatever wrote it.
- **The app itself doesn't need an LLM.** Nothing in a default install calls an AI service. The AI
  coach and the MCP server are opt-in, and the coach only talks to the provider you configure, with
  your own key.

Community pull requests are written by their authors, with whatever tools they like, and reviewed
the same way.

## License

**openGym's own code** is licensed under the [GNU AGPL v3.0](LICENSE). You can self-host, use,
modify and share it; if you run a modified version as a network service, you have to offer that
version's source under the same license.

> [!IMPORTANT]
> **The exercise media is not covered by that license.** The stills and animations are
> © Aliaksandr Makatserchyk, [Gym visual](https://gymvisual.com/), licensed for use in openGym only:
> 180 px in this repository and on self-hosted servers, larger only inside the app packages. A
> non-commercial fork may keep them unmodified with the notice; anything else needs your own licence
> from gymvisual.com. The exercise text in `catalogue/` is openGym's and open to contributions.

**Contributing:** pull requests are signed off once with the [Contributor License Agreement](CLA.md):
you keep the copyright in your work, openGym may use and relicense it, and every version released
under the AGPL stays AGPL.

**This fork** keeps the upstream AGPL license and notices. Copyright in the original code remains
with the upstream authors; the fork's own changes are maintained by `dagov42`. The exercise-media
licence above is unchanged: no larger media is added to this repository, and this fork publishes no
Plus or HD APK.

Full third-party notices, including the body-diagram geometry, are in [NOTICE.md](NOTICE.md).
