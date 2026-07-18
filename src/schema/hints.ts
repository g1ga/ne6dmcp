/**
 * Curated semantic hints for the Nord Electro 6D, keyed by parameter id.
 *
 * Layered onto the generated schema by scripts/build-schema.ts. They are
 * semantic metadata (what a parameter *means* for sound design), NOT MIDI
 * values — so maintaining them here by hand is appropriate and they are
 * re-applied deterministically on every build. Parameters without a hint simply
 * omit the field.
 */

export const HINTS: Record<string, string> = {
  // --- Global ---
  'global.volume': 'master output level',
  'global.pan': 'stereo position — bipolar, 64 = center',
  'global.kbd-split': 'keyboard split / external-keyboard-to-LO / dual organ switch — verify states via readback',

  // --- Organ ---
  'organ.enable': 'organ section on/off',
  'organ.level': 'organ section volume',
  'organ.octave-shift': 'organ octave transpose — bipolar, 64 = no shift',
  'organ.model': 'organ engine: B3 tonewheel, Vox/Farf transistor, Pipe 1/2, B3 Bass',
  'organ.preset': 'recalls an organ preset (drawbar+vibrato+percussion setup) within the current model',
  'organ.drawbar-1': "drawbar 1 (B3: 16' sub-octave) — 0 = pushed in (silent), 127 = fully out (loud)",
  'organ.drawbar-2': "drawbar 2 (B3: 5 1/3' quint) — 0 = in, 127 = out",
  'organ.drawbar-3': "drawbar 3 (B3: 8' fundamental — the backbone of most registrations)",
  'organ.drawbar-4': "drawbar 4 (B3: 4' octave)",
  'organ.drawbar-5': "drawbar 5 (B3: 2 2/3' nazard)",
  'organ.drawbar-6': "drawbar 6 (B3: 2' super-octave)",
  'organ.drawbar-7': "drawbar 7 (B3: 1 3/5' tierce)",
  'organ.drawbar-8': "drawbar 8 (B3: 1 1/3' larigot)",
  'organ.drawbar-9': "drawbar 9 (B3: 1' sifflet — adds sparkle)",
  'organ.percussion-enable': 'B3 percussion attack transient on/off (classic jazz/rock click)',
  'organ.percussion-harmonic': 'percussion pitch: 2nd or 3rd harmonic',
  'organ.percussion-speed': 'percussion decay: slow or fast',
  'organ.percussion-level': 'percussion loudness: normal or soft',
  'organ.vibrato-type': 'scanner vibrato/chorus: V1-V3 vibrato, C1-C3 chorus (C3 = classic full chorus)',
  'organ.vibrato-enable': 'vibrato/chorus on/off',
  'organ.edit-lower-manual': 'route panel edits to the lower manual (dual organ / split)',

  // --- Piano ---
  'piano.enable': 'piano section on/off',
  'piano.level': 'piano section volume',
  'piano.octave-shift': 'piano octave transpose — bipolar, 64 = no shift',
  'piano.type': 'piano category — NOT RECEIVED over CC (dump-only); to change pianos use select_program with bankMsb 3, bankLsb = category 0-5, program = model index',
  'piano.model': 'piano model — NOT RECEIVED over CC (dump-only); use select_program (bankMsb 3) instead',
  'piano.variation': 'piano variation — NOT RECEIVED over CC (dump-only); use select_program (bankMsb 3) instead',
  'piano.eq': 'piano timbre filter (e.g. soft/mid/bright) — verify states via readback',

  // --- Sample Synth ---
  'sample-synth.enable': 'sample synth section on/off',
  'sample-synth.level': 'sample synth volume',
  'sample-synth.attack': 'sample envelope attack — 0 = instant, high = slow swell (pads)',
  'sample-synth.decay-release': 'sample envelope decay/release — how long the sound rings out',
  'sample-synth.dynamics': 'velocity response of the sample synth',
  'sample-synth.filter': 'sample synth brightness filter — low = dark, high = open',

  // --- Effects ---
  'effect1.type': 'modulation effect 1: tremolo/pan intensities, wah, ring mod — verify values via readback',
  'effect1.source': 'which engine effect 1 processes: Organ, Piano or Sample Synth',
  'effect1.rate': 'effect 1 speed (wah: sweep position)',
  'effect1.ctrl-pedal': 'let the control pedal drive effect 1 (pedal wah / trem amount)',
  'effect2.type': 'modulation effect 2: phasers, flanger, vibe, choruses — verify values via readback',
  'effect2.source': 'which engine effect 2 processes',
  'effect2.rate': 'effect 2 speed',
  'effect2.deep': 'deep mode — stronger modulation for the current effect 2',
  'delay.amount': 'delay dry/wet balance',
  'delay.rate': 'delay time (use panel tap-tempo for song sync)',
  'delay.feedback': 'number of repeats',
  'delay.ping-pong': 'repeats alternate left/right',
  'delay.source': 'which engine the delay processes',
  'amp.type': 'amp/speaker sim: JC solid-state, Small reed-piano tube, Twin tube, or Rotary speaker',
  'amp.drive': 'overdrive amount (tube-style drive when no amp model selected)',
  'amp.source': 'which engine the amp/speaker processes',
  'rotary.speed': 'rotary speaker rotor speed: slow (chorale) / fast (tremolo)',
  'eq.bass': 'EQ bass at 100 Hz — bipolar, 64 = flat, +/-15 dB',
  'eq.mid': 'EQ mid — bipolar, 64 = flat',
  'eq.mid-frequency': 'EQ mid center frequency, 200 Hz - 8 kHz',
  'eq.treble': 'EQ treble at 4 kHz — bipolar, 64 = flat',
  'eq.source': 'which engine the EQ processes',
  'reverb.type': 'Room (short), Stage (medium), Hall (long) — verify values via readback',
  'reverb.amount': 'reverb dry/wet',
  'reverb.bright': 'preserve high frequencies in the reverb tail',
};
