/**
 * build-schema.ts — generate src/schema/parameters.json for the Nord Electro 6D.
 *
 * Unlike the upstream ns4mcp (which transforms the midi.guide CSV — no Electro 6
 * database exists there), the Electro 6 schema is built from a hand-curated table
 * transcribed from the OFFICIAL manual:
 *
 *   Nord Electro 6 User Manual v2.6x Edition J (English),
 *   Appendix II: MIDI Controller List (p. 33) — the authoritative source.
 *   https://www.nordkeyboards.com/wt/documents/778/
 *
 * The Electro 6 exposes its panel exclusively as plain MIDI CC (no NRPN), which
 * makes this table — and the whole translation layer — much simpler than the
 * Stage 4 original. Program/Live/Piano/Sample recall via Bank Select + Program
 * Change (manual p. 26) is handled by the select_program tool, not as parameters.
 *
 * Run: npm run build-schema   (regenerates parameters.json deterministically)
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HINTS } from '../src/schema/hints.js';
import { OPTIONS } from '../src/schema/options.js';
import { EXTRA_PARAMS } from '../src/schema/extra-params.js';
import type { ParameterSchema, ParameterSpec, Orientation } from '../src/schema/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'schema', 'parameters.json');

/** Row: [id, name, section, cc, orientation?] — range is always 0-127. */
type Row = [id: string, name: string, section: string, cc: number, orientation?: Orientation];

/**
 * The complete Nord Electro 6 MIDI Controller List (Appendix II, manual p. 33).
 * Ids are section-qualified slugs, stable across regenerations.
 */
const ROWS: Row[] = [
  // --- Global ---
  ['global.volume', 'Volume', 'Global', 7],
  ['global.pan', 'Pan', 'Global', 10, 'bipolar'],
  ['global.sustain-pedal', 'Sustain', 'Global', 64],
  ['global.ctrl-pedal', 'Ctrl Pedal (Expression)', 'Global', 11],
  ['global.kbd-split', 'KBD Split / Ext. KBD to LO / Dual Organ', 'Global', 3],

  // --- Organ ---
  ['organ.enable', 'Organ Enable', 'Organ', 9],
  ['organ.level', 'Organ Level', 'Organ', 13],
  ['organ.octave-shift', 'Organ Octave Shift', 'Organ', 12, 'bipolar'],
  ['organ.sustain-pedal', 'Organ Sustain Pedal', 'Organ', 47],
  ['organ.ctrl-pedal', 'Organ Ctrl Pedal', 'Organ', 48],
  ['organ.model', 'Organ Model', 'Organ', 14],
  ['organ.preset', 'Organ Preset', 'Organ', 15],
  ['organ.drawbar-1', 'Drawbar 1', 'Organ', 16],
  ['organ.drawbar-2', 'Drawbar 2', 'Organ', 17],
  ['organ.drawbar-3', 'Drawbar 3', 'Organ', 18],
  ['organ.drawbar-4', 'Drawbar 4', 'Organ', 19],
  ['organ.drawbar-5', 'Drawbar 5', 'Organ', 20],
  ['organ.drawbar-6', 'Drawbar 6', 'Organ', 21],
  ['organ.drawbar-7', 'Drawbar 7', 'Organ', 22],
  ['organ.drawbar-8', 'Drawbar 8', 'Organ', 23],
  ['organ.drawbar-9', 'Drawbar 9', 'Organ', 24],
  ['organ.percussion-enable', 'Percussion Enable', 'Organ', 25],
  ['organ.percussion-harmonic', 'Percussion Harmonic', 'Organ', 28],
  ['organ.percussion-speed', 'Percussion Speed', 'Organ', 29],
  ['organ.percussion-level', 'Percussion Level', 'Organ', 30],
  ['organ.vibrato-type', 'Vibrato Type', 'Organ', 26],
  ['organ.vibrato-enable', 'Vibrato Enable', 'Organ', 27],
  ['organ.edit-lower-manual', 'Edit Lower Manual', 'Organ', 8],

  // --- Piano ---
  ['piano.enable', 'Piano Enable', 'Piano', 33],
  ['piano.level', 'Piano Level', 'Piano', 34],
  ['piano.octave-shift', 'Piano Octave Shift', 'Piano', 35, 'bipolar'],
  ['piano.sustain-pedal', 'Piano Sustain Pedal', 'Piano', 49],
  ['piano.ctrl-pedal', 'Piano Ctrl Pedal', 'Piano', 50],
  ['piano.type', 'Piano Type', 'Piano', 36],
  ['piano.model', 'Piano Model', 'Piano', 37],
  ['piano.variation', 'Piano Variation', 'Piano', 38],
  ['piano.eq', 'Piano EQ (Timbre)', 'Piano', 40],

  // --- Sample Synth ---
  ['sample-synth.enable', 'Sample Synth Enable', 'Sample Synth', 42],
  ['sample-synth.level', 'Sample Synth Level', 'Sample Synth', 43],
  ['sample-synth.octave-shift', 'Sample Synth Octave Shift', 'Sample Synth', 44, 'bipolar'],
  ['sample-synth.sustain-pedal', 'Sample Synth Sustain Pedal', 'Sample Synth', 45],
  ['sample-synth.ctrl-pedal', 'Sample Synth Ctrl Pedal', 'Sample Synth', 46],
  ['sample-synth.attack', 'Sample Synth Attack', 'Sample Synth', 68],
  ['sample-synth.decay-release', 'Sample Synth Decay/Release', 'Sample Synth', 69],
  ['sample-synth.dynamics', 'Sample Synth Dynamics', 'Sample Synth', 72],
  ['sample-synth.filter', 'Sample Synth Filter', 'Sample Synth', 73],

  // --- Effect 1 (Trem / Pan / Wah / RM) ---
  ['effect1.enable', 'Effect 1 Enable', 'Effect 1', 82],
  ['effect1.type', 'Effect 1 Type', 'Effect 1', 83],
  ['effect1.source', 'Effect 1 Source', 'Effect 1', 84],
  ['effect1.ctrl-pedal', 'Effect 1 Ctrl Ped', 'Effect 1', 85],
  ['effect1.rate', 'Effect 1 Rate', 'Effect 1', 86],

  // --- Effect 2 (Phaser / Flanger / Vibe / Chorus) ---
  ['effect2.enable', 'Effect 2 Enable', 'Effect 2', 91],
  ['effect2.type', 'Effect 2 Type', 'Effect 2', 87],
  ['effect2.source', 'Effect 2 Source', 'Effect 2', 88],
  ['effect2.deep', 'Effect 2 Deep', 'Effect 2', 89],
  ['effect2.rate', 'Effect 2 Rate', 'Effect 2', 90],

  // --- Delay ---
  ['delay.enable', 'Delay Enable', 'Delay', 97],
  ['delay.source', 'Delay Source', 'Delay', 92],
  ['delay.amount', 'Delay Amount', 'Delay', 93],
  ['delay.rate', 'Delay Rate', 'Delay', 94],
  ['delay.feedback', 'Delay Feedback', 'Delay', 95],
  ['delay.ping-pong', 'Delay Ping-Pong', 'Delay', 98],

  // --- Amp/Spkr (incl. Rotary) ---
  ['amp.enable', 'Amp/Spkr Enable', 'Amp/Spkr', 118],
  ['amp.type', 'Amp/Spkr Type', 'Amp/Spkr', 100],
  ['amp.drive', 'Amp/Spkr Drive', 'Amp/Spkr', 117],
  ['amp.source', 'Amp/Spkr Source', 'Amp/Spkr', 119],
  ['rotary.speed', 'Rotary Speed', 'Amp/Spkr', 108],

  // --- EQ ---
  ['eq.enable', 'EQ Enable', 'EQ', 105],
  ['eq.bass', 'EQ Bass', 'EQ', 102, 'bipolar'],
  ['eq.mid', 'EQ Mid', 'EQ', 103, 'bipolar'],
  ['eq.mid-frequency', 'EQ Mid Frequency', 'EQ', 107],
  ['eq.treble', 'EQ Treble', 'EQ', 104, 'bipolar'],
  ['eq.source', 'EQ Source', 'EQ', 106],

  // --- Reverb ---
  ['reverb.enable', 'Reverb Enable', 'Reverb', 116],
  ['reverb.type', 'Reverb Type', 'Reverb', 115],
  ['reverb.amount', 'Reverb Amount (Dry/Wet)', 'Reverb', 113],
  ['reverb.bright', 'Reverb Bright', 'Reverb', 112],
];

