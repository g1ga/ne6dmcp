/**
 * Curated enumerated-selector options for the Nord Electro 6D, keyed by parameter id.
 *
 * These let the model address a selector by NAME (e.g. organ.model = "B3",
 * reverb.type = "Hall") instead of a raw MIDI value. Layered onto the generated
 * schema by scripts/build-schema.ts, like HINTS.
 *
 * VALUE MAPPING: the Nord manual documents option NAMES and panel ORDER but not
 * explicit CC value tables. Each `value` is the MIDPOINT of that option's even
 * slice of 0-127 — the scheme hardware-confirmed on the Stage 4 by upstream
 * ns4mcp (for an N-option selector: value_i = round((i + 0.5) * 128 / N)).
 *
 * CONFIDENCE: names and order come from the Electro 6 manual v2.6x (organ p. 12-14,
 * piano p. 15-17, effects p. 22-24). Selectors marked "verify" should be
 * calibrated on the instrument: run `npm run listen`, click through the panel
 * selector, and read the transmitted CC values back.
 *
 * Names of SPECIFIC loaded sounds (e.g. "White Grand Med") are NOT included —
 * they aren't sent over MIDI; use piano.model/piano.variation indices or pick on
 * the instrument.
 */

import type { SelectorOption } from './types.js';

/** Build {value,label} options from labels, placing each at the midpoint of its slice. */
function opts(labels: string[]): SelectorOption[] {
  const n = labels.length;
  return labels.map((label, i) => ({ value: Math.round(((i + 0.5) * 128) / n), label }));
}

const OFF_ON = opts(['Off', 'On']);
const SOURCES = opts(['Organ', 'Piano', 'Sample Synth']);

export const OPTIONS: Record<string, SelectorOption[]> = {
  // --- Organ (manual p. 12-14: B3, VOX, FARF, PIPE1, PIPE2, B3 BASS) ---
  'organ.model': opts(['B3', 'Vox', 'Farf', 'Pipe 1', 'Pipe 2', 'B3 Bass']),
  'organ.vibrato-type': opts(['V1', 'C1', 'V2', 'C2', 'V3', 'C3']),
  'organ.percussion-harmonic': opts(['2nd', '3rd']),
  'organ.percussion-speed': opts(['Slow', 'Fast']),
  'organ.percussion-level': opts(['Normal', 'Soft']),
  'organ.enable': OFF_ON,
  'organ.percussion-enable': OFF_ON,
  'organ.vibrato-enable': OFF_ON,
  'organ.sustain-pedal': OFF_ON,
  'organ.ctrl-pedal': OFF_ON,
  'organ.edit-lower-manual': OFF_ON,

  // --- Piano (categories as on the panel / Sound Manager) ---
  'piano.type': opts(['Grand', 'Upright', 'Electric', 'Clav/Hps', 'Digital', 'Layer']),
  'piano.eq': opts(['Off', 'Soft', 'Mid', 'Bright']), // verify order on hardware
  'piano.enable': OFF_ON,
  'piano.sustain-pedal': OFF_ON,
  'piano.ctrl-pedal': OFF_ON,

  // --- Sample Synth ---
  'sample-synth.enable': OFF_ON,
  'sample-synth.sustain-pedal': OFF_ON,
  'sample-synth.ctrl-pedal': OFF_ON,

  // --- Effect 1 (manual p. 22: Trem x3, Pan x3, Wah, RM — verify count/order) ---
  'effect1.type': opts(['Trem 1', 'Trem 2', 'Trem 3', 'Pan 1', 'Pan 2', 'Pan 3', 'Wah', 'RM']),
  'effect1.enable': OFF_ON,
  'effect1.source': SOURCES,
  'effect1.ctrl-pedal': OFF_ON,

  // --- Effect 2 (manual p. 23: two phasers, flanger, two choruses, vibe) ---
  'effect2.type': opts(['Phaser 1', 'Phaser 2', 'Flanger', 'Vibe', 'Chorus 1', 'Chorus 2']), // verify order
  'effect2.enable': OFF_ON,
  'effect2.source': SOURCES,
  'effect2.deep': OFF_ON,

  // --- Delay ---
  'delay.enable': OFF_ON,
  'delay.source': SOURCES,
  'delay.ping-pong': OFF_ON,

  // --- Amp/Spkr (manual p. 23: JC, Small, Twin + Rotary) ---
  'amp.type': opts(['JC', 'Small', 'Twin', 'Rotary']), // verify order
  'amp.enable': OFF_ON,
  'amp.source': SOURCES,
  'rotary.speed': opts(['Slow', 'Fast']), // stop mode may add a third state — verify

  // --- EQ ---
  'eq.enable': OFF_ON,
  'eq.source': SOURCES,

  // --- Reverb (manual p. 24: Room, Stage, Hall) ---
  'reverb.type': opts(['Room', 'Stage', 'Hall']), // verify order
  'reverb.enable': OFF_ON,
  'reverb.bright': OFF_ON,

  // --- Global ---
  'global.sustain-pedal': OFF_ON,
  'global.kbd-split': OFF_ON, // split/dual-organ modes may be multi-state — verify
};
