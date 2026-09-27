export interface PlinkoPerfProbeState {
  phase: 'ready' | 'running' | 'resolved' | 'error';
  startedAtMs: number | null;
  resolvedAtMs: number | null;
  activeBallCount: number;
  error: string | null;
  start(): Promise<void>;
}

declare global {
  interface Window {
    __PLINKO_PERF__?: PlinkoPerfProbeState;
  }
}

export const isPlinkoPerfMode = (): boolean => {
  if (import.meta.env.VITE_PERF_PROBE !== 'true') return false;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('perf') === 'plinko';
};

export const clearPlinkoPerfProbe = (): void => {
  if (typeof window !== 'undefined') delete window.__PLINKO_PERF__;
};
