/**
 * Plays a short two-tone "bell" chime for new-order alerts. Synthesised with the
 * Web Audio API so there's no binary asset to ship or fetch (which the strict
 * asset pipeline would otherwise have to host).
 *
 * Browsers block audio until the user has interacted with the page; if the
 * context can't start (or isn't supported) we fail silently — the toast and the
 * sidebar dot still convey the event.
 */

type WindowWithWebkitAudio = Window &
  typeof globalThis & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

/** A single struck note with a soft exponential decay. */
function strike(ac: AudioContext, freq: number, at: number, duration: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.28, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(at);
  osc.stop(at + duration);
}

export function playBell(): void {
  try {
    const ac = getContext();
    if (!ac) return;
    // Resume if the context was auto-suspended (returns a promise we ignore).
    if (ac.state === "suspended") void ac.resume();
    const now = ac.currentTime;
    strike(ac, 880, now, 0.5); // A5
    strike(ac, 1174.66, now + 0.14, 0.5); // D6
  } catch {
    /* audio unavailable — the toast + dot still fire */
  }
}
