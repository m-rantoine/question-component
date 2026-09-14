import { useId, useState } from 'react';
import { useMessages } from '../hooks';
import { MIN_NAME_LENGTH, MAX_NAME_LENGTH, signIn } from '../identity';

export interface NameGateProps {
  /** Shown above the field. Defaults to the translated prompt. */
  prompt?: string;
  onSignedIn?: (name: string) => void;
}

/**
 * Asks for a name once and remembers it. Rendered inline by `AskQuestion` when
 * nobody is signed in, because the header nav is not on every page.
 */
export function NameGate({ prompt, onSignedIn }: NameGateProps) {
  const messages = useMessages();
  const id = useId();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const student = signIn(name);
      setError(null);
      onSignedIn?.(student.name);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : messages.nameTooShort(MIN_NAME_LENGTH));
    }
  }

  return (
    <form className="askq-namegate" onSubmit={handleSubmit}>
      <label className="askq-label" htmlFor={id}>
        {prompt ?? messages.namePrompt}
      </label>
      <div className="askq-namegate__row">
        <input
          id={id}
          className="askq-input"
          type="text"
          value={name}
          autoComplete="name"
          minLength={MIN_NAME_LENGTH}
          maxLength={MAX_NAME_LENGTH}
          placeholder={messages.namePlaceholder}
          onChange={(event) => setName(event.target.value)}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={error ? true : undefined}
        />
        <button type="submit" className="askq-button">
          {messages.continueLabel}
        </button>
      </div>
      {error ? (
        <p className="askq-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
