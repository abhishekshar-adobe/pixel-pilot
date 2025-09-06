/**
 * Figma to HTML/CSS Generator
 * Converts Figma designs into clean, responsive HTML and CSS code
 */

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class FigmaHTMLGenerator {
  constructor(figmaToken, fileKey) {
    this.figmaToken = figmaToken;
    this.fileKey = fileKey;
    this.apiBase = 'https://api.figma.com/v1';
    this.generatedAssets = [];
    this.cssVariables = new Map();
    this.componentLibrary = new Map();
  }

  /**
   * Generate complete HTML/CSS from Figma file or specific frames
   */
  async generateFromFigma(options = {}) {
    try {
      const {
        pageId,
        frameIds = [],
        generateResponsive = true,
        includeInteractions = false,
        outputFormat = 'separate', // 'separate', 'inline', 'component'
        framework = 'vanilla', // 'vanilla', 'react', 'vue'
        cssFramework = 'custom' // 'custom', 'tailwind', 'bootstrap'
      } = options;

      console.log('🎨 Starting Figma to HTML/CSS generation...');

      // Step 1: Fetch Figma file data
      const figmaData = await this.getFigmaFileData();
      
      // Step 2: Extract design tokens and styles
      const designTokens = await this.extractDesignTokens(figmaData);
      
      // Step 3: Process frames/components
      const processedFrames = await this.processFrames(figmaData, pageId, frameIds);
      
      // Step 4: Generate CSS
      const generatedCSS = await this.generateCSS(processedFrames, designTokens, {
        responsive: generateResponsive,
        framework: cssFramework
      });
      
      // Step 5: Generate HTML
      const generatedHTML = await this.generateHTML(processedFrames, {
        framework,
        includeInteractions,
        outputFormat
      });
      
      // Step 6: Generate assets (images, icons)
      const assets = await this.generateAssets(processedFrames);
      
      const result = {
        html: generatedHTML,
        css: generatedCSS,
        assets,
        designTokens,
        metadata: {
          figmaFileKey: this.fileKey,
          generatedAt: new Date().toISOString(),
          framework,
          cssFramework,
          responsive: generateResponsive,
          totalFrames: processedFrames.length,
          totalComponents: this.componentLibrary.size
        }
      };

      console.log('✅ HTML/CSS generation completed successfully');
      return result;

    } catch (error) {
      console.error('❌ Error generating HTML/CSS from Figma:', error);
      throw error;
    }
  }

  /**
   * Fetch Figma file data with detailed node information
   */
  async getFigmaFileData() {
    const response = await axios.get(`${this.apiBase}/files/${this.fileKey}`, {
      headers: { 'X-FIGMA-TOKEN': this.figmaToken },
      params: {
        depth: 10,
        geometry: 'paths'
      }
    });

    return response.data;
  }

  /**
   * Extract design tokens (colors, typography, spacing) from Figma
   */
  async extractDesignTokens(figmaData) {
    const tokens = {
      colors: new Map(),
      typography: new Map(),
      spacing: new Map(),
      effects: new Map(),
      grids: new Map()
    };

    // Extract color styles
    if (figmaData.styles) {
      for (const [styleId, style] of Object.entries(figmaData.styles)) {
        if (style.styleType === 'FILL') {
          const colorName = this.sanitizeName(style.name);
          const colorValue = this.extractColorValue(style);
          tokens.colors.set(colorName, colorValue);
          this.cssVariables.set(`--color-${colorName}`, colorValue);
        } else if (style.styleType === 'TEXT') {
          const typographyName = this.sanitizeName(style.name);
          const typographyValue = this.extractTypographyValue(style);
          tokens.typography.set(typographyName, typographyValue);
        }
      }
    }

    // Process document to extract additional tokens
    this.processNodeForTokens(figmaData.document, tokens);

    return tokens;
  }

  /**
   * Process frames and convert them to structured data
   */
  async processFrames(figmaData, pageId, frameIds) {
    const frames = [];
    
    // Find the target page
    const page = pageId 
      ? figmaData.document.children.find(p => p.id === pageId)
      : figmaData.document.children[0];

    if (!page) {
      throw new Error('Page not found');
    }

    // Process specific frames or all frames
    const targetFrames = frameIds.length > 0 
      ? page.children.filter(child => frameIds.includes(child.id))
      : page.children.filter(child => child.type === 'FRAME');

    for (const frame of targetFrames) {
      console.log(`🖼️ Processing frame: ${frame.name}`);
      
      const processedFrame = {
        id: frame.id,
        name: this.sanitizeName(frame.name),
        type: frame.type,
        bounds: frame.absoluteBoundingBox,
        styles: this.extractNodeStyles(frame),
        elements: [],
        layout: this.analyzeLayout(frame),
        responsive: this.generateResponsiveBreakpoints(frame)
      };

      // Process all child elements
      if (frame.children) {
        processedFrame.elements = await this.processElements(frame.children, frame);
      }

      frames.push(processedFrame);
    }

    return frames;
  }

  /**
   * Process individual elements within frames
   */
  async processElements(elements, parentFrame, level = 0) {
    const processedElements = [];

    for (const element of elements) {
      const processedElement = {
        id: element.id,
        name: this.sanitizeName(element.name),
        type: element.type,
        bounds: element.absoluteBoundingBox,
        styles: this.extractNodeStyles(element),
        level,
        htmlTag: this.determineHTMLTag(element),
        cssClasses: this.generateCSSClasses(element),
        children: []
      };

      // Type-specific processing
      switch (element.type) {
        case 'TEXT':
          processedElement.content = element.characters || '';
          processedElement.typography = this.extractTypographyStyles(element);
          break;
          
        case 'RECTANGLE':
        case 'ELLIPSE':
        case 'POLYGON':
          processedElement.shape = this.extractShapeStyles(element);
          break;
          
        case 'FRAME':
        case 'GROUP':
          processedElement.layout = this.analyzeLayout(element);
          if (element.children) {
            processedElement.children = await this.processElements(
              element.children, 
              parentFrame, 
              level + 1
            );
          }
          break;
          
        case 'COMPONENT':
        case 'INSTANCE':
          processedElement.component = this.processComponent(element);
          this.componentLibrary.set(element.id, processedElement);
          break;
      }

      // Extract images if present
      if (element.fills) {
        const imageData = await this.extractImages(element);
        if (imageData) {
          processedElement.images = imageData;
        }
      }

      processedElements.push(processedElement);
    }

    return processedElements;
  }

  /**
   * Generate CSS from processed frames
   */
  async generateCSS(frames, designTokens, options) {
    const { responsive, framework } = options;
    
    let css = '';

    // CSS Reset and base styles
    css += this.generateCSSReset();
    css += '\n\n';

    // CSS Variables from design tokens
    css += this.generateCSSVariables(designTokens);
    css += '\n\n';

    // Generate styles for each frame
    for (const frame of frames) {
      css += this.generateFrameCSS(frame, responsive);
      css += '\n\n';
    }

    // Generate responsive breakpoints
    if (responsive) {
      css += this.generateResponsiveCSS(frames);
    }

    // Framework-specific adjustments
    if (framework === 'tailwind') {
      css = this.adaptForTailwind(css);
    } else if (framework === 'bootstrap') {
      css = this.adaptForBootstrap(css);
    }

    return css;
  }

  /**
   * Generate HTML from processed frames
   */
  async generateHTML(frames, options) {
    const { framework, includeInteractions, outputFormat } = options;

    let html = '';

    if (framework === 'react') {
      return this.generateReactComponents(frames, options);
    } else if (framework === 'vue') {
      return this.generateVueComponents(frames, options);
    }

    // Generate vanilla HTML
    html += this.generateHTMLHead();
    html += '<body>\n';

    for (const frame of frames) {
      html += this.generateFrameHTML(frame, 1);
    }

    if (includeInteractions) {
      html += this.generateJavaScript(frames);
    }

    html += '</body>\n</html>';

    return html;
  }

  /**
   * Generate frame-specific CSS
   */
  generateFrameCSS(frame, responsive = true) {
    let css = '';

    // Frame container styles
    const frameClass = `.${frame.name}-container`;
    css += `${frameClass} {\n`;
    css += `  width: ${frame.bounds.width}px;\n`;
    css += `  height: ${frame.bounds.height}px;\n`;
    css += `  position: relative;\n`;
    css += `  margin: 0 auto;\n`;
    
    if (frame.styles.backgroundColor) {
      css += `  background-color: ${frame.styles.backgroundColor};\n`;
    }
    
    css += '}\n\n';

    // Generate CSS for all elements
    css += this.generateElementsCSS(frame.elements, frame.name);

    return css;
  }

  /**
   * Generate CSS for elements
   */
  generateElementsCSS(elements, parentClass, level = 0) {
    let css = '';

    for (const element of elements) {
      const elementClass = `.${parentClass} .${element.cssClasses[0]}`;
      
      css += `${elementClass} {\n`;
      
      // Position and dimensions
      css += `  position: absolute;\n`;
      css += `  left: ${element.bounds.x}px;\n`;
      css += `  top: ${element.bounds.y}px;\n`;
      css += `  width: ${element.bounds.width}px;\n`;
      css += `  height: ${element.bounds.height}px;\n`;

      // Apply extracted styles
      for (const [property, value] of Object.entries(element.styles)) {
        css += `  ${this.convertToCSSProperty(property)}: ${value};\n`;
      }

      // Type-specific styles
      if (element.type === 'TEXT' && element.typography) {
        for (const [prop, val] of Object.entries(element.typography)) {
          css += `  ${this.convertToCSSProperty(prop)}: ${val};\n`;
        }
      }

      css += '}\n\n';

      // Generate CSS for children
      if (element.children && element.children.length > 0) {
        css += this.generateElementsCSS(element.children, parentClass, level + 1);
      }
    }

    return css;
  }

  /**
   * Generate HTML for frame
   */
  generateFrameHTML(frame, indent = 0) {
    const spaces = '  '.repeat(indent);
    let html = '';

    html += `${spaces}<div class="${frame.name}-container">\n`;
    html += this.generateElementsHTML(frame.elements, indent + 1);
    html += `${spaces}</div>\n`;

    return html;
  }

  /**
   * Generate HTML for elements
   */
  generateElementsHTML(elements, indent = 0) {
    const spaces = '  '.repeat(indent);
    let html = '';

    for (const element of elements) {
      const tag = element.htmlTag;
      const classes = element.cssClasses.join(' ');

      if (element.type === 'TEXT') {
        html += `${spaces}<${tag} class="${classes}">${element.content || ''}</${tag}>\n`;
      } else if (element.images && element.images.length > 0) {
        const img = element.images[0];
        html += `${spaces}<img class="${classes}" src="${img.url}" alt="${element.name}" />\n`;
      } else {
        html += `${spaces}<${tag} class="${classes}">`;
        
        if (element.children && element.children.length > 0) {
          html += '\n';
          html += this.generateElementsHTML(element.children, indent + 1);
          html += `${spaces}`;
        }
        
        html += `</${tag}>\n`;
      }
    }

    return html;
  }

  /**
   * Generate React components
   */
  generateReactComponents(frames, options) {
    let components = {};

    for (const frame of frames) {
      const componentName = this.toPascalCase(frame.name);
      
      let jsx = `import React from 'react';\n`;
      jsx += `import './${frame.name}.css';\n\n`;
      jsx += `const ${componentName} = () => {\n`;
      jsx += `  return (\n`;
      jsx += `    <div className="${frame.name}-container">\n`;
      jsx += this.generateReactElements(frame.elements, 3);
      jsx += `    </div>\n`;
      jsx += `  );\n`;
      jsx += `};\n\n`;
      jsx += `export default ${componentName};`;

      components[`${componentName}.jsx`] = jsx;
    }

    return components;
  }

  /**
   * Generate Vue components
   */
  generateVueComponents(frames, options) {
    let components = {};

    for (const frame of frames) {
      const componentName = this.toPascalCase(frame.name);
      
      let vue = `<template>\n`;
      vue += `  <div class="${frame.name}-container">\n`;
      vue += this.generateVueElements(frame.elements, 2);
      vue += `  </div>\n`;
      vue += `</template>\n\n`;
      
      vue += `<script>\n`;
      vue += `export default {\n`;
      vue += `  name: '${componentName}',\n`;
      vue += `  data() {\n`;
      vue += `    return {\n`;
      vue += `      // Component data here\n`;
      vue += `    };\n`;
      vue += `  }\n`;
      vue += `};\n`;
      vue += `</script>\n\n`;
      
      vue += `<style scoped>\n`;
      vue += `@import './${frame.name}.css';\n`;
      vue += `</style>`;

      components[`${componentName}.vue`] = vue;
    }

    return components;
  }

  /**
   * Generate Vue template elements
   */
  generateVueElements(elements, indent) {
    const spaces = '  '.repeat(indent);
    let template = '';

    for (const element of elements) {
      const tag = element.htmlTag;
      const classes = element.cssClasses.join(' ');

      if (element.type === 'TEXT') {
        template += `${spaces}<${tag} class="${classes}">${element.content || ''}</${tag}>\n`;
      } else {
        template += `${spaces}<${tag} class="${classes}">`;
        
        if (element.children && element.children.length > 0) {
          template += '\n';
          template += this.generateVueElements(element.children, indent + 1);
          template += `${spaces}`;
        }
        
        template += `</${tag}>\n`;
      }
    }

    return template;
  }

  /**
   * Helper methods
   */
  sanitizeName(name) {
    return name.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Extract color value from Figma style
   */
  extractColorValue(style) {
    if (!style.fills || !style.fills[0]) {
      return '#000000';
    }

    const fill = style.fills[0];
    if (fill.type === 'SOLID') {
      const r = Math.round(fill.color.r * 255);
      const g = Math.round(fill.color.g * 255);
      const b = Math.round(fill.color.b * 255);
      const a = fill.opacity || 1;
      
      if (a < 1) {
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      } else {
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      }
    }
    
    return '#000000';
  }

  /**
   * Extract typography value from Figma style
   */
  extractTypographyValue(style) {
    if (!style.description) {
      return {};
    }

    // Parse typography properties from style description
    // This is a simplified implementation
    return {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      lineHeight: '1.5'
    };
  }

  /**
   * Process node for extracting additional design tokens
   */
  processNodeForTokens(node, tokens) {
    if (!node) return;

    // Extract spacing values
    if (node.paddingLeft !== undefined) {
      tokens.spacing.set('padding-left', `${node.paddingLeft}px`);
    }
    if (node.paddingRight !== undefined) {
      tokens.spacing.set('padding-right', `${node.paddingRight}px`);
    }
    if (node.paddingTop !== undefined) {
      tokens.spacing.set('padding-top', `${node.paddingTop}px`);
    }
    if (node.paddingBottom !== undefined) {
      tokens.spacing.set('padding-bottom', `${node.paddingBottom}px`);
    }

    // Recursively process children
    if (node.children) {
      for (const child of node.children) {
        this.processNodeForTokens(child, tokens);
      }
    }
  }

  determineHTMLTag(element) {
    switch (element.type) {
      case 'TEXT':
        if (element.name.toLowerCase().includes('heading') || 
            element.name.toLowerCase().includes('title')) {
          return 'h2';
        }
        return 'p';
      case 'RECTANGLE':
      case 'FRAME':
        if (element.name.toLowerCase().includes('button')) {
          return 'button';
        }
        return 'div';
      default:
        return 'div';
    }
  }

  generateCSSClasses(element) {
    const baseClass = this.sanitizeName(element.name);
    const classes = [baseClass];
    
    // Add type-based classes
    classes.push(`element-${element.type.toLowerCase()}`);
    
    return classes;
  }

  extractNodeStyles(node) {
    const styles = {};

    // Background
    if (node.fills && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        styles.backgroundColor = this.rgbToHex(fill.color);
      }
    }

    // Border
    if (node.strokes && node.strokes.length > 0) {
      const stroke = node.strokes[0];
      if (stroke.color) {
        styles.borderColor = this.rgbToHex(stroke.color);
        styles.borderWidth = `${node.strokeWeight || 1}px`;
        styles.borderStyle = 'solid';
      }
    }

    // Border radius
    if (node.cornerRadius) {
      styles.borderRadius = `${node.cornerRadius}px`;
    }

    // Opacity
    if (node.opacity !== undefined && node.opacity !== 1) {
      styles.opacity = node.opacity;
    }

    return styles;
  }

  extractTypographyStyles(textNode) {
    const typography = {};

    if (textNode.style) {
      const style = textNode.style;
      
      if (style.fontFamily) typography.fontFamily = `"${style.fontFamily}"`;
      if (style.fontSize) typography.fontSize = `${style.fontSize}px`;
      if (style.fontWeight) typography.fontWeight = style.fontWeight;
      if (style.lineHeightPx) typography.lineHeight = `${style.lineHeightPx}px`;
      if (style.letterSpacing) typography.letterSpacing = `${style.letterSpacing}px`;
      if (style.textAlignHorizontal) {
        typography.textAlign = style.textAlignHorizontal.toLowerCase();
      }
    }

    return typography;
  }

  /**
   * Extract shape-specific styles from Figma elements
   */
  extractShapeStyles(element) {
    const shapeStyles = {};

    // Extract shape-specific properties
    if (element.type === 'RECTANGLE') {
      if (element.cornerRadius) {
        shapeStyles.borderRadius = `${element.cornerRadius}px`;
      }
      if (element.rectangleCornerRadii) {
        const [tl, tr, br, bl] = element.rectangleCornerRadii;
        if (tl === tr && tr === br && br === bl) {
          shapeStyles.borderRadius = `${tl}px`;
        } else {
          shapeStyles.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
        }
      }
    }

    if (element.type === 'ELLIPSE') {
      shapeStyles.borderRadius = '50%';
    }

    if (element.type === 'POLYGON') {
      // For polygons, we might need to use clip-path
      shapeStyles.clipPath = this.generatePolygonClipPath(element);
    }

    // Extract fill styles
    if (element.fills && element.fills.length > 0) {
      const fill = element.fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        shapeStyles.backgroundColor = this.rgbToHex(fill.color);
        if (fill.opacity !== undefined && fill.opacity !== 1) {
          shapeStyles.opacity = fill.opacity;
        }
      } else if (fill.type === 'GRADIENT_LINEAR') {
        shapeStyles.background = this.generateLinearGradient(fill);
      } else if (fill.type === 'GRADIENT_RADIAL') {
        shapeStyles.background = this.generateRadialGradient(fill);
      }
    }

    // Extract stroke styles
    if (element.strokes && element.strokes.length > 0) {
      const stroke = element.strokes[0];
      if (stroke.color) {
        shapeStyles.borderColor = this.rgbToHex(stroke.color);
        shapeStyles.borderWidth = `${element.strokeWeight || 1}px`;
        shapeStyles.borderStyle = 'solid';
      }
    }

    // Extract effects (shadows, blurs)
    if (element.effects && element.effects.length > 0) {
      shapeStyles.boxShadow = this.generateBoxShadow(element.effects);
    }

    return shapeStyles;
  }

  /**
   * Generate clip-path for polygon shapes
   */
  generatePolygonClipPath(element) {
    // This is a simplified implementation
    // In practice, you'd need to parse the actual polygon vertices
    return 'polygon(50% 0%, 0% 100%, 100% 100%)';
  }

  /**
   * Generate linear gradient CSS
   */
  generateLinearGradient(fill) {
    if (!fill.gradientStops || fill.gradientStops.length === 0) {
      return '#000000';
    }

    const angle = this.calculateGradientAngle(fill.gradientTransform);
    const stops = fill.gradientStops.map(stop => {
      const color = this.rgbToHex(stop.color);
      const position = Math.round(stop.position * 100);
      return `${color} ${position}%`;
    }).join(', ');

    return `linear-gradient(${angle}deg, ${stops})`;
  }

  /**
   * Generate radial gradient CSS
   */
  generateRadialGradient(fill) {
    if (!fill.gradientStops || fill.gradientStops.length === 0) {
      return '#000000';
    }

    const stops = fill.gradientStops.map(stop => {
      const color = this.rgbToHex(stop.color);
      const position = Math.round(stop.position * 100);
      return `${color} ${position}%`;
    }).join(', ');

    return `radial-gradient(circle, ${stops})`;
  }

  /**
   * Calculate gradient angle from transform matrix
   */
  calculateGradientAngle(transform) {
    if (!transform || transform.length < 4) {
      return 0;
    }
    // Simplified angle calculation
    return Math.round(Math.atan2(transform[1], transform[0]) * 180 / Math.PI);
  }

  /**
   * Generate box-shadow CSS from effects
   */
  generateBoxShadow(effects) {
    const shadows = effects
      .filter(effect => effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW')
      .map(effect => {
        const x = effect.offset?.x || 0;
        const y = effect.offset?.y || 0;
        const blur = effect.radius || 0;
        const spread = effect.spread || 0;
        const color = effect.color ? this.rgbToHex(effect.color) : '#000000';
        const inset = effect.type === 'INNER_SHADOW' ? 'inset ' : '';
        
        return `${inset}${x}px ${y}px ${blur}px ${spread}px ${color}`;
      });

    return shadows.length > 0 ? shadows.join(', ') : 'none';
  }

  /**
   * Generate assets (images, icons) from processed frames
   */
  async generateAssets(processedFrames) {
    const assets = {
      images: [],
      icons: [],
      fonts: [],
      totalSize: 0
    };

    for (const frame of processedFrames) {
      await this.extractAssetsFromFrame(frame, assets);
    }

    return assets;
  }

  /**
   * Extract assets from a single frame
   */
  async extractAssetsFromFrame(frame, assets) {
    // Extract assets from frame elements recursively
    if (frame.elements) {
      for (const element of frame.elements) {
        await this.extractAssetsFromElement(element, assets);
      }
    }
  }

  /**
   * Extract assets from a single element
   */
  async extractAssetsFromElement(element, assets) {
    // Check for image fills
    if (element.fills) {
      for (const fill of element.fills) {
        if (fill.type === 'IMAGE' && fill.imageRef) {
          const imageAsset = {
            id: fill.imageRef,
            type: 'image',
            url: `https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/${fill.imageRef}`,
            name: `${element.name}-image`,
            format: 'png'
          };
          assets.images.push(imageAsset);
        }
      }
    }

    // Check for vector/icon elements
    if (element.type === 'VECTOR' || (element.type === 'FRAME' && element.name.toLowerCase().includes('icon'))) {
      const iconAsset = {
        id: element.id,
        type: 'icon',
        name: element.name,
        format: 'svg'
      };
      assets.icons.push(iconAsset);
    }

    // Recursively process children
    if (element.children) {
      for (const child of element.children) {
        await this.extractAssetsFromElement(child, assets);
      }
    }
  }

  rgbToHex(color) {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  convertToCSSProperty(property) {
    return property.replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  toPascalCase(str) {
    return str.replace(/(^\w|-\w)/g, clearAndUpper);
    function clearAndUpper(text) {
      return text.replace(/-/, "").toUpperCase();
    }
  }

  generateCSSReset() {
    return `/* CSS Reset */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
}`;
  }

  generateCSSVariables(designTokens) {
    let css = ':root {\n';
    
    for (const [varName, value] of this.cssVariables) {
      css += `  ${varName}: ${value};\n`;
    }
    
    css += '}';
    return css;
  }

  generateHTMLHead() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated from Figma</title>
  <link rel="stylesheet" href="styles.css">
</head>
`;
  }

  analyzeLayout(node) {
    // Analyze if the layout uses flexbox, grid, or absolute positioning
    return {
      type: 'absolute', // Default for Figma designs
      direction: 'column',
      wrap: false,
      justifyContent: 'flex-start',
      alignItems: 'flex-start'
    };
  }

  generateResponsiveBreakpoints(frame) {
    return {
      mobile: { maxWidth: 768, scale: 0.8 },
      tablet: { maxWidth: 1024, scale: 0.9 },
      desktop: { minWidth: 1025, scale: 1 }
    };
  }

  async extractImages(element) {
    // This would fetch actual images from Figma
    // For now, return placeholder
    return null;
  }

  processComponent(element) {
    return {
      componentId: element.componentId,
      isInstance: element.type === 'INSTANCE',
      mainComponent: element.mainComponent
    };
  }

  generateResponsiveCSS(frames) {
    let css = '';
    
    css += `
/* Responsive Design */
@media (max-width: 768px) {
  .frame-container {
    width: 100% !important;
    padding: 16px;
  }
  
  .element-text {
    font-size: 14px !important;
  }
}

@media (max-width: 480px) {
  .frame-container {
    padding: 12px;
  }
  
  .element-text {
    font-size: 12px !important;
  }
}`;

    return css;
  }

  generateJavaScript(frames) {
    return `
<script>
// Add any interactive functionality here
document.addEventListener('DOMContentLoaded', function() {
  console.log('Generated from Figma - Ready for interactions!');
});
</script>
`;
  }

  adaptForTailwind(css) {
    // Convert CSS to Tailwind utility classes
    // This is a complex transformation that would require detailed mapping
    return css;
  }

  adaptForBootstrap(css) {
    // Adapt CSS to work with Bootstrap
    return css;
  }

  generateReactElements(elements, indent) {
    const spaces = '  '.repeat(indent);
    let jsx = '';

    for (const element of elements) {
      const tag = element.htmlTag;
      const classes = element.cssClasses.join(' ');

      if (element.type === 'TEXT') {
        jsx += `${spaces}<${tag} className="${classes}">${element.content || ''}</${tag}>\n`;
      } else {
        jsx += `${spaces}<${tag} className="${classes}">`;
        
        if (element.children && element.children.length > 0) {
          jsx += '\n';
          jsx += this.generateReactElements(element.children, indent + 1);
          jsx += `${spaces}`;
        }
        
        jsx += `</${tag}>\n`;
      }
    }

    return jsx;
  }
}

module.exports = FigmaHTMLGenerator;
