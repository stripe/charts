import {render, SpecError} from './index';

describe('render', () => {
  it('hands back the chart on a first spec that is invalid', () => {
    const element = document.createElement('div');
    let error: unknown;
    try {
      render(element, {version: 1, title: 'Gross volume', chart: {type: 'pie'}});
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(SpecError);
    expect(element.querySelector('.sc-error')).not.toBeNull();

    (error as SpecError).chart?.update({
      version: 1,
      title: 'Gross volume',
      series: [{label: '2026', data: [{x: '2026-11-27', y: 412000.25}]}],
    });
    expect(element.querySelector('.sc-error')).toBeNull();
    expect(element.textContent).toContain('Gross volume');
  });
});
