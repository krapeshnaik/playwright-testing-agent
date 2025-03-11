# UI Testing Agent

A flexible, powerful automated testing framework for web user interfaces.

## Overview

UI Testing Agent is a JavaScript-based framework that provides comprehensive UI testing capabilities using Playwright. It simplifies the process of creating, running, and analyzing automated tests for web applications.

## Features

- **Automated UI Testing**: Test functionality, appearance, and behavior of web UIs
- **Cross-browser Testing**: Run tests on Chrome, Firefox, and WebKit
- **Screenshot Capture**: Automatically capture screenshots during test execution
- **Video Recording**: Record test sessions for visual verification and debugging
- **Accessibility Testing**: Verify compliance with WCAG accessibility standards
- **Detailed Reporting**: Generate comprehensive HTML and JSON reports of test results

## Installation

```bash
# Create a new project
mkdir ui-testing-project
cd ui-testing-project
npm init -y

# Install dependencies
npm install playwright
npx playwright install
```

## Quick Start

```javascript
const UITestingAgent = require('./UITestingAgent');

async function runBasicTest() {
  const agent = new UITestingAgent({
    baseUrl: 'https://example.com',
    outputDir: './test-results'
  });
  
  try {
    await agent.initialize();
    await agent.navigateTo('/');
    
    // Test page elements
    await agent.testElement('h1', 'exists');
    await agent.testElement('h1', 'text', 'Example Domain');
    
    // Capture screenshot
    await agent.captureScreenshot('homepage');
    
    // Generate report
    await agent.generateReport();
  } finally {
    await agent.close();
  }
}

runBasicTest().catch(console.error);
```

## API Reference

### Constructor

```javascript
const agent = new UITestingAgent(config);
```

**Configuration options:**
- `baseUrl` (required): Base URL of the application under test
- `outputDir` (optional): Directory to store test artifacts (default: './test-results')

### Core Methods

#### `async initialize()`

Launches the browser and prepares the testing environment.

```javascript
await agent.initialize();
```

#### `async navigateTo(url)`

Navigates to a specified URL. If the URL doesn't start with 'http', it will be appended to the baseUrl.

```javascript
await agent.navigateTo('/login');
```

#### `async testElement(selector, testType, expectedValue)`

Tests a UI element based on the specified criteria.

**Parameters:**
- `selector`: CSS selector for the element
- `testType`: Type of test to perform ('exists', 'text', 'attribute', 'clickable')
- `expectedValue`: Expected value for the test (required for 'text' and 'attribute' tests)

```javascript
// Check if element exists
await agent.testElement('#login-button', 'exists');

// Verify element text
await agent.testElement('.welcome-message', 'text', 'Welcome!');

// Test element attribute
await agent.testElement('a.signup', 'attribute', 'href=/register');

// Test if element is clickable
await agent.testElement('button.submit', 'clickable');
```

#### `async fillForm(formData)`

Fills form fields with specified values.

```javascript
await agent.fillForm({
  '#username': 'testuser',
  '#password': 'password123',
  '#remember-me': true
});
```

#### `async captureScreenshot(name)`

Captures a screenshot of the current page.

```javascript
await agent.captureScreenshot('login-form');
```

#### `async runAccessibilityCheck()`

Performs accessibility testing using axe-core.

```javascript
const accessibilityResults = await agent.runAccessibilityCheck();
```

#### `async generateReport()`

Generates HTML and JSON reports of test results.

```javascript
await agent.generateReport();
```

#### `async close()`

Closes the browser and cleans up resources.

```javascript
await agent.close();
```

## Test Structure Best Practices

### Organizing Tests

Structure your tests into logical groups:

