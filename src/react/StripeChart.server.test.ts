/**
 * @jest-environment node
 */
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';

import {StripeChart} from './index';

test('server rendering outputs only the container, with no DOM', () => {
  expect(typeof document).toBe('undefined');
  const html = renderToString(
    createElement(StripeChart, {
      spec: {
        version: 1,
        title: 'Gross volume',
        chart: {type: 'kpi'},
        kpi: {value: 1, basis: 'custom'},
      },
      id: 'chart',
      className: 'card',
    }),
  );
  expect(html).toBe('<div id="chart" class="card"></div>');
});
