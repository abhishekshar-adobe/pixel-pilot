/**
 * Design-to-Code Comparison Engine
 * Orchestrates DOM extraction, Figma API calls, and mismatch detection
 */

const { extractDOMData } = require('./dom-extractor');
const { FigmaAPIClient, DesignTokenComparator } = require('./figma-integration');
const fs = require('fs-extra');
const path = require('path');

class DesignComparisonEngine {
  constructor(config = {}) {
    this.config = {
      figmaAccessToken: config.figmaAccessToken || process.env.FIGMA_ACCESS_TOKEN,
      figmaFileKey: config.figmaFileKey || process.env.FIGMA_FILE_KEY,
      cacheDirectory: config.cacheDirectory || path.join(__dirname, 'design-cache'),
      tolerance: config.tolerance || {
        fontSize: 2,
        spacing: 4,
        color: 10
      },
      ...config
    };

    this.figmaClient = null;
    this.comparator = new DesignTokenComparator(this.config.tolerance);
    
    this.initializeCache();
  }

  /**
   * Initialize cache directory
   */
  async initializeCache() {
    await fs.ensureDir(this.config.cacheDirectory);
  }

  /**
   * Initialize Figma client
   */
  initializeFigmaClient(fileKey = null) {
    if (!this.config.figmaAccessToken) {
      throw new Error('Figma access token is required');
    }

    const figmaFileKey = fileKey || this.config.figmaFileKey;
    if (!figmaFileKey) {
      throw new Error('Figma file key is required');
    }

    this.figmaClient = new FigmaAPIClient(
      this.config.figmaAccessToken,
      figmaFileKey
    );
    
    return this.figmaClient;
  }

  /**
   * Get or initialize Figma client
   */
  getFigmaClient() {
    if (!this.figmaClient) {
      this.initializeFigmaClient();
    }
    return this.figmaClient;
  }

  /**
   * Run complete design comparison for a scenario
   */
  async runComparison(scenarioConfig) {
    const results = {
      scenario: scenarioConfig,
      timestamp: new Date().toISOString(),
      domData: null,
      figmaTokens: null,
      comparison: null,
      errors: []
    };

    try {
      console.log(`Running design comparison for: ${scenarioConfig.label}`);

      // Step 1: Extract DOM data from the live site
      console.log('Step 1: Extracting DOM data...');
      results.domData = await this.extractDOMDataForScenario(scenarioConfig);
      
      // Step 2: Fetch Figma design tokens
      console.log('Step 2: Fetching Figma design tokens...');
      let figmaTokens = await this.getFigmaTokens(scenarioConfig.figmaFileKey);
      
      // Filter tokens based on selected layers if specified
      if (scenarioConfig.selectedLayers && scenarioConfig.selectedLayers.length > 0) {
        console.log(`Filtering tokens for ${scenarioConfig.selectedLayers.length} selected layers`);
        figmaTokens = this.filterTokensByLayers(figmaTokens, scenarioConfig.selectedLayers);
      }
      
      results.figmaTokens = figmaTokens;
      
      // Step 3: Compare DOM data with Figma tokens
      console.log('Step 3: Comparing DOM with design tokens...');
      results.comparison = this.comparator.compareWithTokens(
        results.domData,
        results.figmaTokens
      );

      // Step 4: Generate report
      console.log('Step 4: Generating comparison report...');
      const reportPath = await this.generateReport(results);
      results.reportPath = reportPath;

      console.log(`Design comparison completed. Found ${results.comparison.totalMismatches} mismatches.`);
      
    } catch (error) {
      console.error('Error during design comparison:', error);
      results.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }

    return results;
  }

