/**
 * Tiny synthesised UI tones.
 *
 * Synthesised rather than sampled so there's no audio asset to ship, cache or
 * fail to load — the whole "sound pack" is a few oscillator envelopes.
 *
 * Deliberately quiet and short. This is confirmation feedback on a stepper,
 * not a notification: if someone taps "+" eight times in a row it should feel
 * like a soft click each time, never like an alarm.
 */

let ctx: AudioContext | null = null;

/**
 * Browsers refuse to start an AudioContext outside a user gesture, so it's
 * created on the first tap rather than at import time — and a context that
 * was auto-suspended (backgrounded tab) is nudged awake before use.
 */
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;

  try {
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    // Audio is a nicety; a browser that won't give us a context loses nothing
    // else on the page.
    return null;
  }
}

/** One shaped note. `from`/`to` in Hz let a note glide rather than sit flat. */
function note(
  from: number,
  to: number,
  start: number,
  duration: number,
  peak: number,
) {
  const ac = audio();
  if (!ac) return;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  // Triangle is softer than square and less pure than sine — reads as a UI
  // blip rather than a test tone.
  osc.type = "triangle";
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration);

  // A quick attack with an exponential decay; ramping to a true zero is
  // illegal on an exponential curve, hence the near-silent floor.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** A bright two-note rise — something was added. */
export function playIncrement() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  note(660, 880, t, 0.09, 0.06); // E5 → A5
  note(880, 1320, t + 0.06, 0.12, 0.045); // A5 → E6
}

/** A dulled fall — something was taken away. */
export function playDecrement() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  // Lands a minor third below where it started, which is what makes it read
  // as "undone" rather than as another confirmation.
  note(520, 415, t, 0.11, 0.05); // C5 → G#4
  note(415, 330, t + 0.07, 0.14, 0.038); // G#4 → E4
}
