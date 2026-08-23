/* ==========================================================================
   PEAK — app.js
  Lightweight local persistence for workout history and streaks.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------- state ---------- */
  const state = {
    plan: structuredClone(DEFAULT_PROGRAM),
    activeDay: DEFAULT_PROGRAM.days[0].id,
    session: { running: false, paused: false, seconds: 0, timerId: null, dayId: null, exerciseIndex: 0, setIndex: 0, phase: "exercise", phaseRemaining: 0 },
    rest: { running: false, remaining: 0, total: 0, timerId: null, label: "" },
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- audio cue (no external files — Web Audio oscillator) ---------- */
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
    } catch (e) { /* audio not available — visual alert still fires */ }
  }
  function restEndFanfare() { beep(660, 0.12, 0); beep(880, 0.12, 0.14); beep(1175, 0.22, 0.28); }
  function restTick() { beep(520, 0.06, 0); }

  /* ---------- helpers ---------- */
  const fmtClock = (totalSec) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.floor(totalSec % 60);
    return (h > 0 ? String(h).padStart(2, "0") + ":" : "") +
      String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  };

  function findDay(dayId) { return state.plan.days.find((d) => d.id === dayId); }
  function findExercise(dayId, exId) { return findDay(dayId).exercises.find((e) => e.id === exId); }

  /* ---------- rendering: nav ---------- */
  function renderNav() {
    const nav = $("#dayNav");
    nav.innerHTML = state.plan.days.map((d) => `
      <button class="navtab ${d.id === state.activeDay ? "is-active" : ""}" data-day="${d.id}" style="--accent:${CATEGORY_META[d.category].accent}">
        <span class="navtab__code">${d.code}</span>
        <span class="navtab__name">${d.name}</span>
      </button>
    `).join("");
    $$(".navtab", nav).forEach((btn) => btn.addEventListener("click", () => {
      state.activeDay = btn.dataset.day;
      renderNav();
      renderDay();
    }));
  }

  /* ---------- rendering: day content ---------- */
  function renderDay() {
    const day = findDay(state.activeDay);
    const meta = CATEGORY_META[day.category];
    const panel = $("#dayPanel");

    document.documentElement.style.setProperty("--accent-active", meta.accent);

    panel.innerHTML = `
      <div class="dayhead">
        <div>
          <p class="eyebrow" style="color:${meta.accent}">${day.code} · ${meta.label}</p>
          <h2>${day.name}</h2>
          <p class="dayhead__focus">${day.focus}</p>
        </div>
        <div class="dayhead__actions">
          <button class="btn btn--ghost" id="addExerciseBtn">+ Add exercise</button>
          <button class="btn btn--ghost" id="resetDayBtn">Reset day</button>
        </div>
      </div>
      ${state.session.running && state.session.dayId === day.id ? renderActiveWorkout(day) : ""}
      <div class="exlist" id="exlist"></div>
    `;

    const list = $("#exlist", panel);
    day.exercises.forEach((e, idx) => list.appendChild(renderExerciseCard(day, e, idx)));

    $("#addExerciseBtn").addEventListener("click", () => addExercise(day.id));
    $("#resetDayBtn").addEventListener("click", () => resetDay(day.id));

    renderSessionBar();
  }

  function renderActiveWorkout(day) {
    const exercise = day.exercises[state.session.exerciseIndex];
    if (!exercise) return "";
    const isRest = state.session.phase === "rest";
    return `<section class="activeworkout ${isRest ? "is-rest" : ""}" aria-live="polite">
      <div class="activeworkout__visual" aria-label="Technique animation"><div class="motion-demo"><span class="motion-demo__head"></span><span class="motion-demo__body"></span><span class="motion-demo__arm"></span><span class="motion-demo__leg"></span></div></div>
      <div class="activeworkout__copy"><p class="eyebrow">${isRest ? "Recover" : "Now training"} · Set ${state.session.setIndex + 1} of ${exercise.sets}</p>
        <h3>${escapeAttr(isRest ? "Rest interval" : exercise.name)}</h3><p>${isRest ? "Breathe, reset, and get ready for the next effort." : escapeAttr(exercise.cue || "Stay controlled and deliberate.")}</p></div>
      <div class="activeworkout__clock" id="activeClock">${fmtClock(state.session.phaseRemaining)}</div>
      <div class="activeworkout__actions"><button class="btn btn--ghost" id="pauseWorkoutBtn">${state.session.paused ? "Resume" : "Pause"}</button><button class="btn btn--ghost" id="skipRestBtn">Skip rest</button><button class="btn btn--ghost" id="prevExerciseBtn">Previous</button><button class="btn btn--accent" id="nextExerciseBtn">Next</button></div>
    </section>`;
  }

  function renderExerciseCard(day, e, idx) {
    const meta = CATEGORY_META[day.category];
    const card = document.createElement("article");
    card.className = "excard";
    card.dataset.exId = e.id;

    const setPills = Array.from({ length: e.sets }).map((_, i) => `
      <button class="setpill ${e.done[i] ? "is-done" : ""}" data-set="${i}" title="Mark set ${i + 1} complete">
        ${e.done[i] ? "✓" : i + 1}
      </button>
    `).join("");

    card.innerHTML = `
      <div class="excard__icon" style="color:${meta.accent}">${ICONS[e.icon] || ICONS.bodyweight}</div>
      <div class="excard__body">
        <div class="excard__top">
          <input class="excard__name" value="${escapeAttr(e.name)}" data-field="name" aria-label="Exercise name" />
          <span class="excard__muscle">${e.muscle || ""}</span>
        </div>
        <p class="excard__cue">${e.cue || ""}</p>
        <div class="excard__fields">
          <label>Sets<input type="number" min="1" max="10" value="${e.sets}" data-field="sets" /></label>
          <label>Reps<input type="text" value="${escapeAttr(e.reps)}" data-field="reps" /></label>
          <label>Work (sec)<input type="number" min="5" max="3600" step="5" value="${e.duration || 45}" data-field="duration" /></label>
          <label>Rest (sec)<input type="number" min="0" step="5" value="${e.rest}" data-field="rest" /></label>
        </div>
        <div class="excard__row">
          <div class="setpills">${setPills}</div>
          <div class="excard__btns">
            <button class="btn btn--sm btn--accent" data-action="video">▶ Form video</button>
            <button class="btn btn--sm btn--danger" data-action="remove">Remove</button>
          </div>
        </div>
        <div class="excard__video" hidden></div>
      </div>
    `;

    // field edits
    $$("[data-field]", card).forEach((input) => {
      input.addEventListener("change", () => {
        const field = input.dataset.field;
        let val = input.value;
        if (field === "sets") {
          val = Math.max(1, Math.min(10, parseInt(val, 10) || 1));
          const diff = val - e.sets;
          if (diff > 0) for (let i = 0; i < diff; i++) e.done.push(false);
          else e.done = e.done.slice(0, val);
          e.sets = val;
          renderDay();
          return;
        } else if (field === "rest" || field === "duration") {
          val = Math.max(0, parseInt(val, 10) || 0);
        }
        e[field] = val;
      });
    });

    // set pills
    $$(".setpill", card).forEach((pill) => {
      pill.addEventListener("click", () => {
        const i = parseInt(pill.dataset.set, 10);
        if (state.session.running && state.session.dayId === day.id && state.session.exerciseIndex === idx && state.session.phase === "exercise" && i === state.session.setIndex) {
          startWorkoutRest();
          return;
        }
        e.done[i] = !e.done[i];
        pill.classList.toggle("is-done", e.done[i]);
        pill.textContent = e.done[i] ? "✓" : String(i + 1);
        if (e.done[i]) startRest(e.rest, `${e.name} — set ${i + 1} done`);
      });
    });

    // video toggle
    $('[data-action="video"]', card).addEventListener("click", (ev) => {
      const box = $(".excard__video", card);
      if (box.hidden) {
        const q = encodeURIComponent(`${e.name} proper form technique`);
        box.innerHTML = `<a class="video-link" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">Open ${escapeAttr(e.name)} technique videos on YouTube ↗</a>`;
        box.hidden = false;
        ev.target.textContent = "▲ Hide video";
      } else {
        box.hidden = true;
        box.innerHTML = "";
        ev.target.textContent = "▶ Form video";
      }
    });

    // remove
    $('[data-action="remove"]', card).addEventListener("click", () => {
      day.exercises = day.exercises.filter((x) => x.id !== e.id);
      renderDay();
    });

    return card;
  }

  function escapeAttr(str) {
    return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function addExercise(dayId) {
    const day = findDay(dayId);
    const n = day.exercises.length + 1;
    day.exercises.push(ex(`${dayId}_custom_${Date.now()}`, "New Exercise", 3, "10", 90, "dumbbell", "Add your own coaching cue.", ""));
    renderDay();
    // scroll to bottom / focus new name field
    setTimeout(() => {
      const cards = $$(".excard");
      const last = cards[cards.length - 1];
      if (last) { last.scrollIntoView({ behavior: "smooth", block: "center" }); $(".excard__name", last).focus(); }
    }, 30);
  }

  function resetDay(dayId) {
    if (!confirm("Reset this day back to the default program? Your edits for this day will be lost.")) return;
    const fresh = structuredClone(DEFAULT_PROGRAM.days.find((d) => d.id === dayId));
    const idx = state.plan.days.findIndex((d) => d.id === dayId);
    state.plan.days[idx] = fresh;
    renderDay();
  }

  /* ---------- session (workout) stopwatch ---------- */
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
    const startBtn = $("#startSessionBtn");
    if (startBtn) startBtn.addEventListener("click", startSession);
    const endBtn = $("#endSessionBtn");
    if (endBtn) endBtn.addEventListener("click", endSession);
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
      state.session.seconds++;
      if (!state.session.paused) tickWorkout();
      const clock = $("#sessionClock");
      if (clock) clock.textContent = fmtClock(state.session.seconds);
    }, 1000);
    renderSessionBar();
    renderDay();
  }

  function tickWorkout() {
    if (state.session.phase === "rest") return;
    if (state.session.phaseRemaining > 0) state.session.phaseRemaining--;
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
    exercise.done[state.session.setIndex] = true;
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
    if (state.session.setIndex + 1 < exercise.sets) state.session.setIndex++;
    else if (state.session.exerciseIndex + 1 < day.exercises.length) { state.session.exerciseIndex++; state.session.setIndex = 0; }
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

  /* ---------- rest timer (auto-triggered by set completion) ---------- */
  const restRingLen = 2 * Math.PI * 54; // r=54

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
    state.rest.remaining--;
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
            <circle class="restring__fg" cx="60" cy="60" r="54"
              stroke-dasharray="${restRingLen}" stroke-dashoffset="${offset}"/>
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

  function flashScreen() {
    const flash = $("#flashOverlay");
    flash.classList.add("flash-active");
    setTimeout(() => flash.classList.remove("flash-active"), 400);
  }

  function saveWorkoutLog(dayId, seconds) {
    const logs = JSON.parse(localStorage.getItem("peak-workout-logs") || "[]");
    logs.unshift({ dayId, seconds, date: new Date().toISOString() });
    localStorage.setItem("peak-workout-logs", JSON.stringify(logs.slice(0, 50)));
    const days = new Set(logs.filter((log) => log.date.slice(0, 10) >= new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)).map((log) => log.date.slice(0, 10)));
    localStorage.setItem("peak-workout-streak", String(days.size));
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function showToast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-shown"), 3200);
  }

  /* ---------- export / import (persistence without localStorage) ---------- */
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
        state.plan = parsed;
        if (!findDay(state.activeDay)) state.activeDay = state.plan.days[0].id;
        renderNav();
        renderDay();
        showToast("Program imported.");
      } catch (e) {
        showToast("Couldn't read that file — is it a PEAK export?");
      }
    };
    reader.readAsText(file);
  }

  /* ---------- init ---------- */
  function ex(id, name, sets, reps, rest, icon, cue, muscle) {
    const duration = String(reps).includes("min") ? 300 : 45;
    return { id, name, sets, reps, rest, duration, icon, cue, muscle, done: [] };
  }

  function init() {
    $("#exportBtn").addEventListener("click", exportPlan);
    $("#importInput").addEventListener("change", (e) => {
      if (e.target.files[0]) importPlan(e.target.files[0]);
      e.target.value = "";
    });
    renderNav();
    renderDay();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
