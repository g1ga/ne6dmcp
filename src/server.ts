/**
 * MCP server wiring: registers tools + resources on an McpServer.
 *
 * The transport is created by the caller (index.ts) and passed to connect(), so
 * a future HTTP/SSE transport can reuse this exact server (transport-agnostic).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { NordController } from './controller.js';
import type { ParamChange } from './translate.js';
import type { ParameterSpec } from './schema/types.js';

const SCHEMA_URI = 'ne6://schema';
const PATCH_URI = 'ne6://patch';

function text(obj: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(obj, null, 2) }] };
}

/** Public view of a parameter merged with its current value. */
function paramView(p: ParameterSpec, ctrl: NordController) {
  const cur = ctrl.state.get(p.id);
  return {
    id: p.id,
    name: p.name,
    section: p.section,
    addressing: p.addressing,
    range: [p.min, p.max] as const,
    orientation: p.orientation,
    ...(p.center !== undefined ? { center: p.center } : {}),
    ...(p.options ? { options: p.options } : {}),
    ...(p.hint ? { hint: p.hint } : {}),
    ...(cur ? { current: cur.value, currentOrigin: cur.origin } : {}),
  };
}

const changeShape = {
  id: z.string().describe('Section-qualified parameter id, e.g. "organ.drawbar-1"'),
  value: z.number().int().optional().describe('Raw device value within the param range (0-127)'),
  label: z.string().optional().describe('Named option for an enumerated selector instead of value, e.g. organ.model = "B3" (see the param\'s options)'),
};

