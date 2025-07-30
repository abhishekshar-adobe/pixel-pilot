import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('public/uploads'));

// Create required directories for BackstopJS
const directories = [
  'backstop_data',
  'backstop_data/bitmaps_reference',
  'backstop_data/bitmaps_test',
  'public/uploads'
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Configure multer for screenshot uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const { scenario, viewport } = req.body;
    const timestamp = Date.now();
    cb(null, `${scenario}_${viewport}_${timestamp}.png`);
  }
});

const upload = multer({ storage });

// BackstopJS Configuration Management API
app.get('/api/config', (req, res) => {
  console.log('📋 BackstopJS config requested');
  res.json({
    scenarios: [
      { label: 'Homepage', url: 'http://localhost:3000' },
      { label: 'About Page', url: 'http://localhost:3000/about' },
      { label: 'Contact Page', url: 'http://localhost:3000/contact' },
      { label: 'Products', url: 'http://localhost:3000/products' },
      { label: 'Dashboard', url: 'http://localhost:3000/dashboard' }
    ],
    viewports: [
      { 
        label: 'Mobile Portrait', 
        width: 375, 
        height: 667,
        color: '#FF6B6B',
        darkColor: '#FF5252'
      },
      { 
        label: 'Tablet', 
        width: 768, 
        height: 1024,
        color: '#4ECDC4',
        darkColor: '#26A69A'
      },
      { 
        label: 'Desktop', 
        width: 1280, 
        height: 800,
        color: '#45B7D1',
        darkColor: '#1976D2'
      },
      { 
        label: 'Large Desktop', 
        width: 1440, 
        height: 900,
        color: '#96CEB4',
        darkColor: '#66BB6A'
      }
    ]
  });
});

