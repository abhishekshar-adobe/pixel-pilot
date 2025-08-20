/**
 * Detailed Mismatch Insights Engine
 * Provides advanced analysis of design-to-code mismatches using BackstopJS and Figma APIs
 */

const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');

class DetailedMismatchInsights {
  constructor(config = {}) {
    this.config = {
      ...config,
      thresholds: {
        critical: 5.0,    // >5% difference is critical
        warning: 2.0,     // >2% difference is warning
        minor: 0.5,       // >0.5% difference is minor
        ...config.thresholds
      }
    };
  }

  /**
   * Analyze BackstopJS test results with enhanced insights
   */
  async analyzeTestResults(testResultsPath) {
    try {
      const results = await fs.readJson(testResultsPath);
      const insights = {
        summary: this.generateSummary(results),
        detailedAnalysis: await this.performDetailedAnalysis(results),
        recommendations: this.generateRecommendations(results),
        figmaComparison: null,
        visualHeatmap: null
      };

      return insights;
    } catch (error) {
      console.error('Error analyzing test results:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive summary of test results
   */
  generateSummary(results) {
    const tests = results.tests || [];
    const summary = {
      totalTests: tests.length,
      passed: tests.filter(t => t.status === 'pass').length,
      failed: tests.filter(t => t.status === 'fail').length,
      skipped: tests.filter(t => t.status === 'skipped').length,
      overallDifference: 0,
      criticalIssues: 0,
      warningIssues: 0,
      minorIssues: 0,
      categories: {
        typography: 0,
        layout: 0,
        color: 0,
        spacing: 0,
        imagery: 0
      }
    };

    // Calculate detailed metrics
    tests.forEach(test => {
      if (test.pair && test.pair.diff) {
        const diffPercent = test.pair.diff.misMatchPercentage || 0;
        summary.overallDifference += diffPercent;

        // Categorize by severity
        if (diffPercent > this.config.thresholds.critical) {
          summary.criticalIssues++;
        } else if (diffPercent > this.config.thresholds.warning) {
          summary.warningIssues++;
        } else if (diffPercent > this.config.thresholds.minor) {
          summary.minorIssues++;
        }

        // Categorize by type (based on scenario label)
        const label = test.pair.label.toLowerCase();
        if (label.includes('text') || label.includes('font') || label.includes('typography')) {
          summary.categories.typography++;
        } else if (label.includes('layout') || label.includes('grid') || label.includes('position')) {
          summary.categories.layout++;
        } else if (label.includes('color') || label.includes('background')) {
          summary.categories.color++;
        } else if (label.includes('margin') || label.includes('padding') || label.includes('spacing')) {
          summary.categories.spacing++;
        } else if (label.includes('image') || label.includes('icon')) {
          summary.categories.imagery++;
        }
      }
    });

    summary.averageDifference = summary.totalTests > 0 ? 
      (summary.overallDifference / summary.totalTests).toFixed(2) : 0;

    return summary;
  }

  /**
   * Perform detailed analysis of individual test failures
   */
  async performDetailedAnalysis(results) {
    const analysis = [];
    const tests = results.tests || [];

    for (const test of tests) {
      if (test.status === 'fail' && test.pair) {
        const testAnalysis = await this.analyzeIndividualTest(test);
        analysis.push(testAnalysis);
      }
    }

    return analysis;
  }

  /**
   * Analyze individual test failure in detail
   */
  async analyzeIndividualTest(test) {
    const analysis = {
      testId: test.pair.label,
      viewport: test.pair.viewportLabel,
      scenario: test.pair.label,
      diffPercentage: test.pair.diff?.misMatchPercentage || 0,
      severity: this.getSeverityLevel(test.pair.diff?.misMatchPercentage || 0),
      regions: await this.analyzeFailureRegions(test),
      possibleCauses: this.identifyPossibleCauses(test),
      suggestions: this.generateSuggestions(test),
      performance: this.analyzePerformanceImpact(test)
    };

    return analysis;
  }

  /**
   * Analyze specific regions of difference in the screenshot
   */
  async analyzeFailureRegions(test) {
    const regions = [];

    try {
      // If diff image exists, analyze it for regions of difference
      if (test.pair.diffImage) {
        const diffImagePath = test.pair.diffImage;
        const imageAnalysis = await this.analyzeImageDifferences(diffImagePath);
        regions.push(...imageAnalysis);
      }
    } catch (error) {
      console.error('Error analyzing failure regions:', error);
    }

    return regions;
  }

  /**
   * Analyze image differences using Sharp
   */
  async analyzeImageDifferences(diffImagePath) {
    try {
      if (!await fs.pathExists(diffImagePath)) {
        return [];
      }

      const image = sharp(diffImagePath);
      const metadata = await image.metadata();
      
      // Convert to grayscale and get pixel data
      const { data, info } = await image
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Find regions with significant differences
      const regions = this.findDifferenceRegions(data, info.width, info.height);
      
      return regions.map(region => ({
        ...region,
        type: this.classifyRegionType(region),
        confidence: this.calculateConfidence(region)
      }));

    } catch (error) {
      console.error('Error analyzing image differences:', error);
      return [];
    }
  }

  /**
   * Find regions of difference in image data
   */
  findDifferenceRegions(data, width, height) {
    const regions = [];
    const threshold = 50; // Difference threshold
    const minRegionSize = 100; // Minimum region size in pixels

    // Simple region detection algorithm
    const visited = new Set();
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        const pixel = data[index];
        
        if (pixel > threshold && !visited.has(index)) {
          const region = this.floodFill(data, width, height, x, y, threshold, visited);
          
          if (region.pixels.length >= minRegionSize) {
            regions.push({
              x: region.bounds.minX,
              y: region.bounds.minY,
              width: region.bounds.maxX - region.bounds.minX,
              height: region.bounds.maxY - region.bounds.minY,
              pixelCount: region.pixels.length,
              intensity: region.averageIntensity
            });
          }
        }
      }
    }

    return regions;
  }

  /**
   * Flood fill algorithm to find connected regions
   */
  floodFill(data, width, height, startX, startY, threshold, visited) {
    const pixels = [];
    const stack = [{ x: startX, y: startY }];
    const bounds = {
      minX: startX, maxX: startX,
      minY: startY, maxY: startY
    };
    let totalIntensity = 0;

    while (stack.length > 0) {
      const { x, y } = stack.pop();
      const index = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height || 
          visited.has(index) || data[index] <= threshold) {
        continue;
      }

      visited.add(index);
      pixels.push({ x, y, intensity: data[index] });
      totalIntensity += data[index];

      // Update bounds
      bounds.minX = Math.min(bounds.minX, x);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxY = Math.max(bounds.maxY, y);

      // Add neighboring pixels
      stack.push(
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 }
      );
    }

