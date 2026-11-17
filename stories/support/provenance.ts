import type {Provenance} from '../../src/index';

const SOURCE = 'Stripe Data API';

export type ProvenanceOptions = {
  metric: string;
  period: string;
  comparedWith?: string;
  timeZone?: string;
  fetchedAt: string;
};

export function provenance({
  metric,
  period,
  comparedWith,
  timeZone = 'UTC',
  fetchedAt,
}: ProvenanceOptions): Provenance {
  return {
    source: SOURCE,
    fetchedAt,
    details: [
      {label: 'Metric', value: metric},
      {label: 'Period', value: period},
      ...(comparedWith === undefined
        ? []
        : [{label: 'Compared with', value: comparedWith}]),
      {label: 'Time zone', value: timeZone},
    ],
  };
}
