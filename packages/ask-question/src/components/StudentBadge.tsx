import { useMessages, useStudent } from '../hooks';
import { signOut } from '../identity';

export interface StudentBadgeProps {
  className?: string;
  /** Shown when nobody is signed in. Defaults to the translated label. */
  signedOutLabel?: string;
}

/**
 * Header widget: who is answering, and the button that clears them so another
 * student can use the same browser. Logout is broadcast, so every question on
 * the page returns to its name prompt straight away.
 */
export function StudentBadge({ className, signedOutLabel }: StudentBadgeProps) {
  const { student, loaded } = useStudent();
  const messages = useMessages();

  if (!loaded) return <span className={`askq-badge ${className ?? ''}`} aria-busy="true" />;

  if (!student) {
    return (
      <span className={`askq-badge askq-muted ${className ?? ''}`}>
        {signedOutLabel ?? messages.notSignedIn}
      </span>
    );
  }

  return (
    <span className={`askq-badge ${className ?? ''}`}>
      <span className="askq-badge__name">{student.name}</span>
      <button type="button" className="askq-button askq-button--small askq-button--ghost" onClick={signOut}>
        {messages.logOut}
      </button>
    </span>
  );
}
