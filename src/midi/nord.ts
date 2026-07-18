/**
 * Nord-specific MIDI controller.
 *
 * Wraps a `MidiDevice` and the pure message builders, holding the configured
 * MIDI channel and the device port-name match. This is the layer the MCP tools
 * call: it exposes the three send paths (CC, NRPN, 14-bit NRPN) by intent, and
 * relays inbound messages for state reconciliation.
 */

import { buildCC, buildNRPN, buildNRPN14, buildProgramSelect } from './messages.js';
import { MidiDevice, MidiMessageListener, PortInfo, RtMidiDevice } from './device.js';

/** Default substring used to find the Nord's MIDI ports. */
export const DEFAULT_PORT_MATCH = 'nord';

export interface NordConfig {
  /** Substring to match the Nord MIDI port name (case-insensitive). */
  portMatch?: string;
  /** MIDI channel 1-16 (Nord global channel). Defaults to 1. */
  channel?: number;
  /** Inject a device (e.g. a mock) for testing. */
  device?: MidiDevice;
}

export class NordMidi {
  private _device?: MidiDevice;
  private readonly injected?: MidiDevice;
  readonly portMatch: string;
  /** 0-indexed channel (0-15) used on the wire. */
  readonly channel: number;
  private opened?: { input?: PortInfo; output?: PortInfo };

  /** Lazily constructed so dry-run works without the native MIDI binding. */
  get device(): MidiDevice {
    if (!this._device) this._device = this.injected ?? new RtMidiDevice();
    return this._device;
  }

  constructor(config: NordConfig = {}) {
    this.injected = config.device;
    this.portMatch = config.portMatch ?? DEFAULT_PORT_MATCH;
    const ch = config.channel ?? 1;
    if (!Number.isInteger(ch) || ch < 1 || ch > 16) {
      throw new RangeError(`channel must be 1-16, got ${ch}`);
    }
    this.channel = ch - 1;
  }

  open(): { input?: PortInfo; output?: PortInfo } {
    const first = !this._device;
    const dev = this.device; // may lazily construct
    if (first) {
      for (const l of this.pendingMessageListeners) dev.onMessage(l);
      for (const l of this.pendingDisconnectListeners) dev.onDisconnect(l);
    }
    this.opened = dev.open(this.portMatch);
    return this.opened;
  }

  close(): void {
    if (this._device) this._device.close();
  }

  isOpen(): boolean {
    return this._device ? this._device.isOpen() : false;
  }

  private readonly pendingMessageListeners: MidiMessageListener[] = [];
  private readonly pendingDisconnectListeners: Array<(reason: string) => void> = [];

  /** Listener registration is buffered until the device is actually opened. */
  onMessage(listener: MidiMessageListener): void {
    this.pendingMessageListeners.push(listener);
    if (this._device) this._device.onMessage(listener);
  }

  onDisconnect(listener: (reason: string) => void): void {
    this.pendingDisconnectListeners.push(listener);
    if (this._device) this._device.onDisconnect(listener);
  }

  // --- The three send paths (Phase 1) ---

  /** Plain CC. */
  sendCC(controller: number, value: number): number[][] {
    const msgs = buildCC(this.channel, controller, value);
    this.device.sendAll(msgs);
    return msgs;
  }

  /** Standard NRPN: value goes in Data Entry LSB (CC38), Data Entry MSB (CC6)=0. */
  sendNRPN(nrpnMsb: number, nrpnLsb: number, value: number): number[][] {
    const msgs = buildNRPN(this.channel, nrpnMsb, nrpnLsb, value);
    this.device.sendAll(msgs);
    return msgs;
  }

  /** 14-bit NRPN (e.g. Sample category+sample: NRPN 3/4, MSB=category LSB=sample). */
  sendNRPN14(nrpnMsb: number, nrpnLsb: number, dataMsb: number, dataLsb: number): number[][] {
    const msgs = buildNRPN14(this.channel, nrpnMsb, nrpnLsb, dataMsb, dataLsb);
    this.device.sendAll(msgs);
    return msgs;
  }

  /**
   * Recall content via Bank Select + Program Change (manual p. 26):
   *   Bank MSB (CC0): 0 = Program, 3 = Piano, 4 = Sample, 6 = Live
   *   Bank LSB (CC32): Program 0-3 (each LSB spans 8 banks), Piano 0-5, Sample 0-n, Live 0
   *   Program Change: 0-127 (Program: bank A = 0-15, B = 16-31, ... H = 112-127)
   */
  selectProgram(bankMsb: number, bankLsb: number, program: number): number[][] {
    const msgs = buildProgramSelect(this.channel, bankMsb, bankLsb, program);
    this.device.sendAll(msgs);
    return msgs;
  }

  /** Play a note (raw Note On). For auditioning sounds without the user playing. */
  noteOn(note: number, velocity = 100): number[] {
    const m = [0x90 | this.channel, note & 0x7f, velocity & 0x7f];
    this.device.send(m);
    return m;
  }

  /** Release a note (Note On with velocity 0 — universally accepted Note Off). */
  noteOff(note: number): number[] {
    const m = [0x90 | this.channel, note & 0x7f, 0];
    this.device.send(m);
    return m;
  }

  /** Panic: All Notes Off (CC 123) — safety to avoid stuck notes. */
  allNotesOff(): void {
    this.sendCC(123, 0);
  }
}
