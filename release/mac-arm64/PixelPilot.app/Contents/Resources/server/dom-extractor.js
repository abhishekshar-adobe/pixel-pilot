/**
 * DOM Data Extractor for Design-to-Code Comparison
 * Extracts CSS properties and layout data from live DOM elements during BackstopJS runs
 */

/**
 * Extract comprehensive style data from DOM elements
 * This function runs in the browser context during BackstopJS tests
 */
function extractDOMData(selectors = []) {
  const results = {};
  
  // If no selectors provided, find common UI elements
  if (selectors.length === 0) {
    selectors = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'span', 'div', 'button', 'a',
      '.header', '.footer', '.nav', '.sidebar',
      '[class*="title"]', '[class*="button"]', '[class*="text"]'
    ];
  }
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    
    if (elements.length > 0) {
      results[selector] = Array.from(elements).map((element, index) => {
        const computedStyle = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        return {
          elementId: element.id || `${selector}-${index}`,
          className: element.className ? element.className.toString() : '',
          tagName: element.tagName.toLowerCase(),
          
          // Typography
          fontFamily: computedStyle.fontFamily,
          fontSize: computedStyle.fontSize,
          fontWeight: computedStyle.fontWeight,
          lineHeight: computedStyle.lineHeight,
          letterSpacing: computedStyle.letterSpacing,
          textAlign: computedStyle.textAlign,
          
          // Colors
          color: computedStyle.color,
          backgroundColor: computedStyle.backgroundColor,
          borderColor: computedStyle.borderColor,
          
          // Layout & Spacing
          width: rect.width,
          height: rect.height,
          margin: {
            top: computedStyle.marginTop,
            right: computedStyle.marginRight,
            bottom: computedStyle.marginBottom,
            left: computedStyle.marginLeft
          },
          padding: {
            top: computedStyle.paddingTop,
            right: computedStyle.paddingRight,
            bottom: computedStyle.paddingBottom,
            left: computedStyle.paddingLeft
          },
          
          // Border
          borderWidth: computedStyle.borderWidth,
          borderStyle: computedStyle.borderStyle,
          borderRadius: computedStyle.borderRadius,
          
          // Position
          position: computedStyle.position,
          top: computedStyle.top,
          left: computedStyle.left,
          zIndex: computedStyle.zIndex,
          
          // Additional properties
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity,
          
          // Text content (first 100 chars for identification)
          textContent: element.textContent?.trim().substring(0, 100) || '',
          
          // Viewport position
          boundingRect: {
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            x: rect.x,
            y: rect.y
          }
        };
      });
    }
  });
  
  return {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    elements: results,
    totalElements: Object.values(results).reduce((sum, arr) => sum + arr.length, 0)
  };
}

/**
 * Color utility functions for comparison
 */
function normalizeColor(color) {
  // Convert rgb/rgba to hex for consistent comparison
  if (color.startsWith('rgb')) {
    const values = color.match(/\d+/g);
    if (values) {
      const [r, g, b] = values.map(Number);
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }
  }
  return color;
}

/**
 * Convert px values to numbers for comparison
 */
function pxToNumber(value) {
  if (typeof value === 'string' && value.endsWith('px')) {
    return parseFloat(value);
  }
  return value;
}

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractDOMData,
    normalizeColor,
    pxToNumber
  };
}
