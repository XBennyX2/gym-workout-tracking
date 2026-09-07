/* ==========================================================================
   PEAK — app.js
  Lightweight local persistence for workout history and streaks.
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEYS = {
    users: "peak-users-v2",
    currentUser: "peak-current-user-v2",
    program: "peak-program",
    logs: "peak-workout-logs",
    body: "peak-bodyweight",
    streak: "peak-workout-streak",
  };

  const state = {
    user: null,
    plan: structuredClone(DEFAULT_PROGRAM),
    activeDay: DEFAULT_PROGRAM.days[0].id,
    timeline: { month: 1, week: 1 },
    session: { running: false, paused: false, seconds: 0, timerId: null, dayId: null, exerciseIndex: 0, setIndex: 0, phase: "exercise", phaseRemaining: 0 },
    rest: { running: false, remaining: 0, total: 0, timerId: null, label: "" },
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function getUserProfiles() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.users) || "[]");
    } catch (error) {
      return [];
    }
  }

  function saveUserProfiles(profiles) {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(profiles));
  }

  function getCurrentUser() {
    const userId = localStorage.getItem(STORAGE_KEYS.currentUser);
    const profiles = getUserProfiles();
    if (!userId) return null;
    return profiles.find((user) => user.id === userId) || null;
  }

  function makeUserProfile(name) {
    const base = String(name || "").trim();
    if (!base) return null;
    const profiles = getUserProfiles();
    const existing = profiles.find((user) => user.name.toLowerCase() === base.toLowerCase());
    if (existing) return existing;
    const user = { id: `user-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, name: base };
    profiles.push(user);
    saveUserProfiles(profiles);
    return user;
  }

  function loginUser(name) {
    const user = makeUserProfile(name);
    if (!user) return false;
    state.user = user;
    localStorage.setItem(STORAGE_KEYS.currentUser, user.id);
    state.plan = loadProgram();
    state.activeDay = state.plan.days[0]?.id || DEFAULT_PROGRAM.days[0].id;
    renderAuthControls();
    renderNav();
    renderDay();
    return true;
  }

  function logoutUser() {
    state.user = null;
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    state.plan = structuredClone(DEFAULT_PROGRAM);
    state.activeDay = DEFAULT_PROGRAM.days[0].id;
    renderAuthControls();
    renderNav();
    renderDay();
    showToast("Logged out. Enter a name to continue.");
  }

  function getUserStorageKey(name) {
    return `${name}-${state.user?.id || "guest"}`;
  }

  function loadProgram() {
    try {
      const userId = state.user?.id || localStorage.getItem(STORAGE_KEYS.currentUser);
      if (!userId) return structuredClone(DEFAULT_PROGRAM);
      const raw = localStorage.getItem(`${STORAGE_KEYS.program}-${userId}`);
      if (!raw) return structuredClone(DEFAULT_PROGRAM);
      const parsed = JSON.parse(raw);
      return normalizeProgram(parsed);
    } catch (error) {
      return structuredClone(DEFAULT_PROGRAM);
    }
  }

  function normalizeProgram(plan) {
    const baseline = structuredClone(DEFAULT_PROGRAM);
    if (!plan || !Array.isArray(plan.days)) return baseline;
    return {
      ...baseline,
      ...plan,
      days: plan.days.map((day, dayIndex) => ({
        ...(baseline.days[dayIndex] || {}),
        ...day,
        exercises: Array.isArray(day.exercises)
          ? day.exercises.map((exercise) => ({
              id: exercise.id || `${day.id}-exercise-${Math.random().toString(16).slice(2)}`,
              name: exercise.name || "Exercise",
              sets: Number(exercise.sets) || 1,
              reps: exercise.reps || "8-12",
              rest: Number(exercise.rest) || 60,
              duration: Number(exercise.duration) || 45,
              icon: exercise.icon || "bodyweight",
              cue: exercise.cue || "",
              muscle: exercise.muscle || exercise.primaryMuscles || "General",
              category: exercise.category || day.category,
              equipment: exercise.equipment || "Bodyweight",
              type: exercise.type || "Strength",
              notes: exercise.notes || "",
              optional: Boolean(exercise.optional),
              logs: Array.isArray(exercise.logs) ? exercise.logs : [],
              skillWork: exercise.skillWork || null,
            }))
          : [],
      })),
    };
  }

  function persistPlan() {
    const userId = state.user?.id || localStorage.getItem(STORAGE_KEYS.currentUser);
    if (!userId) return;
    localStorage.setItem(`${STORAGE_KEYS.program}-${userId}`, JSON.stringify(state.plan));
  }

  function getWorkoutLogs() {
    try {
      const userId = state.user?.id || localStorage.getItem(STORAGE_KEYS.currentUser);
      if (!userId) return [];
      return JSON.parse(localStorage.getItem(`${STORAGE_KEYS.logs}-${userId}`) || "[]");
    } catch (error) {
      return [];
    }
  }

  function setWorkoutLogs(logs) {
    const userId = state.user?.id || localStorage.getItem(STORAGE_KEYS.currentUser);
    if (!userId) return;
    localStorage.setItem(`${STORAGE_KEYS.logs}-${userId}`, JSON.stringify(logs));
  }

  function getBodyweightEntries() {
    try {
      const userId = state.user?.id || localStorage.getItem(STORAGE_KEYS.currentUser);
      if (!userId) return [];
      return JSON.parse(localStorage.getItem(`${STORAGE_KEYS.body}-${userId}`) || "[]");
    } catch (error) {
      return [];
    }
  }

  function setBodyweightEntries(entries) {
    const userId = state.user?.id || localStorage.getItem(STORAGE_KEYS.currentUser);
    if (!userId) return;
    localStorage.setItem(`${STORAGE_KEYS.body}-${userId}`, JSON.stringify(entries));
  }

  function findDay(dayId) {
    return state.plan.days.find((d) => d.id === dayId) || state.plan.days[0];
  }

  function findExercise(dayId, exId) {
    const day = findDay(dayId);
    return day.exercises.find((ex) => ex.id === exId);
  }

  function escapeAttr(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function parseRepRange(repRange) {
    const normalized = String(repRange || "8-12").replace(/[–—]/g, "-");
    const match = normalized.match(/(\d+)\s*-\s*(\d+)/i) || normalized.match(/(\d+)\s*to\s*(\d+)/i);
    if (!match) {
      const single = Number(String(normalized).match(/\d+/)?.[0] || 0);
      return { min: single, max: single, isSingle: true };
    }
    return { min: Number(match[1]), max: Number(match[2]), isSingle: false };
  }

  function getLatestExerciseLog(exerciseName) {
    const logs = getWorkoutLogs();
    return logs.find((log) => log.exerciseName === exerciseName) || null;
  }

  function suggestWeight(exercise) {
    const previous = getLatestExerciseLog(exercise.name);
    if (!previous || !Array.isArray(previous.sets) || previous.sets.length === 0) {
      return {
        text: "No performance recorded yet. Start with the plan target and log a first session.",
        nextWeight: null,
      };
    }

    const weights = previous.sets.filter((set) => Number(set.weight) > 0).map((set) => Number(set.weight));
    const lastWeight = weights.length ? Math.max(...weights) : 0;
    const completed = previous.sets.filter((set) => Number(set.reps) > 0);
    const range = parseRepRange(exercise.reps);
    const achieved = completed.length >= Math.max(1, Number(exercise.sets || 1))
      && completed.every((set) => Number(set.reps) >= range.min && Number(set.reps) <= range.max);

    if (!achieved) {
      return {
        text: `Current log is ${previous.sets.map((set) => `${set.weight || "?"} kg x ${set.reps || "?"}`).join(" / ")}. Keep this weight until the target range is consistently met.`,
        nextWeight: lastWeight || null,
      };
    }

    const increment = exercise.equipment && /barbell|dumbbell|cable|machine/i.test(exercise.equipment) ? 2.5 : 1;
    return {
      text: `🎯 Target achieved. You completed ${exercise.sets} × ${exercise.reps} at ${lastWeight} kg. Suggested next weight: ${lastWeight + increment} kg.`,
      nextWeight: lastWeight + increment,
    };
  }

  function getPRSummary() {
    const logs = getWorkoutLogs();
    const map = new Map();

    logs.forEach((log) => {
      const name = log.exerciseName;
      const heaviest = Math.max(...(log.sets || []).map((set) => Number(set.weight || 0)), 0);
      const bestReps = Math.max(...(log.sets || []).map((set) => Number(set.reps || 0)), 0);
      const previous = map.get(name) || { weight: 0, reps: 0, date: "" };
      if (heaviest > previous.weight) {
        map.set(name, { weight: heaviest, reps: bestReps, date: log.date, name });
      }
    });

    return [...map.values()].sort((a, b) => b.weight - a.weight).slice(0, 5);
  }

  function getWorkoutStreak() {
    const logs = getWorkoutLogs();
    if (!logs.length) return 0;
    const uniqueDates = Array.from(new Set(logs.map((log) => log.date.slice(0, 10)))).sort().reverse();
    let streak = 0;
    const today = new Date();
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const seen = new Set();

    for (let i = 0; i < uniqueDates.length; i++) {
      const date = new Date(uniqueDates[i]);
      const offset = Math.round((current - date) / 86400000);
      if (offset === streak || offset === streak + 1 || (streak === 0 && offset <= 1)) {
        seen.add(uniqueDates[i]);
        streak = streak === 0 ? 1 : streak + 1;
      }
    }
    return seen.size || 0;
  }

  function getOverviewStats(day) {
    const logs = getWorkoutLogs();
    const sessionAgo = logs[0]?.date ? new Date(logs[0].date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "No workouts yet";
    return {
      dayName: day.name,
      totalExercises: day.exercises.length,
      recentWorkout: sessionAgo,
      streak: getWorkoutStreak(),
      prs: getPRSummary(),
    };
  }

  function renderAuthControls() {
    const authArea = $("#authArea");
    if (!authArea) return;
    const profiles = getUserProfiles();

    if (!state.user) {
      authArea.innerHTML = `
        <form id="loginForm" class="auth-form">
          <input type="text" name="username" placeholder="Your name" maxlength="24" />
          <button class="btn btn--accent" type="submit">Login</button>
        </form>
      `;
      $("#loginForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = new FormData(event.currentTarget).get("username")?.toString().trim();
        if (loginUser(name)) {
          event.currentTarget.reset();
        } else {
          showToast("Enter a name to continue.");
        }
      });
      return;
    }

    const switcher = profiles.length > 1 ? `<button class="btn btn--ghost" id="switchUserBtn">Switch user</button>` : "";
    authArea.innerHTML = `
      <div class="profile-pill">
        <span>Signed in as</span>
        <strong>${escapeAttr(state.user.name)}</strong>
      </div>
      ${switcher}
      <button class="btn btn--ghost" id="logoutBtn">Logout</button>
    `;

    $("#switchUserBtn")?.addEventListener("click", () => {
      const next = prompt("Enter a username to switch to a profile, or create a new one.");
      if (next) {
        const valid = loginUser(next);
        if (!valid) showToast("Please enter a valid user name.");
      }
    });

    $("#logoutBtn")?.addEventListener("click", () => logoutUser());
  }

  function renderNav() {
    const nav = $("#dayNav");
    if (!nav) return;
    nav.innerHTML = state.plan.days.map((day) => `
      <button class="navtab ${day.id === state.activeDay ? "is-active" : ""}" data-day="${day.id}" style="--accent:${CATEGORY_META[day.category]?.accent || "var(--power)"}">
        <span class="navtab__code">${day.code}</span>
        <span class="navtab__name">${day.name}</span>
      </button>
    `).join("");

    $$(".navtab", nav).forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeDay = btn.dataset.day;
        renderNav();
        renderDay();
      });
    });
  }

  function renderDay() {
    const panel = $("#dayPanel");
    if (!panel) return;

    if (!state.user) {
      panel.innerHTML = `
        <div class="dayhead">
          <div>
            <p class="eyebrow" style="color:var(--sky)">Access</p>
            <h2>Login to track progress</h2>
            <p class="dayhead__focus">Each athlete gets a separate profile with their own workout history and program data.</p>
          </div>
        </div>
      `;
      return;
    }

    const day = findDay(state.activeDay);
    const meta = CATEGORY_META[day.category] || CATEGORY_META.strength;
    document.documentElement.style.setProperty("--accent-active", meta.accent);

    const stats = getOverviewStats(day);
    const bodyEntries = getBodyweightEntries();
    const recentPRs = getPRSummary();

    panel.innerHTML = `
      <div class="dayhead">
        <div>
          <p class="eyebrow" style="color:${meta.accent}">${day.code} · ${meta.label}</p>
          <h2>${day.name}</h2>
          <p class="dayhead__focus">${day.focus}</p>
        </div>
        <div class="dayhead__actions">
          <button class="btn btn--ghost" id="resetDayBtn">Reset day</button>
        </div>
      </div>

      <div class="timeline-strip">
        <button class="btn btn--ghost" id="prevWeekBtn">← Week</button>
        <div class="timeline-strip__text">Month ${state.timeline.month} → Week ${state.timeline.week} → ${day.code}</div>
        <button class="btn btn--ghost" id="nextWeekBtn">Week →</button>
      </div>

      ${state.session.running && state.session.dayId === day.id ? renderActiveWorkout(day) : ""}

      <div class="overview-grid">
        <div class="overview-card">
          <span>Today's workout</span>
          <strong>${day.name}</strong>
          <small>${stats.totalExercises} exercises</small>
        </div>
        <div class="overview-card">
          <span>Current week</span>
          <strong>Week ${state.timeline.week}</strong>
          <small>Month ${state.timeline.month}</small>
        </div>
        <div class="overview-card">
          <span>Workout streak</span>
          <strong>${stats.streak} day${stats.streak === 1 ? "" : "s"}</strong>
          <small>Last session: ${stats.recentWorkout}</small>
        </div>
        <div class="overview-card">
          <span>Recent PR</span>
          <strong>${recentPRs[0]?.name || "No data yet"}</strong>
          <small>${recentPRs[0] ? `${recentPRs[0].weight} kg` : "Track a set to unlock PRs"}</small>
        </div>
      </div>

      <div class="dashboard-panel">
        <div class="dashboard-panel__section">
          <h3>Strength dashboard</h3>
          <div class="mini-chart">
            ${renderChartBars([42, 57, 63, 74, 82, 90])}
          </div>
        </div>
        <div class="dashboard-panel__section">
          <h3>Bodyweight</h3>
          <div class="bodyweight-box">
            <div class="bodyweight-box__list">
              ${bodyEntries.length ? bodyEntries.slice(0, 3).map((entry) => `<div><strong>${entry.weight} kg</strong><span>${entry.date}</span></div>`).join("") : `<div class="muted">No bodyweight entries yet.</div>`}
            </div>
            <form id="bodyweightForm" class="bodyweight-form">
              <input type="date" name="date" />
              <input type="number" step="0.1" name="weight" placeholder="Weight kg" />
              <input type="number" step="0.1" name="waist" placeholder="Waist cm" />
              <button class="btn btn--accent" type="submit">Save</button>
            </form>
          </div>
        </div>
      </div>

      <div class="exlist" id="exlist"></div>
    `;

    $("#prevWeekBtn").addEventListener("click", () => { state.timeline.week = Math.max(1, state.timeline.week - 1); if (state.timeline.week === 0) { state.timeline.month = Math.max(1, state.timeline.month - 1); state.timeline.week = 4; } renderDay(); });
    $("#nextWeekBtn").addEventListener("click", () => { state.timeline.week = Math.min(12, state.timeline.week + 1); if (state.timeline.week > 12) { state.timeline.month = Math.min(3, state.timeline.month + 1); state.timeline.week = 1; } renderDay(); });
    $("#resetDayBtn").addEventListener("click", () => resetDay(day.id));

    const list = $("#exlist", panel);
    day.exercises.forEach((exercise) => list.appendChild(renderExerciseCard(day, exercise)));
    $("#bodyweightForm")?.addEventListener("submit", handleBodyweightSubmit);

    renderSessionBar();
  }

  function renderChartBars(values) {
    const max = Math.max(...values, 100);
    return values.map((value) => `<span style="height:${(value / max) * 100}%"></span>`).join("");
  }

  function handleBodyweightSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const date = formData.get("date");
    const weight = Number(formData.get("weight"));
    const waist = Number(formData.get("waist"));

    if (!date || !weight) {
      showToast("Add a date and bodyweight to save this entry.");
      return;
    }

    const entries = getBodyweightEntries();
    entries.unshift({ date, weight, waist: waist || null });
    setBodyweightEntries(entries.slice(0, 10));
    form.reset();
    renderDay();
    showToast("Bodyweight entry saved.");
  }

  function renderActiveWorkout(day) {
    const exercise = day.exercises[state.session.exerciseIndex];
    if (!exercise) return "";
    const isRest = state.session.phase === "rest";
    const nextExercise = day.exercises[state.session.exerciseIndex + 1];
    const nextSet = 1;
    const nextTitle = nextExercise ? escapeAttr(nextExercise.name) : "Workout complete";
    const nextMeta = nextExercise
      ? `Next exercise · Set ${nextSet} of ${nextExercise.sets}`
      : "You reached the end of today's session";
    return `<section class="activeworkout ${isRest ? "is-rest" : ""}" aria-live="polite">
      <div class="activeworkout__visual" aria-label="Technique animation"><div class="motion-demo"><span class="motion-demo__head"></span><span class="motion-demo__body"></span><span class="motion-demo__arm"></span><span class="motion-demo__leg"></span></div></div>
      <div class="activeworkout__copy"><p class="eyebrow">${isRest ? "Recover" : "Now training"} · Set ${state.session.setIndex + 1} of ${exercise.sets}</p>
        <h3>${escapeAttr(isRest ? "Rest interval" : exercise.name)}</h3><p>${isRest ? "Breathe, reset, and get ready for the next effort." : escapeAttr(exercise.cue || "Stay controlled and deliberate.")}</p></div>
      <div class="activeworkout__clock" id="activeClock">${fmtClock(state.session.phaseRemaining)}</div>
      <div class="activeworkout__actions"><button class="btn btn--ghost" id="pauseWorkoutBtn">${state.session.paused ? "Resume" : "Pause"}</button><button class="btn btn--ghost" id="skipRestBtn">Skip rest</button><button class="btn btn--ghost" id="prevExerciseBtn">Previous</button><button class="btn btn--accent" id="nextExerciseBtn">Next</button></div>
      <div class="activeworkout__next ${nextExercise ? "" : "is-finale"}">
        <span class="activeworkout__next-label">${nextExercise ? "Next up" : "Finale"}</span>
        <div class="activeworkout__next-copy"><strong>${nextTitle}</strong><span>${nextMeta}</span></div>
        <span class="activeworkout__next-arrow" aria-hidden="true">→</span>
      </div>
    </section>`;
  }

  function renderExerciseCard(day, exercise) {
    const latestPerformance = getLatestExerciseLog(exercise.name);
    const suggestion = suggestWeight(exercise);
    const range = parseRepRange(exercise.reps);

    const setRows = Array.from({ length: Number(exercise.sets) || 1 }, (_, index) => {
      const previousSet = latestPerformance?.sets?.[index] || {};
      const prevWeight = previousSet.weight ?? "";
      const prevReps = previousSet.reps ?? "";
      const prevRIR = previousSet.rir ?? "";
      const prevNotes = previousSet.notes ?? "";

      return `
        <div class="set-row">
          <label>Set ${index + 1}</label>
          <input type="number" step="0.5" placeholder="kg" class="set-weight" value="${prevWeight}" />
          <input type="number" min="0" max="50" placeholder="reps" class="set-reps" value="${prevReps}" />
          <select class="set-rir">
            <option value="">RIR</option>
            <option value="0" ${prevRIR === "0" ? "selected" : ""}>0</option>
            <option value="1" ${prevRIR === "1" ? "selected" : ""}>1</option>
            <option value="2" ${prevRIR === "2" ? "selected" : ""}>2</option>
            <option value="3+" ${prevRIR === "3+" ? "selected" : ""}>3+</option>
            <option value="Not sure" ${prevRIR === "Not sure" ? "selected" : ""}>Not sure</option>
          </select>
          <input type="text" placeholder="Notes" class="set-notes" value="${escapeAttr(prevNotes)}" />
        </div>
      `;
    }).join("");

    const card = document.createElement("article");
    card.className = "excard";
    card.setAttribute("data-exercise-id", exercise.id);
    card.innerHTML = `
      <div class="excard__icon" style="color:${CATEGORY_META[day.category]?.accent || "var(--power)"}">${ICONS[exercise.icon] || ICONS.bodyweight}</div>
      <div class="excard__body">
        <div class="excard__top">
          <div>
            <span class="exercise-badge">${exercise.category || day.category}</span>
            <h3 class="excard__name">${exercise.name}</h3>
          </div>
          <span class="excard__muscle">${exercise.muscle || exercise.primaryMuscles || "General"}</span>
        </div>

        <div class="excard__meta-bar">
          <span>${exercise.sets} sets</span>
          <span>${exercise.reps}</span>
          <label>Time <input type="number" min="1" max="3600" class="exercise-duration" value="${exercise.duration || 45}" aria-label="Exercise time in seconds" />s</label>
          <label>Rest <input type="number" min="0" max="3600" class="exercise-rest" value="${exercise.rest || 0}" aria-label="Rest time in seconds" />s</label>
          <span>${exercise.type || "Strength"}</span>
        </div>

        <p class="excard__cue">${exercise.cue || "Focus on quality, control, and consistent effort."}</p>

        <div class="excard__stats">
          <div class="stat-box">
            <label>Previous</label>
            <strong>${latestPerformance ? latestPerformance.sets.map((set) => `${set.weight || "?"}×${set.reps || "?"}`).join(" / ") : "No session logged"}</strong>
          </div>
          <div class="stat-box">
            <label>Current target</label>
            <strong>${exercise.sets} × ${exercise.reps}</strong>
          </div>
          <div class="stat-box stat-box--accent">
            <label>Recommendation</label>
            <strong>${suggestion.nextWeight ? `${suggestion.nextWeight} kg` : "Start logging"}</strong>
          </div>
        </div>

        <div class="set-log-box">
          ${setRows}
        </div>

        <div class="excard__actions">
          <div class="callout">${suggestion.text}</div>
          <button class="btn btn--accent" data-action="save-exercise">Save exercise</button>
        </div>
      </div>
    `;

    const saveBtn = card.querySelector("[data-action='save-exercise']");
    saveBtn.addEventListener("click", () => {
      exercise.duration = Math.max(1, Number(card.querySelector(".exercise-duration").value) || 45);
      exercise.rest = Math.max(0, Number(card.querySelector(".exercise-rest").value) || 0);
      persistPlan();
      const rows = [...card.querySelectorAll(".set-row")];
      const completedSets = rows.map((row) => {
        const weight = parseFloat(row.querySelector(".set-weight").value || "0");
        const reps = parseInt(row.querySelector(".set-reps").value, 10);
        const rir = row.querySelector(".set-rir").value;
        const notes = row.querySelector(".set-notes").value.trim();
        if (!Number.isFinite(weight) && !Number.isFinite(reps) && !rir && !notes) return null;
        if (!Number.isFinite(weight) && !Number.isFinite(reps) && !rir && !notes) return null;
        return {
          weight: Number.isFinite(weight) ? weight : 0,
          reps: Number.isFinite(reps) ? reps : 0,
          rir: rir || "",
          notes,
        };
      }).filter(Boolean);

      if (!completedSets.length) {
        showToast("Enter at least one set before saving this exercise.");
        return;
      }

      const logs = getWorkoutLogs();
      logs.unshift({
        id: `log-${Date.now()}`,
        dayId: day.id,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        date: new Date().toISOString(),
        target: exercise.reps,
        sets: completedSets,
        notes: exercise.notes || "",
      });
      setWorkoutLogs(logs.slice(0, 200));
      showToast(`${exercise.name} saved to your history.`);
      renderDay();
    });

    return card;
  }

  function resetDay(dayId) {
    if (!confirm("Reset this day back to the original training template?")) return;
    const matched = structuredClone(DEFAULT_PROGRAM.days.find((d) => d.id === dayId));
    const index = state.plan.days.findIndex((d) => d.id === dayId);
    state.plan.days[index] = matched;
    persistPlan();
    renderDay();
  }

  function renderSessionBar() {
    const bar = $("#sessionBar");
    const isActiveDay = state.session.dayId === state.activeDay;
    bar.innerHTML = `
      <div class="sessionbar__clock">
        <span class="sessionbar__label">Session</span>
        <span class="sessionbar__time" id="sessionClock">${fmtClock(isActiveDay ? state.session.seconds : 0)}</span>
      </div>
      <div class="sessionbar__actions">
        ${state.session.running && isActiveDay
          ? `<button class="btn btn--danger" id="endSessionBtn">End workout</button>`
          : `<button class="btn btn--accent" id="startSessionBtn">Start workout</button>`}
      </div>
    `;

    $("#startSessionBtn")?.addEventListener("click", startSession);
    $("#endSessionBtn")?.addEventListener("click", endSession);
    if (isActiveDay && state.session.running) bindWorkoutControls();
  }

  function bindWorkoutControls() {
    $("#pauseWorkoutBtn")?.addEventListener("click", () => { state.session.paused = !state.session.paused; renderDay(); });
    $("#skipRestBtn")?.addEventListener("click", () => { if (state.session.phase === "rest") finishRest(); });
    $("#nextExerciseBtn")?.addEventListener("click", () => advanceExercise(1));
    $("#prevExerciseBtn")?.addEventListener("click", () => advanceExercise(-1));
  }

  function startSession() {
    if (state.session.running) return;
    state.session.running = true;
    state.session.paused = false;
    state.session.dayId = state.activeDay;
    state.session.seconds = 0;
    state.session.exerciseIndex = 0;
    state.session.setIndex = 0;
    state.session.phase = "exercise";
    state.session.phaseRemaining = findDay(state.activeDay).exercises[0]?.duration || 45;
    clearInterval(state.session.timerId);
    state.session.timerId = setInterval(() => {
      state.session.seconds += 1;
      if (!state.session.paused) tickWorkout();
      const clock = $("#sessionClock");
      if (clock) clock.textContent = fmtClock(state.session.seconds);
    }, 1000);
    renderSessionBar();
    renderDay();
  }

  function tickWorkout() {
    if (state.session.phase === "rest") return;
    if (state.session.phaseRemaining > 0) state.session.phaseRemaining -= 1;
    const clock = $("#activeClock");
    if (clock) clock.textContent = fmtClock(state.session.phaseRemaining);
    if (state.session.phaseRemaining <= 3 && state.session.phaseRemaining > 0) restTick();
    if (state.session.phaseRemaining <= 0) {
      if (state.session.phase === "exercise") startWorkoutRest();
      else finishRest();
    }
  }

  function startWorkoutRest() {
    const exercise = findDay(state.session.dayId).exercises[state.session.exerciseIndex];
    state.session.phase = "rest";
    state.session.phaseRemaining = exercise.rest;
    if (!exercise.rest) finishRest();
    else { startRest(exercise.rest, `${exercise.name} — set ${state.session.setIndex + 1} complete`); renderDay(); }
  }

  function finishRest() {
    clearInterval(state.rest.timerId);
    state.rest.running = false;
    hideRestPanel();
    const day = findDay(state.session.dayId);
    const exercise = day.exercises[state.session.exerciseIndex];
    if (state.session.setIndex + 1 < exercise.sets) state.session.setIndex += 1;
    else if (state.session.exerciseIndex + 1 < day.exercises.length) { state.session.exerciseIndex += 1; state.session.setIndex = 0; }
    else { completeSession(); return; }
    state.session.phase = "exercise";
    state.session.phaseRemaining = day.exercises[state.session.exerciseIndex].duration || 45;
    renderDay();
  }

  function advanceExercise(direction) {
    const day = findDay(state.session.dayId);
    state.session.exerciseIndex = Math.max(0, Math.min(day.exercises.length - 1, state.session.exerciseIndex + direction));
    state.session.setIndex = 0;
    state.session.phase = "exercise";
    state.session.phaseRemaining = day.exercises[state.session.exerciseIndex].duration || 45;
    clearInterval(state.rest.timerId); state.rest.running = false; hideRestPanel(); renderDay();
  }

  function completeSession() {
    const total = fmtClock(state.session.seconds);
    saveWorkoutLog(state.session.dayId, state.session.seconds);
    clearInterval(state.session.timerId); state.session.running = false;
    restEndFanfare(); flashScreen(); renderSessionBar(); renderDay();
    showToast(`Workout complete — ${total}. Session saved.`);
  }

  function endSession() {
    clearInterval(state.session.timerId);
    const total = fmtClock(state.session.seconds);
    state.session.running = false;
    clearInterval(state.rest.timerId);
    state.rest.running = false;
    hideRestPanel();
    renderSessionBar();
    showToast(`Workout logged — ${total} on the clock. Nice work.`);
  }

  const restRingLen = 2 * Math.PI * 54;

  function startRest(seconds, label) {
    seconds = Math.max(5, seconds || 60);
    clearInterval(state.rest.timerId);
    state.rest.running = true;
    state.rest.total = seconds;
    state.rest.remaining = seconds;
    state.rest.label = label;
    showRestPanel();
    state.rest.timerId = setInterval(tickRest, 1000);
  }

  function tickRest() {
    state.rest.remaining -= 1;
    if (state.session.running && state.session.phase === "rest") state.session.phaseRemaining = state.rest.remaining;
    if (state.rest.remaining <= 3 && state.rest.remaining > 0) restTick();
    if (state.rest.remaining <= 0) {
      clearInterval(state.rest.timerId);
      state.rest.running = false;
      restEndFanfare();
      flashScreen();
      updateRestPanel();
      setTimeout(hideRestPanel, 1400);
      if (state.session.running && state.session.phase === "rest") finishRest();
      return;
    }
    updateRestPanel();
  }

  function showRestPanel() {
    const panel = $("#restPanel");
    panel.hidden = false;
    panel.classList.add("is-open");
    updateRestPanel();
  }

  function hideRestPanel() {
    const panel = $("#restPanel");
    panel.classList.remove("is-open");
    setTimeout(() => { panel.hidden = true; }, 260);
  }

  function updateRestPanel() {
    const panel = $("#restPanel");
    const pct = Math.max(0, state.rest.remaining / state.rest.total);
    const offset = restRingLen * (1 - pct);
    panel.innerHTML = `
      <div class="restcard">
        <p class="restcard__label">${state.rest.remaining > 0 ? "Rest — " + state.rest.label : "Rest complete"}</p>
        <div class="restring">
          <svg viewBox="0 0 120 120">
            <circle class="restring__bg" cx="60" cy="60" r="54"/>
            <circle class="restring__fg" cx="60" cy="60" r="54" stroke-dasharray="${restRingLen}" stroke-dashoffset="${offset}"/>
          </svg>
          <span class="restring__num">${state.rest.remaining > 0 ? state.rest.remaining : "GO"}</span>
        </div>
        <div class="restcard__btns">
          <button class="btn btn--ghost" id="restMinus">-15s</button>
          <button class="btn btn--ghost" id="restPlus">+10s</button>
          <button class="btn btn--accent" id="restSkip">Skip rest</button>
        </div>
      </div>
    `;
    $("#restSkip").addEventListener("click", () => { clearInterval(state.rest.timerId); state.rest.running = false; hideRestPanel(); });
    $("#restPlus").addEventListener("click", () => { state.rest.remaining += 10; state.rest.total += 10; if (state.session.running) state.session.phaseRemaining = state.rest.remaining; updateRestPanel(); });
    $("#restMinus").addEventListener("click", () => { state.rest.remaining = Math.max(1, state.rest.remaining - 15); updateRestPanel(); });
  }

  function saveWorkoutLog(dayId, seconds) {
    const userId = state.user?.id || localStorage.getItem(STORAGE_KEYS.currentUser);
    if (!userId) return;

    const logs = getWorkoutLogs();
    logs.unshift({
      id: `log-${Date.now()}`,
      dayId,
      seconds,
      date: new Date().toISOString(),
    });
    setWorkoutLogs(logs.slice(0, 60));
    localStorage.setItem(STORAGE_KEYS.streak, String(new Set(logs.filter((log) => log.date.slice(0, 10) >= new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)).map((log) => log.date.slice(0, 10))).size));
  }

  let toastTimer = null;
  function showToast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-shown"), 3200);
  }

  function exportPlan() {
    const blob = new Blob([JSON.stringify(state.plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "peak-program.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importPlan(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.days) throw new Error("bad shape");
        state.plan = normalizeProgram(parsed);
        persistPlan();
        if (!findDay(state.activeDay)) state.activeDay = state.plan.days[0].id;
        renderNav();
        renderDay();
        showToast("Program imported.");
      } catch (error) {
        showToast("Couldn't read that file — is it a PEAK export?");
      }
    };
    reader.readAsText(file);
  }

  function init() {
    state.user = getCurrentUser();
    state.plan = loadProgram();
    state.activeDay = state.plan.days[0]?.id || "d1";
    $("#exportBtn").addEventListener("click", exportPlan);
    $("#importInput").addEventListener("change", (event) => {
      if (event.target.files[0]) importPlan(event.target.files[0]);
      event.target.value = "";
    });
    renderAuthControls();
    renderNav();
    renderDay();
  }

  let actx = null;
  function beep(freq = 880, dur = 0.14, delay = 0) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime + delay;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(actx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (error) {
      // Audio is optional.
    }
  }

  function restEndFanfare() { beep(660, 0.12, 0); beep(880, 0.12, 0.14); beep(1175, 0.22, 0.28); }
  function restTick() { beep(520, 0.06, 0); }
  function flashScreen() {
    const flash = $("#flashOverlay");
    flash.classList.add("flash-active");
    setTimeout(() => flash.classList.remove("flash-active"), 400);
  }

  const fmtClock = (totalSec) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.floor(totalSec % 60);
    return (h > 0 ? String(h).padStart(2, "0") + ":" : "") + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  };

  document.addEventListener("DOMContentLoaded", init);
})();
