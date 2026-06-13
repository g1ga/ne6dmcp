# NS4MCP — Control your Nord Stage 4 from Claude

A local [MCP](https://modelcontextprotocol.io) server that lets you **shape sounds
on a USB-connected Nord Stage 4 by talking to Claude Desktop in plain language.**

> *"Make the synth brighter and a touch slower to speak."*
> *"Give me a warm electric piano and play Frère Jacques."*
> *"Turn the lead into a supersaw and open the filter."*

Claude turns your request into a set of named parameter changes; this server
translates them into the exact Nord MIDI messages (CC / NRPN / 14-bit NRPN) and
applies them to your instrument live. You stay in the loop — Claude proposes and
applies, **you** are the ears.

- 🎛️ **146 parameters** across piano, organ, and synth — filters, envelopes, LFO,
  arp, effects, oscillator.
- 🗣️ **Talk in musical terms**, not MIDI bytes. Claude picks the parameters.
- 🔊 **Audition + undo** built in: snapshot a sound, try variations, A/B, restore.
- 🎹 **Play notes & melodies** through the current sound to hear changes instantly.

---

## Install

You need a **Nord Stage 4** connected over **USB** and **[Claude Desktop](https://claude.ai/download)**.
Pick one of the two install paths below, **then do the [Nord MIDI setup](#set-up-the-nord-for-midi-required-do-this-once)**.

### Option A — Download an installer (recommended, nothing else to install)

Grab the installer for your OS from the **[Releases page](https://github.com/gbulfon/ns4mcp/releases)**.
Each one bundles a Node runtime + the app and **configures Claude Desktop for you** —
no Node, no developer tools, no editing config files.

| OS | Download | Notes |
|---|---|---|
| **macOS** | `NS4MCP-<ver>-macos-arm64.pkg` (Apple Silicon) · `…-x64.pkg` (Intel) | Signed & notarized — double-click to install. |
| **Windows** | `NS4MCP-<ver>-windows-x64-setup.exe` | Installs per-user (no admin). It's **unsigned**, so Windows SmartScreen warns: click **More info → Run anyway**. |
| **Linux** | `NS4MCP-<ver>-linux-x64.tar.gz` | `tar -xzf` it, then run `./ns4mcp/install.sh`. |

When it finishes, do the Nord setup below and **quit & reopen Claude Desktop**.

<details>
<summary>How to uninstall</summary>

- **macOS:** `sudo /usr/local/ns4mcp/runtime/node /usr/local/ns4mcp/configure-claude.mjs --uninstall && sudo rm -rf /usr/local/ns4mcp`
- **Windows:** Settings → Apps → *NS4MCP* → Uninstall (also removes the Claude entry).
- **Linux:** `~/.local/share/ns4mcp/uninstall.sh`
</details>

### Option B — From source (developers)

Requires **Node.js ≥ 18**. The native MIDI module ships prebuilt binaries, so this
normally needs **no compiler**.

```bash
git clone git@github.com:gbulfon/ns4mcp.git
cd ns4mcp
npm install        # installs deps (prebuilt MIDI binary — no build step needed)
npm run build      # produces dist/index.js (this is what Claude runs)
npm run doctor     # lists MIDI ports; exits 0 when the Nord is found
```

> Only if `npm install` falls back to compiling (rare): **macOS** needs Xcode CLT
> (`xcode-select --install`); **Linux** needs ALSA headers (`sudo apt install libasound2-dev`).

Then add the server to Claude Desktop's config file
(`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS,
`%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```jsonc
{
  "mcpServers": {
    "nord-stage-4": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/ns4mcp/dist/index.js"],
      "env": { "NS4_CHANNEL": "1" }
    }
  }
}
```

- Replace the path with your real one (`pwd` in the project folder).
- Set `NS4_CHANNEL` to your Nord's global MIDI channel if it isn't `1`.
- **macOS tip:** if Claude Desktop can't find `node`, use its absolute path
  (`which node`, often `/opt/homebrew/bin/node`) as `"command"`.

## Set up the Nord for MIDI ⚠️ (required — do this once)

Two things must be true on the instrument, or Claude's changes won't be heard —
**this applies to both install paths above.**

**a) Enable USB MIDI.** The Nord must be sending/receiving over its USB connection.
This is on by default; if in doubt, check the System menu.

**b) Enable NRPN reception.** Many parameters (organ & piano model/type, effects
on/off, synth vibrato/arp/LFO, the oscillator) are sent as **NRPN**, and the Nord
**silently ignores NRPN unless you turn it on:**

> On the Nord:
> 1. Press **Shift + Program 7** to open the **MIDI menu**.
> 2. Press **PAGE ►** until you reach **page 7, "Control / NRPN / Device Mode"**.
> 3. Set **Type = `CC & NRPN`**.
> 4. Set **Ctrl = `Send & Receive`** (Send also lets the Nord *tell* the server what you tweak by hand).
> 5. Press **Shift** again to exit. Settings persist automatically.

**Symptom if you skip this:** basic controls (filter, levels, on/off) respond, but
model/type/effect/oscillator changes do nothing. (This is the single most common
setup issue — it's the `Type = CC` default that discards NRPN.)

Also note your Nord's **global MIDI channel** (System menu) — the config assumes channel **1**.

## Use it in Claude Desktop

Fully **quit and reopen** Claude Desktop so it launches the server, then just ask:

> *"List the synth parameters."*
> *"Set up a warm pad: lower the filter cutoff and add a slow LFO to the filter."*
> *"Play a C major chord so I can hear it."*
> *"That's too dark — open it up a bit and play it again."*

Claude will read the current patch, apply changes, and play notes for you to judge.
Ask it to `snapshot` before big changes so you can `restore` if you don't like them.

---

## What you can ask for

| Capability | Example prompt |
|---|---|
| Inspect the patch | *"What's the current synth filter set to?"* |
| Change sound by feel | *"Make it punchier and a bit darker."* |
| Pick a sound category | *"Switch the piano to an electric piano."* |
| Choose an oscillator waveform | *"Give the synth a supersaw."* / *"Use tubular bells."* |
| Hear it | *"Play an arpeggiated A minor chord."* |
| Play a melody | *"Play Frère Jacques at 100 BPM."* |
| A/B and undo | *"Snapshot this, then try three brighter variations."* / *"Go back to the snapshot."* |
| Explore | *"Randomize the synth envelope a little."* |

### Selecting sounds by category

The Nord's individual loaded sound *names* (e.g. "White Grand XL") aren't readable
over MIDI — only **categories** are. So Claude selects a **category** (Grand,
Electric Piano, B3 organ, etc.) and you pick the exact model on the instrument if
you want a specific one. Browse what's loaded with
`npm run browse-sounds -- --section piano|organ|synth` and read the names off the
Nord's display.

---

## Tools (what Claude has access to)

| Tool | Purpose |
|---|---|
| `list_parameters` | List parameters (filter by section/query) with ranges, hints, current values. |
| `get_patch_state` | The current authoritative patch as JSON. |
| `set_parameters` | Apply a diff of named changes; validates and emits the right MIDI. |
| `play_notes` | Play notes as a chord/arpeggio to audition the sound. |
| `play_sequence` | Play a timed melody (notes + rests at a tempo) in one call. |
| `snapshot` | Save current state for A/B compare and undo. |
| `restore` | Restore a snapshot (default most recent) and re-send to the Nord. |
| `audition_variations` | Step through N proposed variations to choose between. |
| `randomize` | Mutate selected parameters within musical ranges. |

Resources: `ns4://schema` (all parameters) and `ns4://patch` (live state).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Tools don't appear in Claude Desktop | Did you `npm run build`? Is the path in the config absolute and correct? Fully quit & reopen Claude Desktop. |
| Filter/levels work but model/effect/oscillator changes do nothing | NRPN isn't enabled — redo **step 2b** (MIDI menu page 7, `Type = CC & NRPN`). |
| Nothing happens at all | `npm run doctor` — is the Nord detected? Check USB and that USB MIDI is on. Confirm `NS4_CHANNEL` matches the Nord's global channel. |
| "node: command not found" in Claude logs | Use the absolute path to node as `"command"` (`which node`). |
| Changes feel like they're being dropped during big edits | Expected for rapid NRPN bursts; the server paces them (~150 ms apart). If you hand-tweak fast on the panel, the Nord itself can drop messages. |

You can sanity-check the whole pipeline without the synth:

```bash
npm run smoke      # builds, then drives the server in --dry-run over MCP
```

---

## Verify against hardware (optional)

```bash
npm run midi-test               # sweeps the filter, sends an NRPN + a 14-bit NRPN
npm run midi-test -- --listen   # just print inbound MIDI while you move knobs
```

This sends live MIDI and **will change the Nord's current sound** — that's on
purpose, so you can confirm the three send paths (CC, NRPN, 14-bit NRPN) actually
move the instrument.

---

## How it works (for the curious)

- **Claude works in named, normalized parameters** (`synth-filter.frequency`), never
  raw MIDI bytes. It does the musical reasoning.
- **This server is a deterministic translator.** All byte-level specifics (CC vs
  NRPN vs 14-bit NRPN, message ordering, bipolar center offsets, pacing) live here.
- **You judge the sound.** The server can't hear — it proposes and applies;
  `snapshot` / `audition_variations` / `restore` give you A/B and undo.

See [`PLAN.md`](./PLAN.md) for the full phased design.

### Configuration flags

| Flag | Env | Default | Meaning |
|---|---|---|---|
| `--dry-run` | — | off | Validate + track state, never send MIDI |
| `--channel <1-16>` | `NS4_CHANNEL` | `1` | Nord global MIDI channel |
| `--port-match <str>` | `NS4_PORT_MATCH` | `nord` | MIDI port name substring |

### The synth oscillator (a bonus — mostly undocumented)

The official manual describes only one oscillator NRPN, mislabeled. By listening to
what the Nord transmits from its panel, NS4MCP maps the **complete** oscillator:
three NRPNs (`synth-oscillator.type` 3/1 → `category` 3/2 → `wave` 3/3) covering all
four types and ~91 named waveforms, exposed in the schema as `oscillatorWaveforms`:

- **Analog** — 8 categories, 45 named waves (Pure, Sub Osc, Sync, Shape, Shape Sine, Multi, Super, Misc).
- **FM-H** — 5 categories (Harmonic A–E); wave = FM ratio (index 0 = 0.5, then 1–24).
- **FM-I** — 5 categories (Inharmonic A–E); wave = semitone (−12…+48).
- **Wave** — 5 categories (Bells/Tines, Acoustic, Digital, Organ, Keys); 46 named waves.

So *"give the synth tubular bells"* → Wave / Bells-Tines / wave 5, and *"a DX
electric piano"* → Wave / Keys. `npm run wind` is a complete example patch (a wind/
noise sound) built entirely through the server.

### Architecture

- `src/midi/messages.ts` — pure CC/NRPN/14-bit NRPN byte builders (the deterministic core).
- `src/midi/device.ts` — `MidiDevice` interface + `RtMidiDevice` (`@julusian/midi`); mockable.
- `src/midi/nord.ts` — Nord-specific send paths bound to a channel.
- `src/translate.ts` — named change → validated value → MIDI send.
- `src/state/patch.ts` — authoritative state, snapshot stack, inbound NRPN reconciliation.
- `src/server.ts` — MCP tools + resources (transport-agnostic; stdio today, HTTP/SSE later).
- `src/index.ts` — stdio transport entrypoint.

---

## Parameter schema (reproducible)

`src/schema/parameters.json` is **generated**, not hand-copied:

```bash
npm run fetch-schema               # download the upstream database and re-transform
npm run fetch-schema -- --offline  # transform from a cached copy
```

146 parameters: 95 CC, 50 NRPN, 1 14-bit NRPN, 5 bipolar/centered. Section-qualified
ids (`piano.model` vs `organ.model`) keep colliding names distinct.

### Data attribution & license

This project's **code is MIT-licensed** (see `package.json`). Parameter data is
derived from the community **[midi.guide](https://midi.guide/d/nord/stage-4/)** Nord
Stage 4 database, licensed **CC BY-SA 4.0** — the transform records the source URL,
license, and fetch date in `parameters.json`. The official
[Nord Stage 4 User Manual (v1.2X, Edition K)](https://www.nordkeyboards.com/downloads/downloads-nord-stage-4)
is the **authoritative tiebreaker** on any conflict. *Nord* and *Nord Stage* are
trademarks of Clavia DMI AB; this is an independent, unofficial project.
