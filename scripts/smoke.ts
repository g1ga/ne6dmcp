/**
 * smoke — end-to-end MCP test against the built server in --dry-run mode.
 * Exercises the full stack (transport, tools, resources, validation, state)
 * without touching hardware.
 *
 *   npm run build && npx tsx scripts/smoke.ts
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

function body(res: any): any {
  const txt = res.content?.find((c: any) => c.type === 'text')?.text ?? '{}';
  return JSON.parse(txt);
}
let failures = 0;
function check(label: string, cond: boolean, extra?: unknown): void {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) { failures++; if (extra !== undefined) console.log('   ', JSON.stringify(extra)); }
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js', '--dry-run'],
  });
  const client = new Client({ name: 'smoke', version: '0.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name).sort();
  check('all 10 tools registered', names.length === 10, names);
  check('expected tool names', ['audition_variations', 'get_patch_state', 'list_parameters', 'play_notes', 'play_sequence', 'randomize', 'restore', 'select_program', 'set_parameters', 'snapshot'].every((n) => names.includes(n)), names);

  const resources = await client.listResources();
  check('schema + patch resources', resources.resources.length === 2, resources.resources.map((r) => r.uri));

  const schemaRes = await client.readResource({ uri: 'ne6://schema' });
  const schema = JSON.parse((schemaRes.contents[0] as any).text);
  check('schema resource has 77 params', schema.parameters.length === 77, schema.parameters.length);
  check('all params are plain CC', schema.parameters.every((p: any) => p.addressing === 'cc'));
  check('organ drawbars 1-9 present', [1,2,3,4,5,6,7,8,9].every((n) => schema.parameters.some((p: any) => p.id === `organ.drawbar-${n}`)));

  const lp = body(await client.callTool({ name: 'list_parameters', arguments: { section: 'organ' } }));
  check('list_parameters filters by section', lp.count > 0 && lp.parameters.every((p: any) => p.section.toLowerCase().includes('organ')), lp.count);

  // Valid CC change + invalid out-of-range + unknown id
  const sp = body(await client.callTool({
    name: 'set_parameters',
    arguments: {
      changes: [
        { id: 'sample-synth.filter', value: 100 },
        { id: 'sample-synth.filter', value: 999 },
        { id: 'nope.nope', value: 1 },
      ],
      rationale: 'smoke test',
    },
  }));
  check('one valid CC applied', sp.applied.some((a: any) => a.id === 'sample-synth.filter' && a.value === 100), sp.applied);
  check('out-of-range rejected', sp.errors.some((e: any) => e.message.includes('out of range')), sp.errors);
  check('unknown id rejected with suggestion', sp.errors.some((e: any) => e.id === 'nope.nope'), sp.errors);
  check('dry-run reports nothing sent', sp.sent === false);

  // Verify CC byte for sample synth filter = [0xB0, 73, 100]
  const ccBytes = sp.applied.find((a: any) => a.id === 'sample-synth.filter')?.bytes?.[0];
  check('CC bytes correct [176,73,100]', JSON.stringify(ccBytes) === JSON.stringify([176, 73, 100]), ccBytes);

  // Label-based selection: organ.model = "B3" -> value 11 -> CC 14
  const lab = body(await client.callTool({ name: 'set_parameters', arguments: { changes: [{ id: 'organ.model', label: 'B3' }] } }));
  const labApplied = lab.applied.find((a: any) => a.id === 'organ.model');
  check('label "B3" resolves to value 11', labApplied?.value === 11, lab.applied);
  check('label resolves to CC 14 bytes', JSON.stringify(labApplied?.bytes) === JSON.stringify([[176, 14, 11]]), labApplied?.bytes);
  const badLab = body(await client.callTool({ name: 'set_parameters', arguments: { changes: [{ id: 'organ.model', label: 'Nonsense' }] } }));
  check('unknown label rejected with choices', badLab.errors.some((e: any) => e.message.includes('choices:')), badLab.errors);

  // Bipolar param center: eq.bass center 64
  const eqp = schema.parameters.find((p: any) => p.id === 'eq.bass');
  check('eq.bass is bipolar centered at 64', eqp?.orientation === 'bipolar' && eqp?.center === 64, eqp);

  // select_program: bank+location mapping (B:23 -> LSB 0, PC = 1*16 + 6 = 22)
  const selB = body(await client.callTool({ name: 'select_program', arguments: { bank: 'B', location: '23' } }));
  check('select_program B:23 -> MSB 0 LSB 0 PC 22', selB.bankMsb === 0 && selB.bankLsb === 0 && selB.programChange === 22, selB);
  // bank K (index 10) -> LSB 1, PC = 2*16 + slot; location 11 -> slot 0 -> PC 32
  const selK = body(await client.callTool({ name: 'select_program', arguments: { bank: 'K', location: '11' } }));
  check('select_program K:11 -> LSB 1 PC 32', selK.bankLsb === 1 && selK.programChange === 32, selK);
  check('select_program dry-run does not send', selK.sent === false);
  const selBad = body(await client.callTool({ name: 'select_program', arguments: {} }));
  check('select_program without args errors', typeof selBad.error === 'string', selBad);

  // State should now reflect the dry-run set
  const gs = body(await client.callTool({ name: 'get_patch_state', arguments: {} }));
  check('state tracks set value', gs.values['sample-synth.filter']?.value === 100, gs.values['sample-synth.filter']);

  // Snapshot -> randomize -> restore
  body(await client.callTool({ name: 'snapshot', arguments: { label: 'base' } }));
  const rnd = body(await client.callTool({ name: 'randomize', arguments: { sections: ['Sample Synth'], amount: 0.3 } }));
  check('randomize produced changes', rnd.randomized > 0, rnd.randomized);
  const rst = body(await client.callTool({ name: 'restore', arguments: { index: 0 } }));
  check('restore ran', rst.restored === 'base', rst);
  const gs2 = body(await client.callTool({ name: 'get_patch_state', arguments: {} }));
  check('restore brought filter back to 100', gs2.values['sample-synth.filter']?.value === 100, gs2.values['sample-synth.filter']);

  await client.close();
  console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error('smoke failed:', err); process.exit(1); });
