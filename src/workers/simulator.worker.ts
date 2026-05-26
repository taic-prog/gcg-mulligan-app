/// <reference lib="webworker" />
import { simulateCustomPlayability, simulatePlayability } from '../logic/simulator';
import type { DeckEntry, PlayabilityStats } from '../types';

type SimRequest =
  | { id: number; type: 'playability'; entries: DeckEntry[]; multiCardMode: boolean; trials: number }
  | { id: number; type: 'custom'; entries: DeckEntry[]; turnCardIds: string[][]; trials: number };

self.onmessage = (e: MessageEvent<SimRequest>) => {
  const req = e.data;
  let result: PlayabilityStats;
  if (req.type === 'playability') {
    result = simulatePlayability(req.entries, req.multiCardMode, req.trials);
  } else {
    const turnCardIds = req.turnCardIds.map((ids) => new Set(ids));
    result = simulateCustomPlayability(req.entries, turnCardIds, req.trials);
  }
  self.postMessage({ id: req.id, type: req.type, result });
};