  /**
   * Extract DOM data for a specific scenario
   */
  async extractDOMDataForScenario(scenarioConfig) {
    // This would integrate with BackstopJS or run independently
    // For now, we'll simulate the process
    
    try {
      // In a real implementation, this would:
      // 1. Launch Puppeteer
      // 2. Navigate to the scenario URL
      // 3. Wait for the page to load
      // 4. Execute DOM extraction
      
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Set viewport based on scenario config
      if (scenarioConfig.viewport) {
        await page.setViewport({
          width: scenarioConfig.viewport.width,
          height: scenarioConfig.viewport.height
        });
      }

      // Navigate to the URL
      await page.goto(scenarioConfig.url, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for any additional selectors if specified
      if (scenarioConfig.readySelector) {
        await page.waitForSelector(scenarioConfig.readySelector, { timeout: 10000 });
      }

      // Hide elements if hideSelectors specified
      if (scenarioConfig.hideSelectors && scenarioConfig.hideSelectors.length > 0) {
        await this.hideSelectorsOnPage(page, scenarioConfig.hideSelectors);
      }

      // Extract DOM data
      const domData = await page.evaluate(extractDOMData);
      
      await browser.close();
      
      return domData;
      
    } catch (error) {
      console.error('Error extracting DOM data:', error);
      throw error;
    }
  }

  /**
   * Hide selectors on page (similar to BackstopJS hideSelectors)
   */
  async hideSelectorsOnPage(page, hideSelectors) {
    for (const selector of hideSelectors) {
      try {
        await page.evaluate((sel) => {
          const elements = document.querySelectorAll(sel);
          elements.forEach(el => {
            el.style.opacity = '0';
            el.style.visibility = 'hidden';
          });
        }, selector);
      } catch (error) {
        console.log(`Could not hide selector: ${selector}`, error.message);
      }
    }
  }

  /**
   * Get Figma design tokens (with caching)
   */
  async getFigmaTokens(figmaFileKey = null) {
    const fileKey = figmaFileKey || this.config.figmaFileKey;
    const cacheFile = path.join(this.config.cacheDirectory, `figma-tokens-${fileKey}.json`);
    
    // Try to load from cache first
    const cachedTokens = await this.figmaClient?.loadCachedTokens(cacheFile);
    if (cachedTokens) {
      console.log('Using cached Figma design tokens');
      return cachedTokens;
    }

    // Initialize client if not already done
    if (!this.figmaClient) {
      this.initializeFigmaClient(fileKey);
    }

    // Fetch fresh tokens and cache them
    console.log('Fetching fresh Figma design tokens...');
    const tokens = await this.figmaClient.cacheDesignTokens(cacheFile);
    
    return tokens;
  }

  /**
   * Generate comparison report
   */
  async generateReport(results) {
    const reportData = {
      metadata: {
        scenario: results.scenario.label,
        url: results.scenario.url,
        timestamp: results.timestamp,
        figmaFileKey: results.scenario.figmaFileKey || this.config.figmaFileKey
      },
      statistics: {
        ...results.comparison.summary,
        domElementsAnalyzed: Object.keys(results.domData.elements).length,
        figmaComponentsFound: results.figmaTokens.components.length,
        figmaTypographyFound: Object.keys(results.figmaTokens.typography).length
      },
      mismatches: results.comparison.mismatches,
      errors: results.errors
    };

    // Save detailed JSON report
    const reportFileName = `design-comparison-${Date.now()}.json`;
    const reportPath = path.join(this.config.cacheDirectory, reportFileName);
    await fs.writeJson(reportPath, reportData, { spaces: 2 });

    // Generate HTML report
    const htmlReport = this.generateHTMLReport(reportData);
    const htmlReportPath = path.join(this.config.cacheDirectory, reportFileName.replace('.json', '.html'));
    await fs.writeFile(htmlReportPath, htmlReport);

    console.log(`Report saved to: ${reportPath}`);
    console.log(`HTML report saved to: ${htmlReportPath}`);

    return reportPath;
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(reportData) {
    const { metadata, statistics, mismatches } = reportData;
    
    const severityColors = {
      minor: '#ffc107',
      moderate: '#ff9800',
      major: '#f44336'
    };

    const mismatchRows = mismatches.map(mismatch => {
      const issueRows = mismatch.mismatches.map(issue => `
        <tr>
          <td>${mismatch.selector}</td>
          <td>${issue.property}</td>
          <td>${issue.domValue}</td>
          <td>${issue.figmaValue}</td>
          <td><span class="severity severity-${issue.severity}" style="background-color: ${severityColors[issue.severity]}">${issue.severity}</span></td>
          <td>${issue.difference}</td>
        </tr>
      `).join('');
      
      return issueRows;
    }).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Design-to-Code Comparison Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #1976d2; margin-bottom: 30px; }
        h2 { color: #424242; margin-top: 30px; }
        .metadata {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .statistics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            text-align: center;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #1976d2;
        }
        .stat-label {
            color: #666;
            margin-top: 5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f5f5f5;
            font-weight: 600;
        }
        .severity {
            padding: 4px 8px;
            border-radius: 4px;
            color: white;
            font-size: 0.8em;
            font-weight: bold;
        }
        .no-mismatches {
            text-align: center;
            color: #4caf50;
            font-size: 1.2em;
            padding: 40px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Design-to-Code Comparison Report</h1>
        
        <div class="metadata">
            <h3>Test Details</h3>
            <p><strong>Scenario:</strong> ${metadata.scenario}</p>
            <p><strong>URL:</strong> ${metadata.url}</p>
            <p><strong>Timestamp:</strong> ${metadata.timestamp}</p>
            <p><strong>Figma File:</strong> ${metadata.figmaFileKey}</p>
        </div>

        <h2>Statistics</h2>
        <div class="statistics">
            <div class="stat-card">
                <div class="stat-value">${statistics.totalMismatches}</div>
                <div class="stat-label">Total Mismatches</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.totalElements}</div>
                <div class="stat-label">Elements Analyzed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.bySeverity.major}</div>
                <div class="stat-label">Major Issues</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.bySeverity.moderate}</div>
                <div class="stat-label">Moderate Issues</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.bySeverity.minor}</div>
                <div class="stat-label">Minor Issues</div>
            </div>
        </div>

        <h2>Detailed Mismatches</h2>
        ${mismatches.length > 0 ? `
        <table>
            <thead>
                <tr>
                    <th>Element Selector</th>
                    <th>Property</th>
                    <th>DOM Value</th>
                    <th>Figma Value</th>
                    <th>Severity</th>
                    <th>Difference</th>
                </tr>
            </thead>
            <tbody>
                ${mismatchRows}
            </tbody>
        </table>
        ` : `
        <div class="no-mismatches">
            🎉 No design mismatches found! Your implementation matches the design perfectly.
        </div>
        `}
    </div>
</body>
</html>
    `;
  }

  /**
   * Run comparison for multiple scenarios
   */
  async runBatchComparison(scenarios) {
    const results = [];
    
    for (const scenario of scenarios) {
      try {
        const result = await this.runComparison(scenario);
        results.push(result);
      } catch (error) {
        console.error(`Failed to run comparison for ${scenario.label}:`, error);
        results.push({
          scenario,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  /**
   * Integration with BackstopJS - modify onReady script to extract DOM data
   */
  getBackstopIntegrationScript() {
    return `
// BackstopJS onReady script with DOM extraction
module.exports = async (page, scenario, vp) => {
  console.log('SCENARIO > ' + scenario.label);
  
  // Existing hideSelectors logic
  if (scenario.hideSelectors && scenario.hideSelectors.length > 0) {
    for (const selector of scenario.hideSelectors) {
      try {
        await page.evaluate((sel) => {
          const elements = document.querySelectorAll(sel);
          elements.forEach(el => {
            el.style.opacity = '0';
            el.style.visibility = 'hidden';
          });
        }, selector);
        console.log('Hidden selector:', selector);
      } catch (error) {
        console.log('Could not hide selector:', selector);
      }
    }
  }

  // Extract DOM data for design comparison
  if (scenario.enableDesignComparison) {
    try {
      const domData = await page.evaluate(${extractDOMData.toString()});
      
      // Save DOM data for later comparison
      const fs = require('fs-extra');
      const path = require('path');
      const outputPath = path.join(__dirname, '../design-cache', \`dom-data-\${scenario.label.replace(/[^a-zA-Z0-9]/g, '-')}-\${Date.now()}.json\`);
      
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeJson(outputPath, {
        scenario: scenario.label,
        url: scenario.url,
        viewport: vp,
        timestamp: new Date().toISOString(),
        domData
      }, { spaces: 2 });
      
      console.log('DOM data extracted for design comparison:', outputPath);
    } catch (error) {
      console.error('Failed to extract DOM data:', error);
    }
  }

  // Add delay if specified
  if (scenario.delay) {
    await new Promise(resolve => setTimeout(resolve, scenario.delay));
  }
`;
  }

  /**
   * Filter design tokens to only include selected layers
   */
  filterTokensByLayers(tokens, selectedLayerIds) {
    if (!tokens || !selectedLayerIds || selectedLayerIds.length === 0) {
      return tokens;
    }

    const filteredTokens = {};
    
    // If tokens have a layers property (structured data)
    if (tokens.layers) {
      filteredTokens.layers = tokens.layers.filter(layer => 
        selectedLayerIds.includes(layer.id)
      );
      
      // Copy over other token properties if they exist
      Object.keys(tokens).forEach(key => {
        if (key !== 'layers') {
          filteredTokens[key] = tokens[key];
        }
      });
    } else {
      // If tokens are in a flat structure, filter by layer IDs in the keys
      Object.keys(tokens).forEach(key => {
        // Check if this token belongs to one of the selected layers
        const belongsToSelectedLayer = selectedLayerIds.some(layerId => {
          return key.includes(layerId) || tokens[key]?.layerId === layerId;
        });
        
        if (belongsToSelectedLayer) {
          filteredTokens[key] = tokens[key];
        }
      });
    }

    console.log(`Filtered tokens: ${Object.keys(filteredTokens).length} items from ${Object.keys(tokens).length} original items`);
    return filteredTokens;
  }
}

module.exports = {
  DesignComparisonEngine
};
