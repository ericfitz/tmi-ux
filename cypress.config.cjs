const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    setupNodeEvents(on, config) {
      // Suppress warnings and errors
      on('task', {
        log(message) {
          console.log(message);
          return null;
        }
      });
      
      // Suppress browser console errors that are not test-related
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'electron') {
          launchOptions.args.push('--disable-dev-shm-usage');
          launchOptions.args.push('--no-sandbox');
          launchOptions.args.push('--disable-gpu');
          launchOptions.args.push('--disable-background-timer-throttling');
          launchOptions.args.push('--disable-renderer-backgrounding');
          launchOptions.args.push('--disable-features=TranslateUI');
          launchOptions.args.push('--disable-ipc-flooding-protection');
          launchOptions.args.push('--disable-backgrounding-occluded-windows');
          launchOptions.args.push('--log-level=3'); // Only show fatal errors
        }
        return launchOptions;
      });
    },
  },
  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack',
    },
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts',
  },
  viewportWidth: 1280,
  viewportHeight: 800,
  video: false,
  screenshotOnRunFailure: true,
  chromeWebSecurity: false,
  defaultCommandTimeout: 10000,
  requestTimeout: 10000,
  responseTimeout: 10000,
  pageLoadTimeout: 30000,
  // Suppress various warnings
  watchForFileChanges: false,
  modifyObstructiveCode: false,
  env: {
    NODE_OPTIONS: '--no-warnings'
  }
});