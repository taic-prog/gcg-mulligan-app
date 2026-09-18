import { useCallback, useEffect, useRef } from 'react';
import type { DeckEntry, MultiSimulationStats } from '../types';

type WorkerResponse = { id: number; type: 'multi'; result: MultiSimulationStats };

interface Pending {
  resolve: (result: MultiSimulationStats) => void;
  reject: (error: unknown) => void;
}

// runMultipleSimulations を Web Worker で実行し、メインスレッドをブロックしない。
// Statistics・TestDraw のようにボタン押下で1件ずつ実行する用途向け（PlayabilityCard の
// entries変更トリガー・古いリクエスト破棄が必要なケースは専用実装のまま）。
export function useMultiSimWorker() {
  const workerRef = useRef<Worker | null>(null);
  const nextIdRef = useRef(0);
  const pendingRef = useRef(new Map<number, Pending>());

  useEffect(() => {
    const worker = new Worker(new URL('../workers/simulator.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const pending = pendingRef.current.get(e.data.id);
      if (!pending) return;
      pendingRef.current.delete(e.data.id);
      pending.resolve(e.data.result);
    };
    worker.onerror = (e) => {
      // どのリクエストで発生したか特定できないため、保留中の全リクエストを失敗させる
      for (const pending of pendingRef.current.values()) pending.reject(e);
      pendingRef.current.clear();
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  return useCallback((entries: DeckEntry[], trials: number): Promise<MultiSimulationStats> => {
    const id = nextIdRef.current++;
    return new Promise((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject });
      workerRef.current?.postMessage({ id, type: 'multi', entries, trials });
    });
  }, []);
}
