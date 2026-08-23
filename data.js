/* ==========================================================================
   PEAK — default program data
   Every exercise is fully editable at runtime; this is just the seed data.
   category drives which icon + accent color is used.
   ========================================================================== */

const ICONS = {
  barbell: `<svg viewBox="0 0 64 24"><rect x="2" y="9" width="6" height="6" rx="1"/><rect x="10" y="6" width="4" height="12" rx="1"/><rect x="16" y="10" width="32" height="4" rx="1"/><rect x="50" y="6" width="4" height="12" rx="1"/><rect x="56" y="9" width="6" height="6" rx="1"/></svg>`,
  dumbbell: `<svg viewBox="0 0 64 24"><rect x="4" y="7" width="6" height="10" rx="1"/><rect x="12" y="10" width="4" height="4"/><rect x="16" y="11" width="32" height="2"/><rect x="48" y="10" width="4" height="4"/><rect x="54" y="7" width="6" height="10" rx="1"/></svg>`,
  bodyweight: `<svg viewBox="0 0 24 24"><circle cx="12" cy="4" r="2.6"/><path d="M12 8v7M12 8l-6 3M12 8l6 3M12 15l-5 7M12 15l5 7"/></svg>`,
  bench: `<svg viewBox="0 0 64 24"><rect x="4" y="4" width="4" height="16"/><rect x="56" y="4" width="4" height="16"/><rect x="2" y="10" width="60" height="4" rx="1"/></svg>`,
  cable: `<svg viewBox="0 0 24 24"><path d="M12 2v6"/><circle cx="12" cy="12" r="4"/><path d="M12 16v6M6 22h12"/></svg>`,
  stretch: `<svg viewBox="0 0 24 24"><circle cx="12" cy="4" r="2.4"/><path d="M12 7v6M12 7l-7 2M12 7l7 2M12 13l-4 8M12 13l4 8"/></svg>`,
  glove: `<svg viewBox="0 0 24 24"><path d="M7 12V6a2 2 0 1 1 4 0v5M11 11V4.5a2 2 0 1 1 4 0V11M15 11.5V6a2 2 0 1 1 4 0v9c0 4-3 7-7 7h-1c-3.5 0-6-2-7-5l-2-5.5c-.4-1 .1-2 1.1-2.3 1-.3 2 .2 2.3 1.1L7 13"/></svg>`,
};

const CATEGORY_META = {
  strength: { label: "Strength", accent: "var(--power)" },
  hypertrophy: { label: "Hypertrophy", accent: "var(--power)" },
  mobility: { label: "Mobility", accent: "var(--lime)" },
  mma: { label: "Skill / MMA", accent: "var(--sky)" },
};

function ex(id, name, sets, reps, rest, icon, cue, muscle) {
  const duration = String(reps).includes("min") ? 300 : 45;
  return { id, name, sets, reps, rest, duration, icon, cue, muscle, done: [] };
}