export function buildServer(ctrl: NordController): McpServer {
  const server = new McpServer(
    { name: 'ne6dmcp', version: '0.1.0' },
    {
      instructions:
        'Controls a Nord Electro 6D over MIDI. Work in named parameters (ids like ' +
        '"organ.drawbar-1"); never raw MIDI. Read the ne6://schema resource for ' +
        'ids, ranges, orientation (bipolar params center at 64), and hints. Use ' +
        'set_parameters with a diff of changes and select_program to recall program ' +
        'slots. Sound/sample NAMES are not addressable over MIDI — only categories ' +
        'and indices; the human picks exact sounds on the instrument. The server ' +
        'cannot hear audio — propose changes and let the human judge; use ' +
        'audition_variations / snapshot for A/B. Storing and naming programs ' +
        'happens on the instrument / Nord Sound Manager, not over MIDI.',
    },
  );

  // --- Resources: schema + live patch, always available without a tool call ---
  server.registerResource(
    'parameter-schema',
    SCHEMA_URI,
    {
      title: 'Nord Electro 6D parameter schema',
      description: 'All addressable parameters with ids, ranges, orientation, and semantic hints.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(
            { ...ctrl.schema.raw, parameters: ctrl.schema.parameters.map((p) => paramView(p, ctrl)) },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    'patch-state',
    PATCH_URI,
    {
      title: 'Current Nord Electro 6D patch state',
      description: 'Authoritative in-memory parameter values (set + readback).',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(
            { connected: ctrl.connected, dryRun: ctrl.dryRun, values: ctrl.state.toJSON() },
            null,
            2,
          ),
        },
      ],
    }),
  );

  // --- Phase 3 tools ---

  server.registerTool(
    'list_parameters',
    {
      title: 'List parameters',
      description: 'List addressable Nord parameters with ranges, orientation, hints, and current values. Filter by section or free-text query.',
      inputSchema: {
        section: z.string().optional().describe('Case-insensitive section filter, e.g. "organ"'),
        query: z.string().optional().describe('Case-insensitive substring over id/name/hint'),
      },
    },
    async ({ section, query }) => {
      let params = ctrl.schema.parameters;
      if (section) params = params.filter((p) => p.section.toLowerCase().includes(section.toLowerCase()));
      if (query) {
        const q = query.toLowerCase();
        params = params.filter(
          (p) => p.id.includes(q) || p.name.toLowerCase().includes(q) || (p.hint ?? '').toLowerCase().includes(q),
        );
      }
      return text({ count: params.length, parameters: params.map((p) => paramView(p, ctrl)) });
    },
  );

  server.registerTool(
    'get_patch_state',
    {
      title: 'Get patch state',
      description: 'Current authoritative in-memory patch as JSON (only parameters that have been set or read back).',
      inputSchema: {},
    },
    async () => text({ connected: ctrl.connected, dryRun: ctrl.dryRun, lastError: ctrl.lastError, values: ctrl.state.toJSON() }),
  );

  server.registerTool(
    'set_parameters',
    {
      title: 'Set parameters',
      description:
        'Apply a diff of named parameter changes. Validates ranges/orientation and translates each to the correct MIDI CC message. Bipolar params use raw values with 64 as center. For enumerated selectors (e.g. piano.type) pass `label` ("Grand") instead of a value.',
      inputSchema: {
        changes: z.array(z.object(changeShape)).min(1).describe('One or more parameter changes to apply'),
        rationale: z.string().optional().describe('Optional one-line rationale, logged for traceability'),
      },
    },
    async ({ changes, rationale }) => {
      if (rationale) process.stderr.write(`[ne6dmcp] set_parameters: ${rationale}\n`);
      const { applied, errors, sent } = await ctrl.applyBatch(changes as ParamChange[]);
      return text({
        sent,
        connected: ctrl.connected,
        dryRun: ctrl.dryRun,
        ...(sent ? {} : { warning: ctrl.dryRun ? 'dry-run: nothing sent to hardware' : `device not connected (${ctrl.lastError ?? 'unknown'}); nothing sent` }),
        appliedCount: applied.length,
        applied: applied.map((a) => ({ id: a.id, value: a.value, ...(a.category !== undefined ? { category: a.category, sample: a.sample } : {}), addressing: a.addressing, bytes: a.messages })),
        errors,
      });
    },
  );

  server.registerTool(
    'play_notes',
    {
      title: 'Play notes',
      description:
        'Play MIDI notes on the Nord so the human can audition the current sound (the server cannot hear). Block chord by default; set gapMs > 0 to arpeggiate. Notes always auto-release. Use after set_parameters to let the user judge the result. Middle C = 60.',
      inputSchema: {
        notes: z.array(z.number().int().min(0).max(127)).min(1).describe('MIDI note numbers (middle C = 60)'),
        velocity: z.number().int().min(1).max(127).optional().describe('Note velocity (default 100)'),
        durationMs: z.number().int().min(50).max(10000).optional().describe('How long to hold, ms (default 1500, max 10000)'),
        gapMs: z.number().int().min(0).max(2000).optional().describe('Gap between note-ons, ms; >0 arpeggiates (default 0 = block chord)'),
      },
    },
    async ({ notes, velocity, durationMs, gapMs }) => {
      const result = await ctrl.playNotes(notes, { velocity, durationMs, gapMs });
      return text({
        ...result,
        connected: ctrl.connected,
        dryRun: ctrl.dryRun,
        note: result.played ? 'Ask the human what they heard.' : 'Nothing played.',
      });
    },
  );

  server.registerTool(
    'play_sequence',
    {
      title: 'Play a melody/sequence',
      description:
        'Play a TIMED sequence of notes (a melody with rhythm and rests) in ONE call so it sounds continuous. Use this for tunes/melodies — NOT play_notes (which is a single chord). Each step has a pitch (MIDI number, middle C = 60), optional chord (array of pitches), or rest (null/omitted), and a duration in beats. Tempo is in BPM. Example Frère Jacques opening at 120bpm: steps [{pitch:60,beats:1},{pitch:62,beats:1},{pitch:64,beats:1},{pitch:60,beats:1}].',
      inputSchema: {
        steps: z
          .array(
            z.object({
              pitch: z.union([z.number().int().min(0).max(127), z.array(z.number().int().min(0).max(127)), z.null()]).optional().describe('MIDI note (60=middle C), array for a chord, or null/omitted for a rest'),
              beats: z.number().min(0.0625).max(16).optional().describe('Duration in beats (default 1; 0.5=eighth, 2=half)'),
              velocity: z.number().int().min(1).max(127).optional().describe('Per-note velocity override'),
            }),
          )
          .min(1)
          .describe('The melody as an ordered list of note/rest steps'),
        tempoBpm: z.number().min(20).max(300).optional().describe('Tempo in beats per minute (default 120)'),
        gate: z.number().min(0.1).max(1).optional().describe('Fraction of each step the note sounds before release; 1=legato, lower=more separated (default 0.85)'),
        velocity: z.number().int().min(1).max(127).optional().describe('Default velocity (default 100)'),
      },
    },
    async ({ steps, tempoBpm, gate, velocity }) => {
      const result = await ctrl.playSequence(steps as Array<{ pitch?: number | number[] | null; beats?: number; velocity?: number }>, { tempoBpm, gate, velocity });
      return text({
        ...result,
        connected: ctrl.connected,
        dryRun: ctrl.dryRun,
        note: result.played ? 'Played as one continuous sequence. Ask the human how it sounded.' : 'Nothing played.',
        ...(result.truncated ? { warning: 'sequence truncated (exceeded step/duration cap); split into multiple calls if needed' } : {}),
      });
    },
  );

  server.registerTool(
    'select_program',
    {
      title: 'Select program',
      description:
        'Recall a Program on the Nord Electro 6 via Bank Select + Program Change. ' +
        'Pass bank (letter: A-H live on Bank LSB 0, I-P on 1, Q-X on 2) and location ' +
        '(page 1-4 + position 1-4 as shown on the display, e.g. "23" = page 2, position 3). ' +
        'Or pass raw bankMsb/bankLsb/program to recall Live/Piano/Sample content ' +
        '(Bank MSB: 0=Program, 3=Piano, 4=Sample, 6=Live — manual p. 26). ' +
        'PIANOS (hardware-verified): bankMsb 3, bankLsb = category index ' +
        '(0=Grand 1=Upright 2=Electric 3=Clav/Hps 4=Digital 5=Layer), program = ' +
        'model index 0-based in Sound Manager order. This is the ONLY way to switch ' +
        'pianos over MIDI — piano.type/model CCs are dump-only. SAMPLES ' +
        '(hardware-verified): bankMsb 4, program = sample list position 0-based ' +
        '(Sound Manager location - 1), bankLsb = page for positions beyond 49.',
      inputSchema: {
        bank: z.string().regex(/^[A-Xa-x]$/).optional().describe('Program bank letter, e.g. "A"'),
        location: z.string().regex(/^[1-4][1-4]$/).optional().describe('Location as page+position, e.g. "23"'),
        bankMsb: z.number().int().min(0).max(127).optional().describe('Raw Bank Select MSB (0=Program, 3=Piano, 4=Sample, 6=Live)'),
        bankLsb: z.number().int().min(0).max(127).optional().describe('Raw Bank Select LSB'),
        program: z.number().int().min(0).max(127).optional().describe('Raw Program Change value'),
      },
    },
    async ({ bank, location, bankMsb, bankLsb, program }) => {
      let msb: number;
      let lsb: number;
      let pc: number;
      if (bank !== undefined && location !== undefined) {
        const bankIdx = bank.toUpperCase().charCodeAt(0) - 65; // A = 0
        const page = Number(location[0]);
        const pos = Number(location[1]);
        const slot = (page - 1) * 4 + (pos - 1); // 0-15 within the bank
        msb = 0;
        lsb = Math.floor(bankIdx / 8);
        pc = (bankIdx % 8) * 16 + slot;
      } else if (program !== undefined) {
        msb = bankMsb ?? 0;
        lsb = bankLsb ?? 0;
        pc = program;
      } else {
        return text({ error: 'pass bank+location (e.g. bank "A", location "23") or raw bankMsb/bankLsb/program' });
      }
      const result = ctrl.selectProgram(msb, lsb, pc);
      return text({
        ...result,
        bankMsb: msb,
        bankLsb: lsb,
        programChange: pc,
        ...(bank ? { requested: `${bank.toUpperCase()}:${location}` } : {}),
        note: result.sent
          ? 'Program recalled. The panel changed wholesale; previous in-memory parameter state may be stale.'
          : 'Nothing sent.',
      });
    },
  );

  // --- Phase 4 tools ---

  server.registerTool(
    'snapshot',
    {
      title: 'Snapshot patch',
      description: 'Push the current patch state onto the history stack for A/B compare and undo.',
      inputSchema: { label: z.string().optional().describe('Optional label for the snapshot') },
    },
    async ({ label }) => {
      const snap = ctrl.state.snapshot(label ?? `snapshot-${ctrl.state.listSnapshots().length}`);
      return text({ saved: snap.label, at: snap.at, parameterCount: Object.keys(snap.values).length, stack: ctrl.state.listSnapshots() });
    },
  );

  server.registerTool(
    'restore',
    {
      title: 'Restore snapshot',
      description: 'Restore a snapshot by index (default: most recent) and re-send its values to the Nord.',
      inputSchema: {
        index: z.number().int().optional().describe('Snapshot index from `snapshot` stack; default most recent'),
        pop: z.boolean().optional().describe('If true, remove the snapshot from the stack after restoring'),
      },
    },
    async ({ index, pop }) => {
      const snap = ctrl.state.peekSnapshot(index);
      if (!snap) return text({ error: 'no snapshot to restore', stack: ctrl.state.listSnapshots() });
      const changes: ParamChange[] = Object.entries(snap.values).map(([id, value]) => ({ id, value }));
      const { applied, errors, sent } = await ctrl.applyBatch(changes);
      ctrl.state.applySnapshotValues(snap);
      if (pop) ctrl.state.popSnapshot();
      return text({ restored: snap.label, sent, restoredCount: applied.length, errors });
    },
  );

  server.registerTool(
    'audition_variations',
    {
      title: 'Audition variations',
      description:
        'Step through N proposed variations so the human can listen and choose (the server cannot hear). Provide `variations` to start (auto-snapshots a baseline), then call again with `applyIndex` to hear each. Use restore to return to baseline.',
      inputSchema: {
        variations: z
          .array(z.object({ label: z.string(), changes: z.array(z.object(changeShape)).min(1) }))
          .optional()
          .describe('The set of variations to audition; provide once to begin'),
        applyIndex: z.number().int().optional().describe('Which variation to apply now (default 0)'),
      },
    },
    async ({ variations, applyIndex }) => {
      if (variations) {
        ctrl.state.snapshot('audition-baseline');
        ctrl.auditionSet = variations as { label: string; changes: ParamChange[] }[];
      }
      const set = ctrl.auditionSet;
      if (!set || set.length === 0) return text({ error: 'no audition set; call with `variations` first' });
      const idx = applyIndex ?? 0;
      const variation = set[idx];
      if (!variation) return text({ error: `applyIndex ${idx} out of range (0-${set.length - 1})`, variations: set.map((v, i) => ({ index: i, label: v.label })) });
      const { applied, errors, sent } = await ctrl.applyBatch(variation.changes);
      return text({
        auditioning: variation.label,
        index: idx,
        of: set.length,
        sent,
        applied: applied.map((a) => ({ id: a.id, value: a.value })),
        errors,
        next: idx + 1 < set.length ? `call again with applyIndex=${idx + 1} for "${set[idx + 1].label}"` : 'last variation; use restore to return to baseline',
        all: set.map((v, i) => ({ index: i, label: v.label })),
      });
    },
  );

  server.registerTool(
    'randomize',
    {
      title: 'Randomize parameters',
      description:
        'Mutate selected parameters within constrained ranges (respecting bipolar/unipolar orientation) for happy-accident sound design. Auto-snapshots first so you can restore.',
      inputSchema: {
        ids: z.array(z.string()).optional().describe('Specific parameter ids to randomize'),
        sections: z.array(z.string()).optional().describe('Sections to randomize (e.g. ["Synth Filter"])'),
        amount: z.number().min(0).max(1).optional().describe('Mutation strength as a fraction of each range (default 0.2)'),
      },
    },
    async ({ ids, sections, amount }) => {
      const strength = amount ?? 0.2;
      let targets = ctrl.schema.parameters;
      if (ids?.length) targets = targets.filter((p) => ids.includes(p.id));
      else if (sections?.length) {
        const secs = sections.map((s) => s.toLowerCase());
        targets = targets.filter((p) => secs.some((s) => p.section.toLowerCase().includes(s)));
      } else {
        return text({ error: 'specify `ids` or `sections` to constrain randomization' });
      }
      if (targets.length === 0) return text({ error: 'no parameters matched', ids, sections });

      ctrl.state.snapshot('pre-randomize');
      const changes: ParamChange[] = targets.map((p) => {
        const span = p.max - p.min;
        const base = ctrl.state.get(p.id)?.value ?? (p.orientation === 'bipolar' ? (p.center ?? Math.round((p.min + p.max) / 2)) : p.default ?? Math.round((p.min + p.max) / 2));
        const delta = Math.round((Math.random() * 2 - 1) * strength * span);
        const value = Math.max(p.min, Math.min(p.max, base + delta));
        return { id: p.id, value };
      });
      const { applied, errors, sent } = await ctrl.applyBatch(changes);
      return text({ randomized: applied.length, amount: strength, sent, applied: applied.map((a) => ({ id: a.id, value: a.value })), errors, hint: 'use restore to undo (snapshot "pre-randomize")' });
    },
  );

  return server;
}
