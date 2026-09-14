import type { ReactNode } from 'react';
import { useMessages } from '../../hooks';
import type { AnswerValue, Question } from '../../types';

export interface QuestionInputProps {
  question: Question;
  /** The rendered question text. Each input owns its own labelling. */
  label: ReactNode;
  uid: string;
  value: AnswerValue | null;
  onChange: (value: AnswerValue) => void;
  disabled: boolean;
}

/** Discrete scale steps, or `null` when the range is too wide for one control per step. */
export function scaleSteps(min: number, max: number, countBy: number): number[] | null {
  const step = countBy > 0 ? countBy : 1;
  const count = Math.round((max - min) / step);
  if (!Number.isFinite(count) || count < 0 || count > 20) return null;
  return Array.from({ length: count + 1 }, (_, i) => Math.round((min + i * step) * 1e6) / 1e6);
}

function Fieldset({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={`askq-fieldset ${className ?? ''}`}>
      <legend className="askq-legend">{label}</legend>
      {children}
    </fieldset>
  );
}

export function QuestionInput({
  question,
  label,
  uid,
  value,
  onChange,
  disabled,
}: QuestionInputProps) {
  const messages = useMessages();

  switch (question.type) {
    case 'short-text':
      return (
        <div className="askq-field">
          <label className="askq-legend" htmlFor={uid}>
            {label}
          </label>
          <input
            id={uid}
            className="askq-input"
            type="text"
            value={typeof value === 'string' ? value : ''}
            maxLength={question.maxLength}
            placeholder={question.placeholder}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      );

    case 'long-text':
      return (
        <div className="askq-field">
          <label className="askq-legend" htmlFor={uid}>
            {label}
          </label>
          <textarea
            id={uid}
            className="askq-input askq-textarea"
            rows={question.rows ?? 4}
            value={typeof value === 'string' ? value : ''}
            maxLength={question.maxLength}
            placeholder={question.placeholder}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      );

    case 'number': {
      const config = question.config ?? {};
      return (
        <div className="askq-field">
          <label className="askq-legend" htmlFor={uid}>
            {label}
          </label>
          <input
            id={uid}
            className="askq-input askq-input--number"
            type="number"
            inputMode="decimal"
            value={value === null || value === undefined ? '' : String(value)}
            min={config.min}
            max={config.max}
            step={config.step ?? 'any'}
            disabled={disabled}
            onChange={(event) =>
              onChange(event.target.value === '' ? '' : Number(event.target.value))
            }
          />
        </div>
      );
    }

    case 'multiple-choice':
      return (
        <Fieldset label={label}>
          <div className="askq-options">
            {question.options.map((option, index) => {
              const optionId = `${uid}-o${index}`;
              return (
                <label className="askq-option" key={option} htmlFor={optionId}>
                  <input
                    id={optionId}
                    type="radio"
                    name={uid}
                    value={option}
                    checked={value === option}
                    disabled={disabled}
                    onChange={() => onChange(option)}
                  />
                  <span className="askq-option__text">{option}</span>
                </label>
              );
            })}
          </div>
        </Fieldset>
      );

    case 'button-choice':
      // Radio inputs styled as buttons: arrow-key navigation and the selected
      // state come for free, which a grid of <button>s would have to reinvent.
      return (
        <Fieldset label={label} className="askq-fieldset--buttons">
          <div className="askq-buttons">
            {question.options.map((option, index) => {
              const optionId = `${uid}-b${index}`;
              return (
                <label className="askq-choice-button" key={option} htmlFor={optionId}>
                  <input
                    id={optionId}
                    type="radio"
                    name={uid}
                    value={option}
                    checked={value === option}
                    disabled={disabled}
                    onChange={() => onChange(option)}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        </Fieldset>
      );

    case 'checkboxes': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <Fieldset label={label}>
          <div className="askq-options">
            {question.options.map((option, index) => {
              const optionId = `${uid}-c${index}`;
              const checked = selected.includes(option);
              return (
                <label className="askq-option" key={option} htmlFor={optionId}>
                  <input
                    id={optionId}
                    type="checkbox"
                    value={option}
                    checked={checked}
                    disabled={disabled}
                    onChange={() =>
                      onChange(
                        checked
                          ? selected.filter((picked) => picked !== option)
                          : // Keep the question's own option order, not click order.
                            question.options.filter(
                              (candidate) =>
                                candidate === option || selected.includes(candidate),
                            ),
                      )
                    }
                  />
                  <span className="askq-option__text">{option}</span>
                </label>
              );
            })}
          </div>
        </Fieldset>
      );
    }

    case 'scale': {
      const { min, max, countBy = 1, minLabel, maxLabel } = question.config;
      const steps = scaleSteps(min, max, countBy);

      if (!steps) {
        const current = typeof value === 'number' ? value : min;
        return (
          <div className="askq-field">
            <label className="askq-legend" htmlFor={uid}>
              {label}
            </label>
            <div className="askq-slider">
              {minLabel ? <span className="askq-scale__end">{minLabel}</span> : null}
              <input
                id={uid}
                type="range"
                min={min}
                max={max}
                step={countBy}
                value={current}
                disabled={disabled}
                onChange={(event) => onChange(Number(event.target.value))}
              />
              {maxLabel ? <span className="askq-scale__end">{maxLabel}</span> : null}
              <output className="askq-slider__value" htmlFor={uid}>
                {value === null ? '—' : current}
              </output>
            </div>
          </div>
        );
      }

      return (
        <Fieldset label={label} className="askq-fieldset--scale">
          <div className="askq-scale">
            {minLabel ? <span className="askq-scale__end">{minLabel}</span> : null}
            <div className="askq-scale__steps">
              {steps.map((step, index) => {
                const stepId = `${uid}-s${index}`;
                return (
                  <label className="askq-scale__step" key={step} htmlFor={stepId}>
                    <input
                      id={stepId}
                      type="radio"
                      name={uid}
                      value={step}
                      checked={value === step}
                      disabled={disabled}
                      onChange={() => onChange(step)}
                    />
                    <span>{step}</span>
                  </label>
                );
              })}
            </div>
            {maxLabel ? <span className="askq-scale__end">{maxLabel}</span> : null}
          </div>
        </Fieldset>
      );
    }

    case 'rating': {
      const max = question.config?.max ?? 5;
      const stars = Array.from({ length: max }, (_, i) => i + 1);
      return (
        <Fieldset label={label} className="askq-fieldset--rating">
          <div className="askq-rating">
            {stars.map((star) => {
              const starId = `${uid}-r${star}`;
              const filled = typeof value === 'number' && value >= star;
              return (
                <label
                  className={`askq-star ${filled ? 'askq-star--on' : ''}`}
                  key={star}
                  htmlFor={starId}
                >
                  <input
                    id={starId}
                    type="radio"
                    name={uid}
                    value={star}
                    checked={value === star}
                    disabled={disabled}
                    onChange={() => onChange(star)}
                  />
                  <span aria-hidden="true">{filled ? '★' : '☆'}</span>
                  <span className="askq-sr-only">{messages.starsLabel(star)}</span>
                </label>
              );
            })}
            <span className="askq-rating__value" aria-hidden="true">
              {typeof value === 'number' ? `${value}/${max}` : ''}
            </span>
          </div>
        </Fieldset>
      );
    }

    default:
      return null;
  }
}
