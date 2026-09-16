import { useId, useState } from 'react';
import { useMessages } from '../hooks';

export interface TeacherLoginProps {
  /**
   * The route running `createTeacherAuth().login`. Required — the form posts
   * here, and the package cannot know where you mounted it.
   */
  action: string;
  /** Where to go after signing in. Defaults to `?next=` on the current URL. */
  next?: string;
  className?: string;
}

/**
 * Sign-in form for the teacher side.
 *
 * It posts to the server route rather than handling the credentials here: the
 * session is a signed, HttpOnly cookie that JavaScript must not be able to
 * mint or read. The fetch is only so a wrong password can be reported without
 * losing the page.
 */
export function TeacherLogin({ action, next, className }: TeacherLoginProps) {
  const messages = useMessages();
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const destination =
    next ??
    (typeof window === 'undefined'
      ? '/'
      : new URLSearchParams(window.location.search).get('next') || '/');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(action, {
        method: 'POST',
        body: new FormData(event.currentTarget),
        // `redirect: manual` keeps the 303 from being followed by fetch, so the
        // cookie is set and the browser navigates once, here.
        redirect: 'manual',
      });
      if (response.status === 401) {
        setError(messages.signInFailed);
      } else if (response.status === 429) {
        setError(messages.signInThrottled);
      } else {
        window.location.assign(destination);
        return;
      }
    } catch {
      setError(messages.signInFailed);
    }
    setBusy(false);
  }

  return (
    <form
      className={`askq-login ${className ?? ''}`}
      method="post"
      action={action}
      onSubmit={handleSubmit}
    >
      <h2 className="askq-login__title">{messages.teacherSignIn}</h2>
      <input type="hidden" name="next" value={destination} />

      <label className="askq-label" htmlFor={`${id}-user`}>
        {messages.usernameLabel}
      </label>
      <input
        id={`${id}-user`}
        className="askq-input"
        type="text"
        name="user"
        autoComplete="username"
        required
      />

      <label className="askq-label" htmlFor={`${id}-password`}>
        {messages.passwordLabel}
      </label>
      <input
        id={`${id}-password`}
        className="askq-input"
        type="password"
        name="password"
        autoComplete="current-password"
        required
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
      />

      <button type="submit" className="askq-button" disabled={busy}>
        {busy ? messages.submitting : messages.signIn}
      </button>

      {error ? (
        <p className="askq-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
