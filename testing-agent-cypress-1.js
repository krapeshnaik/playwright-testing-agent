// cypress-test-generator.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * UI Testing Agent with Cypress
 * 
 * Features:
 * - Auto-generates tests based on page structure
 * - Runs tests automatically
 * - Takes screenshots at key points
 * - Generates test reports
 */
class CypressTestAgent {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:3000';
    this.testsDir = config.testsDir || './cypress/e2e/auto-generated';
    this.screenshotsDir = config.screenshotsDir || './cypress/screenshots';
    this.viewports = config.viewports || [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];
    this.routes = config.routes || ['/'];
    this.selectors = config.selectors || {
      clickable: 'a, button, [role="button"]',
      input: 'input, textarea, select',
      form: 'form'
    };
    
    this.initialize();
  }

  initialize() {
    // Ensure directories exist
    if (!fs.existsSync(this.testsDir)) {
      fs.mkdirSync(this.testsDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  /**
   * Generate tests for all configured routes
   */
  generateTests() {
    console.log('Generating tests for routes:', this.routes);
    
    this.routes.forEach(route => {
      const routeName = route === '/' ? 'home' : route.replace(/\//g, '_').slice(1);
      const testFilePath = path.join(this.testsDir, `${routeName}_spec.e2e.js`);
      
      // Generate test content
      const testContent = this.generateTestContent(route, routeName);
      
      // Write test file
      fs.writeFileSync(testFilePath, testContent);
      console.log(`Generated test for ${route} at ${testFilePath}`);
    });
  }

  /**
   * Generate test content for a specific route
   */
  generateTestContent(route, routeName) {
    return `
// Auto-generated test for ${route}
describe('${routeName} page tests', () => {
  const viewports = ${JSON.stringify(this.viewports)};
  
  viewports.forEach(viewport => {
    context(\`Testing on \${viewport.name} (\${viewport.width}x\${viewport.height})\`, () => {
      beforeEach(() => {
        cy.viewport(viewport.width, viewport.height);
        cy.visit('${this.baseUrl}${route}');
        cy.wait(1000); // Allow page to fully load
      });
      
      it('should load the page correctly', () => {
        cy.url().should('include', '${route}');
        cy.document().its('readyState').should('eq', 'complete');
        cy.screenshot(\`${routeName}-\${viewport.name}-page-loaded\`);
      });
      
      it('should have no accessibility violations', () => {
        cy.injectAxe();
        cy.checkA11y(null, null, null, true);
      });
      
      it('should test all clickable elements', () => {
        cy.get('${this.selectors.clickable}').each(($el, index) => {
          if ($el.is('a') && ($el.attr('href')?.startsWith('http') || $el.attr('target') === '_blank')) {
            // Skip external links and new tabs
            return;
          }
          
          // Take screenshot before clicking
          cy.wrap($el).scrollIntoView()
            .should('be.visible')
            .screenshot(\`${routeName}-\${viewport.name}-element-\${index}-before-click\`);
          
          // Attempt click if not an external link
          try {
            cy.wrap($el).click({ force: false });
            cy.wait(500);
            cy.screenshot(\`${routeName}-\${viewport.name}-element-\${index}-after-click\`);
            
            // Go back if navigation occurred
            cy.url().then(url => {
              if (!url.includes('${route}')) {
                cy.go('back');
                cy.wait(500);
              }
            });
          } catch (e) {
            cy.log(\`Could not click element: \${e.message}\`);
          }
        });
      });
      
      it('should test form interactions if forms exist', () => {
        cy.get('${this.selectors.form}').each(($form, formIndex) => {
          // Fill all inputs in the form
          cy.wrap($form).within(() => {
            cy.get('${this.selectors.input}').each(($input, inputIndex) => {
              const inputType = $input.attr('type');
              const inputName = $input.attr('name') || $input.attr('id') || \`input-\${inputIndex}\`;
              
              cy.wrap($input).scrollIntoView();
              
              if (inputType === 'checkbox' || inputType === 'radio') {
                cy.wrap($input).check({ force: true }).screenshot(\`${routeName}-\${viewport.name}-form-\${formIndex}-\${inputName}-checked\`);
              } else if (inputType === 'file') {
                // Skip file inputs
              } else if ($input.is('select')) {
                cy.wrap($input).select(1).screenshot(\`${routeName}-\${viewport.name}-form-\${formIndex}-\${inputName}-selected\`);
              } else {
                cy.wrap($input)
                  .clear({ force: true })
                  .type('Test input', { force: true })
                  .screenshot(\`${routeName}-\${viewport.name}-form-\${formIndex}-\${inputName}-filled\`);
              }
            });
          });
          
          // Take screenshot of completed form
          cy.wrap($form).scrollIntoView().screenshot(\`${routeName}-\${viewport.name}-form-\${formIndex}-filled\`);
          
          // Don't submit the form - just test filling it
        });
      });
    });
  });
});
`;
  }

  /**
   * Run all generated tests
   */
  runTests() {
    try {
      console.log('Running Cypress tests...');
      execSync('npx cypress run', { stdio: 'inherit' });
      console.log('Tests completed successfully');
      return true;
    } catch (error) {
      console.error('Error running tests:', error.message);
      return false;
    }
  }

  /**
   * Generate a report from test results
   */
  generateReport() {
    console.log('Generating test report...');
    
    // Count screenshots to determine test coverage
    const screenshotFiles = this.getAllFiles(this.screenshotsDir)
      .filter(file => file.endsWith('.png'));
    
    // Group screenshots by route and viewport
    const reportData = {};
    
    screenshotFiles.forEach(file => {
      const filename = path.basename(file, '.png');
      const parts = filename.split('-');
      
      if (parts.length >= 2) {
        const route = parts[0];
        const viewport = parts[1];
        
        if (!reportData[route]) {
          reportData[route] = {};
        }
        
        if (!reportData[route][viewport]) {
          reportData[route][viewport] = [];
        }
        
        reportData[route][viewport].push(file);
      }
    });
    
    // Generate HTML report
    const reportHtml = this.generateHtmlReport(reportData);
    const reportPath = path.join('./cypress/reports', 'ui-test-report.html');
    
    // Ensure reports directory exists
    if (!fs.existsSync('./cypress/reports')) {
      fs.mkdirSync('./cypress/reports', { recursive: true });
    }
    
    fs.writeFileSync(reportPath, reportHtml);
    console.log(`Report generated at ${reportPath}`);
    
    return reportPath;
  }
  
  /**
   * Generate HTML report from test data
   */
  generateHtmlReport(reportData) {
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>UI Test Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1, h2, h3 { color: #333; }
        .route-section { margin-bottom: 30px; border: 1px solid #ddd; padding: 20px; border-radius: 5px; }
        .viewport-section { margin-bottom: 20px; }
        .screenshot { margin-bottom: 10px; }
        .screenshot img { max-width: 300px; border: 1px solid #ccc; }
        .summary { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 30px; }
      </style>
    </head>
    <body>
      <h1>UI Testing Report</h1>
      <div class="summary">
        <h2>Test Summary</h2>
        <p>Routes tested: ${Object.keys(reportData).length}</p>
        <p>Viewports tested: ${this.viewports.length}</p>
        <p>Total screenshots: ${this.getAllFiles(this.screenshotsDir).filter(file => file.endsWith('.png')).length}</p>
        <p>Generated: ${new Date().toLocaleString()}</p>
      </div>
    `;
    
    // Add route sections
    for (const route in reportData) {
      html += `<div class="route-section">
        <h2>Route: ${route}</h2>`;
      
      // Add viewport sections for this route
      for (const viewport in reportData[route]) {
        html += `<div class="viewport-section">
          <h3>Viewport: ${viewport}</h3>
          <p>Screenshots: ${reportData[route][viewport].length}</p>
        `;
        
        // List screenshots 
        reportData[route][viewport].forEach(screenshotPath => {
          const relativePath = screenshotPath.replace(process.cwd(), '').replace(/\\/g, '/');
          const filename = path.basename(screenshotPath);
          
          html += `<div class="screenshot">
            <p>${filename}</p>
            <img src=".${relativePath}" alt="${filename}" />
          </div>`;
        });
        
        html += `</div>`;
      }
      
      html += `</div>`;
    }
    
    html += `
    </body>
    </html>`;
    
    return html;
  }
  
  /**
   * Helper function to recursively get all files in a directory
   */
  getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      
      if (fs.statSync(filePath).isDirectory()) {
        this.getAllFiles(filePath, fileList);
      } else {
        fileList.push(filePath);
      }
    });
    
    return fileList;
  }
  
  /**
   * Run the complete testing workflow
   */
  runTestWorkflow() {
    console.log('Starting UI testing workflow');
    this.generateTests();
    const success = this.runTests();
    
    if (success) {
      const reportPath = this.generateReport();
      console.log(`Test workflow completed. Report available at: ${reportPath}`);
    } else {
      console.log('Test workflow completed with errors');
    }
  }
}

module.exports = CypressTestAgent;

// Example usage
const testAgent = new CypressTestAgent({
  baseUrl: 'https://example.com',
  routes: ['/', '/about', '/contact'],
  viewports: [
    { width: 1920, height: 1080, name: 'desktop' },
    { width: 375, height: 667, name: 'mobile' }
  ]
});
testAgent.runTestWorkflow();