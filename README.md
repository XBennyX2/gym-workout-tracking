# PEAK — Training Console

A single-page web app version of your 4-day Upper/Lower recomposition program: editable sets/reps/rest, an auto rest timer with audio + visual alerts, a workout stopwatch, per-exercise form-video lookup, a dedicated MMA day, and a daily mobility routine. Pure HTML/CSS/JS — no build step, no backend, no accounts.

## 1. Run it locally

No install needed. Two options:

**Just open it**
Double-click `index.html`. It works fully offline except for the embedded form-video player and Google Fonts, which need internet.

**Or serve it (recommended, avoids browser file:// restrictions)**
```bash
cd peak
python3 -m http.server 8000
# then open http://localhost:8000
```

## 2. How it works

- **Days**: 6 tabs — `D1` Upper Strength, `D2` Lower Strength, `D3` Mobility, `D4` Upper Hypertrophy, `D5` Lower Hypertrophy, `MMA`. Together D1–D5 hit every major muscle group twice a week; D3 and MMA are lower-impact skill/recovery days you can slot anywhere in your week.
- **Editing**: every exercise name, set count, rep target, and rest duration is a live input — just click and type. "+ Add exercise" appends a blank card to that day; "Remove" deletes one; "Reset day" restores that day's defaults.
- **Set tracking & rest timer**: tap a numbered circle to mark a set done. That exercise's rest duration automatically starts a countdown sheet at the bottom of the screen — circular progress ring, ±15s adjust, skip button, three-tone chime plus a full-screen flash when it ends (works even if your phone is on silent, since it's a screen flash, not a vibration).
- **Workout stopwatch**: "Start workout" begins a running clock for the session pinned above the tab bar; "End workout" stops it and confirms your total time.
- **Form videos**: "▶ Form video" on any card loads a real, non-hardcoded YouTube result for that exact exercise name inline — no broken links, no guessing which clip exists.
- **MMA day**: same card format — striking, clinch/takedowns, ground work, and a conditioning circuit, each with its own drilling video lookup and adjustable round timers.
- **Saving your edits**: this app intentionally does **not** use browser storage, so it behaves identically whether you open it locally, host it, or preview it anywhere. Use **Export plan** (top right) to download your customized program as a `.json` file, and **Import plan** to load it back in on any device/browser. Keep that file somewhere safe (Notes app, Drive, etc.) — export again whenever you make edits you want to keep.

## 3. Customize

- **Program data**: `js/data.js` holds every default exercise (name, sets, reps, rest, coaching cue, muscle, icon). Edit this file directly to change what loads on first visit — or just edit in the UI and export.
- **Colors/type**: `css/style.css`, top of file — CSS variables (`--power`, `--lime`, `--sky`, fonts) control the whole theme.
- **Icons**: `js/data.js` → `ICONS` object holds small inline SVGs per equipment category (barbell, dumbbell, bodyweight, bench, cable, stretch, glove). Add your own key/SVG and reference it from an exercise's `icon` field.
- **Rest chime**: generated in-browser with the Web Audio API (`js/app.js` → `beep()`), so there are no audio files to manage or replace.

## 4. Deploy for free

**GitHub Pages**
1. Create a new repo and push this `peak/` folder's contents to the repo root (`index.html` should be at the top level).
2. Repo → Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / `root`.
3. Your app is live at `https://<username>.github.io/<repo>/` within a minute or two.

**Vercel**
1. `npm i -g vercel` (or use the Vercel dashboard's "Import Project").
2. From inside the `peak/` folder: `vercel` → accept defaults (no framework/build step needed, it's static).
3. `vercel --prod` for the permanent URL.

**Netlify**
1. Drag-and-drop the `peak/` folder onto [app.netlify.com/drop](https://app.netlify.com/drop), or
2. `netlify deploy` from inside the folder via the Netlify CLI, then `netlify deploy --prod`.

No environment variables, API keys, or server needed for any of these — it's a static site.

## 5. File structure

```
peak/
├── index.html        # layout shell
├── css/
│   └── style.css      # design system + responsive rules
├── js/
│   ├── data.js         # default program content (edit here to change defaults)
│   └── app.js           # rendering, timers, editing, export/import
└── README.md
```