// Screenshot Upload API for BackstopJS
app.post('/api/upload-screenshot', upload.single('screenshot'), (req, res) => {
  try {
    const { scenario, viewport, isReference } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No screenshot file uploaded' });
    }

    console.log(`📸 Screenshot uploaded: ${scenario}_${viewport} (Reference: ${isReference})`);
    
    res.json({ 
      success: true, 
      message: 'Screenshot uploaded successfully for BackstopJS',
      filename: req.file.filename,
      path: `/uploads/${req.file.filename}`,
      scenario,
      viewport
    });
  } catch (error) {
    console.error('Screenshot upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// BackstopJS Reference Screenshot Sync API
app.post('/api/sync-reference', async (req, res) => {
  const { viewport, scenario } = req.body;
  
  try {
    console.log(`🔄 Syncing BackstopJS reference: ${scenario}_${viewport}`);
    
    // Simulate BackstopJS reference generation process
    setTimeout(() => {
      res.json({ 
        success: true, 
        message: 'Reference screenshot synced to BackstopJS successfully',
        syncStatus: 'synced',
        lastSync: new Date().toISOString()
      });
    }, 1500);
    
  } catch (error) {
    console.error('BackstopJS sync error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get scenario screenshots
app.get('/api/scenario-screenshots/:scenario/:viewport', (req, res) => {
  const { scenario, viewport } = req.params;
  
  console.log(`📋 Screenshots requested for: ${scenario}_${viewport}`);
  
  // Mock response - in real implementation, this would check filesystem
  res.json({
    screenshots: [],
    hasReference: false,
    lastUpdated: null
  });
});

// Check sync status
app.get('/api/sync-status/:scenario/:viewport', (req, res) => {
  const { scenario, viewport } = req.params;
  
  console.log(`🔍 Sync status check for: ${scenario}_${viewport}`);
  
  // Mock sync status
  res.json({
    status: 'not_synced',
    lastSync: null,
    needsSync: true
  });
});

// Figma Design Import Integration API - Get Pages
app.get('/api/design-comparison/pages', async (req, res) => {
  const { fileId } = req.query;
  const figmaToken = req.headers['x-figma-token'];
  
  console.log(`📄 Figma pages requested for file: ${fileId}`);
  
  if (!figmaToken) {
    return res.status(401).json({ error: 'Figma token is required' });
  }

  if (!fileId) {
    return res.status(400).json({ error: 'File ID is required' });
  }

  try {
    // Make actual Figma API call to get file data
    const figmaResponse = await fetch(`https://api.figma.com/v1/files/${fileId}`, {
      headers: {
        'X-Figma-Token': figmaToken
      }
    });

    if (!figmaResponse.ok) {
      console.error(`❌ Figma API error: ${figmaResponse.status} ${figmaResponse.statusText}`);
      return res.status(figmaResponse.status).json({ 
        error: `Figma API error: ${figmaResponse.statusText}` 
      });
    }

    const figmaData = await figmaResponse.json();
    const document = figmaData.document;

    if (!document || !document.children) {
      return res.status(500).json({ error: 'Invalid Figma file structure' });
    }

    // Extract pages from Figma document
    const pages = document.children.map(page => ({
      id: page.id,
      name: page.name,
      type: page.type,
      backgroundColor: page.backgroundColor || { r: 0.95, g: 0.95, b: 0.95, a: 1 },
      flowStartingPoints: page.flowStartingPoints || [],
      prototypeDevice: page.prototypeDevice || null,
      visible: page.visible !== false,
      locked: page.locked || false,
      children: page.children ? page.children.length : 0
    }));

    console.log(`✅ Found ${pages.length} pages in Figma file`);

    res.json({
      pages: pages,
      summary: { 
        total: pages.length,
        canvasCount: pages.filter(p => p.type === 'CANVAS').length,
        frameCount: pages.filter(p => p.type === 'FRAME').length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching Figma pages:', error);
    res.status(500).json({ 
      error: 'Failed to fetch pages from Figma',
      details: error.message 
    });
  }
});

// Figma Design Import Integration API - Get Layers for a specific page
app.get('/api/design-comparison/layers', (req, res) => {
  const { fileId, pageId, mainOnly, minWidth, minHeight, includeInvisible } = req.query;
  
  console.log(`🎨 Figma layers requested for file: ${fileId}, page: ${pageId}`);
  console.log(`📋 Filter params - mainOnly: ${mainOnly}, minWidth: ${minWidth}, minHeight: ${minHeight}, includeInvisible: ${includeInvisible}`);
  
  // Mock Figma layers response based on page
  const layersByPage = {
    'page-home': [
      {
        id: 'frame-header',
        name: 'Navigation Header',
        type: 'FRAME',
        absoluteBoundingBox: { x: 0, y: 0, width: 1280, height: 80 },
        bounds: { x: 0, y: 0, width: 1280, height: 80 },
        visible: true,
        pageName: 'Homepage Design',
        description: 'Main navigation header with logo and menu items',
        hasChildren: true,
        childCount: 5
      },
      {
        id: 'comp-hero',
        name: 'Hero Banner Section',
        type: 'COMPONENT',
        absoluteBoundingBox: { x: 0, y: 80, width: 1280, height: 600 },
        bounds: { x: 0, y: 80, width: 1280, height: 600 },
        visible: true,
        pageName: 'Homepage Design',
        description: 'Main hero section with call-to-action button',
        hasChildren: true,
        childCount: 8
      },
      {
        id: 'frame-features',
        name: 'Features Section',
        type: 'FRAME',
        absoluteBoundingBox: { x: 0, y: 680, width: 1280, height: 400 },
        bounds: { x: 0, y: 680, width: 1280, height: 400 },
        visible: true,
        pageName: 'Homepage Design',
        description: 'Three-column feature showcase',
        hasChildren: true,
        childCount: 12
      }
    ],
    'page-products': [
      {
        id: 'frame-product-grid',
        name: 'Product Grid Layout',
        type: 'FRAME',
        absoluteBoundingBox: { x: 0, y: 0, width: 1280, height: 800 },
        bounds: { x: 0, y: 0, width: 1280, height: 800 },
        visible: true,
        pageName: 'Product Pages',
        description: 'Responsive grid layout showcasing featured products',
        hasChildren: true,
        childCount: 15
      },
      {
        id: 'comp-product-card',
        name: 'Product Card Component',
        type: 'COMPONENT',
        absoluteBoundingBox: { x: 40, y: 40, width: 300, height: 400 },
        bounds: { x: 40, y: 40, width: 300, height: 400 },
        visible: true,
        pageName: 'Product Pages',
        description: 'Reusable product card with image, title, and price',
        hasChildren: true,
        childCount: 6
      }
    ],
    'page-mobile': [
      {
        id: 'frame-mobile-nav',
        name: 'Mobile Navigation',
        type: 'FRAME',
        absoluteBoundingBox: { x: 0, y: 0, width: 375, height: 60 },
        bounds: { x: 0, y: 0, width: 375, height: 60 },
        visible: true,
        pageName: 'Mobile Views',
        description: 'Responsive mobile navigation bar',
        hasChildren: true,
        childCount: 4
      },
      {
        id: 'frame-mobile-content',
        name: 'Mobile Content Area',
        type: 'FRAME',
        absoluteBoundingBox: { x: 0, y: 60, width: 375, height: 600 },
        bounds: { x: 0, y: 60, width: 375, height: 600 },
        visible: true,
        pageName: 'Mobile Views',
        description: 'Main content area optimized for mobile',
        hasChildren: true,
        childCount: 10
      }
    ],
    'page-components': [
      {
        id: 'comp-button-primary',
        name: 'Primary Button',
        type: 'COMPONENT',
        absoluteBoundingBox: { x: 100, y: 100, width: 200, height: 48 },
        bounds: { x: 100, y: 100, width: 200, height: 48 },
        visible: true,
        pageName: 'Design System',
        description: 'Primary action button component',
        hasChildren: true,
        childCount: 3
      },
      {
        id: 'comp-input-field',
        name: 'Input Field',
        type: 'COMPONENT',
        absoluteBoundingBox: { x: 100, y: 200, width: 300, height: 56 },
        bounds: { x: 100, y: 200, width: 300, height: 56 },
        visible: true,
        pageName: 'Design System',
        description: 'Standard form input field',
        hasChildren: true,
        childCount: 4
      }
    ]
  };

  const mockLayers = layersByPage[pageId] || [];

  res.json({
    layers: mockLayers,
    summary: { 
      total: mockLayers.length, 
      filtered: mockLayers.length,
      filterStrategy: 'size_and_visibility',
      appliedFilters: [`minWidth: ${minWidth}`, `minHeight: ${minHeight}`, `mainOnly: ${mainOnly}`, `includeInvisible: ${includeInvisible}`],
      pageId: pageId
    }
  });
});

// Figma Layer Elements API - Get elements within a layer
app.get('/api/design-comparison/layer-elements', (req, res) => {
  const { fileId, layerId } = req.query;
  
  console.log(`🔍 Figma layer elements requested for layer: ${layerId} in file: ${fileId}`);
  
  // Mock layer elements based on layer type
  const elementsByLayer = {
    'frame-header': [
      {
        id: 'logo-element',
        name: 'Company Logo',
        type: 'INSTANCE',
        absoluteBoundingBox: { x: 40, y: 20, width: 120, height: 40 },
        bounds: { x: 40, y: 20, width: 120, height: 40 },
        visible: true,
        description: 'Main company logo'
      },
      {
        id: 'nav-menu',
        name: 'Navigation Menu',
        type: 'GROUP',
        absoluteBoundingBox: { x: 500, y: 25, width: 400, height: 30 },
        bounds: { x: 500, y: 25, width: 400, height: 30 },
        visible: true,
        description: 'Main navigation menu items'
      },
      {
        id: 'search-box',
        name: 'Search Input',
        type: 'INSTANCE',
        absoluteBoundingBox: { x: 950, y: 20, width: 200, height: 40 },
        bounds: { x: 950, y: 20, width: 200, height: 40 },
        visible: true,
        description: 'Global search input field'
      },
      {
        id: 'user-avatar',
        name: 'User Profile',
        type: 'INSTANCE',
        absoluteBoundingBox: { x: 1200, y: 20, width: 40, height: 40 },
        bounds: { x: 1200, y: 20, width: 40, height: 40 },
        visible: true,
        description: 'User profile avatar'
      }
    ],
    'comp-hero': [
      {
        id: 'hero-title',
        name: 'Main Headline',
        type: 'TEXT',
        absoluteBoundingBox: { x: 100, y: 180, width: 600, height: 80 },
        bounds: { x: 100, y: 180, width: 600, height: 80 },
        visible: true,
        description: 'Primary headline text'
      },
      {
        id: 'hero-subtitle',
        name: 'Subtitle Text',
        type: 'TEXT',
        absoluteBoundingBox: { x: 100, y: 280, width: 500, height: 60 },
        bounds: { x: 100, y: 280, width: 500, height: 60 },
        visible: true,
        description: 'Supporting subtitle text'
      },
      {
        id: 'hero-cta',
        name: 'Call to Action Button',
        type: 'INSTANCE',
        absoluteBoundingBox: { x: 100, y: 380, width: 200, height: 56 },
        bounds: { x: 100, y: 380, width: 200, height: 56 },
        visible: true,
        description: 'Primary call-to-action button'
      },
      {
        id: 'hero-image',
        name: 'Hero Background',
        type: 'RECTANGLE',
        absoluteBoundingBox: { x: 700, y: 120, width: 500, height: 400 },
        bounds: { x: 700, y: 120, width: 500, height: 400 },
        visible: true,
        description: 'Hero section background image'
      }
    ]
  };

  const mockElements = elementsByLayer[layerId] || [];

  res.json({
    elements: mockElements,
    summary: { 
      total: mockElements.length,
      layerId: layerId,
      parentLayer: layerId
    }
  });
});

// Figma Layer Thumbnail API
app.get('/api/design-comparison/layer-thumbnail', (req, res) => {
  const { layerId, scale = 0.5 } = req.query;
  
  console.log(`🖼️ Thumbnail requested for layer: ${layerId} at scale: ${scale}`);
  
  // Mock thumbnail response with placeholder images
  const thumbnailUrls = {
    'frame-header': 'https://via.placeholder.com/640x40/2196F3/white?text=Navigation+Header',
    'comp-hero': 'https://via.placeholder.com/640x300/4CAF50/white?text=Hero+Banner+Section',
    'frame-products': 'https://via.placeholder.com/640x200/FF9800/white?text=Product+Grid+Layout',
    'comp-footer': 'https://via.placeholder.com/640x100/9C27B0/white?text=Site+Footer'
  };
  
  // Simulate API delay
  setTimeout(() => {
    res.json({
      thumbnailUrl: thumbnailUrls[layerId] || 'https://via.placeholder.com/300x200/757575/white?text=Layer+Preview',
      scale: parseFloat(scale)
    });
  }, 800);
});

// Download Figma layer
app.post('/api/design-comparison/download-figma-layer', (req, res) => {
  const { layerId, layerName, fileId } = req.body;
  
  console.log(`📥 Download requested for Figma layer: ${layerName} (${layerId}) from file: ${fileId}`);
  
  // Mock download response
  setTimeout(() => {
    // Generate a base64 placeholder image
    const mockImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    res.json({
      success: true,
      imageData: mockImageData,
      fileName: `${layerName.replace(/\s+/g, '_')}.png`,
      sourceFile: fileId
    });
  }, 1000);
});

// BackstopJS Health Check API
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'PixelPilot BackstopJS Dashboard API is running',
    timestamp: new Date().toISOString(),
    backstopjs: {
      version: '6.3.25',
      ready: true
    },
    endpoints: [
      'GET /api/config - BackstopJS configuration',
      'POST /api/upload-screenshot - Screenshot upload', 
      'POST /api/sync-reference - BackstopJS reference sync',
      'GET /api/design-comparison/layers - Figma layer import',
      'GET /api/design-comparison/layer-thumbnail - Figma thumbnails'
    ]
  });
});

// Start the BackstopJS Dashboard API server
app.listen(PORT, () => {
  console.log('🚀 PixelPilot BackstopJS Dashboard Started!');
  console.log('');
  console.log(`📡 Backend API Server: http://localhost:${PORT}`);
  console.log(`🎯 API Health Check: http://localhost:${PORT}/api/health`);
  console.log(`📸 Screenshot Management: Ready`);
  console.log(`🎨 Figma Integration: Ready`);
  console.log(`⚙️ BackstopJS Config Management: Ready`);
  console.log('');
  console.log('Ready for React frontend connection...');
});
