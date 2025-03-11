
      const { defineConfig } = require('cypress')

      module.exports = defineConfig({
        e2e: {
          baseUrl: 'https://example.com',
          video: true,
          screenshotOnRunFailure: true,
          reporter: 'junit',
          reporterOptions: {
            mochaFile: './cypress/results/results-[hash].xml',
            toConsole: true,
          },
        },
      })
      