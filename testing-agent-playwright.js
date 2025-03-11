/// UI Testing Agent using Playwright

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class UITestingAgent {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.outputDir = config.outputDir || './test-results';
    this.browser = null;
    this.context = null;
    this.page = null;
    this.testResults = [];
  }

  async initialize() {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Launch browser
    this.browser = await chromium.launch({
    //   headless: process.env.CI ? true : false, // Run headless in CI, with UI locally
        headless: true
    });
    
    // Create a new context with viewport and device settings
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: path.join(this.outputDir, 'videos') }
    });
    
    // Create a new page
    this.page = await this.context.newPage();
    
    console.log('Testing agent initialized');
  }

  async navigateTo(url) {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    console.log(`Navigating to ${fullUrl}`);
    await this.page.goto(fullUrl, { waitUntil: 'networkidle' });
  }

  async captureScreenshot(name) {
    const screenshotPath = path.join(this.outputDir, 'screenshots', `${name}.png`);
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to ${screenshotPath}`);
    return screenshotPath;
  }

  async testElement(selector, testType, expectedValue) {
    try {
      // Wait for element to be visible
      await this.page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
      
      let result = false;
      let actualValue = null;
      
      switch (testType) {
        case 'exists':
          result = await this.page.isVisible(selector);
          break;
        case 'text':
          actualValue = await this.page.textContent(selector);
          result = actualValue === expectedValue;
          break;
        case 'attribute':
          const [attrName, attrValue] = expectedValue.split('=');
          actualValue = await this.page.getAttribute(selector, attrName);
          result = actualValue === attrValue;
          break;
        case 'clickable':
          await this.page.click(selector);
          result = true;
          break;
        default:
          throw new Error(`Unknown test type: ${testType}`);
      }
      
      this.testResults.push({
        selector,
        testType,
        expected: expectedValue,
        actual: actualValue,
        passed: result,
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (error) {
      this.testResults.push({
        selector,
        testType,
        expected: expectedValue,
        error: error.message,
        passed: false,
        timestamp: new Date().toISOString()
      });
      
      console.error(`Test failed for ${selector}: ${error.message}`);
      return false;
    }
  }
  
  async fillForm(formData) {
    for (const [selector, value] of Object.entries(formData)) {
      await this.page.fill(selector, value);
    }
  }
  
  async runAccessibilityCheck() {
    // Inject axe-core
    await this.page.addScriptTag({
      url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.5.0/axe.min.js'
    });
    
    // Run accessibility tests
    const accessibilityResults = await this.page.evaluate(() => {
      return new Promise(resolve => {
        axe.run((err, results) => {
          if (err) throw err;
          resolve(results);
        });
      });
    });
    
    // Save results
    fs.writeFileSync(
      path.join(this.outputDir, 'accessibility.json'),
      JSON.stringify(accessibilityResults, null, 2)
    );
    
    return accessibilityResults;
  }
  
  async generateReport() {
    const reportPath = path.join(this.outputDir, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2));
    
    // Generate HTML report
    const htmlReportPath = path.join(this.outputDir, 'report.html');
    const passedTests = this.testResults.filter(test => test.passed).length;
    const totalTests = this.testResults.length;
    
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
      </style>
    </head>
    <body>
      <h1>UI Test Results</h1>
      <div class="summary">
        <p>Passed: <span class="passed">${passedTests}</span> / ${totalTests}</p>
        <p>Failed: <span class="failed">${totalTests - passedTests}</span> / ${totalTests}</p>
        <p>Pass Rate: ${Math.round((passedTests / totalTests) * 100)}%</p>
      </div>
      <table>
        <tr>
          <th>Selector</th>
          <th>Test Type</th>
          <th>Expected</th>
          <th>Actual</th>
          <th>Status</th>
          <th>Timestamp</th>
        </tr>
        ${this.testResults.map(test => `
          <tr class="${test.passed ? '' : 'test-failed'}">
            <td>${test.selector}</td>
            <td>${test.testType}</td>
            <td>${test.expected || 'N/A'}</td>
            <td>${test.actual || test.error || 'N/A'}</td>
            <td>${test.passed ? 'PASS' : 'FAIL'}</td>
            <td>${test.timestamp}</td>
          </tr>
        `).join('')}
      </table>
    </body>
    </html>
    `;
    
    fs.writeFileSync(htmlReportPath, htmlReport);
    console.log(`Report generated at ${htmlReportPath}`);
  }
  
  async close() {
    // Close browser
    if (this.browser) {
      await this.browser.close();
    }
    console.log('Testing agent closed');
  }
}

module.exports = UITestingAgent;

// Example usage:
async function runExample() {
  const agent = new UITestingAgent({
    baseUrl: 'https://example.com',
    outputDir: './test-results'
  });
  
  try {
    await agent.initialize();
    await agent.navigateTo('/');
    
    // Check homepage elements
    await agent.testElement('h1', 'text', 'Example Domain');
    await agent.testElement('a', 'exists');
    await agent.testElement('a', 'attribute', 'href=https://www.iana.org/domains/example');
    
    // Capture screenshot
    await agent.captureScreenshot('homepage');
    
    // Run accessibility check
    await agent.runAccessibilityCheck();
    
    // Generate test report
    await agent.generateReport();
  } catch (error) {
    console.error('Test run failed:', error);
  } finally {
    await agent.close();
  }
}

// Uncomment to run the example
runExample().catch(console.error);