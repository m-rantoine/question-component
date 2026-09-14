import { useIdleState } from '../hooks';
import { getConfig } from '../runtime';

function humanDuration(ms: number): string {
  if (ms >= 60_000 && ms % 60_000 === 0) {
    const minutes = ms / 60_000;
    return minutes === 1 ? 'a minute' : `${minutes} minutes`;
  }
  const seconds = Math.round(ms / 1000);
  return seconds === 1 ? 'a second' : `${seconds} seconds`;
}

/** Sticky notice shown while polling is stopped, with the button that restarts it. */
export function IdleBanner() {
  const { paused, reason, resume } = useIdleState();
  if (!paused || reason === 'hidden') return null;

  const message =
    reason === 'session-limit'
      ? 'Live updates paused — this page has been open for a while.'
      : `Live updates paused after ${humanDuration(getConfig().idleMs)} of inactivity.`;

  return (
    <div className="askq-banner" role="status">
      <span className="askq-banner__text">{message}</span>
      <button type="button" className="askq-button askq-button--small" onClick={resume}>
        Resume live updates
      </button>
    </div>
  );
}
