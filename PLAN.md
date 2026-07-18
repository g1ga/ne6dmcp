> **Fork note (ne6dmcp):** this document is the upstream ns4mcp (Nord Stage 4)
> design plan, kept for reference. The Electro 6D fork keeps the same phased
> architecture but drops all synth/NRPN phases (the Electro 6 is CC-only) and
> adds program recall (`select_program`).

# NORD Electro 6D MCP Server — Project Plan

> Persistent project memory. Single source of truth for goals, architecture, and
> phased execution. Update this file as decisions are made and phases complete.

## Goal

A **local MCP server** (Node.js/TypeScript, **stdio** transport) that exposes a
USB-attached **NORD Electro 6D** as a set of MCP tools, so an MCP client (Claude
Desktop) can **read and modify synth patch parameters from natural-language
requests**.

**Division of responsibility:**
- The **model** does the semantic work: natural language → named-parameter diff.
- The **server** is a reliable, deterministic translator between **named
  parameters** and **Nord MIDI** (CC / NRPN / 14-bit NRPN).

## Stack

- Node.js + TypeScript
- `@modelcontextprotocol/sdk` — MCP server, stdio transport
- `@julusian/midi` — low-level MIDI I/O (**raw bytes — required for NRPN**; CCs too)
- Optionally `easymidi` for ergonomics, **but raw byte control must remain available**
- **Architect the transport behind an interface** so an HTTP/SSE transport can be
  added later without redesign.

## Design constraints (hold throughout)

1. The model works in **named, normalized parameters** — never raw MIDI bytes.
   All byte-level specifics (CC vs NRPN vs 14-bit NRPN, ordering, center offsets)
   live in the **translation layer**.
2. The server is a **deterministic translator**; all semantic reasoning stays
   client-side.
3. **Human-in-the-loop for audio judgment** — never assume the server can perceive
   sound.
4. Keep the **transport abstracted** for a future remote/HTTP option.
5. The midi.guide data is **community-contributed** — validate against the
   **official manual** and against **real hardware** (Phase 1 send tests); the
   **manual is authoritative on conflict**.

---

## Environment prerequisites (verify FIRST, before any feature work)

- Confirm native build toolchain for the rtmidi addon (**node-gyp**).
  - macOS: CoreMIDI works out of the box.
  - Linux: ALSA dev headers required.
- **Enumerate available MIDI ports** and confirm the Nord Electro 6D is visible
  before building anything else.
- Provide a **`doctor` / diagnostic script** that lists ports and flags whether
  the Nord is detected.

---

## Phase 1 — MIDI foundation & device discovery

1. Initialize the TS project; install deps; set up build/run/lint scripts.
2. Open the Nord's input and output MIDI ports; handle connect/disconnect
   gracefully.
3. Implement and **hardware-test three low-level send paths**:
   - **Plain CC** — e.g., Synth Filter Frequency = **CC 59**.
   - **NRPN** — NRPN MSB (**CC 99**) / NRPN LSB (**CC 98**) + Data Entry MSB
     (**CC 6**), correct ordering, and (where needed) Data Entry LSB (**CC 38**).
   - **14-bit NRPN special case** — Synth "Sample category and sample"
     (**NRPN MSB 3 / LSB 4**): Data Entry MSB selects **category**, Data Entry
     LSB selects **sample**. Handle distinctly.
4. Verify we can **both send changes and receive** parameter/CC data back from the
   Nord (for state reconciliation).

> Note: **SysEx is NOT needed** for live per-parameter tweaking. It's only for
> whole-program/controller dumps — defer to a later phase.

---

## Phase 2 — Parameter schema (fetch + transform, reproducible in-repo)

**Primary source** — community CC/NRPN database (CSV), **CC BY-SA 4.0**:
- CSV: https://midi.guide/d/nord/stage-4/csv/
- Human-readable reference: https://midi.guide/d/nord/stage-4/
- ~146 parameters. Columns: section, parameter name, CC, NRPN MSB, NRPN LSB,
  range, orientation (0-based vs Centered).

**Authoritative tiebreaker** — official Nord manual (use if anything conflicts;
the community DB is third-party):
- Download page: https://www.nordkeyboards.com/downloads/downloads-nord-stage-4
- Target file: **Nord Electro 6D User Manual v1.2X Edition K (English)** — see
  "Controlling the Nord Electro 6D using MIDI" + the MIDI Controller list / MIDI
  Implementation Chart appendix.

**Tasks:**
- Write a **reproducible fetch+transform script** (committed) that downloads the
  CSV and converts it to the project's parameter-schema JSON. **Don't hand-copy
  values** — the transform must be re-runnable when upstream CSV updates.
