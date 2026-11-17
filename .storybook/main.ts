import type {StorybookConfig} from '@storybook/html-vite';

// A minimal Storybook: plain HTML framework, no addons, no global styles, so
// a story shows exactly the DOM the package renders.
const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.ts'],
  addons: [],
  framework: {name: '@storybook/html-vite', options: {}},
  core: {
    disableTelemetry: true,
    disableWhatsNewNotifications: true,
  },
  // These stories do not use change detection.
  // Highlighting watches the story root and reads the computed style of every
  // element on each change, which dominates load time for galleries with
  // thousands of chart nodes; no addon here uses it.
  features: {changeDetection: false, highlight: false},
};

export default config;