```javascript
// login.test.js
async function testLoginFunctionality() {
  const agent = new UITestingAgent({ baseUrl });
  
  try {
    await agent.initialize();
    
    // Login with valid credentials
    await agent.navigateTo('/login');
    await agent.fillForm({
      '#username': 'validuser',
      '#password': 'validpass'
    });
    await agent.testElement('#login-button', 'clickable');
    await agent.testElement('.dashboard', 'exists');
    
    // Login with invalid credentials
    await agent.navigateTo('/login');
    await agent.fillForm({
      '#username': 'invaliduser',
      '#password': 'invalidpass'
    });
    await agent.testElement('#login-button', 'clickable');
    await agent.testElement('.error-message', 'exists');
    await agent.testElement('.error-message', 'text', 'Invalid credentials');
    
    await agent.generateReport();
  } finally {
    await agent.close();
  }
}
```

### Page Object Pattern

For larger applications, use the Page Object Pattern:

```javascript
// LoginPage.js
class LoginPage {
  constructor(agent) {
    this.agent = agent;
    this.url = '/login';
    this.selectors = {
      username: '#username',
      password: '#password',
      loginButton: '#login-button',
      errorMessage: '.error-message'
    };
  }
  
  async navigate() {
    await this.agent.navigateTo(this.url);
  }
  
  async login(username, password) {
    await this.agent.fillForm({
      [this.selectors.username]: username,
      [this.selectors.password]: password
    });
    await this.agent.testElement(this.selectors.loginButton, 'clickable');
  }
  
  async verifyErrorMessage(expectedMessage) {
    await this.agent.testElement(this.selectors.errorMessage, 'text', expectedMessage);
  }
}

// Using the page object
const loginPage = new LoginPage(agent);
await loginPage.navigate();
await loginPage.login('testuser', 'wrongpassword');
await loginPage.verifyErrorMessage('Invalid credentials');
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
# .github/workflows/ui-tests.yml
name: UI Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Set up Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Install Playwright browsers
      run: npx playwright install --with-deps
      
    - name: Run UI tests
      run: node tests/run-all-tests.js
      
    - name: Upload test results
      uses: actions/upload-artifact@v2
      with:
        name: test-results
        path: test-results/
```

## Visual Regression Testing

To add visual regression testing:

```javascript
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');
const fs = require('fs');

async function compareScreenshots(baselinePath, currentPath, diffPath) {
  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  const current = PNG.sync.read(fs.readFileSync(currentPath));
  const diff = new PNG({ width: baseline.width, height: baseline.height });
  
  const numDiffPixels = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    baseline.width,
    baseline.height,
    { threshold: 0.1 }
  );
  
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  return {
    diffPixels: numDiffPixels,
    diffPercentage: (numDiffPixels / (baseline.width * baseline.height)) * 100
  };
}
```

## Extending the Agent

### Adding Custom Test Types

```javascript
async testElement(selector, testType, expectedValue) {
  try {
    await this.page.waitForSelector(selector, { state: 'visible' });
    
    let result = false;
    let actualValue = null;
    
    switch (testType) {
      // ... existing cases ...
      
      case 'cssProperty':
        const [property, value] = expectedValue.split('=');
        const element = await this.page.$(selector);
        actualValue = await element.evaluate(
          (el, prop) => getComputedStyle(el)[prop],
          property
        );
        result = actualValue === value;
        break;
        
      case 'countElements':
        const count = await this.page.$$eval(selector, els => els.length);
        result = count.toString() === expectedValue;
        actualValue = count.toString();
        break;
    }
    
    // ... rest of method ...
  }
}
```

## Troubleshooting

### Common Issues

1. **Element not found errors**
   - Increase timeout: `await this.page.waitForSelector(selector, { timeout: 10000 })`
   - Check if selector is correct
   - Ensure page has fully loaded

2. **Tests flaky or inconsistent**
   - Add waitForNetworkIdle: `await this.page.waitForLoadState('networkidle')`
   - Use more specific selectors
   - Add explicit waits before critical actions

3. **Screenshots not matching**
   - Ensure consistent viewport size
   - Be aware of dynamic content (dates, ads)
   - Use higher threshold for comparison

## License

MIT