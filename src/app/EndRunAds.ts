import type { AdsAdapter } from '@danilah/mini-games-kit/yandex';
import type { SaveState } from '../core/save/SaveState';

export const END_RUN_ADS_KEY = '67m:end-run-ads';

/** Requested only by the summary's restart button. The kit owns pause/watchdog. */
export class EndRunAds {
  private inFlight = false;
  constructor(private readonly ads: AdsAdapter) {}
  async beforeRestart(save: SaveState, restart: () => void | Promise<void>): Promise<boolean> {
    if (this.inFlight || (!save.game.victory && save.game.terminalReason === null) || save.pendingDrop !== null) return false;
    this.inFlight = true;
    try {
      try { await this.ads.showInterstitial(); } catch { /* Failed/no-fill ads never block restart. */ }
      await restart();
      return true;
    } finally { this.inFlight = false; }
  }
}
