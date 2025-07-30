import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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

// Figma Design Import Integration API
app.get('/api/design-comparison/layers', (req, res) => {
  const { fileId, mainOnly, minWidth, minHeight, includeInvisible } = req.query;
  
  console.log(`🎨 Figma layers requested for file: ${fileId}`);
  console.log(`📋 Filter params - mainOnly: ${mainOnly}, minWidth: ${minWidth}, minHeight: ${minHeight}, includeInvisible: ${includeInvisible}`);
  
  // Mock Figma layers response
  const mockLayers = [
    {
      id: 'frame-header',
      name: 'Navigation Header',
      type: 'FRAME',
      absoluteBoundingBox: { x: 0, y: 0, width: 1280, height: 80 },
      bounds: { x: 0, y: 0, width: 1280, height: 80 },
      visible: true,
      pageName: 'Homepage',
      description: 'Main navigation header with logo and menu items'
    },
    {
      id: 'comp-hero',
      name: 'Hero Banner Section',
      type: 'COMPONENT',
      absoluteBoundingBox: { x: 0, y: 80, width: 1280, height: 600 },
      bounds: { x: 0, y: 80, width: 1280, height: 600 },
      visible: true,
      pageName: 'Homepage',
      description: 'Main hero section with call-to-action button'
    },
    {
      id: 'frame-products',
      name: 'Product Grid Layout',
      type: 'FRAME',
      absoluteBoundingBox: { x: 0, y: 680, width: 1280, height: 400 },
      bounds: { x: 0, y: 680, width: 1280, height: 400 },
      visible: true,
      pageName: 'Products',
      description: 'Responsive grid layout showcasing featured products'
    },
    {
      id: 'comp-footer',
      name: 'Site Footer',
      type: 'COMPONENT',
      absoluteBoundingBox: { x: 0, y: 1080, width: 1280, height: 200 },
      bounds: { x: 0, y: 1080, width: 1280, height: 200 },
      visible: true,
      pageName: 'Global',
      description: 'Footer with links, contact info, and social media'
    }
  ];

  res.json({
    layers: mockLayers,
    summary: { 
      total: mockLayers.length, 
      filtered: mockLayers.length,
      filterStrategy: 'size_and_visibility',
      appliedFilters: [`minWidth: ${minWidth}`, `minHeight: ${minHeight}`, `mainOnly: ${mainOnly}`, `includeInvisible: ${includeInvisible}`]
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
