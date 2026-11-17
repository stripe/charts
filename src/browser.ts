// Entry for the self-contained browser build (dist/stripe-charts.min.js).
// Loading that file with a <script> tag defines the `StripeCharts` global.
import * as api from './index';

(globalThis as {StripeCharts?: typeof api}).StripeCharts = api;
