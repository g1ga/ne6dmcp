/**
 * Extra parameters NOT in the manual's MIDI Controller List.
 *
 * The Nord Electro 6 exposes its whole panel as plain CC (Appendix II), so —
 * unlike the Stage 4 with its undocumented synth-oscillator NRPNs — there is
 * nothing extra to add today. Kept as an extension point: parameters discovered
 * by listening to panel transmissions (`npm run listen`) can be added here and
 * merged into the schema by scripts/build-schema.ts.
 */

import type { ParameterSpec } from './types.js';

export const EXTRA_PARAMS: ParameterSpec[] = [];
