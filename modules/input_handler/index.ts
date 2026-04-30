/**
 * input_handler
 * --------------------------------------------------
 * Discrete state machine for the center button on the CyberCard
 * wallet device. Long-press is a hardware authorization gate for
 * any TX-class action (sub-GHz transmit, IR replay, NFC write).
 *
 * Mode cycle: status -> nfc_write -> nfc_scan -> rf_scan -> rf_tx_test -> status
 */

export type Mode = 'status' | 'nfc_write' | 'nfc_scan' | 'rf_scan' | 'rf_tx_test'
export const MODE_CYCLE: Mode[] = ['status', 'nfc_write', 'nfc_scan', 'rf_scan', 'rf_tx_test']

export interface ButtonEvent {
  /** ms since boot */
  ts: number
  /** 'down' | 'up' */
  edge: 'down' | 'up'
}

export interface InputState {
  mode: Mode
  longPressArmed: boolean
  lastDownTs: number | null
}

export const INITIAL_STATE: InputState = {
  mode: 'status',
  longPressArmed: false,
  lastDownTs: null
}

export const SHORT_PRESS_MS = 50
export const LONG_PRESS_MS = 1500

export function reduce(state: InputState, ev: ButtonEvent): InputState {
  if (ev.edge === 'down') {
    return { ...state, lastDownTs: ev.ts, longPressArmed: false }
  }
  // edge === 'up'
  if (state.lastDownTs === null) return state
  const held = ev.ts - state.lastDownTs

  if (held >= LONG_PRESS_MS) {
    // Long press authorizes the *current* mode; does not advance.
    return { ...state, longPressArmed: true, lastDownTs: null }
  }
  if (held >= SHORT_PRESS_MS) {
    const idx = MODE_CYCLE.indexOf(state.mode)
    const next = MODE_CYCLE[(idx + 1) % MODE_CYCLE.length]
    return { mode: next, longPressArmed: false, lastDownTs: null }
  }
  return { ...state, lastDownTs: null }
}

/** TX-class modes that REQUIRE longPressArmed before firmware will transmit. */
export const TX_GATED_MODES: ReadonlySet<Mode> = new Set(['nfc_write', 'rf_tx_test'])

export function canTransmit(state: InputState): boolean {
  return TX_GATED_MODES.has(state.mode) && state.longPressArmed
}
