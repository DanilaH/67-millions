export type SpecialPinAudioKind =
  | 'amplifier'
  | 'splitter'
  | 'return';

export interface SpecialPinCueTiming {
  durationMs: number;
  minIntervalMs: number;
}

export const SPECIAL_PIN_CUE_TIMINGS: Record<
  SpecialPinAudioKind,
  SpecialPinCueTiming
> = {
  amplifier: {
    durationMs: 130,
    minIntervalMs: 42,
  },
  splitter: {
    durationMs: 115,
    minIntervalMs: 48,
  },
  return: {
    durationMs: 185,
    minIntervalMs: 70,
  },
};

export const SPECIAL_PIN_VOICE_LIMIT = 5;

export interface SpecialPinAudioSnapshot {
  activeVoices: number;
  maxObservedActiveVoices: number;
  accepted: Record<SpecialPinAudioKind, number>;
  rejectedByCooldown: number;
  rejectedByVoiceLimit: number;
}

interface ActiveVoice {
  kind: SpecialPinAudioKind;
  endsAtMs: number;
}

const emptyCounts = (): Record<SpecialPinAudioKind, number> => ({
  amplifier: 0,
  splitter: 0,
  return: 0,
});

export class SpecialPinAudioPolicy {
  private readonly activeVoices: ActiveVoice[] = [];
  private readonly lastAcceptedAt = new Map<
    SpecialPinAudioKind,
    number
  >();
  private readonly accepted = emptyCounts();
  private maxObservedActiveVoices = 0;
  private rejectedByCooldown = 0;
  private rejectedByVoiceLimit = 0;

  public constructor(
    private readonly voiceLimit = SPECIAL_PIN_VOICE_LIMIT,
  ) {
    if (!Number.isInteger(voiceLimit) || voiceLimit <= 0) {
      throw new RangeError(
        'Special-pin voice limit must be a positive integer',
      );
    }
  }

  public trySchedule(
    kind: SpecialPinAudioKind,
    nowMs: number,
  ): boolean {
    if (!Number.isFinite(nowMs)) {
      throw new RangeError('Special-pin audio time must be finite');
    }

    this.releaseExpired(nowMs);

    const timing = SPECIAL_PIN_CUE_TIMINGS[kind];
    const lastAcceptedAt =
      this.lastAcceptedAt.get(kind) ?? -Infinity;

    if (nowMs - lastAcceptedAt < timing.minIntervalMs) {
      this.rejectedByCooldown += 1;
      return false;
    }

    if (this.activeVoices.length >= this.voiceLimit) {
      this.rejectedByVoiceLimit += 1;
      return false;
    }

    this.lastAcceptedAt.set(kind, nowMs);
    this.activeVoices.push({
      kind,
      endsAtMs: nowMs + timing.durationMs,
    });
    this.accepted[kind] += 1;
    this.maxObservedActiveVoices = Math.max(
      this.maxObservedActiveVoices,
      this.activeVoices.length,
    );

    return true;
  }

  public snapshot(nowMs: number): SpecialPinAudioSnapshot {
    if (!Number.isFinite(nowMs)) {
      throw new RangeError('Special-pin audio time must be finite');
    }

    this.releaseExpired(nowMs);

    return {
      activeVoices: this.activeVoices.length,
      maxObservedActiveVoices: this.maxObservedActiveVoices,
      accepted: { ...this.accepted },
      rejectedByCooldown: this.rejectedByCooldown,
      rejectedByVoiceLimit: this.rejectedByVoiceLimit,
    };
  }

  private releaseExpired(nowMs: number): void {
    for (
      let index = this.activeVoices.length - 1;
      index >= 0;
      index -= 1
    ) {
      if (this.activeVoices[index]!.endsAtMs <= nowMs) {
        this.activeVoices.splice(index, 1);
      }
    }
  }
}
