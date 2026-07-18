# NE6DMCP — Control your Nord Electro 6D from Claude

A local [MCP](https://modelcontextprotocol.io) server that lets you **shape sounds
on a USB-connected Nord Electro 6D by talking to Claude Desktop in plain language.**

> *"Give me a slow jazz B3: 888000000, C3 chorus, slow rotary."*
> *"Warm electric piano with a light tremolo and some Hall reverb."*
> *"Recall program B:23, then brighten the sample synth a bit."*

Claude turns your request into a set of named parameter changes; this server
translates them into the exact MIDI CC messages and applies them to your
instrument live. You stay in the loop — Claude proposes and applies, **you** are
the ears. When the sound is right, press **Store** on the instrument.

This is a fork of [gbulfon/ns4mcp](https://github.com/gbulfon/ns4mcp) (Nord
Stage 4), adapted for the Nord Electro 6D:

- 🎛️ **77 parameters** across organ (all 9 drawbars, model, vibrato/chorus,
  percussion), piano (type/model/variation, timbre), sample synth
  (attack/decay, filter, dynamics) and the full effects chain (Effect 1/2,
  delay, amp/rotary, EQ, reverb).
- 🎼 **Program recall**: `select_program` switches to any program slot
  (e.g. bank B, location 23) via Bank Select + Program Change — great for
  setlists.
- 🗣️ **Talk in musical terms**, not MIDI bytes. Claude picks the parameters.
- 🔊 **Audition + undo** built in: snapshot a sound, try variations, A/B, restore.
- 🎹 **Play notes & melodies** through the current sound to hear changes instantly.
- ✨ Compared to the Stage 4 original, the Electro 6 speaks **plain MIDI CC
  only** (no NRPN) — simpler and more robust. The schema is transcribed 1:1
  from the official manual's MIDI Controller List (v2.6x Edition J, Appendix II).

## What canNOT be done over MIDI (by design, on all Nords)

- **Naming or storing programs** — press Store on the instrument; rename in
  Nord Sound Manager.
- **Loading new pianos/samples** — Nord Sound Manager only.
- **Addressing sounds by name** ("White Grand Med") — only categories and
  model/variation indices travel over MIDI; pick exact sounds on the panel.

## Quick start (Claude Desktop)

You need: a **Nord Electro 6D** connected over **USB**, **Node.js ≥ 18**, and
**[Claude Desktop](https://claude.ai/download)**. macOS and Linux are supported.

### 1. Get the code and build it

```
git clone https://github.com/g1ga/ne6dmcp.git
cd ne6dmcp
npm install        # also compiles the native MIDI module
npm run build      # produces dist/index.js (this is what Claude runs)
```

> **Build prerequisites for the native MIDI module:**
> - **macOS** — Xcode Command Line Tools: `xcode-select --install` (CoreMIDI works out of the box).
> - **Linux** — ALSA headers: `sudo apt install libasound2-dev`.

Confirm the Nord is visible to the computer:

```
npm run doctor     # lists MIDI ports; exits 0 when the Nord is found
```

### 2. Set up the Nord for MIDI (once)

On the Electro 6D, open the **MIDI menu** (Shift + MIDI) and check:

- **USB MIDI is active** and note the **Global channel** (default 1; the
  default config below assumes 1).
- **Control Change send/receive = On** — panel knobs/buttons are transmitted
  and received as CC.
- **Program Change send/receive = On** if you want `select_program` to work.
- **Local Control = On** (normal standalone use).

### 3. Tell Claude Desktop about the server

Open Claude Desktop's config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add a `nord-electro-6d` entry under `mcpServers` (merge with anything already there):

```json
{
  "mcpServers": {
    "nord-electro-6d": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/ne6dmcp/dist/index.js"],
      "env": { "NE6_CHANNEL": "1" }
    }
  }
}
```

- Replace `/ABSOLUTE/PATH/TO/ne6dmcp` with the real path (run `pwd` in the project folder).
- Set `NE6_CHANNEL` to your Nord's global MIDI channel if it isn't `1`.
- **macOS tip:** if Claude Desktop can't find `node`, use the absolute path —
  `which node` (often `/opt/homebrew/bin/node` with Homebrew) — as `"command"`.

### 4. Restart Claude Desktop and try it

Fully **quit and reopen** Claude Desktop. You should see the **nord-electro-6d**
tools available. Then just ask:

> *"List the organ parameters."*
> *"Set up a gospel B3: all drawbars out, C3 chorus, fast rotary, some drive."*
> *"Play a C major chord so I can hear it."*
> *"Now the ballad version: 888800000, slow rotary, touch of reverb."*

## Tools (what Claude has access to)

| Tool                  | Purpose                                                                       |
| --------------------- | ----------------------------------------------------------------------------- |
| `list_parameters`     | List parameters (filter by section/query) with ranges, hints, current values. |
| `get_patch_state`     | The current authoritative patch as JSON.                                      |
| `set_parameters`      | Apply a diff of named changes; validates and emits the right MIDI CC.         |
| `select_program`      | Recall a program slot (bank + location) via Bank Select + Program Change.     |
| `play_notes`          | Play notes as a chord/arpeggio to audition the sound.                         |
| `play_sequence`       | Play a timed melody (notes + rests at a tempo) in one call.                   |
| `snapshot`            | Save current state for A/B compare and undo.                                  |
| `restore`             | Restore a snapshot (default most recent) and re-send to the Nord.             |
| `audition_variations` | Step through N proposed variations to choose between.                         |
| `randomize`           | Mutate selected parameters within musical ranges.                             |

Resources: `ne6://schema` (all parameters) and `ne6://patch` (live state).

## Calibrating enumerated selectors

**The shipped values are hardware-calibrated** (2026-07-18, Nord Electro 6D):
selector positions are spread evenly over the full 0-127 range
(`value_i = ceil(i * 127 / (N - 1))`), verified in both directions (panel
readback + write-tests) for organ model, vibrato/chorus, Effect 1 (8 positions),
Effect 2 (Vibe last), Amp/Spkr (6 states incl. None and Comp), reverb, rotary
speed and the O/P/S sources. Notable hardware findings: piano type/model CCs are
**dump-only** — switch pianos via `select_program` (Bank MSB 3); vibrato
positions are skipped by the panel on non-B3 models.

Still uncalibrated (defaults may be off): piano EQ/timbre, KBD split states.
To calibrate a selector yourself:

```
npm run listen     # print inbound MIDI while you move panel controls
```

Click through a selector on the panel and note the CC values it transmits, then
adjust the option lists in `src/schema/options.ts` and run `npm run build-schema`.
Panel moves are also read back into `ne6://patch` live state automatically.

## Troubleshooting

| Symptom                                    | Fix                                                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Tools don't appear in Claude Desktop       | Did you `npm run build`? Is the path in the config absolute and correct? Fully quit & reopen Claude Desktop.         |
| Nothing happens at all                     | `npm run doctor` — is the Nord detected? Check USB and MIDI menu. Confirm `NE6_CHANNEL` matches the global channel.  |
| Parameters change but program recall doesn't | Enable Program Change receive in the MIDI menu.                                                                     |
| A selector lands on the wrong option       | Calibrate it — see "Calibrating enumerated selectors".                                                               |
| "node: command not found" in Claude logs   | Use the absolute path to node as `"command"` (`which node`).                                                         |

You can sanity-check the whole pipeline without the instrument:

```
npm run smoke      # builds, then drives the server in --dry-run over MCP
```

## How it works

- **Claude works in named, normalized parameters** (`organ.drawbar-1`,
  `effect2.rate`), never raw MIDI bytes. It does the musical reasoning.
- **This server is a deterministic translator** to MIDI CC (see
  `src/midi/messages.ts`, `src/translate.ts`).
- **The schema is generated** by `npm run build-schema` from a table transcribed
  from the official manual (`scripts/build-schema.ts`), merged with curated
  option names (`src/schema/options.ts`) and sound-design hints
  (`src/schema/hints.ts`).
- **You judge the sound.** The server can't hear — `snapshot` /
  `audition_variations` / `restore` give you A/B and undo.

### Architecture

- `src/midi/messages.ts` — pure CC / Program Change byte builders.
- `src/midi/device.ts` — `MidiDevice` interface + `RtMidiDevice` (`@julusian/midi`, lazily loaded); mockable.
- `src/midi/nord.ts` — Nord-specific send paths bound to a channel.
- `src/translate.ts` — named change → validated value → MIDI send.
- `src/state/patch.ts` — authoritative state, snapshot stack, inbound CC reconciliation.
- `src/server.ts` — MCP tools + resources (transport-agnostic; stdio today).
- `src/index.ts` — stdio transport entrypoint.

## Attribution & license

- **Code:** MIT, forked from [gbulfon/ns4mcp](https://github.com/gbulfon/ns4mcp)
  — the architecture, translation layer, state management and tooling are his
  work; this fork adapts them to the Electro 6D.
- **Parameter data:** transcribed from the official
  [Nord Electro 6 User Manual](https://www.nordkeyboards.com/downloads/downloads-nord-electro-6)
  (v2.6x Edition J), Appendix II: MIDI Controller List.
- *Nord* and *Nord Electro* are trademarks of Clavia DMI AB; this is an
  independent, unofficial project.
