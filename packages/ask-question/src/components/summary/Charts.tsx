import type { Tally } from '../../aggregate';

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/**
 * Horizontal bars for one measure (how many students chose each option).
 *
 * One hue for every bar: the bars encode magnitude, not identity, so colouring
 * each option differently would imply a distinction that isn't in the data. The
 * correct option is marked with a check and a label as well as a colour, so the
 * marking never depends on colour alone.
 */
export function BarList({
  tallies,
  total,
  emptyLabel = 'No answers yet.',
}: {
  tallies: Tally[];
  total: number;
  emptyLabel?: string;
}) {
  if (tallies.length === 0) return <p className="askq-note">{emptyLabel}</p>;
  const peak = Math.max(1, ...tallies.map((tally) => tally.count));

  return (
    <ul className="askq-bars">
      {tallies.map((tally) => (
        <li
          className={`askq-bar ${tally.isCorrect ? 'askq-bar--correct' : ''}`}
          key={tally.label}
          title={`${tally.label}: ${tally.count} of ${total} (${percent(tally.share)})`}
        >
          <div className="askq-bar__head">
            <span className="askq-bar__label">
              {tally.isCorrect ? (
                <span className="askq-tag askq-tag--correct">
                  <span aria-hidden="true">✓</span> correct
                </span>
              ) : null}
              {tally.label}
            </span>
            <span className="askq-bar__value">
              {tally.count} <span className="askq-muted">({percent(tally.share)})</span>
            </span>
          </div>
          <div className="askq-bar__track">
            <div
              className="askq-bar__fill"
              style={{ width: `${(tally.count / peak) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface HistogramBin {
  label: string;
  value: number;
  count: number;
  share: number;
  isCorrect: boolean;
}

/** Vertical columns, one per step of the configured range — empty steps included. */
export function Histogram({ bins, total }: { bins: HistogramBin[]; total: number }) {
  if (bins.length === 0) return <p className="askq-note">No answers yet.</p>;
  const peak = Math.max(1, ...bins.map((bin) => bin.count));

  return (
    <div className="askq-histogram" role="img" aria-label={histogramLabel(bins, total)}>
      {bins.map((bin) => (
        <div
          className={`askq-histogram__col ${bin.isCorrect ? 'askq-histogram__col--correct' : ''}`}
          key={bin.value}
          title={`${bin.label}: ${bin.count} of ${total}`}
        >
          <span className="askq-histogram__count">{bin.count > 0 ? bin.count : ''}</span>
          <div className="askq-histogram__track">
            <div
              className="askq-histogram__fill"
              style={{ height: `${(bin.count / peak) * 100}%` }}
            />
          </div>
          <span className="askq-histogram__tick">
            {bin.label}
            {bin.isCorrect ? (
              <span className="askq-histogram__marker" aria-hidden="true">
                ✓
              </span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}

function histogramLabel(bins: HistogramBin[], total: number): string {
  const parts = bins
    .filter((bin) => bin.count > 0)
    .map((bin) => `${bin.label}: ${bin.count}`)
    .join(', ');
  return `Distribution of ${total} answers. ${parts || 'No answers yet.'}`;
}
