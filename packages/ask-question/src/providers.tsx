import { useEffect, useRef, type ReactNode } from 'react';
import { configure, type AskqConfig } from './runtime';
import { installIdleWatcher } from './idle';
import { useGroupSubscription } from './hooks';
import { IdleBanner } from './components/IdleBanner';

export interface QuestionProviderProps {
  config?: Partial<AskqConfig>;
  children?: ReactNode;
}

/**
 * Optional. Configuration lives on a `globalThis`-pinned runtime, so components
 * work without any provider — which they must, because Astro renders every
 * island as its own React root and no context can span them. Use this provider
 * in a single-root React app; call `configure()` at module scope in Astro.
 */
export function QuestionProvider({ config, children }: QuestionProviderProps) {
  const applied = useRef(false);
  if (!applied.current && config) {
    configure(config);
    applied.current = true;
  }
  useEffect(() => {
    installIdleWatcher();
  }, []);
  return <>{children}</>;
}

export interface AnswersProviderProps {
  groupId: string;
  config?: Partial<AskqConfig>;
  /** Renders the "polling paused" banner above the children. Defaults to true. */
  showIdleBanner?: boolean;
  children?: ReactNode;
}

/**
 * Holds one poller open for a whole dashboard, so results keep arriving while
 * individual `SeeAnswers` components mount and unmount, and every one of them
 * is fed by a single request per interval.
 */
export function AnswersProvider({
  groupId,
  config,
  showIdleBanner = true,
  children,
}: AnswersProviderProps) {
  const applied = useRef(false);
  if (!applied.current && config) {
    configure(config);
    applied.current = true;
  }
  useGroupSubscription(groupId);
  return (
    <>
      {showIdleBanner ? <IdleBanner /> : null}
      {children}
    </>
  );
}
