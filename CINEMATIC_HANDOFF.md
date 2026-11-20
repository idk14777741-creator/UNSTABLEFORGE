# Cinematic Homepage Handoff — The Forge Sequence

## Approach

The existing Express/SQLite/React application was kept intact. Only the visitor-facing homepage changed:

- `/` is now one pinned, scroll-driven WebGL journey.
- The previous homepage sections (idea, challenge, tracks, journey, stakes, latest dispatches, participation, FAQ, final CTA) moved to a real `/brief` route, so no content, link target or editor copy was lost.
- One dependency was added: **`three`** (`^0.187.0`). It is only imported through dynamic `import()` inside the homepage worlds, so `/brief`, `/projects`, `/register`, `/admin` and the auth pages do not pay for it.
- No API, schema, auth or authorization behaviour changed.

Every animation is a pure function of a single normalised scroll progress value (plus slow ambient time). That is what makes reverse scrolling rewind the film exactly, with no timeline library and no state accumulation.

## Scene map

| Scene | Where | What happens |
|---|---|---|
| 01 The Spark | `forgeWorld.js` p 0 – 0.14 | Dark hall, burning furnace, embers, smoke, anvil; caption “Before something exists, someone imagines it.” |
| 02 The Raw Idea | p 0.14 – 0.32 | Camera moves in on a glowing billet; the hydraulic hammer establishes scale |
| 03 The Forging | p 0.32 – 0.60 | Three strikes at p 0.44 / 0.505 / 0.565: ram travel, sparks, shockwaves, camera impulse, ingot deformation, then three fragments |
| 04 The Revelation | p 0.60 – 1.0 | Fragments rise into three nested forged C's on a mounted plate; `C × C × C` → `C³` → `CRESCENT CODE CLASH` → `CODE. COMPETE. CONQUER.`; the hall dims to give the mark the frame |
| 05 The Portal | `constellationWorld.js` p 0 – 0.16 | The mark becomes a ringed passage; the camera passes through it into a particle field |
| 06 The Constellation | p 0.16 – 0.86 | Particles settle into a spatial field of warm nodes with fine threads and pointer parallax |
| 07 The Possibilities | p 0.24 – 0.90 | 12 challenge domains as real buttons anchored to their lights; hover/focus/tap highlights the node and its paths; editorial side panel |
| 08 The Invitation | `ForgedExperience.jsx` `<Ending />` | The field contracts to an ember; “The forge is ready. What will you create?” with `ENTER C³` → `/register` and `EXPLORE CREATIONS` → `/projects` |

## Files

### Created

- `src/cinematic/forgeWorld.js` — the forge scene, materials, camera keys, hammer keys, sparks, shockwaves, emblem
- `src/cinematic/constellationWorld.js` — portal ring, particle field, domain nodes, connecting threads, contraction
- `src/cinematic/ForgedExperience.jsx` — the pinned homepage shell, typography timing, HUD, loader, skip, static/reduced version
- `src/cinematic/ConstellationScene.jsx` — pinned constellation section, node buttons, panel, static field
- `src/cinematic.css`, `src/constellation.css`
- `src/data/challengeDomains.js` — the domain list (id, name, note); the constellation lays out every entry automatically
- `src/pages/BriefPage.jsx` — the former homepage sections at `/brief`
- `CINEMATIC_HANDOFF.md`

### Modified

- `src/App.jsx` — `/` renders the experience, `/brief` added, footer/scroll progress assembled only outside the film
- `src/components/Nav.jsx`, `Footer.jsx`, `src/data/site.js` — section links now target `/brief#…`; cinematic nav treatment on `/`
- `src/main.jsx` — imports the new stylesheets
- `README.md` — routes, scene documentation and stack entry

## Asset requirements

The repository contains **no genuine ALTA event photography, footage or official C³ brand artwork**. Nothing was fabricated to fill the gap:

- Everything in scenes 01–06 is procedural three.js geometry, canvas-generated textures and physically based materials.
- Scene 05 therefore uses an abstract material transition (forged ring → particle field) instead of a hard cut to real event footage.
- **Needed later:** real event photography or short footage of the ALTA venue/participants, plus an official C³ mark if one exists. When supplied, scene 05 is the insertion point and the forged emblem can be replaced by the real mark.

## Verification actually run

- `npm run build` — passed (93 modules; `three` split into its own lazy chunk).
- `npm run test:api` — **96 passed, 0 failed** (unchanged suite, no assertions weakened).
- Homepage loaded in headless Chrome with console capture: **no exceptions, no errors, no warnings**.
- Desktop scene checks at scroll progress 0.05 / 0.44 / 0.72 / 0.76 / 0.9 and constellation 0.02 / 0.3 / 0.55 / 0.97 / ending.
- Reverse scroll: scrolled to 0.42 then back to 0.06 — the opening caption returned to opacity 1 / visible, confirming the sequence rewinds.
- Constellation interaction: clicking node 4 changed the panel from “Twelve places to begin.” to “Smart Automation”, with exactly one `aria-pressed="true"` node and 12 interactive nodes mounted.
- Auth guards: `/register` → `/login?next=%2Fregister`, `/admin` → `/login?next=%2Fadmin`.
- `/brief` renders the editorial brief; `/projects` renders unchanged.
- Mobile (390×844): framing checked at the strike, the emblem and the constellation — camera pulled back, emblem uncropped, bottom panel readable.
- `prefers-reduced-motion: reduce` and a WebGL-disabled browser both render the static journey instead of a canvas, with no errors.

## Known limitations

- The revelation has a dark foreground shape that occludes the lower middle of the emblem in some framings. It is not a shadow (no shadow maps are used) and was not identified; the composition reads, but it is the weakest pixel-level detail in the sequence.
- The static/reduced alternative is a designed editorial fallback, not a shorter film.
- No real event footage exists, so scene 05–06 are entirely abstract (see above).
- The showcase and registration flows are unchanged, so their own known limitations from the Day 11/12 handoffs still apply.
- Mobile uses a shorter pinned length; the story is identical but less leisurely.
