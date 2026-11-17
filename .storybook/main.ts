import type {StorybookConfig} from '@storybook/html-vite';

// Plain HTML stories keep the examples framework-independent.
const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.ts'],
  staticDirs: [
    {from: '../dist', to: '/dist'},
    {from: '../docs', to: '/docs'},
    {from: '../examples', to: '/examples'},
  ],
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
  features: {
    changeDetection: false,
    highlight: false,
    sidebarOnboardingChecklist: false,
    menuOnboardingChecklist: false,
  },
};

export default config;
