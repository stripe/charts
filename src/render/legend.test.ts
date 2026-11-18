import {render} from '../index';
import type {ChartSpec} from '../spec';
import {render as renderWithEnvironment} from './index';
import type {MotionEnvironment} from './motion';

// jsdom has no ResizeObserver; the plot observes its area. A browser sends
// the first notification before the next paint; the stub sends it at once,
// with the element's measured size.
class ResizeObserverStub {
  readonly disconnect = jest.fn();

  readonly unobserve = jest.fn();

  readonly observe: (target: Element) => void;

  constructor(callback: ResizeObserverCallback) {
    this.observe = (target) => {
      const {width, height} = target.getBoundingClientRect();
      callback(
        [{contentRect: {width, height}} as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    };
  }
}

// Every element measures as the plot's size, so each plot, including one
// re-rendered by a legend press, draws from its first notification.
function giveLayout(): void {
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 600,
    height: 300,
    top: 0,
    left: 0,
    right: 600,
    bottom: 300,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

const series = (
  label: string,
  base: number,
): NonNullable<ChartSpec['series']>[number] => ({
  label,
  data: [
    {x: '2026-11-27', y: base},
    {x: '2026-11-28', y: base * 2},
  ],
});

const SPEC: ChartSpec = {
  version: 1,
  title: 'Payments by method',
  timeZone: 'UTC',
  format: {style: 'number'},
  series: [series('Cards', 300), series('Wallets', 200), series('Bank', 100)],
};

let element: HTMLElement;

function buttons(): HTMLButtonElement[] {
  return [...element.querySelectorAll<HTMLButtonElement>('.sc-legend button')];
}

function button(label: string): HTMLButtonElement {
  const found = buttons().find((b) => b.textContent === label);
  if (!found) throw new Error(`no legend button for ${label}`);
  return found;
}

/** Labels whose buttons are pressed, that is, shown. */
function shown(): string[] {
  return buttons()
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent ?? '');
}

/** `detail` is 0 from the keyboard, 1 for a click, 2 or more for later clicks of a run. */
function click(label: string, detail = 1): void {
  button(label).dispatchEvent(new MouseEvent('click', {detail, bubbles: true}));
}

/**
 * A double-click as browsers deliver it: a click, then `dblclick`. The
 * second click (detail 2) is sent too; once the first click has replaced
 * the button, Chrome may drop it, so the legend doesn't rely on it.
 */
function doubleClick(label: string, {secondClick = true} = {}): void {
  click(label, 1);
  if (secondClick) click(label, 2);
  button(label).dispatchEvent(
    new MouseEvent('dblclick', {detail: 2, bubbles: true}),
  );
}

beforeEach(() => {
  (globalThis as {ResizeObserver?: unknown}).ResizeObserver =
    ResizeObserverStub;
  element = document.createElement('div');
  document.body.appendChild(element);
});

afterEach(() => {
  element.remove();
  jest.restoreAllMocks();
});

describe('interactive legend', () => {
  it('hides a series from the plot as soon as it is clicked', () => {
    const onLegendChange = jest.fn();
    giveLayout();
    render(element, SPEC, {onLegendChange});
    expect(element.querySelectorAll('.sc-line')).toHaveLength(3);

    click('Wallets');
    expect(shown()).toEqual(['Cards', 'Bank']);
    expect(element.querySelectorAll('.sc-line')).toHaveLength(2);
    expect(onLegendChange).toHaveBeenLastCalledWith({hidden: ['Wallets']});
    expect(document.activeElement?.textContent).toBe('Wallets');
  });

  it('isolates on double-click from the state before it, and restores on another', () => {
    const onLegendChange = jest.fn();
    render(element, SPEC, {onLegendChange});
    // The double-click's first click hides Bank at once; the second shows
    // only Bank, not a net toggle.
    doubleClick('Bank');
    expect(shown()).toEqual(['Bank']);
    expect(onLegendChange).toHaveBeenLastCalledWith({
      hidden: ['Cards', 'Wallets'],
    });

    doubleClick('Bank');
    expect(shown()).toEqual(['Cards', 'Wallets', 'Bank']);
    expect(onLegendChange).toHaveBeenLastCalledWith({hidden: []});

    button('Cards').dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(shown()).toEqual(['Cards']);
  });

  it('isolates a hidden series on double-click, whether or not the second click arrives', () => {
    const onLegendChange = jest.fn();
    render(element, SPEC, {onLegendChange});
    click('Wallets');
    // Hidden Wallets: the double-click's first click shows it, and the
    // double-click leaves it the only one shown, not all of them.
    doubleClick('Wallets', {secondClick: false});
    expect(shown()).toEqual(['Wallets']);
    expect(onLegendChange).toHaveBeenLastCalledWith({
      hidden: ['Cards', 'Bank'],
    });

    // A click right before a double-click makes a run of three clicks; the
    // third doesn't undo the isolation.
    click('Cards');
    doubleClick('Cards');
    click('Cards', 3);
    expect(shown()).toEqual(['Cards']);
  });

  it('keeps the last visible series and says why', () => {
    const onLegendChange = jest.fn();
    render(element, SPEC, {onLegendChange});
    doubleClick('Cards');
    onLegendChange.mockClear();

    click('Cards', 0);
    expect(shown()).toEqual(['Cards']);
    expect(onLegendChange).not.toHaveBeenCalled();
    expect(element.querySelector('.sc-legend [aria-live]')?.textContent).toBe(
      'At least one series stays visible.',
    );
  });

  it('starts no animation for a press, though updates animate', () => {
    const frames: number[] = [];
    const animations: Keyframe[][] = [];
    const environment: MotionEnvironment = {
      now: () => 0,
      requestFrame: () => frames.push(0),
      cancelFrame: () => undefined,
      prefersReducedMotion: () => false,
      animate: (_target, keyframes) => {
        animations.push(keyframes);
        return {
          cancel: () => undefined,
          addEventListener: () => undefined,
        } as unknown as Animation;
      },
    };
    giveLayout();
    const chart = renderWithEnvironment(element, SPEC, {}, environment);
    frames.length = 0;
    animations.length = 0;

    click('Wallets');
    expect(element.querySelectorAll('.sc-line')).toHaveLength(2);
    expect(frames).toHaveLength(0);
    expect(animations).toHaveLength(0);

    chart.update({...SPEC, series: [series('Cards', 1), series('Bank', 2)]});
    expect(frames.length + animations.length).toBeGreaterThan(0);
  });

  it('keeps hidden series through a loading placeholder', () => {
    const onLegendChange = jest.fn();
    const chart = render(element, SPEC, {onLegendChange});
    click('Wallets');
    onLegendChange.mockClear();

    chart.update({version: 1, title: SPEC.title, loading: true});
    expect(onLegendChange).not.toHaveBeenCalled();
    chart.update(SPEC);
    expect(shown()).toEqual(['Cards', 'Bank']);
    expect(onLegendChange).not.toHaveBeenCalled();
  });

  it('keeps series hidden across update() by label', () => {
    const onLegendChange = jest.fn();
    const chart = render(element, SPEC, {onLegendChange});
    click('Wallets');

    chart.update({
      ...SPEC,
      series: [...(SPEC.series ?? []), series('Other', 50)],
    });
    expect(shown()).toEqual(['Cards', 'Bank', 'Other']);

    chart.update({
      ...SPEC,
      series: [series('Cards', 1), series('Bank', 2), series('Other', 3)],
    });
    expect(shown()).toEqual(['Cards', 'Bank', 'Other']);
    expect(onLegendChange).toHaveBeenLastCalledWith({hidden: []});
  });
});
