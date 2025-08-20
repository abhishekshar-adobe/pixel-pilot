/**
 * Figma API Integration for Design Specs
 * Fetches design tokens and component specifications from Figma
 */

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class FigmaAPIClient {
  constructor(options) {
    // Handle both object and individual parameters for backward compatibility
    if (typeof options === 'string') {
      // Legacy: constructor(accessToken, fileKey)
      this.accessToken = options;
      this.fileKey = arguments[1];
    } else {
      // New: constructor({accessToken, fileKey})
      this.accessToken = options.accessToken;
      this.fileKey = options.fileKey;
    }
    
    this.baseURL = 'https://api.figma.com/v1';
    this.axios = axios.create({
      baseURL: this.baseURL,
      headers: {
        'X-Figma-Token': this.accessToken
      }
    });
  }

  /**
   * Fetch file data from Figma
   */
  async getFile() {
    try {
      const response = await this.axios.get(`/files/${this.fileKey}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching Figma file:', error.message);
      throw error;
    }
  }

  /**
   * Get main layers from Figma file with refined filtering strategy
   * 
   * REFINED FILTERING STRATEGY:
   * ✅ Type: Only FRAME, COMPONENT, INSTANCE layers
   * ✅ Parent: Only direct children of a Page (Canvas) 
   * ✅ Visibility: Skip layers with "visible": false (configurable)
   * ✅ Size: Ignore layers smaller than specified dimensions (default: 100x100px)
   * 
   * This filtering dramatically reduces the number of layers from potentially 
   * thousands to a manageable set of main design elements suitable for 
   * screenshot comparison and design review.
   * 
   * @param {Object} options - Filtering options
   * @param {string} options.pageId - Specific page ID to filter by (optional)
   * @param {number} options.minWidth - Minimum width in pixels (default: 100)
   * @param {number} options.minHeight - Minimum height in pixels (default: 100) 
   * @param {boolean} options.includeInvisible - Include invisible layers (default: false)
   * @param {string[]} options.includeTypes - Layer types to include (default: ['FRAME', 'COMPONENT', 'INSTANCE'])
   * @returns {Promise<Array>} Filtered array of main layers
   */
  async getMainLayersList(options = {}) {
    try {
      const fileData = await this.getFile();
      const mainLayers = [];
      
      const {
        pageId = null,
        minWidth = 100,
        minHeight = 100,
        includeInvisible = false,
        includeTypes = ['FRAME', 'COMPONENT', 'INSTANCE']
      } = options;

      console.log('🔍 Filtering main layers with options:', { pageId, minWidth, minHeight, includeInvisible, includeTypes });

      // Process each page (Canvas) in the document
      if (fileData.document && fileData.document.children) {
        fileData.document.children.forEach(page => {
          if (page.type === 'CANVAS') {
            // If pageId is specified, only process that specific page
            if (pageId && page.id !== pageId) {
              console.log(`⏭️ Skipping page "${page.name}" (${page.id}) - not matching ${pageId}`);
              return;
            }
            
            console.log(`📄 Processing page "${page.name}" (${page.id}), children: ${page.children ? page.children.length : 0}`);
            
            if (page.children) {
              // Process direct children of the page (Canvas)
              page.children.forEach(child => {
                console.log(`🔍 Checking layer "${child.name}" (${child.type}), bounds:`, child.absoluteBoundingBox);
                
                // Apply filtering criteria
                const shouldInclude = (
                  // Type filter: Only FRAME, COMPONENT, INSTANCE
                  includeTypes.includes(child.type) &&
                  
                  // Visibility filter: Skip invisible layers unless explicitly included
                  (includeInvisible || child.visible !== false) &&
                  
                  // Size filter: Ignore layers that are too small
                  child.absoluteBoundingBox &&
                  child.absoluteBoundingBox.width >= minWidth &&
                  child.absoluteBoundingBox.height >= minHeight
                );

                console.log(`🎯 Layer "${child.name}" - Include: ${shouldInclude}, Type: ${child.type}, Visible: ${child.visible !== false}, Size: ${child.absoluteBoundingBox ? `${child.absoluteBoundingBox.width}x${child.absoluteBoundingBox.height}` : 'no bounds'}`);

                if (shouldInclude) {
                  const layer = {
                    id: child.id,
                    name: child.name,
                    type: child.type,
                    pageName: page.name,
                    path: `${page.name} > ${child.name}`,
                    depth: 1, // Direct child of page
                    visible: child.visible !== false,
                    locked: child.locked === true,
                    hasChildren: child.children && child.children.length > 0,
                    bounds: child.absoluteBoundingBox,
                    // Extract width and height from bounds for easy access
                    width: child.absoluteBoundingBox ? child.absoluteBoundingBox.width : 0,
                    height: child.absoluteBoundingBox ? child.absoluteBoundingBox.height : 0,
                    // Add styling information if available
                    fills: child.fills,
                    strokes: child.strokes,
                    effects: child.effects,
                    cornerRadius: child.cornerRadius,
                    opacity: child.opacity,
                    // Text-specific properties
                    characters: child.characters,
                    style: child.style,
                    // Component properties
                    componentId: child.componentId,
                    componentSetId: child.componentSetId,
                    // Additional metadata
                    isMainLayer: true,
                    filterCriteria: {
                      meetsTypeFilter: includeTypes.includes(child.type),
                      meetsVisibilityFilter: includeInvisible || child.visible !== false,
                      meetsSizeFilter: child.absoluteBoundingBox && 
                                     child.absoluteBoundingBox.width >= minWidth && 
                                     child.absoluteBoundingBox.height >= minHeight
                    }
                  };

                  mainLayers.push(layer);
                }
              });
            }
          }
        });
      }

      console.log(`Found ${mainLayers.length} main layers matching criteria:`, {
        minWidth,
        minHeight,
        includeInvisible,
        includeTypes
      });

      return mainLayers;
    } catch (error) {
      console.error('Error fetching Figma main layers:', error.message);
      throw error;
    }
  }

  /**
   * Get all layers from Figma file with hierarchical structure
   * @param {string} pageId - Optional page ID to filter by
   */
  async getLayersList(pageId = null) {
    try {
      const fileData = await this.getFile();
      const layers = [];

      console.log('🔍 Getting all layers, pageId filter:', pageId);

      const traverseNodes = (node, path = [], depth = 0, pageName = '') => {
        if (!node) return;

        // Create layer entry
        const layer = {
          id: node.id,
          name: node.name,
          type: node.type,
          path: path.join(' > '),
          depth,
          visible: node.visible !== false,
          locked: node.locked === true,
          hasChildren: node.children && node.children.length > 0,
          bounds: node.absoluteBoundingBox,
          pageName: pageName,
          // Extract width and height from bounds for easy access
          width: node.absoluteBoundingBox ? node.absoluteBoundingBox.width : 0,
          height: node.absoluteBoundingBox ? node.absoluteBoundingBox.height : 0,
          // Add styling information if available
          fills: node.fills,
          strokes: node.strokes,
          effects: node.effects,
          cornerRadius: node.cornerRadius,
          opacity: node.opacity,
          // Text-specific properties
          characters: node.characters,
          style: node.style,
          // Component properties
          componentId: node.componentId,
          componentSetId: node.componentSetId
        };

        layers.push(layer);

        // Recursively process children
        if (node.children) {
          node.children.forEach(child => {
            traverseNodes(child, [...path, node.name], depth + 1, pageName);
          });
        }
      };

      // Start traversing from the document root
      if (fileData.document && fileData.document.children) {
        fileData.document.children.forEach(page => {
          // If pageId is specified, only process that specific page
          if (pageId && page.id !== pageId) {
            console.log(`⏭️ Skipping page "${page.name}" (${page.id}) - not matching ${pageId}`);
            return;
          }
          
          console.log(`📄 Processing all layers in page "${page.name}" (${page.id})`);
          traverseNodes(page, [], 0, page.name);
        });
      }

      console.log(`✅ Found ${layers.length} total layers` + (pageId ? ` for page ${pageId}` : ''));
      return layers;
    } catch (error) {
      console.error('Error fetching Figma layers:', error.message);
      throw error;
    }
  }

  /**
   * Check if a layer meets the main layer criteria
   */
  isMainLayer(layer, options = {}) {
    const {
      minWidth = 100,
      minHeight = 100,
      includeInvisible = false,
      includeTypes = ['FRAME', 'COMPONENT', 'INSTANCE']
    } = options;

    return (
      // Type filter: Only specified types
      includeTypes.includes(layer.type) &&
      
      // Visibility filter: Skip invisible layers unless explicitly included
      (includeInvisible || layer.visible !== false) &&
      
      // Size filter: Ignore layers that are too small
      layer.absoluteBoundingBox &&
      layer.absoluteBoundingBox.width >= minWidth &&
      layer.absoluteBoundingBox.height >= minHeight
    );
  }

  /**
   * Get layer statistics for debugging and optimization
   */
  getLayerStats(layers) {
    const stats = {
      total: layers.length,
      byType: {},
      byVisibility: { visible: 0, hidden: 0 },
      bySize: { 
        tooSmall: 0, 
        small: 0, 
        medium: 0, 
        large: 0,
        xlarge: 0 
      },
      averageSize: { width: 0, height: 0 }
    };

    let totalWidth = 0, totalHeight = 0;

    layers.forEach(layer => {
      // Count by type
      stats.byType[layer.type] = (stats.byType[layer.type] || 0) + 1;
      
      // Count by visibility
      if (layer.visible !== false) {
        stats.byVisibility.visible++;
      } else {
        stats.byVisibility.hidden++;
      }
      
      // Count by size categories
      const width = layer.width || 0;
      const height = layer.height || 0;
      const area = width * height;
      
      totalWidth += width;
      totalHeight += height;
      
      if (width < 100 || height < 100) {
        stats.bySize.tooSmall++;
      } else if (area < 50000) { // < 224x224 approx
        stats.bySize.small++;
      } else if (area < 200000) { // < 447x447 approx
        stats.bySize.medium++;
      } else if (area < 500000) { // < 707x707 approx
        stats.bySize.large++;
      } else {
        stats.bySize.xlarge++;
      }
    });

    if (layers.length > 0) {
      stats.averageSize.width = Math.round(totalWidth / layers.length);
      stats.averageSize.height = Math.round(totalHeight / layers.length);
    }

    return stats;
  }

  /**
   * Get specific layer details by ID
   */
  async getLayerDetails(layerId) {
    try {
      const fileData = await this.getFile();
      
      const findNode = (node) => {
        if (node.id === layerId) {
          return node;
        }
        if (node.children) {
          for (const child of node.children) {
            const found = findNode(child);
            if (found) return found;
          }
        }
        return null;
      };

      const layer = findNode(fileData.document);
      if (!layer) {
        throw new Error(`Layer with ID ${layerId} not found`);
      }

      return {
        id: layer.id,
        name: layer.name,
        type: layer.type,
        bounds: layer.absoluteBoundingBox,
        // Extract width and height from bounds for easy access
        width: layer.absoluteBoundingBox ? layer.absoluteBoundingBox.width : 0,
        height: layer.absoluteBoundingBox ? layer.absoluteBoundingBox.height : 0,
        fills: layer.fills,
        strokes: layer.strokes,
        effects: layer.effects,
        cornerRadius: layer.cornerRadius,
        opacity: layer.opacity,
        characters: layer.characters,
        style: layer.style,
        componentId: layer.componentId,
        children: layer.children ? layer.children.map(child => ({
          id: child.id,
          name: child.name,
          type: child.type
        })) : []
      };
    } catch (error) {
      console.error('Error fetching layer details:', error.message);
      throw error;
    }
  }

  /**
   * Export layers as images
   */
  async exportLayers(layerIds, options = {}) {
    try {
      const {
        format = 'jpg',
        scale = 1,
        useAbsoluteBounds = false
      } = options;

      const images = await this.getImages(layerIds, format, scale);
      
      // Download and save images locally
      const exportedLayers = [];
      
      for (const [layerId, imageUrl] of Object.entries(images.images || {})) {
        if (imageUrl) {
          try {
            // Download the image with proper handling
            const imageResponse = await axios.get(imageUrl, {
              responseType: 'arraybuffer',
              timeout: 30000
            });
            
            // Properly convert ArrayBuffer to Buffer and then to base64
            const imageBuffer = Buffer.from(imageResponse.data);
            const base64Image = imageBuffer.toString('base64');
            const dataUrl = `data:image/${format};base64,${base64Image}`;
            
            exportedLayers.push({
              layerId,
              url: imageUrl, // Original Figma URL for direct download
              imageUrl, // Keep for backward compatibility
              dataUrl,
              format,
              scale,
              filename: `layer-${layerId}.${format}`,
              buffer: imageBuffer // Include buffer for server-side processing
            });
          } catch (downloadError) {
            console.error(`Error downloading image for layer ${layerId}:`, downloadError.message);
            exportedLayers.push({
              layerId,
              imageUrl,
              format,
              scale,
              error: 'Failed to download image'
            });
          }
        }
      }

      return exportedLayers;
    } catch (error) {
      console.error('Error exporting layers:', error.message);
      throw error;
    }
  }

  /**
   * Filter layers by type
   */
  filterLayersByType(layers, types) {
    return layers.filter(layer => types.includes(layer.type));
  }

  /**
   * Search layers by name
   */
  searchLayers(layers, searchTerm) {
    const term = searchTerm.toLowerCase();
    return layers.filter(layer => 
      layer.name.toLowerCase().includes(term) ||
      layer.path.toLowerCase().includes(term)
    );
  }

  /**
   * Extract design tokens from Figma file
   */
  async extractDesignTokens() {
    const fileData = await this.getFile();
    const tokens = {
      colors: {},
      typography: {},
      spacing: {},
      components: []
    };

    // Recursively traverse the Figma node tree
    const traverseNodes = (node, path = []) => {
      if (!node) return;

      // Extract text styles
      if (node.type === 'TEXT') {
        const textStyle = {
          name: node.name,
          path: path.join(' > '),
          fontFamily: node.style?.fontFamily,
          fontSize: node.style?.fontSize,
          fontWeight: node.style?.fontWeight,
          lineHeight: node.style?.lineHeightPx,
          letterSpacing: node.style?.letterSpacing,
          textAlign: node.style?.textAlignHorizontal?.toLowerCase(),
          color: this.figmaColorToHex(node.fills?.[0]?.color),
          bounds: node.absoluteBoundingBox,
          // Extract width and height from bounds for easy access
          width: node.absoluteBoundingBox ? node.absoluteBoundingBox.width : 0,
          height: node.absoluteBoundingBox ? node.absoluteBoundingBox.height : 0
        };
        
        tokens.typography[node.id] = textStyle;
      }

      // Extract component styles
      if (node.type === 'COMPONENT' || node.type === 'INSTANCE') {
        const component = {
          id: node.id,
          name: node.name,
          type: node.type,
          path: path.join(' > '),
          bounds: node.absoluteBoundingBox,
          // Extract width and height from bounds for easy access
          width: node.absoluteBoundingBox ? node.absoluteBoundingBox.width : 0,
          height: node.absoluteBoundingBox ? node.absoluteBoundingBox.height : 0,
          backgroundColor: this.figmaColorToHex(node.fills?.[0]?.color),
          borderRadius: node.cornerRadius,
          effects: node.effects,
          constraints: node.constraints
        };
        
        tokens.components.push(component);
      }

      // Extract colors from fills
      if (node.fills && Array.isArray(node.fills)) {
        node.fills.forEach((fill, index) => {
          if (fill.type === 'SOLID' && fill.color) {
            const colorKey = `${node.name || node.type}_${node.id}_${index}`;
            tokens.colors[colorKey] = this.figmaColorToHex(fill.color);
          }
        });
      }

      // Extract spacing information from layout properties
      if (node.paddingLeft !== undefined || node.itemSpacing !== undefined) {
        tokens.spacing[node.id] = {
          name: node.name,
          paddingTop: node.paddingTop,
          paddingRight: node.paddingRight,
          paddingBottom: node.paddingBottom,
          paddingLeft: node.paddingLeft,
          itemSpacing: node.itemSpacing
        };
      }

      // Recursively process children
      if (node.children) {
        node.children.forEach(child => {
          traverseNodes(child, [...path, node.name]);
        });
      }
    };

    // Start traversing from the document root
    if (fileData.document) {
      traverseNodes(fileData.document, []);
    }

    return tokens;
  }

  /**
   * Convert Figma color format to hex
   */
  figmaColorToHex(figmaColor) {
    if (!figmaColor) return null;
    
    const { r, g, b, a = 1 } = figmaColor;
    const toHex = (value) => Math.round(value * 255).toString(16).padStart(2, '0');
    
    if (a < 1) {
      // Include alpha for transparent colors
      return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`;
    }
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Get images/exports from Figma
   */
  async getImages(nodeIds, format = 'jpg', scale = 1) {
    try {
      const response = await this.axios.get(`/images/${this.fileKey}`, {
        params: {
          ids: nodeIds.join(','),
          format,
          scale
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching Figma images:', error.message);
      throw error;
    }
  }

  /**
   * Get images with explicit dimensions to ensure consistent resolution
   * This method fetches layer information first to calculate appropriate dimensions,
   * preventing resolution issues that can occur with arbitrary scale values.
   * 
   * BENEFITS:
   * - Prevents excessive image sizes by capping dimensions
   * - Maintains aspect ratio while ensuring consistent quality
   * - Calculates optimal scale based on original layer dimensions
   * - Handles edge cases like very small or very large layers
   * 
   * @param {string[]} nodeIds - Array of Figma node IDs
   * @param {string} format - Image format ('jpg', 'png', 'svg', 'pdf')
   * @param {number} maxDimension - Maximum width or height in pixels (default: 2048)
   * @returns {Promise<Object>} Figma images response with URLs
   */
  async getImagesWithDimensions(nodeIds, format = 'jpg', maxDimension = 2048) {
    try {
      // Validate inputs
      if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
        throw new Error('nodeIds must be a non-empty array');
      }
      
      if (maxDimension < 50 || maxDimension > 8192) {
        throw new Error('maxDimension must be between 50 and 8192 pixels');
      }
      
      console.log(`🎯 Fetching ${nodeIds.length} images with max dimension: ${maxDimension}px`);
      
      // First, get the file data to access layer dimensions
      const fileData = await this.getFile();
      const layerDimensions = {};
      
      // Extract dimensions for requested layers
      const extractLayerDimensions = (node) => {
        if (nodeIds.includes(node.id) && node.absoluteBoundingBox) {
          layerDimensions[node.id] = {
            width: node.absoluteBoundingBox.width,
            height: node.absoluteBoundingBox.height
          };
        }
        
        // Recursively check children
        if (node.children) {
          node.children.forEach(extractLayerDimensions);
        }
      };
      
      // Search through all pages and layers
      if (fileData.document && fileData.document.children) {
        fileData.document.children.forEach(page => {
          if (page.children) {
            page.children.forEach(extractLayerDimensions);
          }
        });
      }
      
      console.log(`📐 Found dimensions for ${Object.keys(layerDimensions).length}/${nodeIds.length} layers`);
      
      // For each layer, determine optimal dimensions
      const imageRequests = nodeIds.map(async (nodeId) => {
        const dimensions = layerDimensions[nodeId];
        let params = {
          ids: nodeId,
          format
        };
        
        if (dimensions) {
          const { width, height } = dimensions;
          
          // Skip layers that are too small (likely decorative elements)
          if (width < 1 || height < 1) {
            console.log(`⚠️ Skipping layer ${nodeId}: too small (${width}x${height})`);
            return { nodeId, error: 'Layer too small' };
          }
          
          const aspectRatio = width / height;
          
          // Calculate dimensions that fit within maxDimension while preserving aspect ratio
          let targetWidth, targetHeight;
          
          if (width > height) {
            // Landscape orientation
            targetWidth = Math.min(width, maxDimension);
            targetHeight = Math.round(targetWidth / aspectRatio);
          } else {
            // Portrait orientation  
            targetHeight = Math.min(height, maxDimension);
            targetWidth = Math.round(targetHeight * aspectRatio);
          }
          
          // Calculate appropriate scale based on desired vs original dimensions
          const scaleX = targetWidth / width;
          const scaleY = targetHeight / height;
          const scale = Math.min(scaleX, scaleY, 4); // Cap at 4x scale to prevent excessive file sizes
          
          // Use minimum scale of 0.1 to ensure readability
          params.scale = Math.max(0.1, Math.min(scale, 4));
          
          console.log(`📏 Layer ${nodeId}: ${width}x${height} -> scale: ${params.scale.toFixed(2)} (target: ${targetWidth}x${targetHeight})`);
        } else {
          // Fallback to reasonable scale if dimensions not found
          // This might happen for text layers or other special elements
          params.scale = Math.min(2, maxDimension / 500); // Reasonable fallback
          console.log(`🔍 Layer ${nodeId}: dimensions not found, using fallback scale: ${params.scale.toFixed(2)}`);
        }
        
        try {
          const response = await this.axios.get(`/images/${this.fileKey}`, { params });
          return { nodeId, response: response.data };
        } catch (error) {
          console.error(`❌ Failed to fetch image for layer ${nodeId}:`, error.message);
          return { nodeId, error: error.message };
        }
      });
      
      // Execute all requests in parallel with error handling
      const results = await Promise.all(imageRequests);
      
      // Combine successful results into single response format
      const combinedImages = {};
      const errors = [];
      
      results.forEach(result => {
        if (result.error) {
          errors.push({ nodeId: result.nodeId, error: result.error });
        } else if (result.response && result.response.images && result.response.images[result.nodeId]) {
          combinedImages[result.nodeId] = result.response.images[result.nodeId];
        } else {
          errors.push({ nodeId: result.nodeId, error: 'No image URL returned' });
        }
      });
      
      console.log(`✅ Successfully fetched ${Object.keys(combinedImages).length}/${nodeIds.length} images`);
      
      if (errors.length > 0) {
        console.warn(`⚠️ ${errors.length} images failed:`, errors);
      }
      
      return {
        images: combinedImages,
        errors: errors.length > 0 ? errors : null,
        err: null
      };
      
    } catch (error) {
      console.error('❌ Error fetching Figma images with dimensions:', error.message);
      throw error;
    }
  }

  /**
   * Cache design tokens to file
   */
  async cacheDesignTokens(filePath) {
    const tokens = await this.extractDesignTokens();
    await fs.writeJson(filePath, tokens, { spaces: 2 });
    console.log(`Design tokens cached to: ${filePath}`);
    return tokens;
  }

  /**
   * Load cached design tokens
   */
  async loadCachedTokens(filePath) {
    if (await fs.pathExists(filePath)) {
      return await fs.readJson(filePath);
    }
    return null;
  }
}

/**
 * Design token comparison utilities
 */
class DesignTokenComparator {
  constructor(tolerance = {}) {
    this.tolerance = {
      fontSize: 2, // px
      spacing: 4, // px
      color: 10, // color difference threshold
      ...tolerance
    };
  }

  /**
   * Compare DOM data with Figma design tokens
   */
  compareWithTokens(domData, figmaTokens) {
    const mismatches = [];

    console.log('🔍 Starting DOM vs Figma comparison...');
    console.log(`📊 DOM elements found: ${Object.keys(domData.elements).length} selectors`);
    console.log(`🎨 Figma tokens - Typography: ${Object.keys(figmaTokens.typography).length}, Components: ${figmaTokens.components.length}`);

    // Compare typography
    Object.entries(domData.elements).forEach(([selector, elements]) => {
      console.log(`🔍 Processing selector: ${selector} (${elements.length} elements)`);
      
      elements.forEach((element, index) => {
        // Add safety check for element structure
        if (!element || typeof element !== 'object') {
          console.log(`⚠️ Skipping invalid element at ${selector}[${index}]`);
          return;
        }

        console.log(`🔍 Element ${index}:`, {
          className: element.className,
          textContent: element.textContent ? element.textContent.substring(0, 50) + '...' : 'no text',
          hasClassName: !!element.className,
          classNameType: typeof element.className
        });

        // Find matching Figma components/text by name or position
        const matchingFigmaElements = this.findMatchingFigmaElements(
          element, 
          figmaTokens
        );

        console.log(`🎯 Found ${matchingFigmaElements.length} matching Figma elements for selector ${selector}[${index}]`);

        matchingFigmaElements.forEach(figmaElement => {
          const elementMismatches = this.compareElement(element, figmaElement);
          if (elementMismatches.length > 0) {
            console.log(`📍 Found ${elementMismatches.length} mismatches between DOM element and Figma element "${figmaElement.name}"`);
            mismatches.push({
              selector,
              elementIndex: index,
              elementId: element.elementId,
              figmaElementId: figmaElement.id,
              figmaElementName: figmaElement.name,
              mismatches: elementMismatches
            });
          }
        });
      });
    });

    console.log(`✅ Comparison completed. Total mismatches found: ${mismatches.length}`);

    return {
      totalMismatches: mismatches.length,
      mismatches,
      summary: this.generateSummary(mismatches)
    };
  }

  /**
   * Find matching Figma elements based on name, position, or content
   */
  findMatchingFigmaElements(domElement, figmaTokens) {
    const matches = [];

    try {
      // Check typography matches
      if (figmaTokens.typography && typeof figmaTokens.typography === 'object') {
        Object.values(figmaTokens.typography).forEach(figmaText => {
          try {
            if (this.isElementMatch(domElement, figmaText)) {
              matches.push({ ...figmaText, type: 'text' });
            }
          } catch (error) {
            console.log(`⚠️ Error matching typography element:`, error.message);
          }
        });
      }

      // Check component matches
      if (figmaTokens.components && Array.isArray(figmaTokens.components)) {
        figmaTokens.components.forEach(figmaComponent => {
          try {
            if (this.isElementMatch(domElement, figmaComponent)) {
              matches.push({ ...figmaComponent, type: 'component' });
            }
          } catch (error) {
            console.log(`⚠️ Error matching component element:`, error.message);
          }
        });
      }
    } catch (error) {
      console.error(`❌ Error in findMatchingFigmaElements:`, error);
    }

    return matches;
  }

  /**
   * Determine if DOM element matches Figma element
   */
  isElementMatch(domElement, figmaElement) {
    // Match by text content similarity
    if (domElement.textContent && figmaElement.characters) {
      const similarity = this.calculateTextSimilarity(
        domElement.textContent.toLowerCase(),
        figmaElement.characters.toLowerCase()
      );
      if (similarity > 0.8) return true;
    }

    // Match by name similarity
    if (domElement.className && typeof domElement.className === 'string' && figmaElement.name) {
      const classNames = domElement.className.split(' ');
      return classNames.some(className => 
        figmaElement.name.toLowerCase().includes(className.toLowerCase()) ||
        className.toLowerCase().includes(figmaElement.name.toLowerCase())
      );
    }

    return false;
  }

  /**
   * Compare individual element properties
   */
  compareElement(domElement, figmaElement) {
    const mismatches = [];

    // Compare font size
    if (figmaElement.fontSize && domElement.fontSize) {
      const domFontSize = parseFloat(domElement.fontSize);
      const figmaFontSize = figmaElement.fontSize;
      
      if (Math.abs(domFontSize - figmaFontSize) > this.tolerance.fontSize) {
        mismatches.push({
          property: 'fontSize',
          domValue: `${domFontSize}px`,
          figmaValue: `${figmaFontSize}px`,
          difference: Math.abs(domFontSize - figmaFontSize),
          severity: this.getSeverity(Math.abs(domFontSize - figmaFontSize), this.tolerance.fontSize)
        });
      }
    }

    // Compare colors
    if (figmaElement.color && domElement.color) {
      const colorDifference = this.calculateColorDifference(
        domElement.color,
        figmaElement.color
      );
      
      if (colorDifference > this.tolerance.color) {
        mismatches.push({
          property: 'color',
          domValue: domElement.color,
          figmaValue: figmaElement.color,
          difference: colorDifference,
          severity: this.getSeverity(colorDifference, this.tolerance.color)
        });
      }
    }

    // Compare spacing (if available)
    // Add more comparison logic here...

    return mismatches;
  }

  /**
   * Calculate text similarity using Levenshtein distance
   */
  calculateTextSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array(len2 + 1).fill().map(() => Array(len1 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i] + 1,
            matrix[j][i - 1] + 1,
            matrix[j - 1][i - 1] + 1
          );
        }
      }
    }

    const distance = matrix[len2][len1];
    return 1 - distance / Math.max(len1, len2);
  }

  /**
   * Calculate color difference
   */
  calculateColorDifference(color1, color2) {
    // Simple color difference calculation
    // In a real implementation, you'd use CIEDE2000 or similar
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');
    
    if (hex1 === hex2) return 0;
    
    const r1 = parseInt(hex1.substr(0, 2), 16);
    const g1 = parseInt(hex1.substr(2, 2), 16);
    const b1 = parseInt(hex1.substr(4, 2), 16);
    
    const r2 = parseInt(hex2.substr(0, 2), 16);
    const g2 = parseInt(hex2.substr(2, 2), 16);
    const b2 = parseInt(hex2.substr(4, 2), 16);
    
    return Math.sqrt(
      Math.pow(r2 - r1, 2) + 
      Math.pow(g2 - g1, 2) + 
      Math.pow(b2 - b1, 2)
    );
  }

  /**
   * Get severity level based on difference
   */
  getSeverity(difference, tolerance) {
    const ratio = difference / tolerance;
    if (ratio < 1.5) return 'minor';
    if (ratio < 3) return 'moderate';
    return 'major';
  }

  /**
   * Generate summary of mismatches
   */
  generateSummary(mismatches) {
    const summary = {
      byProperty: {},
      bySeverity: { minor: 0, moderate: 0, major: 0 },
      totalElements: new Set()
    };

    mismatches.forEach(mismatch => {
      summary.totalElements.add(mismatch.elementId);
      
      mismatch.mismatches.forEach(issue => {
        // Count by property
        summary.byProperty[issue.property] = (summary.byProperty[issue.property] || 0) + 1;
        
        // Count by severity
        summary.bySeverity[issue.severity]++;
      });
    });

    summary.totalElements = summary.totalElements.size;
    return summary;
  }
}

module.exports = {
  FigmaAPIClient,
  DesignTokenComparator
};
