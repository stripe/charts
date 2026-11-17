// Benchmarks for the browser build: script cost, first render, update,
// hover, resize, many charts on one page, memory and DOM size. Loaded by
// index.html (see README.md). The data is generated from fixed seeds, so
// runs are comparable between builds and machines.
//
// Each suite is an async function of plain options that resolves to plain
// JSON, so it can be run from the page's buttons or from a browser
// automation script through `window.StripeChartsBench`.
//
// Measurements must not overlap, so suites await each step in turn.

(function () {
  const DAY_MS = 86400000;
  const HOUR_MS = 3600000;
  const START = Date.UTC(2025, 0, 1);
  const FRAME_TIMEOUT_MS = 5000;

  /** How the build loaded, set by `load()`. */
  let loaded = null;

  // --- Data -------------------------------------------------------------

  /**
   * A seeded pseudo-random generator (Park-Miller), so every run draws the
   * same data. The products stay below 2^53, so doubles compute it exactly.
   */
  function random(seed) {
    const modulus = 2147483647;
    let state = (seed % (modulus - 1)) + 1;
    return function next() {
      state = (state * 48271) % modulus;
      return (state - 1) / (modulus - 1);
    };
  }

  /** Dates: calendar days, or hours as ISO date-times for `hourly`. */
  function xValue(index, hourly) {
    const iso = new Date(START + index * (hourly ? HOUR_MS : DAY_MS));
    return hourly
      ? `${iso.toISOString().slice(0, 19)}Z`
      : iso.toISOString().slice(0, 10);
  }

  /** A trend with weekly seasonality and noise, scaled down per series. */
  function seriesData(points, seriesIndex, hourly, seed) {
    const next = random(seed * 31 + seriesIndex + 1);
    const scale = 1 - seriesIndex * 0.15;
    const period = hourly ? 24 : 7;
    const data = [];
    for (let i = 0; i < points; i += 1) {
      const trend = 1000 + (i / Math.max(points, 1)) * 400;
      const season = 1 + 0.25 * Math.sin((2 * Math.PI * i) / period);
      const noise = 0.85 + 0.3 * next();
      data.push({
        x: xValue(i, hourly),
        y: Math.round(trend * season * noise * scale * 100) / 100,
      });
    }
    return data;
  }

  /**
   * A spec for one chart. `type` is "line", "bar" (grouped), "stacked" or
   * "kpi" (a KPI tile with a sparkline). Odd-numbered series are
   * comparisons, except in stacked bars, which cannot stack comparisons.
   */
  function makeSpec({
    type,
    series = 2,
    points = 30,
    hourly = false,
    seed = 1,
    provenance = true,
  }) {
    const chart =
      type === 'stacked'
        ? {type: 'bar', stacking: 'stacked'}
        : {type: type === 'kpi' ? 'kpi' : type};
    const list = [];
    for (let s = 0; s < series; s += 1) {
      const comparison = type !== 'stacked' && s % 2 === 1;
      list.push({
        label: comparison ? `Series ${s} (last year)` : `Series ${s + 1}`,
        ...(comparison ? {comparison: true} : {}),
        data: seriesData(points, s, hourly, seed),
      });
    }
    const total = list[0].data.reduce((sum, point) => sum + point.y, 0);
    return {
      title: `Benchmark ${type}`,
      description: `${series} series, ${points} points`,
      timeZone: 'UTC',
      format: {style: 'currency', currency: 'usd', unit: 'major'},
      kpi: {basis: 'custom', value: total, comparisonValue: total * 0.9},
      chart,
      series: list,
      ...(provenance
        ? {
            provenance: {
              source: 'Generated data',
              fetchedAt: '2026-01-01T00:00:00Z',
              details: [{label: 'Seed', value: String(seed)}],
            },
          }
        : {}),
    };
  }

  // --- Measurement helpers ----------------------------------------------

  const now = () => performance.now();
  const round = (value) => Math.round(value * 100) / 100;

  /** Median, p95 and range of `values`, in their own units. */
  function stats(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const at = (q) =>
      sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
    return {
      n: sorted.length,
      median: round(at(0.5)),
      p95: round(at(0.95)),
      min: round(sorted[0]),
      max: round(sorted[sorted.length - 1]),
    };
  }

  /** `stats` for every key of a list of samples like `{render: 1.2, frame: 16}`. */
  function summarize(samples) {
    const result = {};
    for (const key of Object.keys(samples[0] ?? {})) {
      result[key] = stats(samples.map((sample) => sample[key]));
    }
    return result;
  }

  /**
   * Resolves with the time once the next frame has been produced: a task
   * queued from an animation frame callback runs after that frame's style,
   * layout and paint. A zero-delay timeout is used rather than a message
   * channel (slightly coarser, by up to a millisecond of timer clamping)
   * so the harness adds no message event listeners.
   */
  function afterFrame() {
    return new Promise((resolve, reject) => {
      // A page that stops producing frames (in the background, or a stalled
      // browser) would otherwise hang the run.
      const stalled = setTimeout(() => {
        reject(new Error('No animation frame for 5s; is the page visible?'));
      }, FRAME_TIMEOUT_MS);
      requestAnimationFrame(() => {
        clearTimeout(stalled);
        setTimeout(() => {
          resolve(now());
        }, 0);
      });
    });
  }

  const wait = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

  // Long tasks (over 50ms) and long animation frames, kept for the whole
  // page so a suite can ask for the ones inside its time window.
  const longTasks = [];
  const longFrames = [];
  function observe(type, list) {
    if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return;
    new PerformanceObserver((entries) =>
      list.push(...entries.getEntries()),
    ).observe({type, buffered: true});
  }
  observe('longtask', longTasks);
  observe('long-animation-frame', longFrames);

  /** Count, total and longest of the long tasks between two times. */
  function longTasksBetween(start, end) {
    const inside = longTasks.filter(
      (task) => task.startTime >= start && task.startTime < end,
    );
    const frames = longFrames.filter(
      (frame) => frame.startTime >= start && frame.startTime < end,
    );
    return {
      count: inside.length,
      totalMs: round(inside.reduce((sum, task) => sum + task.duration, 0)),
      maxMs: round(Math.max(0, ...inside.map((task) => task.duration))),
      longFrames: frames.length,
      maxBlockingMs: round(
        Math.max(0, ...frames.map((frame) => frame.blockingDuration ?? 0)),
      ),
    };
  }

  // Memory and garbage collection. An automation script can provide
  // precise versions (for example through the DevTools protocol) as
  // `window.benchGC`, `window.benchHeap` and `window.benchCounters`.
  async function collectGarbage() {
    if (window.benchGC) await window.benchGC();
    else if (window.gc) window.gc();
  }
  async function heapBytes() {
    if (window.benchHeap) return window.benchHeap();
    return performance.memory ? performance.memory.usedJSHeapSize : null;
  }
  async function counters() {
    const live = document.getElementsByTagName('*').length;
    const extra = window.benchCounters ? await window.benchCounters() : {};
    return {liveElements: live, heapBytes: await heapBytes(), ...extra};
  }

  // --- Page helpers -----------------------------------------------------

  const stage = () => document.getElementById('stage');

  /** A chart container on the stage. KPI tiles take their own height. */
  function container(width, height, type) {
    const element = document.createElement('div');
    element.style.width = `${width}px`;
    if (type !== 'kpi') element.style.height = `${height}px`;
    stage().appendChild(element);
    return element;
  }

  /** Element counts in a chart, by the kinds that grow with the data. */
  function domSize(element) {
    const count = (selector) => element.querySelectorAll(selector).length;
    const paths = [...element.querySelectorAll('path')];
    return {
      elements: count('*'),
      svgElements: count('svg *'),
      rects: count('rect'),
      paths: paths.length,
      pathChars: paths.reduce(
        (sum, path) => sum + (path.getAttribute('d') ?? '').length,
        0,
      ),
      texts: count('text'),
      tableRows: count('tr'),
    };
  }

  function charts() {
    if (!window.StripeCharts)
      throw new Error('The StripeCharts build is not loaded');
    return window.StripeCharts;
  }

  const prefersReducedMotion = () =>
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Frame intervals for `duration` ms: how smooth an animation runs. */
  async function frameIntervals(duration) {
    const start = now();
    const intervals = [];
    let last = start;
    while (now() - start < duration) {
      const time = await afterFrame();
      intervals.push(time - last);
      last = time;
    }
    return {
      frames: intervals.length,
      maxFrameMs: round(Math.max(...intervals)),
      over33ms: intervals.filter((interval) => interval > 33.4).length,
      longTasks: longTasksBetween(start, now()),
    };
  }

  // --- Suites -----------------------------------------------------------

  /** Script cost, measured by `load()` on page load and by re-evaluating the source. */
  async function script({runs = 10} = {}) {
    const source = await (await fetch(bundleUrl())).text();
    const samples = [];
    for (let i = 0; i < runs; i += 1) {
      const element = document.createElement('script');
      element.textContent = source;
      delete window.StripeCharts;
      const start = now();
      document.head.appendChild(element);
      const ready = now();
      if (!window.StripeCharts)
        throw new Error('The script did not define StripeCharts');
      element.remove();
      samples.push({evaluateMs: ready - start});
      await afterFrame();
    }
    return {
      firstLoad: loaded,
      rawBytes: source.length,
      reevaluate: summarize(samples),
    };
  }

  /**
   * First render: `render()` returning, then layout flushed, then the next
   * frame produced. Also validation alone, which `render()` includes.
   */
  async function render({
    type = 'line',
    series = 2,
    points = 30,
    width = 800,
    height = 400,
    hourly = false,
    provenance = true,
    runs = 10,
    warmup = 3,
  }) {
    const spec = makeSpec({type, series, points, hourly, provenance});
    const samples = [];
    let dom = null;
    const start = now();
    for (let i = 0; i < warmup + runs; i += 1) {
      const element = container(width, height, type);
      await afterFrame();
      const t0 = now();
      charts().validate(spec);
      const t1 = now();
      const handle = charts().render(element, spec);
      const t2 = now();
      // Reading a size forces any pending style and layout work.
      element.getBoundingClientRect();
      const t3 = now();
      const t4 = await afterFrame();
      if (i >= warmup)
        samples.push({
          validateMs: t1 - t0,
          renderMs: t2 - t1,
          layoutMs: t3 - t1,
          frameMs: t4 - t1,
        });
      dom ??= domSize(element);
      handle.destroy();
      element.remove();
    }
    return {
      ...summarize(samples),
      dom,
      longTasks: longTasksBetween(start, now()),
    };
  }

  /**
   * `update()` with the same shape of data (new values: a tween when motion
   * is on) or a different shape (half the points: a replacement).
   */
  async function update({
    type = 'line',
    series = 2,
    points = 30,
    width = 800,
    height = 400,
    shape = 'same',
    runs = 10,
    warmup = 2,
    settleMs = 800,
  }) {
    const first = makeSpec({type, series, points});
    const second =
      shape === 'same'
        ? makeSpec({type, series, points, seed: 2})
        : makeSpec({
            type,
            series,
            points: Math.max(1, Math.round(points / 2)),
            seed: 2,
          });
    const element = container(width, height, type);
    const handle = charts().render(element, first);
    const animated = !prefersReducedMotion();
    if (animated) await wait(settleMs);
    const samples = [];
    const animations = [];
    const start = now();
    for (let i = 0; i < warmup + runs; i += 1) {
      await afterFrame();
      const t0 = now();
      handle.update(i % 2 === 0 ? second : first);
      const t1 = now();
      const t2 = await afterFrame();
      if (i >= warmup) samples.push({updateMs: t1 - t0, frameMs: t2 - t0});
      if (animated) {
        const frames = await frameIntervals(settleMs);
        if (i >= warmup) animations.push(frames);
      }
    }
    const result = {
      ...summarize(samples),
      longTasks: longTasksBetween(start, now()),
    };
    if (animated) {
      result.animation = {
        maxFrameMs: stats(animations.map((a) => a.maxFrameMs)),
        over33msPerUpdate: stats(animations.map((a) => a.over33ms)),
      };
    }
    handle.destroy();
    element.remove();
    return result;
  }

  /**
   * The entrance animation's cost when motion is on: frame intervals from
   * `render()` until the animation has finished.
   */
  async function entrance({
    type = 'line',
    series = 2,
    points = 30,
    width = 800,
    height = 400,
    runs = 5,
    durationMs = 1200,
  }) {
    const spec = makeSpec({type, series, points});
    const results = [];
    for (let i = 0; i < runs; i += 1) {
      const element = container(width, height, type);
      await afterFrame();
      const handle = charts().render(element, spec);
      results.push(await frameIntervals(durationMs));
      handle.destroy();
      element.remove();
    }
    return {
      reducedMotion: prefersReducedMotion(),
      frames: stats(results.map((r) => r.frames)),
      maxFrameMs: stats(results.map((r) => r.maxFrameMs)),
      over33ms: stats(results.map((r) => r.over33ms)),
      longTasks: stats(results.map((r) => r.longTasks.count)),
    };
  }

  /**
   * Sweeps the pointer across the plot, one move per frame, with
   * synthetic pointer events: the handler's time (crosshair, markers,
   * tooltip and its placement) and the time until the frame showing it.
   */
  async function hover({
    type = 'line',
    series = 2,
    points = 1000,
    width = 800,
    height = 400,
    steps = 200,
  }) {
    const element = container(width, height, type);
    const handle = charts().render(element, makeSpec({type, series, points}));
    const area = element.querySelector('.sc-plot-area');
    const tooltip = element.querySelector('.sc-tooltip');
    const box = area.getBoundingClientRect();
    const samples = [];
    let changes = 0;
    let previous = '';
    await afterFrame();
    const start = now();
    for (let i = 0; i < steps; i += 1) {
      const clientX = box.left + ((i + 0.5) / steps) * box.width;
      const event = new PointerEvent('pointermove', {
        clientX,
        clientY: box.top + box.height / 2,
        bubbles: true,
      });
      const t0 = now();
      area.dispatchEvent(event);
      const t1 = now();
      const t2 = await afterFrame();
      samples.push({handlerMs: t1 - t0, frameMs: t2 - t0});
      if (tooltip.textContent !== previous) changes += 1;
      previous = tooltip.textContent;
    }
    const result = {
      ...summarize(samples),
      tooltipChanges: changes,
      longTasks: longTasksBetween(start, now()),
    };
    handle.destroy();
    element.remove();
    return result;
  }

  /**
   * Records real pointer input on `element` until `stop()` is called: the
   * time from each pointermove's timestamp to the end of the frame after
   * it. For automation that moves a real mouse.
   */
  function inputProbe(selector) {
    const target = document.querySelector(selector);
    const latencies = [];
    let pending = false;
    const start = now();
    const onMove = (event) => {
      if (pending) return;
      pending = true;
      afterFrame().then((time) => {
        latencies.push(time - event.timeStamp);
        pending = false;
      });
    };
    target.addEventListener('pointermove', onMove);
    return {
      stop() {
        target.removeEventListener('pointermove', onMove);
        return {
          latencyMs: stats(latencies),
          longTasks: longTasksBetween(start, now()),
        };
      },
    };
  }

  /**
   * A container width change: the time to the next frame compared with an
   * idle frame, and how resizes coalesce (one redraw per frame at most).
   */
  async function resize({
    type = 'line',
    series = 2,
    points = 365,
    from = 800,
    to = 600,
    height = 400,
    runs = 10,
    rapid = 50,
  }) {
    const element = container(from, height, type);
    const handle = charts().render(element, makeSpec({type, series, points}));
    let redraws = 0;
    const watcher = new MutationObserver((records) => {
      redraws += records.filter(
        (record) => record.target instanceof SVGSVGElement,
      ).length;
    });
    watcher.observe(element, {childList: true, subtree: true});
    const setWidth = (width) => {
      element.style.width = `${width}px`;
    };
    await afterFrame();

    const idle = [];
    const resized = [];
    for (let i = 0; i < runs; i += 1) {
      let t0 = now();
      idle.push({frameMs: (await afterFrame()) - t0});
      t0 = now();
      setWidth(i % 2 === 0 ? to : from);
      resized.push({frameMs: (await afterFrame()) - t0});
    }
    const start = now();

    // Many changes in one task: the observer reports only the last one.
    redraws = 0;
    for (let i = 0; i < rapid; i += 1) setWidth(from - i * 4);
    await afterFrame();
    await afterFrame();
    const oneTask = {redraws};

    // One change per task, as from a resize handler: at most one redraw per frame.
    redraws = 0;
    let frames = 0;
    let counting = true;
    const countFrames = () => {
      if (!counting) return;
      frames += 1;
      requestAnimationFrame(countFrames);
    };
    requestAnimationFrame(countFrames);
    for (let i = 0; i < rapid; i += 1) {
      setWidth(from - i * 4);
      await wait(0);
    }
    await afterFrame();
    counting = false;
    await afterFrame();
    const perTask = {redraws, frames};

    // One change per frame, as when dragging a window edge.
    redraws = 0;
    const dragged = [];
    for (let i = 0; i < rapid; i += 1) {
      const t0 = now();
      setWidth(from - i * 4);
      dragged.push({frameMs: (await afterFrame()) - t0});
    }
    const perFrame = {redraws, ...summarize(dragged)};

    const result = {
      idle: summarize(idle),
      resized: summarize(resized),
      rapid: {changes: rapid, oneTask, perTask, perFrame},
      longTasks: longTasksBetween(start, now()),
    };
    watcher.disconnect();
    handle.destroy();
    element.remove();
    return result;
  }

  /** The chart kinds a dashboard cycles through, as `makeSpec` options. */
  const DASHBOARD_CARDS = [
    {type: 'kpi', series: 2, points: 30},
    {type: 'line', series: 2, points: 30},
    {type: 'bar', series: 2, points: 30},
    {type: 'stacked', series: 3, points: 30},
    {type: 'line', series: 2, points: 365},
    {type: 'bar', series: 1, points: 90},
  ];

  /**
   * Many charts on one page: a grid of `cards` cards, rendered in one go,
   * then destroyed. Memory is after garbage collection where available.
   */
  async function dashboard({
    cards = 12,
    width = 1440,
    columns = 3,
    height = 320,
  }) {
    const grid = document.createElement('div');
    grid.style.cssText = `display:grid;grid-template-columns:repeat(${columns},1fr);gap:16px;width:${width}px`;
    stage().appendChild(grid);
    const specs = [];
    const elements = [];
    for (let i = 0; i < cards; i += 1) {
      const card = DASHBOARD_CARDS[i % DASHBOARD_CARDS.length];
      specs.push(makeSpec({...card, seed: i + 1}));
      const element = document.createElement('div');
      if (card.type !== 'kpi') element.style.height = `${height}px`;
      grid.appendChild(element);
      elements.push(element);
    }
    await collectGarbage();
    const before = await counters();
    await afterFrame();
    const t0 = now();
    const handles = specs.map((spec, i) => charts().render(elements[i], spec));
    const t1 = now();
    const t2 = await afterFrame();
    const longTasksDuring = longTasksBetween(t0, now());
    await collectGarbage();
    const mounted = await counters();
    handles.forEach((handle) => handle.destroy());
    grid.remove();
    await afterFrame();
    await collectGarbage();
    const after = await counters();
    return {
      cards,
      renderAllMs: round(t1 - t0),
      toFrameMs: round(t2 - t0),
      perCardMs: round((t1 - t0) / cards),
      longTasks: longTasksDuring,
      before,
      mounted,
      afterDestroy: after,
    };
  }

  /**
   * Leak check: render and destroy `cycles` charts in one element, then
   * update one chart `cycles` times. Counts before and after should match.
   */
  async function leak({
    type = 'line',
    series = 2,
    points = 365,
    width = 800,
    height = 400,
    cycles = 500,
  }) {
    const specs = [
      makeSpec({type, series, points}),
      makeSpec({type, series, points, seed: 2}),
    ];
    const element = container(width, height, type);
    const warm = charts().render(element, specs[0]);
    await afterFrame();
    warm.destroy();
    await collectGarbage();
    const start = await counters();
    for (let i = 0; i < cycles; i += 1) {
      const handle = charts().render(element, specs[i % 2]);
      if (i % 10 === 0) await afterFrame();
      handle.destroy();
    }
    await afterFrame();
    await collectGarbage();
    const afterRenders = await counters();
    const handle = charts().render(element, specs[0]);
    for (let i = 0; i < cycles; i += 1) {
      handle.update(specs[(i + 1) % 2]);
      if (i % 10 === 0) await afterFrame();
    }
    await afterFrame();
    await collectGarbage();
    const afterUpdates = await counters();
    handle.destroy();
    element.remove();
    await collectGarbage();
    const end = await counters();
    return {
      cycles,
      start,
      afterRenders,
      afterUpdates,
      end,
      leftoverChildren: element.childElementCount,
    };
  }

  /**
   * The details view: opening it, until the first frame and until every
   * row is in, then scrolling its table to the end, one step per frame.
   */
  async function details({
    type = 'line',
    series = 2,
    points = 1000,
    width = 800,
    height = 400,
    runs = 5,
    scrollSteps = 30,
  }) {
    const opens = [];
    const scrolls = [];
    let rows = 0;
    for (let i = 0; i < runs; i += 1) {
      const element = container(width, height, type);
      const handle = charts().render(element, makeSpec({type, series, points}));
      await afterFrame();
      const button = element.querySelector('button[aria-controls]');
      const t0 = now();
      button.click();
      const t1 = now();
      const t2 = await afterFrame();
      // The table may be filled in over several frames: wait until the
      // row count stops changing.
      // Data rows only: the table may also hold a hidden row group that
      // sizes its columns.
      const rowCount = () =>
        element.querySelectorAll('tbody:not(.sc-table-sizer) tr').length;
      let t3 = t2;
      for (let last = -1; rowCount() !== last; ) {
        last = rowCount();
        t3 = await afterFrame();
      }
      opens.push({openMs: t1 - t0, frameMs: t2 - t0, allRowsMs: t3 - t0});
      const content = element.querySelector('.sc-details-content');
      rows = rowCount();
      for (let step = 1; step <= scrollSteps; step += 1) {
        const s0 = now();
        content.scrollTop = (content.scrollHeight * step) / scrollSteps;
        scrolls.push({frameMs: (await afterFrame()) - s0});
      }
      handle.destroy();
      element.remove();
    }
    return {rows, open: summarize(opens), scroll: summarize(scrolls)};
  }

  /** Renders one chart and leaves it on the stage, for screenshots. */
  function show({
    type = 'line',
    series = 2,
    points = 30,
    width = 800,
    height = 400,
    hourly = false,
    label,
  }) {
    const wrapper = document.createElement('figure');
    wrapper.className = 'bench-shot';
    const caption = document.createElement('figcaption');
    caption.textContent =
      label ?? `${type}, ${series} series, ${points} points, ${width}px`;
    const element = container(width, height, type);
    wrapper.append(caption, element);
    stage().appendChild(wrapper);
    charts().render(element, makeSpec({type, series, points, hourly}));
    return wrapper;
  }

  function clear() {
    stage().replaceChildren();
  }

  // --- Loading the build ------------------------------------------------

  /**
   * The bundle to measure: `?bundle=<relative path>`, by default the
   * package's own build. Only relative paths, so the page never loads
   * anything from another origin.
   */
  function bundleUrl() {
    const requested = new URLSearchParams(location.search).get('bundle');
    return requested && !/^[a-z][\w+.-]*:|^\/\//i.test(requested)
      ? requested
      : '../dist/stripe-charts.min.js';
  }

  /** Loads the build with a script tag and times it until the global is ready. */
  function load() {
    return new Promise((resolve, reject) => {
      const element = document.createElement('script');
      const url = new URL(bundleUrl(), location.href).href;
      const start = now();
      element.onload = () => {
        const ready = now();
        const [timing] = performance.getEntriesByName(url);
        loaded = {
          // From adding the script tag until the global exists.
          scriptTagMs: round(ready - start),
          // From the last byte arriving: parse, compile and run.
          evaluateMs: timing ? round(ready - timing.responseEnd) : null,
          transferBytes: timing ? timing.transferSize : null,
        };
        resolve(loaded);
      };
      element.onerror = () => reject(new Error(`Could not load ${url}`));
      element.src = url;
      document.head.appendChild(element);
    });
  }

  function environment() {
    return {
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency,
      viewport: {width: innerWidth, height: innerHeight},
      reducedMotion: prefersReducedMotion(),
      bundle: bundleUrl(),
      version: window.StripeCharts?.version ?? null,
    };
  }

  const suites = {
    script,
    render,
    update,
    entrance,
    hover,
    resize,
    dashboard,
    leak,
    details,
  };

  /** Runs one suite and returns its options and result, with the environment. */
  async function run(name, options = {}) {
    const suite = suites[name];
    if (!suite)
      throw new Error(
        `Unknown suite "${name}"; expected one of ${Object.keys(suites).join(
          ', ',
        )}`,
      );
    clear();
    const result = await suite(options);
    clear();
    return {suite: name, options, environment: environment(), result};
  }

  /** A quick pass over every suite at small and typical sizes, for the page's button. */
  async function quick() {
    const results = [];
    results.push(await run('script'));
    for (const type of ['line', 'bar', 'stacked', 'kpi']) {
      for (const points of [30, 365, 1000]) {
        results.push(await run('render', {type, points, runs: 5}));
      }
    }
    results.push(await run('update', {points: 365}));
    results.push(await run('hover', {points: 1000}));
    results.push(await run('resize'));
    results.push(await run('dashboard', {cards: 24}));
    results.push(await run('leak', {cycles: 100}));
    results.push(await run('details', {points: 1000}));
    return results;
  }

  window.StripeChartsBench = {
    ready: load(),
    run,
    quick,
    suites,
    makeSpec,
    show,
    clear,
    inputProbe,
    environment,
  };
})();
