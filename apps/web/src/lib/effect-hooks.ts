import { type Effect, Fiber } from "effect";
import { useCallback, useEffect, useRef, useState } from "react";
import { mapApiError } from "@/api/api-errors";
import { type ApiClient, ApiRuntime } from "@/api/client";

/**
 * Hook for manual actions (mutations).
 * Returns a trigger function and the status of the execution.
 */
export const useAction = <A, E, R extends ApiClient, P extends unknown[]>(
  effectFn: (...args: P) => Effect.Effect<A, E, R>,
  options?: {
    onSuccess?: (data: A) => void;
    onError?: (error: string) => void;
  },
) => {
  const [data, setData] = useState<A | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fiberRef = useRef<Fiber.RuntimeFiber<A, any> | null>(null);

  const unmountedRef = useRef(false);

  const execute = useCallback(
    (...args: P) => {
      // Interrupt any existing fiber for this action
      if (fiberRef.current) {
        ApiRuntime.runSync(Fiber.interrupt(fiberRef.current));
      }

      setIsLoading(true);
      setError(null);

      const program = effectFn(...args);
      const runtimeFiber = ApiRuntime.runFork(program);
      fiberRef.current = runtimeFiber;

      ApiRuntime.runPromise(Fiber.join(runtimeFiber))
        .then((result) => {
          if (!unmountedRef.current) {
            setData(result);
            setIsLoading(false);
            options?.onSuccess?.(result);
          }
        })
        .catch((err) => {
          if (!unmountedRef.current) {
            const message = mapApiError(err);
            setError(message);
            setIsLoading(false);
            options?.onError?.(message);
          }
        });
    },
    [effectFn, options],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      if (fiberRef.current) {
        ApiRuntime.runSync(Fiber.interrupt(fiberRef.current));
      }
    };
  }, []);

  return { execute, data, error, isLoading } as const;
};

/**
 * Hook for automatic data fetching on mount or dependency change.
 */
export const useQuery = <A, E, R extends ApiClient>(
  effect: Effect.Effect<A, E, R>,
  deps: Array<any> = [],
) => {
  const [data, setData] = useState<A | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fiberRef = useRef<Fiber.RuntimeFiber<A, any> | null>(null);
  const effectRef = useRef(effect);

  useEffect(() => {
    effectRef.current = effect;
  }, [effect]);

  useEffect(() => {
    // Interrupt any existing fiber
    if (fiberRef.current) {
      ApiRuntime.runSync(Fiber.interrupt(fiberRef.current));
    }

    setIsLoading(true);
    setError(null);

    let cancelled = false;
    const runtimeFiber = ApiRuntime.runFork(effectRef.current);
    fiberRef.current = runtimeFiber;

    ApiRuntime.runPromise(Fiber.join(runtimeFiber))
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(mapApiError(err));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (fiberRef.current) {
        ApiRuntime.runSync(Fiber.interrupt(fiberRef.current));
      }
    };
  }, deps);

  return { data, error, isLoading } as const;
};