- Record **source URL, license (CC BY-SA 4.0, with attribution), and fetch date**
  in the output.

**Schema shape per parameter:**
- `name`
- `section` (organ / piano / synth / synth-oscillator / synth-filter / ... /
  delay / reverb / compressor / etc.)
- `addressing` (`cc` | `nrpn` | `nrpn14`)
- relevant `cc` number **or** `nrpnMsb` / `nrpnLsb`
- `range`
- `orientation` (`unipolar` | `bipolar`)
- short **semantic hint** (e.g., "filter frequency — brightness/openness";
  "amp envelope attack — how fast the note speaks")

**Honor orientation:** centered params (A/B/C pan, oscillator Pitch coarse/fine)
are **bipolar** — model should reason in **−/0/+ with 64 as center**, not raw
0–127.

**Also record:**
- Panel controls that are **NOT MIDI-addressable**.
- **SysEx-only operations** (program/controller dumps) as **out-of-scope for live
  tweaking**.

---

## Phase 3 — Core MCP tools

- `list_parameters` — return schema (names, sections, ranges, orientation,
  current values, semantic hints).
- `get_patch_state` — current in-memory patch as JSON.
- `set_parameters` — accept a **diff** of named params; validate against
  ranges/orientation; translate to correct CC/NRPN/14-bit-NRPN messages; apply
  live; update state.
- Expose the **parameter schema** and **current patch** as **MCP resources** so
  the client model always has them in context without a tool round-trip.
- Maintain **authoritative in-memory patch state**; reconcile with values read
  back from the Nord where possible.

---

## Phase 4 — Iteration & experimentation tools

- `snapshot` / `restore` — push/pop patch states for A/B compare and undo (history
  stack).
