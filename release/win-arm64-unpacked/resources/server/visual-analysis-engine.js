/**
 * Visual Analysis Engine
 * Advanced visual comparison and analysis using computer vision techniques
 */

const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');

class VisualAnalysisEngine {
  constructor(config = {}) {
    this.config = {
      ...config,
      analysis: {
        enablePixelAnalysis: true,
        enableStructuralSimilarity: true,
        enableColorAnalysis: true,
        enableLayoutAnalysis: true,
        ...config.analysis
      }
    };
  }

  /**
   * Perform comprehensive visual analysis between two images
   */
  async performVisualAnalysis(referenceImagePath, testImagePath, outputDir) {
    try {
      const analysis = {
        timestamp: new Date().toISOString(),
        reference: await this.analyzeImage(referenceImagePath),
        test: await this.analyzeImage(testImagePath),
        comparison: null,
        insights: null
      };

      // Perform detailed comparison
      analysis.comparison = await this.compareImages(
        referenceImagePath, 
        testImagePath, 
        outputDir
      );

      // Generate insights
      analysis.insights = this.generateVisualInsights(analysis);

      return analysis;
    } catch (error) {
      console.error('Error performing visual analysis:', error);
      throw error;
    }
  }

  /**
   * Analyze individual image properties
   */
  async analyzeImage(imagePath) {
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      const analysis = {
        path: imagePath,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          channels: metadata.channels,
          format: metadata.format,
          size: metadata.size
        },
        colorAnalysis: await this.analyzeColors(image),
        structuralAnalysis: await this.analyzeStructure(image),
        layoutAnalysis: await this.analyzeLayout(image)
      };