const DEFAULT_PROGRAM = {
  meta: {
    title: "PEAK — 4 Day Recomposition Program",
    subtitle: "Upper/Lower split · every muscle 2x/week · lean, strong, mobile",
  },
  days: [
    {
      id: "d1",
      code: "D1",
      name: "Upper — Strength",
      category: "strength",
      focus: "Heavy compound presses & pulls, low reps",
      exercises: [
        ex("d1e1", "Barbell Bench Press", 4, "5-6", 150, "barbell", "Bar to mid-chest, elbows ~45°, drive feet into floor.", "Chest"),
        ex("d1e2", "Weighted Pull-Ups", 4, "5-6", 150, "bodyweight", "Full hang to chin over bar, no kipping.", "Back"),
        ex("d1e3", "Overhead Press", 3, "6-8", 120, "barbell", "Brace core, bar path close to face, lock out overhead.", "Shoulders"),
        ex("d1e4", "Barbell Row", 3, "6-8", 120, "barbell", "Flat back, pull to lower ribs, squeeze shoulder blades.", "Back"),
        ex("d1e5", "Weighted Dips", 2, "8-10", 90, "bodyweight", "Lean forward slightly, descend to 90° elbow bend.", "Chest/Triceps"),
        ex("d1e6", "Face Pulls", 2, "15", 60, "cable", "Pull to forehead, thumbs back, pause 1s at the face.", "Rear Delts"),
      ],
    },
    {
      id: "d2",
      code: "D2",
      name: "Lower — Strength",
      category: "strength",
      focus: "Heavy squat pattern, posterior chain, low reps",
      exercises: [
        ex("d2e1", "Back Squat", 4, "5-6", 180, "barbell", "Hips and knees together, brace before descent, chest tall.", "Quads/Glutes"),
        ex("d2e2", "Romanian Deadlift", 3, "6-8", 150, "barbell", "Soft knees, hinge at hips, bar drags down shins.", "Hamstrings"),
        ex("d2e3", "Walking Lunges", 2, "10/leg", 90, "dumbbell", "Long stride, back knee lightly grazes floor, torso upright.", "Quads/Glutes"),
        ex("d2e4", "Lying Leg Curl", 3, "8-10", 90, "cable", "Slow eccentric, full squeeze at top, no hip lift.", "Hamstrings"),
        ex("d2e5", "Standing Calf Raise", 3, "10-12", 60, "bodyweight", "Full stretch at bottom, pause 1s at top.", "Calves"),
        ex("d2e6", "Hanging Leg Raise", 2, "12-15", 60, "bodyweight", "Curl pelvis, control the lowering, avoid swinging.", "Core"),
      ],
    },
    {
      id: "d3",
      code: "D3",
      name: "Mobility & Recovery",
      category: "mobility",
      focus: "10-15 min daily flex work — doubles as backflip/gymnastics prep",
      exercises: [
        ex("d3e1", "90/90 Hip Switches", 2, "8/side", 20, "stretch", "Rotate through the hips, keep both sit bones grounded.", "Hips"),
        ex("d3e2", "Ankle Dorsiflexion Rocks", 2, "10/side", 15, "stretch", "Knee tracks over toes, heel stays glued down.", "Ankles"),
        ex("d3e3", "Thoracic Open-Books", 2, "8/side", 20, "stretch", "Rotate from the mid-back, eyes follow the top hand.", "T-Spine"),
        ex("d3e4", "Band Shoulder Dislocates", 2, "10", 20, "stretch", "Wide grip, slow controlled pass over the head.", "Shoulders"),
        ex("d3e5", "Deep Squat Hold", 2, "60s", 30, "bodyweight", "Heels down, chest up, elbows press knees out.", "Hips/Ankles"),
        ex("d3e6", "Cossack Squats", 2, "8/side", 20, "bodyweight", "Sink hips back, keep loaded heel flat, opposite leg straight.", "Adductors"),
        ex("d3e7", "Bridge Hold", 2, "30-45s", 30, "stretch", "Push floor away, open the chest, squeeze glutes.", "Spine/Shoulders"),
      ],
    },
    {
      id: "d4",
      code: "D4",
      name: "Upper — Hypertrophy",
      category: "hypertrophy",
      focus: "Moderate load, higher reps, more isolation volume",
      exercises: [
        ex("d4e1", "Incline Dumbbell Press", 3, "8-12", 90, "dumbbell", "30° bench, press up and slightly in, control descent.", "Upper Chest"),
        ex("d4e2", "Seated Cable Row", 3, "8-12", 90, "cable", "Chest up, drive elbows back, pause at the squeeze.", "Back"),
        ex("d4e3", "Dumbbell Shoulder Press", 3, "10-12", 90, "dumbbell", "Neutral or slight rotation, don't flare elbows too wide.", "Shoulders"),
        ex("d4e4", "Wide-Grip Lat Pulldown", 3, "10-12", 90, "cable", "Lead with the elbows, slight lean back, full stretch on top.", "Lats"),
        ex("d4e5", "Lateral Raise", 3, "12-15", 60, "dumbbell", "Lead with elbows, stop at shoulder height, no swinging.", "Side Delts"),
        ex("d4e6", "Curl + Pushdown Superset", 3, "12-15", 60, "cable", "Superset biceps curl straight into triceps pushdown.", "Arms"),
      ],
    },
    {
      id: "d5",
      code: "D5",
      name: "Lower — Hypertrophy",
      category: "hypertrophy",
      focus: "Moderate load, higher reps, unilateral + isolation focus",
      exercises: [
        ex("d5e1", "Leg Press", 3, "10-12", 90, "cable", "Feet shoulder width, don't let lower back round off the pad.", "Quads"),
        ex("d5e2", "Bulgarian Split Squat", 3, "10/leg", 90, "dumbbell", "Rear foot elevated, torso slight forward lean, front heel drives.", "Quads/Glutes"),
        ex("d5e3", "Hip Thrust", 3, "10-12", 90, "barbell", "Chin tucked, drive through heels, full lockout squeeze.", "Glutes"),
        ex("d5e4", "Leg Extension", 3, "12-15", 60, "cable", "Slight pause at top, controlled negative.", "Quads"),
        ex("d5e5", "Seated Calf Raise", 3, "12-15", 60, "cable", "Full stretch at bottom, deliberate top pause.", "Calves"),
        ex("d5e6", "Cable Crunch", 3, "15", 60, "cable", "Round the spine, crunch down toward the knees, exhale hard.", "Core"),
      ],
    },
    {
      id: "d6",
      code: "MMA",
      name: "MMA Skill & Conditioning",
      category: "mma",
      focus: "Technical drilling + high-output conditioning, low joint load",
      exercises: [
        ex("d6e1", "Striking Fundamentals", 3, "5 min rounds", 60, "glove", "Jab-cross-hook combos on pads or shadow, stay light on feet.", "Striking"),
        ex("d6e2", "Clinch & Takedown Entries", 3, "5 min rounds", 60, "glove", "Level changes, double/single leg entries, drill both sides.", "Wrestling"),
        ex("d6e3", "Ground & BJJ Basics", 3, "5 min rounds", 60, "glove", "Guard retention, hip escapes, basic submissions from mount.", "Grappling"),
        ex("d6e4", "Conditioning Circuit", 4, "60s on/30s off", 30, "glove", "Rotate: burpees, mitt combos, sprawls, battle ropes.", "Full Body"),
      ],
    },
  ],
};