function toSpec([id, name, section, cc, orientation]: Row): ParameterSpec {
  const spec: ParameterSpec = {
    id,
    name,
    section,
    addressing: 'cc',
    cc,
    min: 0,
    max: 127,
    orientation: orientation ?? 'unipolar',
  };
  if (spec.orientation === 'bipolar') spec.center = 64;
  const options = OPTIONS[id];
  if (options) spec.options = options;
  const hint = HINTS[id];
  if (hint) spec.hint = hint;
  return spec;
}

function main(): void {
  const parameters = [...ROWS.map(toSpec), ...EXTRA_PARAMS];

  // Sanity: unique ids and CC numbers.
  const ids = new Set<string>();
  const ccs = new Set<number>();
  for (const p of parameters) {
    if (ids.has(p.id)) throw new Error(`duplicate id: ${p.id}`);
    ids.add(p.id);
    if (p.cc !== undefined) {
      if (ccs.has(p.cc)) throw new Error(`duplicate CC: ${p.cc} (${p.id})`);
      ccs.add(p.cc);
    }
  }

  const schema: ParameterSchema = {
    device: 'Nord Electro 6D',
    source: {
      url: 'https://www.nordkeyboards.com/wt/documents/778/Nord%20Electro%206%20English%20User%20Manual%20v2.6x%20Edition%20J.pdf',
      humanReadable: 'Nord Electro 6 User Manual v2.6x Edition J, Appendix II: MIDI Controller List (p. 33)',
      license: 'Parameter names/CC numbers are facts from the official manual; this transcription is MIT like the rest of the project.',
      attribution:
        'Transcribed from the official Nord Electro 6 User Manual (v2.6x Edition J), Appendix II. Nord and Nord Electro are trademarks of Clavia DMI AB; this is an independent, unofficial project.',
      authoritativeReference: 'Nord Electro 6 User Manual v2.6x Edition J (English) — https://www.nordkeyboards.com/downloads/downloads-nord-electro-6',
      validation:
        'All CC numbers transcribed 1:1 from Appendix II. Enumerated selector VALUES (options) use the midpoint/even-slice scheme hardware-confirmed on the Stage 4 by upstream ns4mcp; selectors marked "verify" in their hints should be calibrated against this Electro 6D via panel readback (npm run listen, move the selector, note the values).',
      fetchedAt: new Date().toISOString(),
      rowCount: parameters.length,
    },
    parameters,
  };

  writeFileSync(OUT_PATH, JSON.stringify(schema, null, 2) + '\n');
  process.stdout.write(`wrote ${OUT_PATH} (${parameters.length} parameters)\n`);
}

main();