      return analysis;
    } catch (error) {
      console.error('Error analyzing image:', error);
      throw error;
    }
  }

  /**
   * Analyze color distribution and palette
   */
  async analyzeColors(image) {
    try {
      // Get pixel data for color analysis
      const { data, info } = await image
        .raw()
        .toBuffer({ resolveWithObject: true });

      const colorDistribution = this.calculateColorDistribution(data, info);
      const dominantColors = this.extractDominantColors(data, info);
      const colorVariance = this.calculateColorVariance(data, info);

      return {
        distribution: colorDistribution,
        dominantColors,
        variance: colorVariance,
        averageBrightness: this.calculateAverageBrightness(data, info),
        contrast: this.calculateContrast(data, info)
      };
    } catch (error) {
      console.error('Error analyzing colors:', error);
      return {};
    }
  }

  /**
   * Calculate color distribution across the image
   */
  calculateColorDistribution(data, info) {
    const channels = info.channels;
    const pixelCount = data.length / channels;
    const distribution = {
      red: { histogram: new Array(256).fill(0), mean: 0 },
      green: { histogram: new Array(256).fill(0), mean: 0 },
      blue: { histogram: new Array(256).fill(0), mean: 0 }
    };

    let redSum = 0, greenSum = 0, blueSum = 0;

    for (let i = 0; i < data.length; i += channels) {
      const red = data[i];
      const green = data[i + 1];
      const blue = data[i + 2];

      distribution.red.histogram[red]++;
      distribution.green.histogram[green]++;
      distribution.blue.histogram[blue]++;

      redSum += red;
      greenSum += green;
      blueSum += blue;
    }

    distribution.red.mean = Math.round(redSum / pixelCount);
    distribution.green.mean = Math.round(greenSum / pixelCount);
    distribution.blue.mean = Math.round(blueSum / pixelCount);

    return distribution;
  }

  /**
   * Extract dominant colors using simple clustering
   */
  extractDominantColors(data, info, maxColors = 5) {
    const channels = info.channels;
    const colors = new Map();

    // Sample every 10th pixel for performance
    for (let i = 0; i < data.length; i += channels * 10) {
      const red = Math.floor(data[i] / 32) * 32;
      const green = Math.floor(data[i + 1] / 32) * 32;
      const blue = Math.floor(data[i + 2] / 32) * 32;
      
      const colorKey = `${red},${green},${blue}`;
      colors.set(colorKey, (colors.get(colorKey) || 0) + 1);
    }

    // Sort by frequency and return top colors
    return Array.from(colors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxColors)
      .map(([color, count]) => {
        const [r, g, b] = color.split(',').map(Number);
        return {
          rgb: { r, g, b },
          hex: this.rgbToHex(r, g, b),
          frequency: count,
          percentage: Math.round((count / (data.length / channels)) * 100 * 10) / 10
        };
      });
  }

  /**
   * Calculate color variance
   */
  calculateColorVariance(data, info) {
    const channels = info.channels;
    const pixelCount = data.length / channels;
    
    // Calculate means first
    let redSum = 0, greenSum = 0, blueSum = 0;
    for (let i = 0; i < data.length; i += channels) {
      redSum += data[i];
      greenSum += data[i + 1];
      blueSum += data[i + 2];
    }
    
    const redMean = redSum / pixelCount;
    const greenMean = greenSum / pixelCount;
    const blueMean = blueSum / pixelCount;

    // Calculate variance
    let redVariance = 0, greenVariance = 0, blueVariance = 0;
    for (let i = 0; i < data.length; i += channels) {
      redVariance += Math.pow(data[i] - redMean, 2);
      greenVariance += Math.pow(data[i + 1] - greenMean, 2);
      blueVariance += Math.pow(data[i + 2] - blueMean, 2);
    }

    return {
      red: Math.round(redVariance / pixelCount),
      green: Math.round(greenVariance / pixelCount),
      blue: Math.round(blueVariance / pixelCount),
      overall: Math.round((redVariance + greenVariance + blueVariance) / (3 * pixelCount))
    };
  }

  /**
   * Calculate average brightness
   */
  calculateAverageBrightness(data, info) {
    const channels = info.channels;
    const pixelCount = data.length / channels;
    let totalBrightness = 0;

    for (let i = 0; i < data.length; i += channels) {
      // Calculate luminance using standard formula
      const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      totalBrightness += brightness;
    }

    return Math.round(totalBrightness / pixelCount);
  }

  /**
   * Calculate contrast using RMS contrast
   */
  calculateContrast(data, info) {
    const channels = info.channels;
    const pixelCount = data.length / channels;
    const brightness = this.calculateAverageBrightness(data, info);
    
    let contrastSum = 0;
    for (let i = 0; i < data.length; i += channels) {
      const pixelBrightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      contrastSum += Math.pow(pixelBrightness - brightness, 2);
    }

    return Math.round(Math.sqrt(contrastSum / pixelCount));
  }

  /**
   * Analyze structural elements in the image
   */
  async analyzeStructure(image) {
    try {
      // Create edge detection version
      const edges = await image
        .greyscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
        })
        .toBuffer();

      const edgeData = await sharp(edges).raw().toBuffer({ resolveWithObject: true });
      
      return {
        edgeCount: this.countEdges(edgeData.data),
        complexity: this.calculateComplexity(edgeData.data),
        symmetry: this.calculateSymmetry(edgeData.data, edgeData.info)
      };
    } catch (error) {
      console.error('Error analyzing structure:', error);
      return {};
    }
  }

  /**
   * Count edge pixels
   */
  countEdges(data, threshold = 50) {
    let edgeCount = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] > threshold) {
        edgeCount++;
      }
    }
    return edgeCount;
  }

  /**
   * Calculate structural complexity
   */
  calculateComplexity(data) {
    // Simple complexity measure based on edge density and variation
    const totalPixels = data.length;
    const edgePixels = this.countEdges(data);
    const edgeDensity = edgePixels / totalPixels;
    
    // Calculate variation in edge strengths
    let variation = 0;
    const mean = data.reduce((sum, val) => sum + val, 0) / totalPixels;
    
    for (let i = 0; i < data.length; i++) {
      variation += Math.pow(data[i] - mean, 2);
    }
    variation = Math.sqrt(variation / totalPixels);

    return {
      edgeDensity: Math.round(edgeDensity * 1000) / 10,
      variation: Math.round(variation),
      complexity: Math.round((edgeDensity * 50 + variation / 255 * 50))
    };
  }

  /**
   * Calculate symmetry
   */
  calculateSymmetry(data, info) {
    const { width, height } = info;
    let horizontalSymmetry = 0;
    let verticalSymmetry = 0;

    // Calculate horizontal symmetry
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width / 2; x++) {
        const leftPixel = data[y * width + x];
        const rightPixel = data[y * width + (width - 1 - x)];
        horizontalSymmetry += Math.abs(leftPixel - rightPixel);
      }
    }

    // Calculate vertical symmetry
    for (let y = 0; y < height / 2; y++) {
      for (let x = 0; x < width; x++) {
        const topPixel = data[y * width + x];
        const bottomPixel = data[(height - 1 - y) * width + x];
        verticalSymmetry += Math.abs(topPixel - bottomPixel);
      }
    }

    const totalPixels = width * height;
    return {
      horizontal: Math.round((1 - horizontalSymmetry / (totalPixels * 127.5)) * 100),
      vertical: Math.round((1 - verticalSymmetry / (totalPixels * 127.5)) * 100)
    };
  }

  /**
   * Analyze layout and composition
   */
  async analyzeLayout(image) {
    try {
      // Convert to grayscale for layout analysis
      const { data, info } = await image
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      return {
        composition: this.analyzeComposition(data, info),
        whitespace: this.analyzeWhitespace(data, info),
        alignment: this.analyzeAlignment(data, info)
      };
    } catch (error) {
      console.error('Error analyzing layout:', error);
      return {};
    }
  }

  /**
   * Analyze composition using rule of thirds
   */
  analyzeComposition(data, info) {
    const { width, height } = info;
    const thirdWidth = Math.floor(width / 3);
    const thirdHeight = Math.floor(height / 3);

    const regions = {
      topLeft: 0, topCenter: 0, topRight: 0,
      centerLeft: 0, center: 0, centerRight: 0,
      bottomLeft: 0, bottomCenter: 0, bottomRight: 0
    };

    let totalWeight = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelValue = 255 - data[y * width + x]; // Invert for content weight
        totalWeight += pixelValue;

        // Determine region
        let region;
        if (y < thirdHeight) {
          if (x < thirdWidth) region = 'topLeft';
          else if (x < 2 * thirdWidth) region = 'topCenter';
          else region = 'topRight';
        } else if (y < 2 * thirdHeight) {
          if (x < thirdWidth) region = 'centerLeft';
          else if (x < 2 * thirdWidth) region = 'center';
          else region = 'centerRight';
        } else {
          if (x < thirdWidth) region = 'bottomLeft';
          else if (x < 2 * thirdWidth) region = 'bottomCenter';
          else region = 'bottomRight';
        }

        regions[region] += pixelValue;
      }
    }

    // Normalize regions
    Object.keys(regions).forEach(key => {
      regions[key] = Math.round((regions[key] / totalWeight) * 100);
    });

    return {
      regions,
      balance: this.calculateBalance(regions),
      ruleOfThirds: this.evaluateRuleOfThirds(regions)
    };
  }

  /**
   * Calculate visual balance
   */
  calculateBalance(regions) {
    const leftWeight = regions.topLeft + regions.centerLeft + regions.bottomLeft;
    const rightWeight = regions.topRight + regions.centerRight + regions.bottomRight;
    const topWeight = regions.topLeft + regions.topCenter + regions.topRight;
    const bottomWeight = regions.bottomLeft + regions.bottomCenter + regions.bottomRight;

    return {
      horizontal: Math.abs(leftWeight - rightWeight),
      vertical: Math.abs(topWeight - bottomWeight),
      overall: (Math.abs(leftWeight - rightWeight) + Math.abs(topWeight - bottomWeight)) / 2
    };
  }

  /**
   * Evaluate adherence to rule of thirds
   */
  evaluateRuleOfThirds(regions) {
    // Points of interest should be on intersection lines
    const intersectionWeight = regions.topLeft + regions.topRight + 
                              regions.bottomLeft + regions.bottomRight;
    const centerWeight = regions.center;
    
    return {
      intersectionFocus: intersectionWeight,
      centerFocus: centerWeight,
      adherence: intersectionWeight > centerWeight ? 'good' : 'poor'
    };
  }

  /**
   * Analyze whitespace distribution
   */
  analyzeWhitespace(data, info, whiteThreshold = 240) {
    const { width, height } = info;
    let whitespacePixels = 0;
    let contentPixels = 0;

    for (let i = 0; i < data.length; i++) {
      if (data[i] > whiteThreshold) {
        whitespacePixels++;
      } else {
        contentPixels++;
      }
    }

    const totalPixels = width * height;
    return {
      percentage: Math.round((whitespacePixels / totalPixels) * 100),
      distribution: this.analyzeWhitespaceDistribution(data, info, whiteThreshold),
      density: Math.round((contentPixels / totalPixels) * 100)
    };
  }

  /**
   * Analyze whitespace distribution across regions
   */
  analyzeWhitespaceDistribution(data, info, whiteThreshold) {
    // This would analyze how whitespace is distributed across different regions
    // Similar to composition analysis but focusing on whitespace
    return {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      center: 0
    };
  }

  /**
   * Analyze alignment and grid structure
   */
  analyzeAlignment(data, info) {
    // This would analyze vertical and horizontal alignment patterns
    return {
      verticalLines: this.detectVerticalLines(data, info),
      horizontalLines: this.detectHorizontalLines(data, info),
      gridStructure: this.detectGridStructure(data, info)
    };
  }

  /**
   * Detect vertical alignment lines
   */
  detectVerticalLines(data, info) {
    // Simple implementation - would be more sophisticated in practice
    return [];
  }

  /**
   * Detect horizontal alignment lines
   */
  detectHorizontalLines(data, info) {
    // Simple implementation - would be more sophisticated in practice
    return [];
  }

  /**
   * Detect grid structure
   */
  detectGridStructure(data, info) {
    // Simple implementation - would be more sophisticated in practice
    return {
      detected: false,
      columns: 0,
      rows: 0,
      consistency: 0
    };
  }

  /**
   * Compare two images with detailed analysis
   */
  async compareImages(referenceImagePath, testImagePath, outputDir) {
    try {
      const comparison = {
        pixelDifference: await this.calculatePixelDifference(referenceImagePath, testImagePath),
        structuralSimilarity: await this.calculateStructuralSimilarity(referenceImagePath, testImagePath),
        colorDifference: await this.calculateColorDifference(referenceImagePath, testImagePath),
        layoutDifference: await this.calculateLayoutDifference(referenceImagePath, testImagePath),
        diffMap: await this.generateDifferenceMap(referenceImagePath, testImagePath, outputDir)
      };

      return comparison;
    } catch (error) {
      console.error('Error comparing images:', error);
      throw error;
    }
  }

  /**
   * Calculate pixel-level differences
   */
  async calculatePixelDifference(refPath, testPath) {
    try {
      const refImage = sharp(refPath);
      const testImage = sharp(testPath);

      // Ensure same dimensions
      const refMeta = await refImage.metadata();
      const testMeta = await testImage.metadata();

      if (refMeta.width !== testMeta.width || refMeta.height !== testMeta.height) {
        throw new Error('Images must have the same dimensions for pixel comparison');
      }

      const refData = await refImage.raw().toBuffer();
      const testData = await testImage.raw().toBuffer();

      let totalDifference = 0;
      let differingPixels = 0;
      const threshold = 10; // Pixel difference threshold

      for (let i = 0; i < refData.length; i += 3) {
        const refR = refData[i];
        const refG = refData[i + 1];
        const refB = refData[i + 2];
        
        const testR = testData[i];
        const testG = testData[i + 1];
        const testB = testData[i + 2];

        const pixelDiff = Math.sqrt(
          Math.pow(refR - testR, 2) +
          Math.pow(refG - testG, 2) +
          Math.pow(refB - testB, 2)
        );

        totalDifference += pixelDiff;
        
        if (pixelDiff > threshold) {
          differingPixels++;
        }
      }

      const totalPixels = refData.length / 3;
      return {
        averageDifference: Math.round(totalDifference / totalPixels),
        differingPixels,
        percentageDifferent: Math.round((differingPixels / totalPixels) * 100 * 10) / 10,
        similarity: Math.round((1 - (totalDifference / (totalPixels * 441))) * 100 * 10) / 10 // 441 = sqrt(255^2 * 3)
      };
    } catch (error) {
      console.error('Error calculating pixel difference:', error);
      return {};
    }
  }

  /**
   * Calculate structural similarity index
   */
  async calculateStructuralSimilarity(refPath, testPath) {
    // Simplified SSIM implementation
    try {
      const refAnalysis = await this.analyzeStructure(sharp(refPath));
      const testAnalysis = await this.analyzeStructure(sharp(testPath));

      const edgeSimilarity = 1 - Math.abs(refAnalysis.edgeCount - testAnalysis.edgeCount) / 
                             Math.max(refAnalysis.edgeCount, testAnalysis.edgeCount);

      const complexitySimilarity = 1 - Math.abs(
        refAnalysis.complexity.complexity - testAnalysis.complexity.complexity
      ) / 100;

      return {
        edgeSimilarity: Math.round(edgeSimilarity * 100),
        complexitySimilarity: Math.round(complexitySimilarity * 100),
        overall: Math.round((edgeSimilarity + complexitySimilarity) * 50)
      };
    } catch (error) {
      console.error('Error calculating structural similarity:', error);
      return {};
    }
  }

  /**
   * Calculate color difference between images
   */
  async calculateColorDifference(refPath, testPath) {
    try {
      const refColors = await this.analyzeColors(sharp(refPath));
      const testColors = await this.analyzeColors(sharp(testPath));

      // Compare dominant colors
      let colorScore = 0;
      const maxColors = Math.min(refColors.dominantColors?.length || 0, testColors.dominantColors?.length || 0);
      
      for (let i = 0; i < maxColors; i++) {
        const refColor = refColors.dominantColors[i];
        const testColor = testColors.dominantColors[i];
        
        const colorDiff = this.calculateColorDistance(refColor.rgb, testColor.rgb);
        colorScore += (1 - colorDiff / 441) * (refColor.percentage + testColor.percentage) / 2;
      }

      // Compare brightness and contrast
      const brightnessDiff = Math.abs(refColors.averageBrightness - testColors.averageBrightness);
      const contrastDiff = Math.abs(refColors.contrast - testColors.contrast);

      return {
        dominantColorSimilarity: Math.round(colorScore),
        brightnessDifference: brightnessDiff,
        contrastDifference: contrastDiff,
        overallSimilarity: Math.round((colorScore + (1 - brightnessDiff/255) + (1 - contrastDiff/255)) * 33.33)
      };
    } catch (error) {
      console.error('Error calculating color difference:', error);
      return {};
    }
  }

  /**
   * Calculate layout difference
   */
  async calculateLayoutDifference(refPath, testPath) {
    try {
      const refLayout = await this.analyzeLayout(sharp(refPath));
      const testLayout = await this.analyzeLayout(sharp(testPath));

      // Compare composition
      const compositionDiff = this.compareComposition(
        refLayout.composition?.regions, 
        testLayout.composition?.regions
      );

      // Compare whitespace
      const whitespaceDiff = Math.abs(
        (refLayout.whitespace?.percentage || 0) - (testLayout.whitespace?.percentage || 0)
      );

      return {
        compositionSimilarity: Math.round((1 - compositionDiff / 100) * 100),
        whitespaceDifference: whitespaceDiff,
        layoutScore: Math.round((1 - (compositionDiff + whitespaceDiff) / 200) * 100)
      };
    } catch (error) {
      console.error('Error calculating layout difference:', error);
      return {};
    }
  }

  /**
   * Compare composition between two layouts
   */
  compareComposition(refRegions, testRegions) {
    if (!refRegions || !testRegions) return 100;

    let totalDiff = 0;
    const regionKeys = Object.keys(refRegions);

    regionKeys.forEach(key => {
      totalDiff += Math.abs((refRegions[key] || 0) - (testRegions[key] || 0));
    });

    return totalDiff / regionKeys.length;
  }

  /**
   * Generate difference map visualization
   */
  async generateDifferenceMap(refPath, testPath, outputDir) {
    try {
      const outputPath = path.join(outputDir, 'difference-map.png');
      
      // Create difference image using Sharp
      const refImage = sharp(refPath);
      const testImage = sharp(testPath);
      
      // This is a simplified version - a full implementation would create a proper diff image
      const refBuffer = await refImage.raw().toBuffer();
      const testBuffer = await testImage.raw().toBuffer();
      const metadata = await refImage.metadata();
      
      const diffBuffer = Buffer.alloc(refBuffer.length);
      
      for (let i = 0; i < refBuffer.length; i += 3) {
        const rDiff = Math.abs(refBuffer[i] - testBuffer[i]);
        const gDiff = Math.abs(refBuffer[i + 1] - testBuffer[i + 1]);
        const bDiff = Math.abs(refBuffer[i + 2] - testBuffer[i + 2]);
        
        const avgDiff = (rDiff + gDiff + bDiff) / 3;
        
        // Highlight differences in red
        diffBuffer[i] = avgDiff > 10 ? 255 : avgDiff * 2; // Red channel
        diffBuffer[i + 1] = avgDiff > 10 ? 0 : avgDiff; // Green channel  
        diffBuffer[i + 2] = avgDiff > 10 ? 0 : avgDiff; // Blue channel
      }

      await sharp(diffBuffer, {
        raw: {
          width: metadata.width,
          height: metadata.height,
          channels: 3
        }
      }).png().toFile(outputPath);

      return {
        path: outputPath,
        created: true
      };
    } catch (error) {
      console.error('Error generating difference map:', error);
      return { created: false, error: error.message };
    }
  }

  /**
   * Generate comprehensive visual insights
   */
  generateVisualInsights(analysis) {
    const insights = {
      overall: this.generateOverallInsight(analysis),
      specific: this.generateSpecificInsights(analysis),
      recommendations: this.generateVisualRecommendations(analysis)
    };

    return insights;
  }

  /**
   * Generate overall insight summary
   */
  generateOverallInsight(analysis) {
    const comparison = analysis.comparison;
    let overallScore = 0;
    let scoreCount = 0;

    // Aggregate scores from different metrics
    if (comparison.pixelDifference?.similarity) {
      overallScore += comparison.pixelDifference.similarity;
      scoreCount++;
    }
    if (comparison.structuralSimilarity?.overall) {
      overallScore += comparison.structuralSimilarity.overall;
      scoreCount++;
    }
    if (comparison.colorDifference?.overallSimilarity) {
      overallScore += comparison.colorDifference.overallSimilarity;
      scoreCount++;
    }
    if (comparison.layoutDifference?.layoutScore) {
      overallScore += comparison.layoutDifference.layoutScore;
      scoreCount++;
    }

    const averageScore = scoreCount > 0 ? Math.round(overallScore / scoreCount) : 0;

    let grade, description;
    if (averageScore >= 95) {
      grade = 'A+';
      description = 'Excellent visual match with minimal differences';
    } else if (averageScore >= 90) {
      grade = 'A';
      description = 'Very good visual match with minor differences';
    } else if (averageScore >= 80) {
      grade = 'B';
      description = 'Good visual match with some noticeable differences';
    } else if (averageScore >= 70) {
      grade = 'C';
      description = 'Acceptable visual match with several differences';
    } else if (averageScore >= 60) {
      grade = 'D';
      description = 'Poor visual match with significant differences';
    } else {
      grade = 'F';
      description = 'Major visual differences detected';
    }

    return {
      score: averageScore,
      grade,
      description,
      confidence: scoreCount === 4 ? 'high' : scoreCount >= 2 ? 'medium' : 'low'
    };
  }

  /**
   * Generate specific insights for different aspects
   */
  generateSpecificInsights(analysis) {
    const insights = [];
    const comparison = analysis.comparison;

    // Pixel-level insights
    if (comparison.pixelDifference) {
      const pixelDiff = comparison.pixelDifference;
      if (pixelDiff.percentageDifferent > 5) {
        insights.push({
          category: 'pixel',
          severity: pixelDiff.percentageDifferent > 15 ? 'high' : 'medium',
          message: `${pixelDiff.percentageDifferent}% of pixels differ significantly`,
          recommendation: 'Review overall implementation for major discrepancies'
        });
      }
    }

    // Color insights
    if (comparison.colorDifference) {
      const colorDiff = comparison.colorDifference;
      if (colorDiff.brightnessDifference > 30) {
        insights.push({
          category: 'color',
          severity: 'medium',
          message: `Brightness differs by ${colorDiff.brightnessDifference} levels`,
          recommendation: 'Check background colors and overall brightness settings'
        });
      }
      if (colorDiff.contrastDifference > 40) {
        insights.push({
          category: 'color',
          severity: 'medium',
          message: `Contrast differs significantly (${colorDiff.contrastDifference})`,
          recommendation: 'Review text and background contrast ratios'
        });
      }
    }

    // Layout insights
    if (comparison.layoutDifference) {
      const layoutDiff = comparison.layoutDifference;
      if (layoutDiff.layoutScore < 80) {
        insights.push({
          category: 'layout',
          severity: layoutDiff.layoutScore < 60 ? 'high' : 'medium',
          message: `Layout composition differs from design (${layoutDiff.layoutScore}% match)`,
          recommendation: 'Check element positioning and spacing'
        });
      }
    }

    return insights;
  }

  /**
   * Generate visual recommendations
   */
  generateVisualRecommendations(analysis) {
    const recommendations = [];
    const comparison = analysis.comparison;

    // Based on pixel differences
    if (comparison.pixelDifference?.percentageDifferent > 10) {
      recommendations.push({
        priority: 'high',
        category: 'implementation',
        title: 'Significant Visual Differences',
        description: 'Large portions of the implementation differ from the design',
        actions: [
          'Compare side-by-side with design file',
          'Check CSS implementation for major elements',
          'Verify responsive behavior across breakpoints',
          'Review component library usage'
        ]
      });
    }

    // Based on color analysis
    if (comparison.colorDifference?.overallSimilarity < 70) {
      recommendations.push({
        priority: 'medium',
        category: 'styling',
        title: 'Color Scheme Adjustments Needed',
        description: 'Colors differ significantly from the design specification',
        actions: [
          'Extract exact color values from design file',
          'Update CSS variables and color tokens',
          'Check for proper theme application',
          'Verify color accessibility compliance'
        ]
      });
    }

    // Based on layout analysis
    if (comparison.layoutDifference?.layoutScore < 75) {
      recommendations.push({
        priority: 'medium',
        category: 'layout',
        title: 'Layout and Spacing Issues',
        description: 'Element positioning and spacing need adjustment',
        actions: [
          'Review margin and padding values',
          'Check flexbox/grid implementation',
          'Verify component alignment',
          'Test responsive behavior'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Utility function to convert RGB to HEX
   */
  rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /**
   * Calculate distance between two colors
   */
  calculateColorDistance(color1, color2) {
    return Math.sqrt(
      Math.pow(color1.r - color2.r, 2) +
      Math.pow(color1.g - color2.g, 2) +
      Math.pow(color1.b - color2.b, 2)
    );
  }
}

module.exports = {
  VisualAnalysisEngine
};
