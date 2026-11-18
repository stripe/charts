import type {StorybookConfig} from '@storybook/html-vite';

// Plain HTML stories keep the examples framework-independent.
const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.ts'],
  // Leave examples/ to Vite: its JSON imports must become JavaScript modules.
  // Serving it statically would return application/json for ?import requests.
  staticDirs: [
    {from: '../dist', to: '/dist'},
    {from: '../docs', to: '/docs'},
  ],
  addons: [],
  framework: {name: '@storybook/html-vite', options: {}},
  viteFinal(config) {
    const ignored = config.server?.watch?.ignored;
    config.server = {
      ...config.server,
      watch: {
        ...config.server?.watch,
        // Static builds must not trigger reloads in the running dev preview.
        ignored: [
          ...(Array.isArray(ignored) ? ignored : ignored ? [ignored] : []),
          '**/storybook-static/**',
        ],
      },
    };
    return config;
  },
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
