# Benchmarks

A page that measures the browser build (`dist/stripe-charts.min.js`) in a
real browser: how long the script takes to load, how long charts take to
render, update, follow the pointer and resize, how many charts a page can
hold, and whether `destroy()` gives memory back. The data is generated from
fixed seeds, so runs are comparable between builds and machines.

## Run it

1. Build the package so `dist/` exists.
2. Serve the package directory over http, for example
   `python3 -m http.server 8000 --bind 127.0.0.1` from the package root.
3. Open `http://127.0.0.1:8000/bench/index.html` and press **Run quick
   pass**. The results appear as JSON on the page.

Close other tabs and keep the page in the foreground: background tabs get
fewer animation frames. Turn on reduced motion in the operating system (or
emulate `prefers-reduced-motion: reduce` in the browser's developer tools)
to measure drawing without animation; turn it off to measure the entrance
and update animations.

## Method

- **Timing.** `performance.now()` around each call. "Frame" times run from
  the call until the next frame has been produced: a `setTimeout(0)` queued
  inside a `requestAnimationFrame` callback, which runs after that frame's
  style, layout and paint (coarser by up to about 1ms of timer clamping).
  On a 60Hz display, 16.7ms means "on the next frame".
- **Statistics.** Each configuration gets warm-up runs, then measured runs:
  by default 3 + 10, fewer for very large inputs. Suites report the median,
  p95, min and max; with few runs, p95 is the maximum.
- **Long tasks.** `PerformanceObserver` entries of type `longtask` (over
  50ms) and `long-animation-frame` within each suite's time window.
- **Memory.** Heap and DOM counts are only meaningful after garbage
  collection, which pages can't force. Supply the hooks below to get
  precise numbers; without them, `performance.memory` is coarse.
- **Caveats.** Numbers depend on the machine and on what else it is doing.
  Compare builds on the same machine in the same session, and expect a
  low-end phone to be several times slower. A suite fails after 5s without
  an animation frame (a hidden or backgrounded page) instead of reporting
  skewed numbers.

## Run suites from a script

`runner.js` defines `window.StripeChartsBench`. Every suite takes plain
options and resolves to JSON, so browser automation can run a full matrix:

```js
await StripeChartsBench.ready; // the build has loaded
await StripeChartsBench.run('render', {
  type: 'bar',
  series: 2,
  points: 365,
  width: 800,
});
```

| Suite       | Measures                                                                |
| ----------- | ----------------------------------------------------------------------- |
| `script`    | Script tag to global ready on page load, and re-evaluating the source.  |
| `render`    | `validate()`, `render()`, layout, and the next frame; element counts.   |
| `update`    | `update()` with the same shape of data (a tween) or a different one.    |
| `entrance`  | Frame intervals during the entrance animation (motion on).              |
| `hover`     | Pointer sweep across the plot: handler time and time to the next frame. |
| `resize`    | A width change, and whether 50 rapid changes coalesce.                  |
| `dashboard` | Many cards on one page: total time, elements and heap.                  |
| `leak`      | Render and destroy, then update, many times: counts before and after.   |
| `details`   | Opening the details view and scrolling its table.                       |

`type` is `"line"`, `"bar"`, `"stacked"` or `"kpi"` (a KPI tile with a
sparkline). `StripeChartsBench.show(options)` renders one chart and leaves it
on the page, for screenshots, and `inputProbe(selector)` times real pointer
input for automation that moves the mouse.

Automation can make the memory numbers precise by defining
`window.benchGC`, `window.benchHeap` and `window.benchCounters` (for example
with the browser's DevTools protocol); otherwise the page uses
`performance.memory` where the browser has it.

## Past the size limits

The spec allows a limited number of points and series. To see how the
renderer behaves beyond them, build a copy with higher limits and point the
page at it with `?bundle=`:

```sh
node bench/build-raised-limits.js /tmp/raised/stripe-charts.min.js 20000 8
```

Serve that file next to the package (for example by copying it into a
directory beside `bench/`) and open
`bench/index.html?bundle=../raised/stripe-charts.min.js`. The page only
accepts relative paths.
