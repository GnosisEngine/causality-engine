// src/runtime/tick.ts

export interface TickConfig {
  /** Number of ticks per real-world second. Default: 20. */
  ticksPerSecond: number
  /** Number of ticks per in-game minute. Default: 1 (1 tick = 1 game minute). */
  ticksPerGameMinute: number
}

export interface TickClock {
  current(): number
  advance(): number
  reset(tick: number): void
  ticksToMs(ticks: number): number
  msToTicks(ms: number): number
  ticksToGameMinutes(ticks: number): number
  config(): Readonly<TickConfig>
}

const DEFAULT_CONFIG: TickConfig = {
  ticksPerSecond: 20,
  ticksPerGameMinute: 1,
}

export function createTickClock(cfg: Partial<TickConfig> = {}): TickClock {
  const resolved: TickConfig = { ...DEFAULT_CONFIG, ...cfg }
  const msPerTick = 1000 / resolved.ticksPerSecond
  let tick = 0

  return {
    current: () => tick,
    advance: () => ++tick,
    reset: (n: number) => { tick = n },
    ticksToMs: (ticks) => Math.round(ticks * msPerTick),
    msToTicks: (ms) => Math.floor(ms / msPerTick),
    ticksToGameMinutes: (ticks) => Math.floor(ticks / resolved.ticksPerGameMinute),
    config: () => Object.freeze({ ...resolved }),
  }
}