    return {
      pixels,
      bounds,
      averageIntensity: pixels.length > 0 ? totalIntensity / pixels.length : 0
    };
  }

  /**
   * Classify the type of region difference
   */
  classifyRegionType(region) {
    const { width, height } = region;
    const aspectRatio = width / height;

    // Simple heuristics for classification
    if (aspectRatio > 3 || aspectRatio < 0.33) {
      return 'layout'; // Long thin regions often indicate layout issues
    } else if (width < 50 && height < 50) {
      return 'typography'; // Small regions often indicate text differences
    } else if (width > 200 && height > 200) {
      return 'imagery'; // Large regions often indicate image differences
    } else {
      return 'color'; // Medium regions often indicate color differences
    }
  }

  /**
   * Calculate confidence score for region classification
   */
  calculateConfidence(region) {
    // Simple confidence calculation based on region size and intensity
    const sizeScore = Math.min(region.pixelCount / 1000, 1); // Normalize by 1000 pixels
    const intensityScore = region.intensity / 255; // Normalize by max intensity
    
    return Math.round((sizeScore * 0.6 + intensityScore * 0.4) * 100);
  }

  /**
   * Identify possible causes of the mismatch
   */
  identifyPossibleCauses(test) {
    const causes = [];
    const diffPercent = test.pair.diff?.misMatchPercentage || 0;
    const label = test.pair.label.toLowerCase();

    // CSS-related causes
    if (diffPercent > 1) {
      if (label.includes('responsive') || label.includes('mobile')) {
        causes.push({
          category: 'responsive',
          description: 'Responsive design implementation differs from Figma specs',
          likelihood: 'high'
        });
      }

      if (label.includes('font') || label.includes('text')) {
        causes.push({
          category: 'typography',
          description: 'Font family, size, or line-height mismatch',
          likelihood: 'high'
        });
      }

      if (label.includes('color') || label.includes('background')) {
        causes.push({
          category: 'styling',
          description: 'Color values or background properties differ',
          likelihood: 'medium'
        });
      }

      if (label.includes('spacing') || label.includes('margin') || label.includes('padding')) {
        causes.push({
          category: 'layout',
          description: 'Spacing and layout properties need adjustment',
          likelihood: 'high'
        });
      }
    }

    // Browser-specific causes
    if (diffPercent > 0.5 && diffPercent < 2) {
      causes.push({
        category: 'browser',
        description: 'Minor browser rendering differences',
        likelihood: 'medium'
      });
    }

    return causes;
  }

  /**
   * Generate specific suggestions for fixing issues
   */
  generateSuggestions(test) {
    const suggestions = [];
    const diffPercent = test.pair.diff?.misMatchPercentage || 0;
    const label = test.pair.label.toLowerCase();

    if (diffPercent > this.config.thresholds.critical) {
      suggestions.push({
        priority: 'critical',
        action: 'immediate-review',
        description: 'Critical visual difference detected - requires immediate attention',
        steps: [
          'Compare with Figma design carefully',
          'Check CSS implementation for major discrepancies',
          'Verify responsive behavior',
          'Test across different browsers'
        ]
      });
    }

    if (label.includes('font') || label.includes('text')) {
      suggestions.push({
        priority: 'high',
        action: 'typography-fix',
        description: 'Typography adjustments needed',
        steps: [
          'Verify font-family matches Figma specification',
          'Check font-size, line-height, and letter-spacing',
          'Ensure proper font loading',
          'Validate text color and font-weight'
        ]
      });
    }

    if (label.includes('spacing') || label.includes('layout')) {
      suggestions.push({
        priority: 'high',
        action: 'layout-fix',
        description: 'Layout spacing requires adjustment',
        steps: [
          'Review margin and padding values',
          'Check flexbox/grid implementation',
          'Verify container widths and heights',
          'Ensure proper alignment properties'
        ]
      });
    }

    if (label.includes('color')) {
      suggestions.push({
        priority: 'medium',
        action: 'color-fix',
        description: 'Color values need correction',
        steps: [
          'Extract exact color values from Figma',
          'Update CSS color properties',
          'Check for transparency/opacity issues',
          'Verify color contrast accessibility'
        ]
      });
    }

    return suggestions;
  }

  /**
   * Analyze performance impact of mismatches
   */
  analyzePerformanceImpact(test) {
    const diffPercent = test.pair.diff?.misMatchPercentage || 0;
    
    return {
      visualImpact: this.getSeverityLevel(diffPercent),
      userExperience: diffPercent > 5 ? 'poor' : diffPercent > 2 ? 'fair' : 'good',
      brandConsistency: diffPercent > 3 ? 'low' : diffPercent > 1 ? 'medium' : 'high',
      maintenanceEffort: this.estimateMaintenanceEffort(test)
    };
  }

  /**
   * Estimate maintenance effort required
   */
  estimateMaintenanceEffort(test) {
    const diffPercent = test.pair.diff?.misMatchPercentage || 0;
    const label = test.pair.label.toLowerCase();

    if (diffPercent > 10) return 'high';
    if (diffPercent > 5) return 'medium';
    if (diffPercent > 1) return 'low';
    
    // Consider complexity based on test type
    if (label.includes('responsive') || label.includes('complex')) {
      return 'medium';
    }

    return 'minimal';
  }

  /**
   * Get severity level based on difference percentage
   */
  getSeverityLevel(diffPercent) {
    if (diffPercent > this.config.thresholds.critical) return 'critical';
    if (diffPercent > this.config.thresholds.warning) return 'warning';
    if (diffPercent > this.config.thresholds.minor) return 'minor';
    return 'pass';
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(results) {
    const recommendations = {
      immediate: [],
      shortTerm: [],
      longTerm: [],
      preventive: []
    };

    const tests = results.tests || [];
    const failedTests = tests.filter(t => t.status === 'fail');

    // Immediate actions for critical issues
    const criticalTests = failedTests.filter(t => 
      (t.pair.diff?.misMatchPercentage || 0) > this.config.thresholds.critical
    );

    if (criticalTests.length > 0) {
      recommendations.immediate.push({
        title: 'Fix Critical Visual Mismatches',
        description: `${criticalTests.length} tests show critical differences (>${this.config.thresholds.critical}%)`,
        priority: 'critical',
        estimatedTime: `${criticalTests.length * 2} hours`,
        impact: 'high'
      });
    }

    // Short-term actions for warning level issues
    const warningTests = failedTests.filter(t => {
      const diff = t.pair.diff?.misMatchPercentage || 0;
      return diff > this.config.thresholds.warning && diff <= this.config.thresholds.critical;
    });

    if (warningTests.length > 0) {
      recommendations.shortTerm.push({
        title: 'Address Warning Level Differences',
        description: `${warningTests.length} tests show warning level differences`,
        priority: 'high',
        estimatedTime: `${warningTests.length} hours`,
        impact: 'medium'
      });
    }

    // Long-term process improvements
    if (failedTests.length > tests.length * 0.2) {
      recommendations.longTerm.push({
        title: 'Improve Design-to-Code Process',
        description: 'High failure rate indicates process improvements needed',
        priority: 'medium',
        estimatedTime: '1-2 weeks',
        impact: 'high'
      });
    }

    // Preventive measures
    recommendations.preventive.push({
      title: 'Implement Continuous Visual Testing',
      description: 'Set up automated visual regression testing in CI/CD pipeline',
      priority: 'medium',
      estimatedTime: '3-5 days',
      impact: 'high'
    });

    return recommendations;
  }

  /**
   * Compare with Figma design tokens for enhanced insights
   */
  async compareWithFigmaTokens(testResults, figmaTokens) {
    const comparison = {
      tokenMismatches: [],
      componentAnalysis: [],
      designSystemCompliance: null
    };

    // This would integrate with the existing Figma API functionality
    // to provide detailed token-level comparisons

    return comparison;
  }

  /**
   * Generate visual heatmap of differences
   */
  async generateVisualHeatmap(testResults) {
    // This would create a visual representation of where most differences occur
    // across different components and viewports
    
    const heatmapData = {
      components: {},
      viewports: {},
      regions: {}
    };

    return heatmapData;
  }
}

module.exports = {
  DetailedMismatchInsights
};
