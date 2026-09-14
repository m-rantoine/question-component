import { useLocale } from '../hooks';
import { LOCALES, LOCALE_NAMES, type Locale } from '../i18n';

export interface LanguagePickerProps {
  className?: string;
  /** `buttons` is a segmented control; `select` is a native dropdown. */
  variant?: 'buttons' | 'select';
}

/**
 * Switches the interface language. The choice is stored per browser and
 * broadcast, so every question and every dashboard on the page follows along.
 */
export function LanguagePicker({ className, variant = 'buttons' }: LanguagePickerProps) {
  const { locale, messages, setLocale } = useLocale();

  if (variant === 'select') {
    return (
      <label className={`askq-langpicker ${className ?? ''}`}>
        <span className="askq-sr-only">{messages.languageLabel}</span>
        <select
          className="askq-langpicker__select"
          value={locale}
          onChange={(event) => setLocale(event.target.value as Locale)}
        >
          {LOCALES.map((option) => (
            <option key={option} value={option}>
              {LOCALE_NAMES[option]}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div
      className={`askq-langpicker askq-toggle ${className ?? ''}`}
      role="group"
      aria-label={messages.languageLabel}
    >
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          className={`askq-toggle__button ${option === locale ? 'is-active' : ''}`}
          aria-pressed={option === locale}
          lang={option}
          onClick={() => setLocale(option)}
        >
          {LOCALE_NAMES[option]}
        </button>
      ))}
    </div>
  );
}
