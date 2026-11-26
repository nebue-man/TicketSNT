// Haptic + audio cues for the gate scanner.
// iOS Safari has no vibration API, so sound is the only non-visual cue there.
// Browsers only allow audio after a user gesture: call unlockAudio() from a tap.

let audioCtx: AudioContext | null = null

function getAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    audioCtx = new Ctor()
  }
  return audioCtx
}

export function unlockAudio() {
  const ctx = getAudio()
  if (ctx && ctx.state === 'suspended') void ctx.resume()
}

function tone(freq: number, startS: number, durS: number, type: OscillatorType = 'sine', gain = 0.25) {
  const ctx = getAudio()
  if (!ctx || ctx.state !== 'running') return
  const t0 = ctx.currentTime + startS
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + durS)
  osc.connect(g).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + durS)
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
}

/** QR read — fires the instant a code is decoded, before the server answers. */
export function cueRead(muted: boolean) {
  vibrate(40)
  if (!muted) tone(1200, 0, 0.06, 'square', 0.12)
}

/** Admitted — rising two-note chime. */
export function cueAdmitted(muted: boolean) {
  vibrate(80)
  if (!muted) { tone(660, 0, 0.12); tone(990, 0.12, 0.2) }
}

/** Already scanned / not admitted / not checked — low buzz. */
export function cueProblem(muted: boolean) {
  vibrate([120, 80, 120])
  if (!muted) tone(160, 0, 0.4, 'square', 0.2)
}
