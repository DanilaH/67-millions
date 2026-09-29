export interface PlinkoPerfProbeState {
  phase: 'ready' | 'running' | 'resolved' | 'error';
  startedAtMs: number | null;
  resolvedAtMs: number | null;
  activeBallCount: number;
  maxActiveBallCount: number;
  targetActiveBallCount: number | null;
  error: string | null;
  start(): Promise<void>;
}

declare global {
  interface Window {
    __PLINKO_PERF__?: PlinkoPerfProbeState;
  }
}

const getPerfMode = (): string | null => {
  if (import.meta.env.VITE_PERF_PROBE !== 'true') return null;
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('perf');
};

export const isPlinkoPerfMode = (): boolean =>
  getPerfMode() === 'plinko';

export const isPlinkoStressPerfMode = (): boolean =>
  getPerfMode() === 'plinko-stress';

export const clearPlinkoPerfProbe = (): void => {
  if (typeof window !== 'undefined') delete window.__PLINKO_PERF__;
};
