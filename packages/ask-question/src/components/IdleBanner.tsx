import { useIdleState, useMessages } from '../hooks';
import { getConfig } from '../runtime';
import type { Messages } from '../i18n';

function humanDuration(ms: number, messages: Messages): string {
  if (ms >= 60_000 && ms % 60_000 === 0) return messages.durationMinutes(ms / 60_000);
  return messages.durationSeconds(Math.round(ms / 1000));
}

/** Sticky notice shown while polling is stopped, with the button that restarts it. */
export function IdleBanner() {
  const { paused, reason, resume } = useIdleState();
  const messages = useMessages();
  if (!paused || reason === 'hidden') return null;

  const text =
    reason === 'session-limit'
      ? messages.pausedSession
      : messages.pausedIdle(humanDuration(getConfig().idleMs, messages));

  return (
    <div className="askq-banner" role="status">
      <span className="askq-banner__text">{text}</span>
      <button type="button" className="askq-button askq-button--small" onClick={resume}>
        {messages.resumeUpdates}
      </button>
    </div>
  );
}
