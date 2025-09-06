/**
 * Design-to-Code Comparison Engine
 * Orchestrates DOM extraction, Figma API calls, and mismatch detection
 */

const { extractDOMData } = require('./dom-extractor');
const { FigmaAPIClient, DesignTokenComparator } = require('./figma-integration');
const { DetailedMismatchInsights } = require('./detailed-mismatch-insights');
const { VisualAnalysisEngine } = require('./visual-analysis-engine');
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
    this.mismatchInsights = new DetailedMismatchInsights({
      thresholds: {
        critical: 5.0,
        warning: 2.0,
        minor: 0.5,
        ...config.thresholds
      }
    });
    this.visualAnalysis = new VisualAnalysisEngine({
      analysis: {
        enablePixelAnalysis: true,
        enableStructuralSimilarity: true,
        enableColorAnalysis: true,
        enableLayoutAnalysis: true,
        ...config.analysis
      }
    });
    
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
   * Run complete design comparison for a scenario with enhanced insights
   */
  async runComparison(scenarioConfig) {
    const results = {
      scenario: scenarioConfig,
      timestamp: new Date().toISOString(),
      domData: null,
      figmaTokens: null,
      comparison: null,
      visualAnalysis: null,
      detailedInsights: null,
      enhancedRecommendations: null,
      errors: []
    };

    try {
      console.log(`Running enhanced design comparison for: ${scenarioConfig.label}`);

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

      // Step 4: Perform enhanced visual analysis if screenshots are available
      console.log('Step 4: Performing enhanced visual analysis...');
      results.visualAnalysis = await this.performEnhancedVisualAnalysis(scenarioConfig);

      // Step 5: Generate detailed mismatch insights
      console.log('Step 5: Generating detailed insights...');
      results.detailedInsights = await this.generateDetailedInsights(results);

      // Step 6: Generate enhanced recommendations
      console.log('Step 6: Creating enhanced recommendations...');
      results.enhancedRecommendations = this.generateEnhancedRecommendations(results);

      // Step 7: Generate comprehensive report
      console.log('Step 7: Generating comprehensive report...');
      const reportPath = await this.generateEnhancedReport(results);
      results.reportPath = reportPath;

      console.log(`Enhanced design comparison completed. Found ${results.comparison.totalMismatches} mismatches with detailed insights.`);
      
    } catch (error) {
      console.error('Error during enhanced design comparison:', error);
      results.errors.push({
        step: 'comparison',
        error: error.message,
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

  /**
   * Perform enhanced visual analysis on screenshots
   */
  async performEnhancedVisualAnalysis(scenarioConfig) {
    try {
      // Look for BackstopJS test results to analyze
      const backstopResultsPath = path.join(__dirname, '../backstop_data/html_report/config.js');
      
      if (await fs.pathExists(backstopResultsPath)) {
        console.log('Found BackstopJS results, performing visual analysis...');
        
        // Parse BackstopJS results
        const resultsContent = await fs.readFile(backstopResultsPath, 'utf8');
        const resultsData = this.parseBackstopResults(resultsContent);
        
        if (resultsData && resultsData.tests) {
          const visualAnalysis = {
            backstopResults: resultsData,
            enhancedAnalysis: [],
            overallInsights: null
          };

          // Analyze each test with visual differences
          for (const test of resultsData.tests.filter(t => t.status === 'fail')) {
            if (test.pair && test.pair.reference && test.pair.test) {
              try {
                const testAnalysis = await this.visualAnalysis.performVisualAnalysis(
                  test.pair.reference,
                  test.pair.test,
                  path.join(this.config.cacheDirectory, 'visual-analysis')
                );
                
                visualAnalysis.enhancedAnalysis.push({
                  testId: test.pair.label,
                  viewport: test.pair.viewportLabel,
                  analysis: testAnalysis
                });
              } catch (error) {
                console.error(`Error analyzing test ${test.pair.label}:`, error);
              }
            }
          }

          // Generate overall insights
          visualAnalysis.overallInsights = this.generateOverallVisualInsights(visualAnalysis.enhancedAnalysis);
          
          return visualAnalysis;
        }
      }

      return { message: 'No BackstopJS results found for visual analysis' };
    } catch (error) {
      console.error('Error performing enhanced visual analysis:', error);
      return { error: error.message };
    }
  }

  /**
   * Parse BackstopJS results from config.js file
   */
  parseBackstopResults(resultsContent) {
    try {
      // Extract JSON data from the BackstopJS config.js file
      const jsonStart = resultsContent.indexOf('report(') + 7;
      const jsonEnd = resultsContent.lastIndexOf(');');
      
      if (jsonStart > 6 && jsonEnd > jsonStart) {
        const jsonString = resultsContent.substring(jsonStart, jsonEnd);
        return JSON.parse(jsonString);
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing BackstopJS results:', error);
      return null;
    }
  }

  /**
   * Generate overall visual insights from individual test analyses
   */
  generateOverallVisualInsights(testAnalyses) {
    if (!testAnalyses || testAnalyses.length === 0) {
      return { message: 'No test analyses available' };
    }

    const insights = {
      totalTests: testAnalyses.length,
      averageScores: {
        visual: 0,
        color: 0,
        layout: 0,
        structure: 0
      },
      commonIssues: [],
      severityDistribution: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      recommendations: []
    };

    let totalScores = { visual: 0, color: 0, layout: 0, structure: 0 };

    // Aggregate data from all test analyses
    testAnalyses.forEach(testAnalysis => {
      const analysis = testAnalysis.analysis;
      
      if (analysis.insights && analysis.insights.overall) {
        totalScores.visual += analysis.insights.overall.score || 0;
      }
      
      if (analysis.comparison) {
        totalScores.color += analysis.comparison.colorDifference?.overallSimilarity || 0;
        totalScores.layout += analysis.comparison.layoutDifference?.layoutScore || 0;
        totalScores.structure += analysis.comparison.structuralSimilarity?.overall || 0;
      }

      // Collect specific insights
      if (analysis.insights && analysis.insights.specific) {
        analysis.insights.specific.forEach(insight => {
          insights.commonIssues.push({
            test: testAnalysis.testId,
            viewport: testAnalysis.viewport,
            category: insight.category,
            severity: insight.severity,
            message: insight.message
          });

          // Count severity distribution
          if (insight.severity && insights.severityDistribution[insight.severity] !== undefined) {
            insights.severityDistribution[insight.severity]++;
          }
        });
      }
    });

    // Calculate averages
    const testCount = testAnalyses.length;
    insights.averageScores = {
      visual: Math.round(totalScores.visual / testCount),
      color: Math.round(totalScores.color / testCount),
      layout: Math.round(totalScores.layout / testCount),
      structure: Math.round(totalScores.structure / testCount)
    };

    // Generate top-level recommendations
    insights.recommendations = this.generateTopLevelRecommendations(insights);

    return insights;
  }

  /**
   * Generate top-level recommendations based on analysis
   */
  generateTopLevelRecommendations(insights) {
    const recommendations = [];

    // Overall score recommendations
    if (insights.averageScores.visual < 70) {
      recommendations.push({
        priority: 'high',
        category: 'overall',
        title: 'Significant Visual Differences Detected',
        description: `Average visual similarity is ${insights.averageScores.visual}%, indicating substantial differences from design`,
        impact: 'high'
      });
    }

    // Color-specific recommendations
    if (insights.averageScores.color < 75) {
      recommendations.push({
        priority: 'medium',
        category: 'color',
        title: 'Color Implementation Issues',
        description: `Color similarity is ${insights.averageScores.color}%, suggesting color palette discrepancies`,
        impact: 'medium'
      });
    }

    // Layout-specific recommendations  
    if (insights.averageScores.layout < 80) {
      recommendations.push({
        priority: 'high',
        category: 'layout',
        title: 'Layout and Spacing Problems',
        description: `Layout score is ${insights.averageScores.layout}%, indicating spacing and positioning issues`,
        impact: 'high'
      });
    }

    // Severity-based recommendations
    if (insights.severityDistribution.critical > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'critical',
        title: 'Critical Issues Require Immediate Attention',
        description: `${insights.severityDistribution.critical} critical issues found across tests`,
        impact: 'critical'
      });
    }

    return recommendations;
  }

  /**
   * Generate detailed insights combining multiple analysis sources
   */
  async generateDetailedInsights(results) {
    try {
      const insights = {
        tokenMismatches: results.comparison || {},
        visualDifferences: results.visualAnalysis || {},
        crossReferences: [],
        prioritizedIssues: [],
        actionableItems: []
      };

      // Cross-reference token mismatches with visual differences
      insights.crossReferences = this.crossReferenceAnalyses(
        results.comparison,
        results.visualAnalysis
      );

      // Prioritize issues based on multiple factors
      insights.prioritizedIssues = this.prioritizeIssues(insights);

      // Generate actionable items
      insights.actionableItems = this.generateActionableItems(insights);

      return insights;
    } catch (error) {
      console.error('Error generating detailed insights:', error);
      return { error: error.message };
    }
  }

  /**
   * Cross-reference token mismatches with visual analysis
   */
  crossReferenceAnalyses(tokenComparison, visualAnalysis) {
    const crossReferences = [];

    if (!tokenComparison || !visualAnalysis) {
      return crossReferences;
    }

    // Find correlations between token mismatches and visual differences
    if (tokenComparison.mismatches && visualAnalysis.enhancedAnalysis) {
      tokenComparison.mismatches.forEach(tokenMismatch => {
        visualAnalysis.enhancedAnalysis.forEach(visualTest => {
          // Look for correlations based on element selectors, colors, spacing, etc.
          const correlation = this.findCorrelation(tokenMismatch, visualTest);
          if (correlation.strength > 0.7) {
            crossReferences.push({
              tokenMismatch: tokenMismatch,
              visualTest: visualTest.testId,
              correlation: correlation,
              confidence: correlation.strength
            });
          }
        });
      });
    }

    return crossReferences;
  }

  /**
   * Find correlation between token mismatch and visual test
   */
  findCorrelation(tokenMismatch, visualTest) {
    let strength = 0;
    const factors = [];

    // Check if selector matches test viewport/scenario
    if (tokenMismatch.selector && visualTest.viewport) {
      if (tokenMismatch.selector.toLowerCase().includes(visualTest.viewport.toLowerCase())) {
        strength += 0.3;
        factors.push('selector-viewport-match');
      }
    }

    // Check for color-related correlations
    if (tokenMismatch.mismatches) {
      tokenMismatch.mismatches.forEach(mismatch => {
        if (mismatch.property === 'color' && visualTest.analysis.comparison?.colorDifference) {
          if (visualTest.analysis.comparison.colorDifference.overallSimilarity < 70) {
            strength += 0.4;
            factors.push('color-correlation');
          }
        }

        // Check for layout correlations
        if ((mismatch.property === 'fontSize' || mismatch.property === 'spacing') && 
            visualTest.analysis.comparison?.layoutDifference) {
          if (visualTest.analysis.comparison.layoutDifference.layoutScore < 80) {
            strength += 0.3;
            factors.push('layout-correlation');
          }
        }
      });
    }

    return { strength, factors };
  }

  /**
   * Prioritize issues based on severity, impact, and frequency
   */
  prioritizeIssues(insights) {
    const issues = [];

    // Add token mismatches as issues
    if (insights.tokenMismatches.mismatches) {
      insights.tokenMismatches.mismatches.forEach(mismatch => {
        mismatch.mismatches.forEach(issue => {
          issues.push({
            type: 'token',
            severity: issue.severity,
            category: issue.property,
            description: `${issue.property} mismatch: ${issue.domValue} vs ${issue.figmaValue}`,
            element: mismatch.selector,
            impact: this.calculateImpact(issue),
            source: 'design-tokens'
          });
        });
      });
    }

    // Add visual analysis issues
    if (insights.visualDifferences.enhancedAnalysis) {
      insights.visualDifferences.enhancedAnalysis.forEach(analysis => {
        if (analysis.analysis.insights && analysis.analysis.insights.specific) {
          analysis.analysis.insights.specific.forEach(insight => {
            issues.push({
              type: 'visual',
              severity: insight.severity,
              category: insight.category,
              description: insight.message,
              element: analysis.testId,
              impact: this.calculateVisualImpact(insight),
              source: 'visual-analysis'
            });
          });
        }
      });
    }

    // Sort by priority (severity + impact)
    return issues.sort((a, b) => {
      const priorityA = this.calculatePriority(a);
      const priorityB = this.calculatePriority(b);
      return priorityB - priorityA;
    });
  }

  /**
   * Calculate impact score for token issues
   */
  calculateImpact(issue) {
    let impact = 0;
    
    switch (issue.severity) {
      case 'major': impact += 3; break;
      case 'moderate': impact += 2; break;
      case 'minor': impact += 1; break;
    }

    // Add property-specific impact
    switch (issue.property) {
      case 'color': impact += 2; break;
      case 'fontSize': impact += 2; break;
      case 'spacing': impact += 1; break;
    }

    return impact;
  }

  /**
   * Calculate impact score for visual issues
   */
  calculateVisualImpact(insight) {
    let impact = 0;
    
    switch (insight.severity) {
      case 'high': impact += 3; break;
      case 'medium': impact += 2; break;
      case 'low': impact += 1; break;
    }

    switch (insight.category) {
      case 'pixel': impact += 2; break;
      case 'color': impact += 2; break;
      case 'layout': impact += 3; break;
    }

    return impact;
  }

  /**
   * Calculate overall priority score
   */
  calculatePriority(issue) {
    return issue.impact * (issue.severity === 'critical' ? 3 : issue.severity === 'high' ? 2 : 1);
  }

  /**
   * Generate actionable items from insights
   */
  generateActionableItems(insights) {
    const actionableItems = [];
    const prioritizedIssues = insights.prioritizedIssues.slice(0, 10); // Top 10 issues

    prioritizedIssues.forEach((issue, index) => {
      const item = {
        id: `action-${index + 1}`,
        priority: this.mapSeverityToPriority(issue.severity),
        title: this.generateActionTitle(issue),
        description: issue.description,
        category: issue.category,
        estimatedEffort: this.estimateEffort(issue),
        steps: this.generateActionSteps(issue),
        verification: this.generateVerificationSteps(issue)
      };

      actionableItems.push(item);
    });

    return actionableItems;
  }

  /**
   * Map issue severity to action priority
   */
  mapSeverityToPriority(severity) {
    const mapping = {
      'critical': 'critical',
      'major': 'high',
      'high': 'high',
      'moderate': 'medium',
      'medium': 'medium',
      'minor': 'low',
      'low': 'low'
    };
    return mapping[severity] || 'medium';
  }

  /**
   * Generate action title based on issue
   */
  generateActionTitle(issue) {
    const titles = {
      'color': `Fix ${issue.category} implementation for ${issue.element}`,
      'fontSize': `Adjust font size for ${issue.element}`,
      'spacing': `Correct spacing for ${issue.element}`,
      'layout': `Fix layout issues in ${issue.element}`,
      'pixel': `Resolve visual differences in ${issue.element}`
    };
    return titles[issue.category] || `Fix ${issue.category} issue in ${issue.element}`;
  }

  /**
   * Estimate effort required for fix
   */
  estimateEffort(issue) {
    const effortMap = {
      'color': 'low',
      'fontSize': 'low',
      'spacing': 'medium',
      'layout': 'high',
      'pixel': 'medium'
    };
    
    let effort = effortMap[issue.category] || 'medium';
    
    // Adjust based on severity
    if (issue.severity === 'critical' || issue.severity === 'major') {
      effort = effort === 'low' ? 'medium' : effort === 'medium' ? 'high' : 'high';
    }
    
    return effort;
  }

  /**
   * Generate specific action steps
   */
  generateActionSteps(issue) {
    const stepsByCategory = {
      'color': [
        'Extract exact color value from Figma design',
        'Update CSS color property or design token',
        'Verify color meets accessibility requirements',
        'Test across different browsers and devices'
      ],
      'fontSize': [
        'Check Figma design for correct font size',
        'Update CSS font-size property',
        'Verify line-height is appropriate',
        'Test responsive behavior'
      ],
      'spacing': [
        'Measure spacing values in Figma design',
        'Update margin/padding CSS properties',
        'Check impact on surrounding elements',
        'Verify responsive spacing behavior'
      ],
      'layout': [
        'Compare layout structure with Figma design',
        'Review flexbox/grid implementation',
        'Adjust element positioning and sizing',
        'Test responsive layout behavior'
      ],
      'pixel': [
        'Identify specific visual differences',
        'Compare implementation with design file',
        'Update relevant CSS properties',
        'Re-run visual regression tests'
      ]
    };

    return stepsByCategory[issue.category] || [
      'Analyze the specific issue',
      'Implement necessary changes',
      'Test the fix',
      'Verify with design specifications'
    ];
  }

  /**
   * Generate verification steps
   */
  generateVerificationSteps(issue) {
    return [
      'Run BackstopJS test to verify visual changes',
      'Compare result with original Figma design',
      'Test across different screen sizes',
      'Verify accessibility compliance',
      'Get design team approval'
    ];
  }

  /**
   * Generate enhanced recommendations
   */
  generateEnhancedRecommendations(results) {
    const recommendations = {
      immediate: [],
      shortTerm: [],
      longTerm: [],
      process: [],
      tooling: []
    };

    // Analyze results and generate targeted recommendations
    if (results.detailedInsights && results.detailedInsights.prioritizedIssues) {
      const criticalIssues = results.detailedInsights.prioritizedIssues.filter(
        issue => issue.severity === 'critical' || issue.severity === 'major'
      );

      if (criticalIssues.length > 0) {
        recommendations.immediate.push({
          title: 'Address Critical Visual Discrepancies',
          description: `${criticalIssues.length} critical issues require immediate attention`,
          priority: 'critical',
          effort: 'high',
          impact: 'high',
          timeframe: '1-2 days'
        });
      }

      // Add visual analysis specific recommendations
      if (results.visualAnalysis && results.visualAnalysis.overallInsights) {
        const insights = results.visualAnalysis.overallInsights;
        
        if (insights.averageScores.visual < 80) {
          recommendations.shortTerm.push({
            title: 'Improve Visual Implementation Accuracy',
            description: 'Overall visual accuracy is below acceptable threshold',
            priority: 'high',
            effort: 'medium',
            impact: 'high',
            timeframe: '1 week'
          });
        }

        if (insights.severityDistribution.critical > 2) {
          recommendations.process.push({
            title: 'Enhance Design Review Process',
            description: 'Multiple critical issues suggest need for better design-to-code handoff',
            priority: 'medium',
            effort: 'medium',
            impact: 'high',
            timeframe: '2-3 weeks'
          });
        }
      }
    }

    // Add tooling recommendations
    recommendations.tooling.push({
      title: 'Implement Continuous Visual Testing',
      description: 'Set up automated visual regression testing in CI/CD pipeline',
      priority: 'medium',
      effort: 'high',
      impact: 'high',
      timeframe: '1-2 weeks'
    });

    recommendations.longTerm.push({
      title: 'Establish Design System Compliance Monitoring',
      description: 'Create automated monitoring for design token usage and compliance',
      priority: 'medium',
      effort: 'high',
      impact: 'high',
      timeframe: '1 month'
    });

    return recommendations;
  }

  /**
   * Generate enhanced HTML report
   */
  async generateEnhancedReport(results) {
    try {
      const reportDir = path.join(this.config.cacheDirectory, 'enhanced-reports');
      await fs.ensureDir(reportDir);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = path.join(reportDir, `enhanced-report-${timestamp}.html`);
      
      const reportHtml = this.generateEnhancedHTMLContent(results);
      await fs.writeFile(reportPath, reportHtml, 'utf8');
      
      console.log(`Enhanced report generated: ${reportPath}`);
      return reportPath;
    } catch (error) {
      console.error('Error generating enhanced report:', error);
      throw error;
    }
  }

  /**
   * Generate enhanced HTML report content
   */
  generateEnhancedHTMLContent(results) {
    const { scenario, detailedInsights, visualAnalysis, enhancedRecommendations } = results;
    
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Enhanced Design Comparison Report - ${scenario.label}</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
            .section { padding: 20px; border-bottom: 1px solid #eee; }
            .section:last-child { border-bottom: none; }
            .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
            .metric { text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; }
            .metric-value { font-size: 2rem; font-weight: bold; color: #333; }
            .metric-label { color: #666; margin-top: 5px; }
            .priority-critical { border-left: 4px solid #dc3545; }
            .priority-high { border-left: 4px solid #fd7e14; }
            .priority-medium { border-left: 4px solid #ffc107; }
            .priority-low { border-left: 4px solid #28a745; }
            .issue-item { padding: 15px; margin: 10px 0; background: #f8f9fa; border-radius: 5px; }
            .recommendation-item { padding: 15px; margin: 10px 0; background: #e3f2fd; border-radius: 5px; }
            .tag { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; margin-right: 5px; }
            .tag-critical { background: #dc3545; color: white; }
            .tag-high { background: #fd7e14; color: white; }
            .tag-medium { background: #ffc107; color: black; }
            .tag-low { background: #28a745; color: white; }
            .visual-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
            .visual-item { background: #f8f9fa; padding: 15px; border-radius: 8px; }
            .score-bar { width: 100%; height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden; margin: 10px 0; }
            .score-fill { height: 100%; transition: width 0.3s ease; }
            .score-excellent { background: #4caf50; }
            .score-good { background: #8bc34a; }
            .score-fair { background: #ffeb3b; }
            .score-poor { background: #ff9800; }
            .score-bad { background: #f44336; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎨 Enhanced Design Comparison Report</h1>
                <p><strong>Scenario:</strong> ${scenario.label}</p>
                <p><strong>URL:</strong> ${scenario.url}</p>
                <p><strong>Generated:</strong> ${new Date(results.timestamp).toLocaleString()}</p>
            </div>

            ${this.generateOverviewSection(results)}
            ${this.generateVisualAnalysisSection(visualAnalysis)}
            ${this.generatePrioritizedIssuesSection(detailedInsights)}
            ${this.generateRecommendationsSection(enhancedRecommendations)}
            ${this.generateActionItemsSection(detailedInsights)}
        </div>
    </body>
    </html>`;
  }

  generateOverviewSection(results) {
    const totalIssues = results.detailedInsights?.prioritizedIssues?.length || 0;
    const criticalIssues = results.detailedInsights?.prioritizedIssues?.filter(i => i.severity === 'critical')?.length || 0;
    const averageVisualScore = results.visualAnalysis?.overallInsights?.averageScores?.visual || 0;
    
    return `
    <div class="section">
        <h2>📊 Overview</h2>
        <div class="metrics">
            <div class="metric">
                <div class="metric-value">${totalIssues}</div>
                <div class="metric-label">Total Issues</div>
            </div>
            <div class="metric">
                <div class="metric-value">${criticalIssues}</div>
                <div class="metric-label">Critical Issues</div>
            </div>
            <div class="metric">
                <div class="metric-value">${averageVisualScore}%</div>
                <div class="metric-label">Visual Similarity</div>
            </div>
            <div class="metric">
                <div class="metric-value">${results.comparison?.totalMismatches || 0}</div>
                <div class="metric-label">Token Mismatches</div>
            </div>
        </div>
    </div>`;
  }

  generateVisualAnalysisSection(visualAnalysis) {
    if (!visualAnalysis || !visualAnalysis.overallInsights) {
      return '<div class="section"><h2>🔍 Visual Analysis</h2><p>No visual analysis data available.</p></div>';
    }

    const insights = visualAnalysis.overallInsights;
    
    return `
    <div class="section">
        <h2>🔍 Visual Analysis</h2>
        <div class="visual-grid">
            <div class="visual-item">
                <h3>Overall Scores</h3>
                <div>
                    <span>Visual Quality:</span>
                    <div class="score-bar">
                        <div class="score-fill ${this.getScoreClass(insights.averageScores.visual)}" 
                             style="width: ${insights.averageScores.visual}%"></div>
                    </div>
                    <span>${insights.averageScores.visual}%</span>
                </div>
                <div>
                    <span>Color Accuracy:</span>
                    <div class="score-bar">
                        <div class="score-fill ${this.getScoreClass(insights.averageScores.color)}" 
                             style="width: ${insights.averageScores.color}%"></div>
                    </div>
                    <span>${insights.averageScores.color}%</span>
                </div>
                <div>
                    <span>Layout Precision:</span>
                    <div class="score-bar">
                        <div class="score-fill ${this.getScoreClass(insights.averageScores.layout)}" 
                             style="width: ${insights.averageScores.layout}%"></div>
                    </div>
                    <span>${insights.averageScores.layout}%</span>
                </div>
            </div>
            <div class="visual-item">
                <h3>Issue Distribution</h3>
                <p><span class="tag tag-critical">${insights.severityDistribution.critical}</span> Critical</p>
                <p><span class="tag tag-high">${insights.severityDistribution.high}</span> High</p>
                <p><span class="tag tag-medium">${insights.severityDistribution.medium}</span> Medium</p>
                <p><span class="tag tag-low">${insights.severityDistribution.low}</span> Low</p>
            </div>
        </div>
    </div>`;
  }

  generatePrioritizedIssuesSection(detailedInsights) {
    if (!detailedInsights || !detailedInsights.prioritizedIssues) {
      return '<div class="section"><h2>🔥 Prioritized Issues</h2><p>No issues to display.</p></div>';
    }

    const topIssues = detailedInsights.prioritizedIssues.slice(0, 10);
    
    return `
    <div class="section">
        <h2>🔥 Prioritized Issues</h2>
        ${topIssues.map((issue, index) => `
            <div class="issue-item priority-${this.mapSeverityToPriority(issue.severity)}">
                <h4>#${index + 1} ${issue.description}</h4>
                <p><strong>Element:</strong> ${issue.element}</p>
                <p><strong>Category:</strong> ${issue.category} | <strong>Source:</strong> ${issue.source}</p>
                <span class="tag tag-${this.mapSeverityToPriority(issue.severity)}">${issue.severity}</span>
                <span class="tag" style="background: #e3f2fd;">Impact: ${issue.impact}</span>
            </div>
        `).join('')}
    </div>`;
  }

  generateRecommendationsSection(recommendations) {
    if (!recommendations) {
      return '<div class="section"><h2>💡 Recommendations</h2><p>No recommendations available.</p></div>';
    }

    return `
    <div class="section">
        <h2>💡 Enhanced Recommendations</h2>
        
        ${recommendations.immediate?.length > 0 ? `
        <h3>🚨 Immediate Actions</h3>
        ${recommendations.immediate.map(rec => `
            <div class="recommendation-item priority-${rec.priority}">
                <h4>${rec.title}</h4>
                <p>${rec.description}</p>
                <p><strong>Timeframe:</strong> ${rec.timeframe} | <strong>Effort:</strong> ${rec.effort} | <strong>Impact:</strong> ${rec.impact}</p>
            </div>
        `).join('')}
        ` : ''}

        ${recommendations.shortTerm?.length > 0 ? `
        <h3>📅 Short-term Improvements</h3>
        ${recommendations.shortTerm.map(rec => `
            <div class="recommendation-item priority-${rec.priority}">
                <h4>${rec.title}</h4>
                <p>${rec.description}</p>
                <p><strong>Timeframe:</strong> ${rec.timeframe} | <strong>Effort:</strong> ${rec.effort} | <strong>Impact:</strong> ${rec.impact}</p>
            </div>
        `).join('')}
        ` : ''}

        ${recommendations.process?.length > 0 ? `
        <h3>🔄 Process Improvements</h3>
        ${recommendations.process.map(rec => `
            <div class="recommendation-item priority-${rec.priority}">
                <h4>${rec.title}</h4>
                <p>${rec.description}</p>
                <p><strong>Timeframe:</strong> ${rec.timeframe} | <strong>Effort:</strong> ${rec.effort} | <strong>Impact:</strong> ${rec.impact}</p>
            </div>
        `).join('')}
        ` : ''}

        ${recommendations.tooling?.length > 0 ? `
        <h3>🛠️ Tooling & Automation</h3>
        ${recommendations.tooling.map(rec => `
            <div class="recommendation-item priority-${rec.priority}">
                <h4>${rec.title}</h4>
                <p>${rec.description}</p>
                <p><strong>Timeframe:</strong> ${rec.timeframe} | <strong>Effort:</strong> ${rec.effort} | <strong>Impact:</strong> ${rec.impact}</p>
            </div>
        `).join('')}
        ` : ''}
    </div>`;
  }

  generateActionItemsSection(detailedInsights) {
    if (!detailedInsights || !detailedInsights.actionableItems) {
      return '<div class="section"><h2>✅ Action Items</h2><p>No action items available.</p></div>';
    }

    const actionItems = detailedInsights.actionableItems.slice(0, 5);
    
    return `
    <div class="section">
        <h2>✅ Action Items</h2>
        ${actionItems.map(item => `
            <div class="issue-item priority-${item.priority}">
                <h4>${item.title}</h4>
                <p>${item.description}</p>
                <p><strong>Category:</strong> ${item.category} | <strong>Estimated Effort:</strong> ${item.estimatedEffort}</p>
                <details>
                    <summary>Implementation Steps</summary>
                    <ol>
                        ${item.steps.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                </details>
                <details>
                    <summary>Verification Steps</summary>
                    <ol>
                        ${item.verification.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                </details>
            </div>
        `).join('')}
    </div>`;
  }

  getScoreClass(score) {
    if (score >= 90) return 'score-excellent';
    if (score >= 80) return 'score-good';
    if (score >= 70) return 'score-fair';
    if (score >= 60) return 'score-poor';
    return 'score-bad';
  }
}

module.exports = {
  DesignComparisonEngine
};
