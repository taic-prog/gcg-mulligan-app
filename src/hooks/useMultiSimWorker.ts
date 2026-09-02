import { useCallback, useEffect, useRef } from 'react';
import type { DeckEntry, MultiSimulationStats } from '../types';

type WorkerResponse = { id: number; type: 'multi'; result: MultiSimulationStats };

// runMultipleSimulations を Web Worker で実行し、メインスレッドをブロックしない。
// Statistics・TestDraw のようにボタン押下で1件ずつ実行する用途向け（PlayabilityCard の
// entries変更トリガー・古いリクエスト破棄が必要なケースは専用実装のまま）。
export function useMultiSimWorker() {
  const workerRef = useRef<Worker | null>(null);
  const nextIdRef = useRef(0);
  const pendingRef = useRef(new Map<number, (result: MultiSimulationStats) => void>());

  useEffect(() => {
    const worker = new Worker(new URL('../workers/simulator.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const resolve = pendingRef.current.get(e.data.id);
      if (!resolve) return;
      pendingRef.current.delete(e.data.id);
      resolve(e.data.result);
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  return useCallback((entries: DeckEntry[], trials: number): Promise<MultiSimulationStats> => {
    const id = nextIdRef.current++;
    return new Promise((resolve) => {
      pendingRef.current.set(id, resolve);
      workerRef.current?.postMessage({ id, type: 'multi', entries, trials });
    });
  }, []);
}