- `audition_variations` — accept N proposed diffs and step through them so the
  user can listen and confirm (human-in-the-loop; the AI can't hear output).
- `randomize` — mutate selected parameters within constrained ranges (respecting
  orientation) for happy-accident sound design.

---

## Phase 5 — Polish

- Robust error handling: device unplugged mid-session, out-of-range values,
  malformed diffs, NRPN ordering edge cases.
- **README** with: Claude Desktop MCP config (stdio server registration), the
  `doctor` diagnostic, and clear **attribution for the midi.guide dataset
  (CC BY-SA 4.0)**.
- Optional: log applied diffs alongside the model's one-line rationale for
  traceability.
- Optional / future: **SysEx-based full-program dump & restore** (from the
  manual's dump section) for true patch save/load beyond per-parameter snapshots.

---

## Proposed repo layout (to be confirmed during Phase 1)

```
NE6DMCP/
  PLAN.md                 # this file
  README.md               # Phase 5
  package.json
  tsconfig.json
  src/
    index.ts              # MCP server entrypoint (stdio)
    transport/            # transport abstraction (stdio now, HTTP/SSE later)
    midi/
      port.ts             # open/close, connect/disconnect handling
      send.ts             # CC / NRPN / NRPN14 send paths
      receive.ts          # readback for state reconciliation
    schema/
      parameters.json     # generated by fetch+transform (Phase 2)
      types.ts
    state/
      patch.ts            # authoritative in-memory state + snapshots
    tools/                # list_parameters, get_patch_state, set_parameters, ...
  scripts/
    doctor.ts             # list MIDI ports, detect Nord
    fetch-schema.ts       # download CSV + transform → parameters.json
```

---

## First actions for Claude Code

1. Run environment prereq checks and scaffold the project.
2. Build and hardware-test the three MIDI send paths (CC, NRPN, 14-bit NRPN) —
   Phase 1.
3. Write the reproducible CSV fetch+transform to generate the parameter-schema
   JSON — Phase 2.

---

## Key reference facts (quick lookup)

| Item | Value |
|---|---|
| Synth Filter Frequency | CC 59 |
| NRPN MSB controller | CC 99 |
| NRPN LSB controller | CC 98 |
| Data Entry MSB | CC 6 |
| Data Entry LSB | CC 38 |
| Sample category+sample (14-bit NRPN) | NRPN MSB 3 / LSB 4 (MSB=category, LSB=sample) |
| Bipolar center value | 64 |
| Param count (approx) | ~146 |
| Dataset license | CC BY-SA 4.0 (midi.guide), attribution required |
| Manual | Nord Electro 6D User Manual v1.2X Edition K (English) |

## Status log

- 2026-06-02 — Project plan captured in PLAN.md.
- 2026-06-02 — **Phases 1–4 built and tested (software).**
  - Env verified: Node 23.5, npm 10.9, Python 3.14, clang/Xcode CLT — native
    `@julusian/midi` addon builds & loads. SDK `@modelcontextprotocol/sdk` 1.29,
    zod 4.4.
  - Project scaffolded (`package.json`, `tsconfig` + `tsconfig.build.json`,
    scripts). Clean typecheck + build; `dist/index.js` is the stdio entrypoint.
  - **MIDI layer**: pure CC/NRPN/14-bit-NRPN byte builders
    (`src/midi/messages.ts`); `MidiDevice` interface + `RtMidiDevice`
    (`src/midi/device.ts`); Nord send paths (`src/midi/nord.ts`).
  - **doctor verified against real hardware** — Nord Electro 6D detected on input
    ("Nord Electro 6D MIDI Output") and output ("Nord Electro 6D MIDI Input").
  - **Phase 2 schema**: reproducible `fetch-schema` downloads midi.guide CSV →
    `src/schema/parameters.json`. 146 params (95 cc / 50 nrpn / 1 nrpn14), 5
    bipolar, 40 curated hints. Source/license/date recorded. Confirmed
    `synth-filter.frequency`=CC59, sample=NRPN 3/4 (0–16383), pitch-coarse
    bipolar center 64. Section-qualified ids resolve name collisions.
  - **Phase 3+4 MCP server**: 7 tools (list_parameters, get_patch_state,
    set_parameters, snapshot, restore, audition_variations, randomize) +
    `ne6://schema` / `ne6://patch` resources. Controller with graceful
    connect/reconnect, dry-run, inbound NRPN reconciliation, rationale logging.
  - **End-to-end smoke test passes (16/16)** in dry-run over real MCP stdio:
    validation, range/unknown-id errors, NRPN14 split, CC bytes `[176,59,100]`,
    state tracking, snapshot→randomize→restore.
  - **Phase 5**: README with Claude Desktop config, doctor, attribution. Robust
    error handling in place.
- 2026-06-02 — **Hardware `midi-test` run.** All three send paths emit
  byte-correct MIDI (verified from wire dump): CC `b0 3b XX`; NRPN
  `b0 63/62/06`; 14-bit NRPN `b0 63 03 / 62 04 / 06 <cat> / 26 <sample>`.
  **Inbound reception confirmed** — 129 Note On/Off messages received from the
  Nord during the test (keyboard play). NOTE: no CC/NRPN echo observed — the Nord
  likely needs "MIDI CC send" enabled in its System/MIDI menu for panel-edit
  reconciliation; notes flow regardless.
  - STILL UNCONFIRMED (needs user's ears): whether the instrument responded
    *audibly* (filter sweep dark→bright; sample swap on path 3).
- 2026-06-02 — **Phase 1 AUDIBLY CONFIRMED.** Via `audition-debug` (server plays
  notes + drives layer enables), user heard both a piano arpeggio and a synth
  chord. Proves: MIDI note-in triggers the engine; CC sends drive layer
  enable/level/filter/amp-env; full send chain works by ear. Layer enable CCs
  validated: piano section-enable CC33/CC3, synth section-enable CC42/CC5,
  organ CC9/CC2, synth A level CC43, piano A level CC34, global volume CC7.
  Note: server can play notes via NordMidi.noteOn/noteOff (added). Earlier
  `audition-synth` silence was a bad demo start value (filter cutoff 0 on low
  notes), not a bug. New scripts: `audition-synth`, `audition-debug`.
- 2026-06-02 — **`play_notes` tool added + schema manual-verified.**
  - `play_notes` MCP tool (now 8 tools): server plays chords/arpeggios so the
    human can audition the current sound. `NordMidi.noteOn/noteOff/allNotesOff`,
    `controller.playNotes` with duration cap + try/finally + All-Notes-Off safety.
  - **Manual cross-check (Edition K, Appendix II):** every CC/NRPN value matches
    the community DB — no conflicts. Pan CC40/41/36 bipolar, pitch CC55/47,
    Global CC8/31/118 all present and correct.
  - **CRITICAL FIX — NRPN transmission was wrong.** Manual (verbatim p.66): value
    goes in **CC#38 (Data Entry LSB)**, CC#6 (Data Entry MSB)=0, full 4-message
    packet CC99/CC98/CC6/CC38. Old `buildNRPN` put the value in CC6 and omitted
    CC38 → all 50 standard NRPN params would have failed. Fixed (manual is
    authoritative per design constraint). The 14-bit sample case (CC6=category,
    CC38=sample) was already correct. NOT yet hardware-confirmed audibly — manual
    + unit test only; the earlier audible confirmation was CC-only.
  - Refactored `translate.ts` into pure `buildChange` (byte-accurate, used by
    dry-run) + `applyChange` (sends). Smoke now asserts the NRPN byte layout.
  - Schema `source.validation` records the manual cross-check; README documents
    the NRPN format. Smoke: 17/17 pass.
- 2026-06-02 — **NRPN root-caused to a device setting (not a code bug).** On
  hardware, all NRPN was ignored while CC worked. Manual (Edition K p.55/60):
  MIDI menu **page 7 "Control/NRPN/Device Mode" → Type** must be **"CC & NRPN"**;
  if "CC", the Nord receives CC but discards NRPN — exactly the symptom. Companion
  "Ctrl" filter gates CC+NRPN together (user's working CC proves Ctrl already
  receives). **ACTION ON THE INSTRUMENT (user):** Shift+Program(MIDI menu) →
  page 7 → Type="CC & NRPN", Ctrl=Receive/Send&Receive. Then re-run
  `npm run nrpn-test`. Diagnostic scripts added: `nrpn-test`, `nrpn-diagnose`
  (3-stage CC-sanity / NRPN-new / NRPN-old), `nrpn-fx-test` (reverb/delay toggle).
  Manuals saved to docs/ (gitignored). Value-byte (CC38 vs CC6) still to be
  settled empirically once NRPN reception is enabled; code uses CC38 (manual
  verbatim).
- 2026-06-02 — **NRPN FULLY CONFIRMED on hardware after enabling the Nord
  setting.** User set MIDI menu page 7 Type="CC & NRPN". Re-tests: Delay enable
  (2/88), Reverb enable/amount/type (2/104, CC113, 2/105) all toggle audibly.
  **Value byte settled: CC38 (Data Entry LSB) is correct** — matches manual and
  `buildNRPN`. ALL THREE SEND PATHS now hardware-proven audibly (CC, NRPN, and
  NRPN14 by the same mechanism). Added `reverb-test`; README now documents the
  required Nord NRPN setting. PHASE 1 COMPLETE end-to-end.
- 2026-06-02 — **Category-by-name selection added.** Design decision (user):
  address sound CATEGORIES, not individual loaded sound names (names aren't sent
  over MIDI — only on the Nord display; user picks the exact model themselves).
  Added `SelectorOption`/`options` to schema, `src/schema/options.ts` (curated),
  fetch-schema merge, label→value resolution in translate, `label` field on
  set_parameters. `piano.type` populated with the 6 documented categories
  (Grand/Upright/Electric Piano/Clav-Harpsichord/Digital/Misc) at midpoint values
  [11,32,53,75,96,117]. Model can now do `set_parameters {id:'piano.type',
  label:'Grand'}`. New `browse-sounds` script (organ/piano/synth). Smoke 20/20.
  Organ models + synth categories intentionally NOT baked in yet — pending
  hardware confirmation of their value→label order.
- 2026-06-02 — **All documented synth/organ selector options added** (user
  request). 15 params now carry named `options` (was 1): organ model/vibrato-
  type/percussion-harmonic; synth voice-mode/priority/unison, filter
  type/drive/kbd-track, lfo waveform/destination, arp mode/direction,
  vibrato.mode. Extracted from manual (Edition K, Organ pp.18-21, Synth
  pp.28-36) via research agent. Midpoint value mapping assumed; **piano.type
  confirmed, organ/synth NOT yet hardware-verified** (flagged in options.ts +
  README). `synth.waveform` 3/2 omitted (context-dependent, not flat enum).
  Also added `play_sequence` tool (timed melodies) + fixed a beats-clamp bug
  (Math.max(1,..) floored sub-beat notes to 1 beat). Build clean, smoke green.
- 2026-06-02 — **All 15 documented selectors hardware-verified** (3 corrections:
  lfo.destination +Off, vibrato.mode +Off, filter.type order). **Synth oscillator
  fully discovered** by listening to panel transmissions (`npm run listen --raw`):
  it's THREE undocumented NRPNs — 3/1 Type, 3/2 Category, 3/3 Wave (literal
  index) — now in src/schema/extra-params.ts as synth-oscillator.type/category/
  wave (schema = 148 params). Noise reachable: Analog/Misc/wave1=Red,
  Analog/Pure/wave6=White. Wind patch = `npm run wind`. **NRPN pacing fix:**
  Nord drops fast NRPN bursts (esp. oscillator reload) — applyBatch now async +
  paces (cc 12ms / nrpn 150ms); all callers await.
- **Deferred / future:** map FM/Wave-type oscillator categories + per-category
  wave names (only Analog noise/basic mapped); SysEx full-program dump & restore;
  HTTP/SSE transport; play_sequence timing regression test; panel→server CC/NRPN
  readback reconciliation (Ctrl=Send confirmed working).
