/**
 * Curated enumerated-selector options for the Nord Electro 6D, keyed by parameter id.
 *
 * These let the model address a selector by NAME (e.g. organ.model = "B3",
 * reverb.type = "Hall") instead of a raw MIDI value.
 *
 * VALUE MAPPING — HARDWARE-CALIBRATED 2026-07-18 on a Nord Electro 6D (OS v2.x)
 * via panel readback + write-tests: the instrument transmits selector positions
 * spread evenly over the FULL 0-127 range (first = 0, last = 127), i.e.
 * value_i = ceil(i * 127 / (N - 1)). Sending these exact values back is
 * confirmed to select the right position.
 *
 * Calibration notes:
 *  - effect1.type: 8 positions incl. Trem 3 (Trem 1+2 LEDs) and Pan 3 (Pan 1+2).
 *  - effect2.type: order differs from the manual prose — Vibe is LAST.
 *  - amp.type: 6 positions incl. leading "None" (no LED; plain drive) and
 *    trailing Comp; Rotary = TWIN+JC LEDs, Comp = JC+SMALL LEDs.
 *  - organ.vibrato-type: with non-B3 models some positions are unavailable and
 *    the panel skips them; values below are the B3 (full) map and are received
 *    correctly regardless.
 *  - piano.type / piano.model / piano.variation (CC 36/37/38) are NOT received
 *    by the instrument (dump/transmit only). Select pianos with the
 *    select_program tool instead: Bank MSB 3, Bank LSB = category index
 *    (0=Grand 1=Upright 2=Electric 3=Clav/Hps 4=Digital 5=Layer),
 *    Program Change = model index (0-based, Sound Manager order). Samples:
 *    Bank MSB 4.
 */

import type { SelectorOption } from './types.js';

/** Evenly spread N labels over 0-127 inclusive (first = 0, last = 127) — the Nord's own scheme. */
function spread(labels: string[]): SelectorOption[] {
  const n = labels.length;
  return labels.map((label, i) => ({ value: n === 1 ? 0 : Math.ceil((i * 127) / (n - 1)), label }));
}

const OFF_ON = spread(['Off', 'On']);
const SOURCES = spread(['Organ', 'Piano', 'Sample Synth']); // O=0, P=64 (measured), S=127

export const OPTIONS: Record<string, SelectorOption[]> = {
  // --- Organ (measured: B3=0, Vox=26, Pipe2=102 write-confirmed) ---
  'organ.model': spread(['B3', 'Vox', 'Farf', 'Pipe 1', 'Pipe 2', 'B3 Bass']),
  // measured on B3: V2=51, C2=77, C3=127 write-confirmed
  'organ.vibrato-type': spread(['V1', 'C1', 'V2', 'C2', 'V3', 'C3']),
  'organ.percussion-harmonic': spread(['2nd', '3rd']),
  'organ.percussion-speed': spread(['Slow', 'Fast']),
  'organ.percussion-level': spread(['Normal', 'Soft']),
  'organ.enable': OFF_ON,
  'organ.percussion-enable': OFF_ON,
  'organ.vibrato-enable': OFF_ON,
  'organ.sustain-pedal': OFF_ON,
  'organ.ctrl-pedal': OFF_ON,
  'organ.edit-lower-manual': OFF_ON,

  // --- Piano (NOTE: transmit/dump-only over CC — see header; use select_program) ---
  'piano.type': spread(['Grand', 'Upright', 'Electric', 'Clav/Hps', 'Digital', 'Layer']),
  'piano.eq': spread(['Off', 'Soft', 'Mid', 'Bright']), // not yet calibrated
  'piano.enable': OFF_ON,
  'piano.sustain-pedal': OFF_ON,
  'piano.ctrl-pedal': OFF_ON,

  // --- Sample Synth ---
  'sample-synth.enable': OFF_ON,
  'sample-synth.sustain-pedal': OFF_ON,
  'sample-synth.ctrl-pedal': OFF_ON,

  // --- Effect 1 (measured full cycle 2026-07-18: 0,19,37,55,73,91,109,127) ---
  'effect1.type': spread(['Trem 1', 'Trem 2', 'Trem 3', 'Pan 1', 'Pan 2', 'Pan 3', 'Wah', 'RM']),
  'effect1.enable': OFF_ON,
  'effect1.source': SOURCES,
  'effect1.ctrl-pedal': OFF_ON,

  // --- Effect 2 (measured: Flang=51, Chor1=77, Vibe=127 — Vibe is LAST, unlike manual prose) ---
  'effect2.type': spread(['Phaser 1', 'Phaser 2', 'Flanger', 'Chorus 1', 'Chorus 2', 'Vibe']),
  'effect2.enable': OFF_ON,
  'effect2.source': SOURCES,
  'effect2.deep': OFF_ON,

  // --- Delay ---
  'delay.enable': OFF_ON,
  'delay.source': SOURCES,
  'delay.ping-pong': OFF_ON,

  // --- Amp/Spkr (measured: None=0, Small=26, Rotary=~102 (TWIN+JC), Comp=127 (JC+SMALL)) ---
  'amp.type': spread(['None', 'Small', 'JC', 'Twin', 'Rotary', 'Comp']),
  'amp.enable': OFF_ON,
  'amp.source': SOURCES,
  // measured: Slow=0, Fast=127 (display feedback); a third Stop state may exist with Rotor Stop Mode
  'rotary.speed': spread(['Slow', 'Fast']),

  // --- EQ ---
  'eq.enable': OFF_ON,
  'eq.source': SOURCES,

  // --- Reverb (measured: Stage=64 write-confirmed, Hall=127; bright is a separate on/off CC) ---
  'reverb.type': spread(['Room', 'Stage', 'Hall']),
  'reverb.enable': OFF_ON,
  'reverb.bright': OFF_ON,

  // --- Global ---
  'global.sustain-pedal': OFF_ON,
  'global.kbd-split': OFF_ON, // split/dual-organ modes may be multi-state — not yet calibrated
};
