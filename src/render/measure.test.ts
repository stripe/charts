import {createTextMeasurer} from './measure';

// jsdom has no layout, so widths come from a stub: 7px per character at the
// base font, doubled for the large one. Each call stands for a forced layout.
function stubLayout(): jest.SpyInstance {
  return jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      const large = this.closest('.large') !== null;
      const width = (this.textContent ?? '').length * (large ? 14 : 7);
      return {width} as DOMRect;
    });
}

function chartElement(className = ''): HTMLElement {
  const element = document.createElement('div');
  element.className = className;
  document.body.appendChild(element);
  return element;
}

// jsdom has no FontFaceSet; an event target is enough to announce loads.
const fonts = new EventTarget();
Object.defineProperty(document, 'fonts', {value: fonts, configurable: true});

describe('createTextMeasurer', () => {
  let style: HTMLStyleElement;
  beforeEach(() => {
    style = document.createElement('style');
    style.textContent =
      '.sc-measure{font-family:Test;font-size:12px}.large .sc-measure{font-size:24px}';
    document.head.appendChild(style);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    style.remove();
    document.body.replaceChildren();
  });

  it('measures a label once per page and font, not once per chart', () => {
    const layout = stubLayout();
    const first = createTextMeasurer(chartElement());
    const second = createTextMeasurer(chartElement());
    const large = createTextMeasurer(chartElement('large'));

    expect(first('$1,000')).toBe(42);
    expect(second('$1,000')).toBe(42);
    expect(layout).toHaveBeenCalledTimes(1);

    // Another font gets its own widths.
    expect(large('$1,000')).toBe(84);
    expect(layout).toHaveBeenCalledTimes(2);
  });

  it('measures again after a web font finishes loading', () => {
    const layout = stubLayout();
    const measure = createTextMeasurer(chartElement());
    measure('Nov 1');
    measure('Nov 1');
    expect(layout).toHaveBeenCalledTimes(1);

    fonts.dispatchEvent(new Event('loadingdone'));
    measure('Nov 1');
    expect(layout).toHaveBeenCalledTimes(2);
  });
});
