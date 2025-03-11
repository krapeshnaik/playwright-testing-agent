// UI Testing Agent using Cypress

const cypress = require('cypress');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class UITestingAgent {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.outputDir = config.outputDir || './cypress/results';
    this.testResults = [];
    this.specFiles = [];
  }

  async initialize() {
    // Create necessary directories
    if (!fs.existsSync('./cypress')) {
      fs.mkdirSync('./cypress', { recursive: true });
    }
    
    if (!fs.existsSync('./cypress/e2e')) {
      fs.mkdirSync('./cypress/e2e', { recursive: true });
    }
    
    if (!fs.existsSync('./cypress/screenshots')) {
      fs.mkdirSync('./cypress/screenshots', { recursive: true });
    }
    
    if (!fs.existsSync('./cypress/videos')) {
      fs.mkdirSync('./cypress/videos', { recursive: true });
    }
    
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    // Create cypress.config.js if it doesn't exist
    if (!fs.existsSync('./cypress.config.js')) {
      const configContent = `
      const { defineConfig } = require('cypress')

      module.exports = defineConfig({
        e2e: {
          baseUrl: '${this.baseUrl}',
          video: true,
          screenshotOnRunFailure: true,
          reporter: 'junit',
          reporterOptions: {
            mochaFile: '${this.outputDir}/results-[hash].xml',
            toConsole: true,
          },
        },
      })
      `;
      
      fs.writeFileSync('./cypress.config.js', configContent);
    }
    
    console.log('Testing agent initialized');
  }

  async createTest(testName, testActions) {
    const specFileName = `${testName.replace(/\s+/g, '_').toLowerCase()}.cy.js`;
    const specFilePath = `./cypress/e2e/${specFileName}`;
    
    // Create the Cypress test file
    const testContent = `
    describe('${testName}', () => {
      it('performs UI testing', () => {
        ${testActions.join('\n        ')}
      })
    })
    `;
    
    fs.writeFileSync(specFilePath, testContent);
    this.specFiles.push(specFilePath);
    
    return specFilePath;
  }

  generateElementTest(selector, testType, expectedValue) {
    let testAction = '';
    
    switch (testType) {
      case 'exists':
        testAction = `cy.get('${selector}').should('exist')`;
        break;
        
      case 'text':
        testAction = `cy.get('${selector}').should('have.text', '${expectedValue}')`;
        break;
        
      case 'attribute':
        const [attrName, attrValue] = expectedValue.split('=');
        testAction = `cy.get('${selector}').should('have.attr', '${attrName}', '${attrValue}')`;
        break;
        
      case 'clickable':
        testAction = `cy.get('${selector}').click()`;
        break;
        
      case 'visible':
        testAction = `cy.get('${selector}').should('be.visible')`;
        break;
        
      case 'count':
        testAction = `cy.get('${selector}').should('have.length', ${expectedValue})`;
        break;
        
      case 'containsText':
        testAction = `cy.get('${selector}').should('contain', '${expectedValue}')`;
        break;
        
      case 'cssProperty':
        const [property, value] = expectedValue.split('=');
        testAction = `cy.get('${selector}').should('have.css', '${property}', '${value}')`;
        break;
        
      default:
        throw new Error(`Unknown test type: ${testType}`);
    }
    
    this.testResults.push({
      selector,
      testType,
      expected: expectedValue,
      testAction
    });
    
    return testAction;
  }
  
  generateNavigationAction(url) {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    return `cy.visit('${url}')`;
  }
  
  generateFormFillAction(formData) {
    const actions = [];
    
    for (const [selector, value] of Object.entries(formData)) {
      if (typeof value === 'boolean') {
        if (value) {
          actions.push(`cy.get('${selector}').check()`);
        } else {
          actions.push(`cy.get('${selector}').uncheck()`);
        }
      } else if (selector.includes('select')) {
        actions.push(`cy.get('${selector}').select('${value}')`);
      } else {
        actions.push(`cy.get('${selector}').clear().type('${value}')`);
      }
    }
    
    return actions;
  }
  
  generateScreenshotAction(name) {
    return `cy.screenshot('${name}')`;
  }
  
  async buildTestSuite(suiteName, actions) {
    const testActions = [];
    
    for (const action of actions) {
      if (action.type === 'navigate') {
        testActions.push(this.generateNavigationAction(action.url));
      } else if (action.type === 'testElement') {
        testActions.push(this.generateElementTest(action.selector, action.testType, action.expectedValue));
      } else if (action.type === 'fillForm') {
        testActions.push(...this.generateFormFillAction(action.formData));
      } else if (action.type === 'screenshot') {
        testActions.push(this.generateScreenshotAction(action.name));
      } else if (action.type === 'wait') {
        testActions.push(`cy.wait(${action.milliseconds})`);
      }
    }
    
    return await this.createTest(suiteName, testActions);
  }
  
  async runTests() {
    return new Promise((resolve, reject) => {
      cypress.run({
        spec: this.specFiles,
        browser: 'chrome',
        headless: process.env.CI ? true : false,
      }).then(results => {
        this.testResults = results;
        resolve(results);
      }).catch(error => {
        reject(error);
      });
    });
  }
  
  async generateAccessibilityTest(testName) {
    // Create a test that uses cypress-axe for accessibility testing
    const setupAxe = `
      cy.injectAxe();
      cy.checkA11y();
    `;
    
    const specFileName = `${testName.replace(/\s+/g, '_').toLowerCase()}_a11y.cy.js`;
    const specFilePath = `./cypress/e2e/${specFileName}`;
    
    // Install cypress-axe if not present
    await new Promise((resolve, reject) => {
      exec('npm list cypress-axe || npm install cypress-axe', (error) => {
        if (error) {
          console.warn('Warning: Could not install cypress-axe. Accessibility testing may not work correctly.');
        }
        resolve();
      });
    });
    
    // Create support file for axe if it doesn't exist
    const supportDir = './cypress/support';
    if (!fs.existsSync(supportDir)) {
      fs.mkdirSync(supportDir, { recursive: true });
    }
    
    if (!fs.existsSync(`${supportDir}/e2e.js`)) {
      fs.writeFileSync(`${supportDir}/e2e.js`, `
        import 'cypress-axe';
        
        Cypress.Commands.add('checkPageA11y', () => {
          cy.injectAxe();
          cy.checkA11y();
        });
      `);
    }
    
    // Create the test file
    const testContent = `
    describe('${testName} Accessibility', () => {
      it('checks accessibility', () => {
        cy.visit('/');
        cy.injectAxe();
        cy.checkA11y();
      })
    })
    `;
    
    fs.writeFileSync(specFilePath, testContent);
    this.specFiles.push(specFilePath);
    
    return specFilePath;
  }
  
  async generateReport() {
    if (!this.testResults || !this.testResults.runs) {
      console.warn('No test results available to generate report');
      return;
    }
    
    const reportPath = path.join(this.outputDir, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2));
    
    // Create HTML report
    const htmlReportPath = path.join(this.outputDir, 'report.html');
    const totalTests = this.testResults.totalTests || 0;
    const passedTests = this.testResults.totalPassed || 0;
    const failedTests = this.testResults.totalFailed || 0;
    
    const htmlReport = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>UI Test Results</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        h1 { color: #333; }
        .summary { margin-bottom: 20px; }
        .passed { color: green; }
        .failed { color: red; }
        table { border-collapse: collapse; width: 100%; }
        th, td { text-align: left; padding: 8px; border: 1px solid #ddd; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        th { background-color: #4CAF50; color: white; }
        .test-failed { background-color: #ffdddd; }
        .video-section { margin-top: 20px; }
        .screenshot-section { margin-top: 20px; }
      </style>
    </head>
    <body>
      <h1>UI Test Results</h1>
      <div class="summary">
        <p>Passed: <span class="passed">${passedTests}</span> / ${totalTests}</p>
        <p>Failed: <span class="failed">${failedTests}</span> / ${totalTests}</p>
        <p>Pass Rate: ${totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}%</p>
      </div>
      <table>
        <tr>
          <th>Spec File</th>
          <th>Tests</th>
          <th>Passes</th>
          <th>Failures</th>
          <th>Duration</th>
        </tr>
        ${this.testResults.runs?.map(run => `
          <tr class="${run.stats.failures > 0 ? 'test-failed' : ''}">
            <td>${run.spec.name}</td>
            <td>${run.stats.tests}</td>
            <td>${run.stats.passes}</td>
            <td>${run.stats.failures}</td>
            <td>${run.stats.duration / 1000}s</td>
          </tr>
        `).join('') || ''}
      </table>
      
      <div class="video-section">
        <h2>Test Videos</h2>
        <ul>
          ${this.testResults.runs?.map(run => {
            const videoPath = run.video;
            if (videoPath) {
              const videoName = path.basename(videoPath);
              return `<li><a href="./videos/${videoName}">${run.spec.name} Video</a></li>`;
            }
            return '';
          }).join('') || ''}
        </ul>
      </div>
      
      <div class="screenshot-section">
        <h2>Test Screenshots</h2>
        <ul>
          ${this.testResults.runs?.map(run => {
            if (run.screenshots && run.screenshots.length > 0) {
              return run.screenshots.map(screenshot => {
                const screenshotName = path.basename(screenshot.path);
                return `<li><a href="./screenshots/${screenshotName}">${screenshot.name}</a></li>`;
              }).join('');
            }
            return '';
          }).join('') || ''}
        </ul>
      </div>
    </body>
    </html>
    `;
    
    fs.writeFileSync(htmlReportPath, htmlReport);
    console.log(`Report generated at ${htmlReportPath}`);
  }
  
  async close() {
    console.log('Testing agent closed');
  }

  // Convenience methods for building test suites
  navigateTo(url) {
    return { type: 'navigate', url };
  }
  
  testElement(selector, testType, expectedValue) {
    return { type: 'testElement', selector, testType, expectedValue };
  }
  
  fillForm(formData) {
    return { type: 'fillForm', formData };
  }
  
  captureScreenshot(name) {
    return { type: 'screenshot', name };
  }
  
  wait(milliseconds) {
    return { type: 'wait', milliseconds };
  }
}

module.exports = UITestingAgent;

// Example usage:
async function runExample() {
  const agent = new UITestingAgent({
    baseUrl: 'https://example.com',
    outputDir: './cypress/results'
  });
  
  try {
    await agent.initialize();
    
    // Build test suite with fluent interface
    const testFile = await agent.buildTestSuite('Example Test', [
      agent.navigateTo('/'),
      agent.testElement('h1', 'text', 'Example Domain'),
      agent.testElement('a', 'exists'),
      agent.testElement('a', 'attribute', 'href=https://www.iana.org/domains/example'),
      agent.captureScreenshot('homepage')
    ]);
    
    // Run the tests
    const results = await agent.runTests();
    
    // Generate report
    await agent.generateReport();
  } catch (error) {
    console.error('Test run failed:', error);
  } finally {
    await agent.close();
  }
}

// Uncomment to run the example
runExample().catch(console.error);