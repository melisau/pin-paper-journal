"use client";

import { useEffect, useRef, type DependencyList, type EffectCallback } from "react";

/** Runs the latest callback once after its dependencies have stayed unchanged. */
export function useDebouncedEffect(effect: EffectCallback, dependencies: DependencyList, delay = 1000, enabled = true) {
  const latestEffect = useRef(effect);

  useEffect(() => {
    latestEffect.current = effect;
  }, [effect]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => latestEffect.current(), delay);
    return () => window.clearTimeout(timer);
    // The caller explicitly supplies the values that should restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, enabled, ...dependencies]);
}
