/** Shared AR spawn bounce: grow → overshoot → jiggle settle + ripple timing. */

export const EMERGE_RISE_MS = 520;
export const EMERGE_JIGGLE_MS = 380;
export const EMERGE_TOTAL_MS = EMERGE_RISE_MS + EMERGE_JIGGLE_MS;
export const EMERGE_OVERSHOOT = 1.18;
export const EMERGE_START_Y = -0.04;
export const EMERGE_RING_MS = 620;
export const EMERGE_RING_STAGGER_MS = 55;
export const EMERGE_RING_SCALE_FROM = 0.12;
export const EMERGE_RING_SCALE_TO = 2.15;
export const EMERGE_RING_OPACITIES = [0.55, 0.4, 0.28] as const;
export const EMERGE_LAND_HAPTIC_MS = 480;
export const REDUCE_MS = 120;

export function easeOutBack(t: number): number {
  const c1 = 2.2;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

export function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

export function rippleFade(t: number): number {
  const u = 1 - Math.min(1, Math.max(0, t));
  return u * u;
}

export function rippleScale(t: number): number {
  const eased = easeOutCubic(Math.min(1, Math.max(0, t)));
  return (
    EMERGE_RING_SCALE_FROM +
    (EMERGE_RING_SCALE_TO - EMERGE_RING_SCALE_FROM) * eased
  );
}

const JIGGLE_KEYS: ReadonlyArray<{ t: number; v: number }> = [
  { t: 0, v: EMERGE_OVERSHOOT },
  { t: 0.35, v: 0.94 },
  { t: 0.7, v: 1.06 },
  { t: 1, v: 1 },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function jiggleIntro(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  for (let i = 0; i < JIGGLE_KEYS.length - 1; i++) {
    const a = JIGGLE_KEYS[i];
    const b = JIGGLE_KEYS[i + 1];
    if (u <= b.t) {
      const local = (u - a.t) / (b.t - a.t || 1);
      return lerp(a.v, b.v, easeOutCubic(local));
    }
  }
  return 1;
}

export function emergeIntroAt(elapsedMs: number, floor = 0): number {
  if (elapsedMs <= 0) return floor;
  if (elapsedMs < EMERGE_RISE_MS) {
    const t = elapsedMs / EMERGE_RISE_MS;
    return Math.max(floor, EMERGE_OVERSHOOT * easeOutBack(t));
  }
  const jiggleT = Math.min(1, (elapsedMs - EMERGE_RISE_MS) / EMERGE_JIGGLE_MS);
  return jiggleIntro(jiggleT);
}

export function emergeRiseY(
  elapsedMs: number,
  startY = EMERGE_START_Y,
): number {
  if (elapsedMs >= EMERGE_RISE_MS) return 0;
  const t = Math.min(1, Math.max(0, elapsedMs / EMERGE_RISE_MS));
  return startY * (1 - easeOutBack(t));
}
