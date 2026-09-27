export class VoiceBudget {
  private active = 0;

  public constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new RangeError('Voice limit must be a positive integer');
    }
  }

  public tryAcquire(): boolean {
    if (this.active >= this.limit) return false;
    this.active += 1;
    return true;
  }

  public release(): void {
    this.active = Math.max(0, this.active - 1);
  }

  public getActiveCount(): number {
    return this.active;
  }
}
