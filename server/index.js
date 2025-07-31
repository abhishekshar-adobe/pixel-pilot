const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const backstop = require('backstopjs');
const sharp = require('sharp');
const { DesignComparisonEngine } = require('./design-comparison-engine');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// Add request logging for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Create necessary directories
const configDir = path.join(__dirname, 'backstop_data');
const uploadsDir = path.join(__dirname, 'uploads');
fs.ensureDirSync(configDir);
fs.ensureDirSync(uploadsDir);

// Configure multer for screenshot uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const { scenario, viewport } = req.body || {};
    const timestamp = Date.now();
    const sanitizedScenario = scenario ? scenario.replace(/[^a-zA-Z0-9]/g, '_') : 'unknown';
    const sanitizedViewport = viewport ? viewport.replace(/[^a-zA-Z0-9]/g, '_') : 'unknown';
    
    // Sanitize the original filename to remove invalid characters for Windows
    const sanitizedOriginalName = file.originalname.replace(/[<>:"/\\|?*]/g, '_');
    
    console.log('Multer filename generation:', {
      originalname: file.originalname,
      sanitizedOriginalName,
      scenario,
      viewport,
      sanitizedScenario,
      sanitizedViewport,
      timestamp
    });
    
    const filename = `${sanitizedScenario}_${sanitizedViewport}_${timestamp}_${sanitizedOriginalName}`;
    console.log('Generated filename:', filename);
    cb(null, filename);
  }
});
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  }
});

// Store scenario-screenshot associations
let scenarioScreenshots = {};

// Configuration storage
const configFilePath = path.join(configDir, 'design-comparison-config.json');

// Load existing configuration on startup
async function loadDesignComparisonConfig() {
  try {
    if (await fs.pathExists(configFilePath)) {
      const config = await fs.readJson(configFilePath);
      console.log('Loaded design comparison configuration');
      return config;
    }
  } catch (error) {
    console.error('Error loading design comparison config:', error.message);
  }
  return null;
}

// Save configuration to file
async function saveDesignComparisonConfig(config) {
  try {
    // Don't save the access token for security, just save structure
    const configToSave = {
      figmaFileKey: config.figmaFileKey,
      tolerance: config.tolerance,
      configured: config.configured,
      lastUpdated: new Date().toISOString()
    };
    await fs.writeJson(configFilePath, configToSave, { spaces: 2 });
    console.log('Design comparison configuration saved');
    return true;
  } catch (error) {
    console.error('Error saving design comparison config:', error.message);
    return false;
  }
}

// Store scenario-screenshot associations

// Load existing scenario screenshots on startup
async function loadScenarioScreenshots() {
  try {
    const scenarioDataPath = path.join(configDir, 'scenario_screenshots.json');
    if (await fs.pathExists(scenarioDataPath)) {
      scenarioScreenshots = await fs.readJson(scenarioDataPath);
      console.log(`Loaded ${Object.keys(scenarioScreenshots).length} scenario screenshot associations`);
    }
  } catch (error) {
    console.error('Error loading scenario screenshots:', error.message);
  }
}

// Initialize server
async function initializeServer() {
  await loadScenarioScreenshots();
  
  // Load saved design comparison configuration if exists
  const savedConfig = await loadDesignComparisonConfig();
  if (savedConfig) {
    console.log('Found saved design comparison configuration');
  }
}

// Generate custom onReady and onBefore scripts for scenarios
async function generateCustomScripts(config) {
  try {
    const scriptsDir = path.join(configDir, 'engine_scripts', 'puppet');
    await fs.ensureDir(scriptsDir);
    
    // Helper function to process custom script code
    const processCustomScript = (customCode) => {
      if (!customCode || !customCode.trim()) return '';
      
      const lines = customCode.split('\n');
      let result = '';
      let inBrowserContext = false;

      for (const line of lines) {
        const trimmed = line.trim();
        
        // Handle empty lines and comments
        if (!trimmed || trimmed.startsWith('//')) {
          if (inBrowserContext) {
            result += '      ' + line + '\n'; // Comments inside browser context get extra indented
          } else {
            result += '    ' + line + '\n'; // Comments outside browser context get base indented
          }
          continue;
        }

        // Detect browser APIs vs Node.js APIs
        const hasBrowserAPI = /\b(document|window|localStorage|sessionStorage|console\.log|alert)\b/.test(trimmed);
        const hasNodeAPI = /\b(page\.|await page|context\(\)|addCookies|setExtraHTTPHeaders|waitFor|click|type|keyboard|mouse)\b/.test(trimmed);

        if (hasBrowserAPI && !hasNodeAPI) {
          // Browser API - needs to run in page.evaluate()
          if (!inBrowserContext) {
            result += '    await page.evaluate(async () => {\n';
            inBrowserContext = true;
          }
          result += '      ' + line + '\n';
        } else {
          // Node.js API or mixed - close browser context if open
          if (inBrowserContext) {
            result += '    });\n';
            inBrowserContext = false;
          }
          result += '    ' + line + '\n';
        }
      }

      // Close any remaining browser context
      if (inBrowserContext) {
        result += '    });\n';
      }

      return result.trim();
    };
    
    // Base onReady script template
    const baseOnReadyScript = `module.exports = async (page, scenario, vp, isReference, Engine, config) => {
  await require('./onBefore.js')(page, scenario, vp, isReference, Engine, config);
  
  // Custom script execution
  try {
    CUSTOM_SCRIPT_PLACEHOLDER
  } catch (error) {
    console.warn('Custom onReady script error for scenario "' + scenario.label + '":', error.message);
  }
  
  // Wait a bit for any changes to settle
  await new Promise(resolve => setTimeout(resolve, 500));
};`;

    // Base onBefore script template
    const baseOnBeforeScript = `module.exports = async (page, scenario, vp, isReference, Engine, config) => {
  console.log('BEFORE > ' + scenario.label);
  
  // Set viewport if specified
  if (vp) {
    await page.setViewport({ width: vp.width, height: vp.height });
  }
  
  // Custom onBefore script execution
  try {
    CUSTOM_SCRIPT_PLACEHOLDER
  } catch (error) {
    console.warn('Custom onBefore script error for scenario "' + scenario.label + '":', error.message);
  }
  
  // Wait for page to be ready
  await page.waitForSelector('body', { timeout: 30000 });
};`;

    // Generate scripts for each scenario
    const scriptPromises = config.scenarios.map(async (scenario) => {
      const scenarioName = scenario.label.replace(/[^a-zA-Z0-9]/g, '_');
      const promises = [];
      
      // Generate custom onReady script or ensure default behavior
      if (scenario.customScript && scenario.customScript.trim()) {
        const onReadyScriptName = `onReady_${scenarioName}.js`;
        const onReadyScriptPath = path.join(scriptsDir, onReadyScriptName);
        
        // Process custom script with intelligent context detection
        const processedReadyCode = processCustomScript(scenario.customScript.trim());
        
        const finalOnReadyScript = baseOnReadyScript.replace('CUSTOM_SCRIPT_PLACEHOLDER', processedReadyCode);
        promises.push(fs.writeFile(onReadyScriptPath, finalOnReadyScript));
        
        // Update scenario to use the custom script
        scenario.onReadyScript = `puppet/${onReadyScriptName}`;
      } else {
        // Ensure scenario has default onReady script if no custom script
        if (!scenario.onReadyScript) {
          scenario.onReadyScript = `puppet/onReady.js`;
        }
      }
      
      // Generate custom onBefore script or ensure default behavior
      if (scenario.customBeforeScript && scenario.customBeforeScript.trim()) {
        const onBeforeScriptName = `onBefore_${scenarioName}.js`;
        const onBeforeScriptPath = path.join(scriptsDir, onBeforeScriptName);
        
        // Process custom script with intelligent context detection
        const processedBeforeCode = processCustomScript(scenario.customBeforeScript.trim());
        
        const finalOnBeforeScript = baseOnBeforeScript.replace('CUSTOM_SCRIPT_PLACEHOLDER', processedBeforeCode);
        promises.push(fs.writeFile(onBeforeScriptPath, finalOnBeforeScript));
        
        // Update scenario to use the custom script
        scenario.onBeforeScript = `puppet/${onBeforeScriptName}`;
      } else {
        // Ensure scenario has default onBefore script if no custom script
        if (!scenario.onBeforeScript) {
          scenario.onBeforeScript = `puppet/onBefore.js`;
        }
      }
      
      return Promise.all(promises);
    });
    
    await Promise.all(scriptPromises);
    
    const onReadyCount = config.scenarios.filter(s => s.customScript && s.customScript.trim()).length;
    const onBeforeCount = config.scenarios.filter(s => s.customBeforeScript && s.customBeforeScript.trim()).length;
    
    // Remove global script settings if we have scenario-specific custom scripts
    // This prevents global scripts from overriding scenario-specific ones
    const hasAnyCustomScripts = onReadyCount > 0 || onBeforeCount > 0;
    if (hasAnyCustomScripts) {
      // If any scenario has custom scripts, remove global settings to allow scenario-specific scripts to work
      if (onReadyCount > 0) {
        delete config.onReadyScript;
      }
      
      if (onBeforeCount > 0) {
        delete config.onBeforeScript;
      }
      
      console.log(`Removed global script settings to enable scenario-specific scripts`);
    }
    
    console.log(`Generated ${onReadyCount} custom onReady scripts and ${onBeforeCount} custom onBefore scripts`);
    
  } catch (error) {
    console.error('Error generating custom scripts:', error.message);
    throw error;
  }
}

initializeServer();

// Default BackstopJS configuration
const defaultConfig = {
  id: "backstop_default",
  viewports: [
    {
      label: "phone",
      width: 320,
      height: 480
    },
    {
      label: "tablet",
      width: 1024,
      height: 768
    },
    {
      label: "desktop",
      width: 1920,
      height: 1080
    }
  ],
  onBeforeScript: "puppet/onBefore.js",
  onReadyScript: "puppet/onReady.js",
  scenarios: [
    {
      label: "Homepage",
      cookiePath: "backstop_data/engine_scripts/cookies.json",
      url: "https://garris.github.io/BackstopJS/",
      referenceUrl: "",
      readyEvent: "",
      readySelector: "",
      delay: 0,
      hideSelectors: [],
      removeSelectors: [],
      hoverSelector: "",
      clickSelector: "",
      postInteractionWait: 0,
      selectors: ["document"],
      selectorExpansion: true,
      expect: 0,
      misMatchThreshold: 0.1,
      requireSameDimensions: true
    }
  ],
  paths: {
    bitmaps_reference: "bitmaps_reference",
    bitmaps_test: "bitmaps_test",
    engine_scripts: "engine_scripts",
    html_report: "html_report",
    ci_report: "ci_report"
  },
  report: ["browser"],
  engine: "puppeteer",
  engineOptions: {
    args: ["--no-sandbox"]
  },
  asyncCaptureLimit: 5,
  asyncCompareLimit: 50,
  debug: false,
  debugWindow: false
};

// API Routes

// Test endpoint for server status
app.get('/api/test', async (req, res) => {
  try {
    const configPath = path.join(configDir, 'backstop.json');
    const configExists = await fs.pathExists(configPath);
    
    // Check if there are any recent test results
    const htmlReportPath = path.join(configDir, 'html_report', 'index.html');
    const reportExists = await fs.pathExists(htmlReportPath);
    
    res.json({
      success: true,
      message: 'Server is running and ready for BackstopJS tests',
      configExists,
      reportExists,
      reportPath: reportExists ? '/report/index.html' : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get current BackstopJS configuration
app.get('/api/config', async (req, res) => {
  try {
    const configPath = path.join(configDir, 'backstop.json');
    let config = defaultConfig;
    
    if (await fs.pathExists(configPath)) {
      config = await fs.readJson(configPath);
    }
    
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update BackstopJS configuration
app.post('/api/config', async (req, res) => {
  try {
    const configPath = path.join(configDir, 'backstop.json');
    const incomingConfig = req.body;
    
    // Merge with default configuration to ensure all required settings are present
    const config = {
      ...defaultConfig,
      ...incomingConfig, // Override with incoming settings
      paths: {
        ...defaultConfig.paths,
        ...(incomingConfig.paths || {})
      }
    };
    
    // Generate custom onReady scripts for scenarios with custom scripts
    await generateCustomScripts(config);
    
    await fs.writeJson(configPath, config, { spaces: 2 });
    res.json({ message: 'Configuration updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload screenshot and associate with scenario
app.post('/api/upload-screenshot', upload.single('screenshot'), async (req, res) => {
  try {
    console.log('Upload Screenshot Request:', {
      hasFile: !!req.file,
      fileDetails: req.file ? {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      } : null,
      body: req.body,
      bodyKeys: Object.keys(req.body)
    });

    if (!req.file) {
      console.error('No file uploaded in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { scenario, viewport, isReference } = req.body;
    
    console.log('Upload params:', { scenario, viewport, isReference });
    
    if (!scenario || !viewport) {
      console.error('Missing scenario or viewport');
      return res.status(400).json({ error: 'Scenario and viewport are required' });
    }
    
    // Create scenario-viewport key
    const scenarioKey = `${scenario}_${viewport}`;
    
    // Initialize scenario screenshots if not exists
    if (!scenarioScreenshots[scenarioKey]) {
      scenarioScreenshots[scenarioKey] = {
        scenario,
        viewport,
        screenshots: [],
        referenceScreenshot: null
      };
    }

    const screenshotData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      uploadedAt: new Date().toISOString(),
      size: req.file.size,
      isReference: isReference === 'true'
    };
    
    console.log('Created screenshot data:', screenshotData);

    // Add to screenshots array
    scenarioScreenshots[scenarioKey].screenshots.push(screenshotData);
    
    // Verify the file was actually saved correctly
    try {
      const savedFileStats = await fs.stat(req.file.path);
      console.log('Saved file verification:', {
        path: req.file.path,
        savedSize: savedFileStats.size,
        originalSize: req.file.size,
        sizeMatch: savedFileStats.size === req.file.size
      });
    } catch (statError) {
      console.error('Error verifying saved file:', statError.message);
    }
    
    // Set as reference if specified
    if (isReference === 'true') {
      scenarioScreenshots[scenarioKey].referenceScreenshot = screenshotData;
      
      // Automatically sync to BackstopJS reference directory
      const configPath = path.join(configDir, 'backstop.json');
      if (await fs.pathExists(configPath)) {
        const config = await fs.readJson(configPath);
        const referenceDir = path.join(configDir, config.paths.bitmaps_reference.replace('backstop_data/', ''));
        await fs.ensureDir(referenceDir);
        
        // Find the scenario configuration to get proper filename
        const scenarioConfig = config.scenarios.find(s => s.label === scenario);
        let backstopFilename;
        
        // Get viewport index from config (BackstopJS uses indices, not names)
        const viewportIndex = config.viewports.findIndex(v => v.label === viewport);
        if (viewportIndex === -1) {
          throw new Error(`Viewport "${viewport}" not found in BackstopJS configuration`);
        }
        
        if (scenarioConfig && scenarioConfig.selectors && scenarioConfig.selectors.length > 0) {
          // If scenario has specific selectors, include them in filename
          // BackstopJS selector naming convention:
          // Based on actual BackstopJS behavior: removes # and . and spaces, keeps text
          const selectorName = scenarioConfig.selectors[0]
            .replace(/#/g, '') // Remove hash symbols
            .replace(/\./g, '') // Remove dots  
            .replace(/\s*>\s*/g, '') // Remove child selectors with spaces
            .replace(/\s+/g, '') // Remove all spaces
            .replace(/[^a-zA-Z0-9]/g, '') // Remove all special characters
            .toLowerCase(); // BackstopJS uses lowercase
          backstopFilename = `backstop_default_${scenario}_0_${selectorName}_${viewportIndex}_${viewport}.png`;
        } else {
          // Full page screenshot
          backstopFilename = `backstop_default_${scenario}_${viewportIndex}_${viewport}.png`;
        }
        
        const referencePath = path.join(referenceDir, backstopFilename);
        
        // Convert image to PNG format if it's not already PNG
        const fileExtension = path.extname(req.file.originalname).toLowerCase();
        if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
          // Convert JPG/JPEG to PNG using sharp
          await sharp(req.file.path)
            .png()
            .toFile(referencePath);
        } else if (fileExtension === '.png') {
          // Direct copy for PNG files
          await fs.copy(req.file.path, referencePath);
        } else {
          // Convert any other format to PNG
          await sharp(req.file.path)
            .png()
            .toFile(referencePath);
        }
        
        console.log(`Auto-synced reference: ${backstopFilename}`);
      }
    }
    
    // Save scenario screenshots to file
    const scenarioDataPath = path.join(configDir, 'scenario_screenshots.json');
    await fs.writeJson(scenarioDataPath, scenarioScreenshots, { spaces: 2 });
    
    res.json({
      message: 'Screenshot uploaded and associated with scenario successfully',
      filename: req.file.filename,
      scenarioKey,
      isReference: isReference === 'true',
      screenshotCount: scenarioScreenshots[scenarioKey].screenshots.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check sync status for a scenario-viewport combination
app.get('/api/sync-status/:scenario/:viewport', async (req, res) => {
  try {
    const { scenario, viewport } = req.params;
    const scenarioKey = `${scenario}_${viewport}`;
    
    // Load scenario screenshots data
    const scenarioDataPath = path.join(configDir, 'scenario_screenshots.json');
    const scenarioScreenshots = await fs.readJson(scenarioDataPath).catch(() => ({}));
    
    // Load BackstopJS config
    const configPath = path.join(configDir, 'backstop.json');
    const config = await fs.readJson(configPath);
    
    const hasReference = scenarioScreenshots[scenarioKey]?.referenceScreenshot != null;
    
    if (!hasReference) {
      return res.json({
        hasReference: false,
        synced: false,
        backstopFilename: null
      });
    }
    
    // Generate expected backstop filename
    const scenarioConfig = config.scenarios.find(s => s.label === scenario);
    const viewportIndex = config.viewports.findIndex(v => v.label === viewport);
    
    if (!scenarioConfig || viewportIndex === -1) {
      return res.json({
        hasReference,
        synced: false,
        error: 'Scenario or viewport not found in BackstopJS config'
      });
    }
    
    let backstopFilename;
    if (scenarioConfig.selectors && scenarioConfig.selectors.length > 0) {
      const selectorName = scenarioConfig.selectors[0]
        .replace(/#/g, '') // Remove hash symbols
        .replace(/\./g, '') // Remove dots
        .replace(/\s*>\s*/g, '----') // Replace > with 4 dashes
        .replace(/\s+/g, '--') // Replace spaces with 2 dashes
        .replace(/#/g, '') // Remove hash symbols
        .replace(/\./g, '') // Remove dots  
        .replace(/\s*>\s*/g, '') // Remove child selectors with spaces
        .replace(/\s+/g, '') // Remove all spaces
        .replace(/[^a-zA-Z0-9]/g, '') // Remove all special characters
        .toLowerCase();
      backstopFilename = `backstop_default_${scenario}_0_${selectorName}_${viewportIndex}_${viewport}.png`;
    } else {
      backstopFilename = `backstop_default_${scenario}_${viewportIndex}_${viewport}.png`;
    }
    
    // Check if BackstopJS reference file exists
    const referenceDir = path.join(configDir, config.paths.bitmaps_reference.replace('backstop_data/', ''));
    const backstopReferencePath = path.join(referenceDir, backstopFilename);
    const synced = await fs.pathExists(backstopReferencePath);
    
    res.json({
      hasReference,
      synced,
      backstopFilename,
      lastSyncCheck: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual sync reference to BackstopJS
app.post('/api/sync-reference', async (req, res) => {
  try {
    console.log('Manual sync request received:', req.body);
    const { scenario, viewport } = req.body;
    const scenarioKey = `${scenario}_${viewport}`;
    
    // Load scenario screenshots data
    const scenarioDataPath = path.join(configDir, 'scenario_screenshots.json');
    const scenarioScreenshots = await fs.readJson(scenarioDataPath).catch(() => ({}));
    
    const referenceData = scenarioScreenshots[scenarioKey]?.referenceScreenshot;
    console.log('Reference data found:', !!referenceData);
    
    if (!referenceData) {
      console.log('Error: No reference screenshot found');
      return res.status(400).json({ error: 'No reference screenshot found for this scenario-viewport combination' });
    }
    
    // Load BackstopJS config
    const configPath = path.join(configDir, 'backstop.json');
    const config = await fs.readJson(configPath);
    
    const scenarioConfig = config.scenarios.find(s => s.label === scenario);
    const viewportIndex = config.viewports.findIndex(v => v.label === viewport);
    
    console.log('Scenario config found:', !!scenarioConfig);
    console.log('Viewport index:', viewportIndex);
    
    if (!scenarioConfig || viewportIndex === -1) {
      console.log('Error: Scenario or viewport not found in BackstopJS config');
      return res.status(400).json({ error: 'Scenario or viewport not found in BackstopJS config' });
    }
    
    // Generate backstop filename
    let backstopFilename;
    if (scenarioConfig.selectors && scenarioConfig.selectors.length > 0) {
      const selectorName = scenarioConfig.selectors[0]
        .replace(/#/g, '') // Remove hash symbols
        .replace(/\./g, '') // Remove dots  
        .replace(/\s*>\s*/g, '') // Remove child selectors with spaces
        .replace(/\s+/g, '') // Remove all spaces
        .replace(/[^a-zA-Z0-9]/g, '') // Remove all special characters
        .toLowerCase();
      backstopFilename = `backstop_default_${scenario}_0_${selectorName}_${viewportIndex}_${viewport}.png`;
    } else {
      backstopFilename = `backstop_default_${scenario}_${viewportIndex}_${viewport}.png`;
    }
    
    console.log('Generated backstop filename:', backstopFilename);
    
    // Copy to BackstopJS reference directory
    const referenceDir = path.join(configDir, config.paths.bitmaps_reference.replace('backstop_data/', ''));
    console.log('Reference directory:', referenceDir);
    await fs.ensureDir(referenceDir);
    
    const sourcePath = referenceData.path;
    const targetPath = path.join(referenceDir, backstopFilename);
    
    console.log('Source path:', sourcePath);
    console.log('Target path:', targetPath);
    
    if (!(await fs.pathExists(sourcePath))) {
      console.log('Error: Source reference file not found at:', sourcePath);
      return res.status(400).json({ error: 'Source reference file not found' });
    }
    
    await fs.copy(sourcePath, targetPath);
    console.log('File copied successfully');
    
    res.json({
      success: true,
      message: `Successfully synced reference to BackstopJS`,
      backstopFilename,
      sourcePath,
      targetPath
    });
    
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Run BackstopJS test
app.post('/api/test', async (req, res) => {
  try {
    const configPath = path.join(configDir, 'backstop.json');
    const config = await fs.readJson(configPath);
    
    // Ensure report paths exist
    await fs.ensureDir(path.join(configDir, config.paths.html_report));
    await fs.ensureDir(path.join(configDir, config.paths.bitmaps_test));
    
    const result = await backstop('test', { 
      config: configPath,
      filter: req.body.filter || undefined
    });
    
    // Get report path for frontend - strip backstop_data prefix from config path
    const htmlReportPath = config.paths.html_report.replace('backstop_data/', '');
    const reportPath = path.join(configDir, htmlReportPath, 'index.html');
    const reportExists = await fs.pathExists(reportPath);
    
    res.json({ 
      success: true, 
      result,
      reportPath: reportExists ? `/report/index.html` : null,
      message: 'Test completed successfully'
    });
  } catch (error) {
    // BackstopJS throws error when there are visual differences, but this is expected
    try {
      const configPath = path.join(configDir, 'backstop.json');
      const config = await fs.readJson(configPath);
      // Get report path for frontend - strip backstop_data prefix from config path
      const htmlReportPath = config.paths.html_report.replace('backstop_data/', '');
      const reportPath = path.join(configDir, htmlReportPath, 'index.html');
      const reportExists = await fs.pathExists(reportPath);
      
      res.status(200).json({ 
        success: false, 
        error: error.message,
        reportPath: reportExists ? `/report/index.html` : null,
        message: 'Test completed with visual differences detected'
      });
    } catch (configError) {
      res.status(500).json({ 
        success: false,
        error: `Configuration error: ${configError.message}`,
        reportPath: null,
        message: 'Test failed due to configuration error'
      });
    }
  }
});

// Run BackstopJS reference
app.post('/api/reference', async (req, res) => {
  try {
    const configPath = path.join(configDir, 'backstop.json');
    const config = await fs.readJson(configPath);
    
    // Ensure reference paths exist
    await fs.ensureDir(path.join(configDir, config.paths.bitmaps_reference));
    
    const result = await backstop('reference', { 
      config: configPath,
      filter: req.body.filter || undefined
    });
    
    res.json({ 
      success: true, 
      result,
      message: 'Reference screenshots generated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Run BackstopJS approve (update reference images with test results)
app.post('/api/approve', async (req, res) => {
  try {
    const configPath = path.join(configDir, 'backstop.json');
    const config = await fs.readJson(configPath);
    
    // Ensure reference paths exist
    await fs.ensureDir(path.join(configDir, config.paths.bitmaps_reference));
    
    const result = await backstop('approve', { 
      config: configPath,
      filter: req.body.filter || undefined
    });
    
    res.json({ 
      success: true, 
      result,
      message: 'Reference screenshots updated successfully - test images approved as new references'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate preview screenshot for a single scenario
app.post('/api/preview-scenario', async (req, res) => {
  try {
    const { config: scenarioConfig, scenarioIndex = 0, viewportIndex = 0 } = req.body;
    
    if (!scenarioConfig || !scenarioConfig.scenarios || scenarioConfig.scenarios.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid scenario configuration provided' 
      });
    }

    const scenario = scenarioConfig.scenarios[scenarioIndex];
    const viewport = scenarioConfig.viewports?.[viewportIndex] || { label: 'preview', width: 1200, height: 800 };

    // Create a temporary preview configuration
    const previewConfigPath = path.join(configDir, 'temp_preview', 'preview-backstop.json');
    const previewDir = path.dirname(previewConfigPath);
    await fs.ensureDir(previewDir);
    await fs.ensureDir(path.join(previewDir, 'preview_reference'));

    const previewConfig = {
      id: 'preview_backstop',
      viewports: [viewport],
      onBeforeScript: 'puppet/onBefore.js',
      onReadyScript: 'puppet/onReady.js',
      scenarios: [{
        ...scenario,
        label: 'preview_scenario',
        url: scenario.url,
        referenceUrl: '',
        readyEvent: '',
        readySelector: '',
        delay: scenario.delay || 0,
        hideSelectors: scenario.hideSelectors || [],
        removeSelectors: scenario.removeSelectors || [],
        hoverSelector: scenario.hoverSelector || '',
        clickSelector: scenario.clickSelector || '',
        postInteractionWait: 0,
        selectors: scenario.selectors || ['document'],
        selectorExpansion: true,
        expect: 0,
        misMatchThreshold: scenario.misMatchThreshold || 0.1,
        requireSameDimensions: scenario.requireSameDimensions || true
      }],
      paths: {
        bitmaps_reference: path.join(previewDir, 'preview_reference'),
        bitmaps_test: path.join(previewDir, 'preview_test'),
        engine_scripts: path.join(configDir, 'engine_scripts'),
        json_report: path.join(previewDir, 'json_report'),
        html_report: path.join(previewDir, 'html_report')
      },
      report: ['browser'],
      engine: 'puppeteer',
      engineOptions: {
        args: ['--no-sandbox']
      },
      asyncCaptureLimit: 5,
      asyncCompareLimit: 50,
      debug: false,
      debugWindow: false
    };

    // Write the preview configuration
    await fs.writeJson(previewConfigPath, previewConfig, { spaces: 2 });

    // Ensure preview directories exist
    await fs.ensureDir(path.join(previewDir, 'preview_reference'));
    await fs.ensureDir(path.join(previewDir, 'preview_test'));

    // Generate the preview screenshot using BackstopJS reference command
    await backstop('reference', { 
      config: previewConfigPath
    });

    // Find the generated screenshot
    const referenceDir = path.join(previewDir, 'preview_reference');
    const screenshotFiles = await fs.readdir(referenceDir);
    
    if (screenshotFiles.length === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'No preview screenshot was generated' 
      });
    }

    // Return the first (and should be only) screenshot file
    const screenshotFile = screenshotFiles[0];
    const screenshotPath = path.join(referenceDir, screenshotFile);
    
    // Create a public accessible URL for the image
    const publicImageName = `preview_${Date.now()}_${screenshotFile}`;
    const publicImagePath = path.join(uploadsDir, publicImageName);
    
    // Copy the screenshot to the uploads directory so it can be served
    await fs.copy(screenshotPath, publicImagePath);
    
    res.json({ 
      success: true, 
      imageUrl: `http://localhost:5000/uploads/${publicImageName}`,
      screenshotFile: screenshotFile,
      message: 'Preview screenshot generated successfully'
    });

  } catch (error) {
    console.error('Error generating preview screenshot:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to generate preview: ${error.message}` 
    });
  }
});

// Serve BackstopJS HTML report
app.use('/report', express.static(path.join(configDir, 'html_report')));

// Analyze BackstopJS report and suggest CSS issues
app.get('/api/analyze-css-issues', async (req, res) => {
  try {
    const jsonReportPath = path.join(configDir, 'json_report', 'jsonReport.json');
    
    if (!await fs.pathExists(jsonReportPath)) {
      return res.status(404).json({ error: 'No test report found. Please run a test first.' });
    }
    
    const report = await fs.readJson(jsonReportPath);
    const cssIssues = await analyzeCSSIssues(report);
    
    res.json({
      success: true,
      totalTests: report.tests?.length || 0,
      failedTests: report.tests?.filter(test => test.status === 'fail').length || 0,
      cssIssues: cssIssues,
      reportGenerated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error analyzing CSS issues:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to analyze CSS issues from BackstopJS report
async function analyzeCSSIssues(report) {
  const issues = [];
  
  if (!report.tests) return issues;
  
  for (const test of report.tests) {
    if (test.status === 'fail') {
      const testIssues = await analyzeTestFailure(test);
      issues.push({
        scenario: test.pair.label,
        viewport: test.pair.viewportLabel,
        diffPercentage: test.pair.diff?.misMatchPercentage || 0,
        issues: testIssues,
        referenceImage: test.pair.reference,
        testImage: test.pair.test,
        diffImage: test.pair.diffImage
      });
    }
  }
  
  return issues;
}

// Analyze individual test failure and suggest CSS fixes
async function analyzeTestFailure(test) {
  const issues = [];
  const diffPercentage = test.pair.diff?.misMatchPercentage || 0;
  const dimensions = test.pair.diff?.dimensionDifference || {};
  const analysisTime = test.pair.diff?.analysisTime || 0;
  
  // Enhanced analysis with specific measurements
  const getDetailedDescription = () => {
    let details = [];
    
    if (dimensions.width) {
      details.push(`Width: ${dimensions.width > 0 ? '+' : ''}${dimensions.width}px`);
    }
    if (dimensions.height) {
      details.push(`Height: ${dimensions.height > 0 ? '+' : ''}${dimensions.height}px`);
    }
    if (analysisTime) {
      details.push(`Analysis: ${analysisTime}ms`);
    }
    
    return details.length > 0 ? ` • ${details.join(' • ')}` : '';
  };
  
  // Analyze based on diff percentage with enhanced details
  if (diffPercentage > 50) {
    issues.push({
      severity: 'high',
      category: 'Major Layout Change',
      description: `Significant visual differences detected: ${diffPercentage}%${getDetailedDescription()}`,
      measurements: {
        diffPercentage: `${diffPercentage}%`,
        widthChange: dimensions.width ? `${dimensions.width > 0 ? '+' : ''}${dimensions.width}px` : 'No change',
        heightChange: dimensions.height ? `${dimensions.height > 0 ? '+' : ''}${dimensions.height}px` : 'No change',
        analysisTime: `${analysisTime}ms`,
        severity: 'HIGH PRIORITY'
      },
      possibleCauses: [
        'CSS framework version change (Bootstrap 4→5, Material-UI upgrade)',
        'Major layout restructuring (Grid→Flexbox, Float→Grid)',
        `Container width/height changes ${dimensions.width ? `(${Math.abs(dimensions.width)}px difference detected)` : ''}`,
        'Grid or flexbox property modifications (grid-template, flex-basis)'
      ],
      suggestedFixes: [
        'Check CSS framework migration guides and breaking changes',
        `Verify container dimensions ${dimensions.width ? `(investigate ${Math.abs(dimensions.width)}px width difference)` : ''}`,
        'Compare grid-template-columns/rows, flex properties before/after',
        'Use browser DevTools to inspect layout differences step by step'
      ]
    });
  } else if (diffPercentage > 20) {
    issues.push({
      severity: 'medium',
      category: 'Layout Shift',
      description: `Moderate layout changes detected: ${diffPercentage}%${getDetailedDescription()}`,
      measurements: {
        diffPercentage: `${diffPercentage}%`,
        widthChange: dimensions.width ? `${dimensions.width > 0 ? '+' : ''}${dimensions.width}px` : 'No change',
        heightChange: dimensions.height ? `${dimensions.height > 0 ? '+' : ''}${dimensions.height}px` : 'No change',
        estimatedPadding: dimensions.height ? `~${Math.abs(Math.round(dimensions.height / 2))}px padding/margin change` : 'Unknown',
        priority: 'MEDIUM'
      },
      possibleCauses: [
        `Margin/padding adjustments ${dimensions.height ? `(estimated ${Math.abs(Math.round(dimensions.height / 2))}px change)` : ''}`,
        'Font size or line-height changes (check computed styles)',
        `Element positioning changes ${dimensions.width ? `(${Math.abs(dimensions.width)}px horizontal shift)` : ''}`,
        'Content overflow or text wrapping differences'
      ],
      suggestedFixes: [
        `Check margin/padding values ${dimensions.height ? `(look for ~${Math.abs(Math.round(dimensions.height / 2))}px differences)` : ''}`,
        'Compare font-size, line-height, letter-spacing between versions',
        'Review position properties and top/left/right/bottom values',
        'Check overflow settings and white-space properties'
      ]
    });
  } else if (diffPercentage > 5) {
    issues.push({
      severity: 'low',
      category: 'Minor Visual Change',
      description: `Small visual differences detected: ${diffPercentage}%${getDetailedDescription()}`,
      measurements: {
        diffPercentage: `${diffPercentage}%`,
        widthChange: dimensions.width ? `${dimensions.width > 0 ? '+' : ''}${dimensions.width}px` : 'No change',
        heightChange: dimensions.height ? `${dimensions.height > 0 ? '+' : ''}${dimensions.height}px` : 'No change',
        affectedArea: `~${Math.round((diffPercentage / 100) * 1920 * 1080)} pixels affected`,
        priority: 'LOW'
      },
      possibleCauses: [
        'Color changes (hex: #ffffff→#f9f9f9, rgba opacity differences)',
        `Border/shadow modifications ${dimensions.width || dimensions.height ? '(check border-width pixel values)' : ''}`,
        'Text content changes (typography, character spacing)',
        'Icon/image updates (SVG paths, image compression artifacts)'
      ],
      suggestedFixes: [
        'Compare exact color values: hex codes, rgb(), hsl() values',
        'Check border-radius (px vs %), box-shadow blur/spread values',
        'Review text content for extra spaces, line breaks, font changes',
        'Verify image dimensions, compression, and SVG viewBox values'
      ]
    });
  }
  
  // Enhanced dimension analysis with specific measurements
  if (dimensions.width || dimensions.height) {
    const widthDesc = dimensions.width ? `Width: ${dimensions.width > 0 ? '+' : ''}${dimensions.width}px` : '';
    const heightDesc = dimensions.height ? `Height: ${dimensions.height > 0 ? '+' : ''}${dimensions.height}px` : '';
    const bothDesc = [widthDesc, heightDesc].filter(Boolean).join(', ');
    
    issues.push({
      severity: Math.abs(dimensions.width || 0) > 50 || Math.abs(dimensions.height || 0) > 50 ? 'high' : 'medium',
      category: 'Precise Dimension Change',
      description: `Element dimensions changed: ${bothDesc}`,
      measurements: {
        widthChange: dimensions.width ? `${dimensions.width > 0 ? '+' : ''}${dimensions.width}px` : '0px',
        heightChange: dimensions.height ? `${dimensions.height > 0 ? '+' : ''}${dimensions.height}px` : '0px',
        totalPixelDiff: `${Math.abs(dimensions.width || 0) + Math.abs(dimensions.height || 0)}px total difference`,
        aspectRatioImpact: dimensions.width && dimensions.height ? 
          `Aspect ratio impact: ${Math.abs(Math.round((dimensions.width / (dimensions.height || 1)) * 100))}%` : 
          'Single dimension change',
        magnitude: Math.abs(dimensions.width || 0) > 20 || Math.abs(dimensions.height || 0) > 20 ? 'SIGNIFICANT' : 'MINOR'
      },
      possibleCauses: [
        `CSS width/height changes (search for ${Math.abs(dimensions.width || dimensions.height || 0)}px in stylesheets)`,
        'Box-sizing: border-box vs content-box calculation differences',
        `Content changes ${dimensions.height ? `(${Math.abs(dimensions.height)}px suggests text/content height change)` : ''}`,
        `Parent container resizing ${dimensions.width ? `(${Math.abs(dimensions.width)}px suggests container width issue)` : ''}`
      ],
      suggestedFixes: [
        `Search CSS for exact values: width: ${Math.abs(dimensions.width || 0)}px, height: ${Math.abs(dimensions.height || 0)}px`,
        'Compare box-sizing values and border/padding calculations',
        `Check min-width: ${Math.abs(dimensions.width || 0)}px, max-width, min-height: ${Math.abs(dimensions.height || 0)}px`,
        'Inspect parent container CSS Grid fr units, Flexbox flex-basis values'
      ]
    });
  }
  
  // Enhanced selector-specific analysis with measurements
  if (test.pair.selector && test.pair.selector !== 'document') {
    const selector = test.pair.selector;
    issues.push({
      severity: 'info',
      category: 'Element-Specific Analysis',
      description: `Changes in "${selector}"${getDetailedDescription()}`,
      measurements: {
        targetSelector: selector,
        specificity: `Selector: "${selector}"`,
        diffPercentage: `${diffPercentage}% of element area changed`,
        elementScope: selector.includes('.') ? 'Class-based (reusable)' : 
                     selector.includes('#') ? 'ID-based (unique)' : 
                     selector.includes('[') ? 'Attribute selector' : 'Element selector',
        priority: 'TARGETED FIX NEEDED'
      },
      possibleCauses: [
        `CSS specificity conflicts (check !important rules affecting ${selector})`,
        `Direct style changes to ${selector} (inspect computed styles)`,
        `JavaScript modifications (document.querySelector('${selector}'))`,
        `Pseudo-class state differences (:hover, :focus, :active on ${selector})`
      ],
      suggestedFixes: [
        `DevTools: Inspect element matching ${selector}`,
        `CSS: Search for "${selector}" across all stylesheets`,
        `Check CSS specificity calculator for ${selector}`,
        `Test ${selector}:hover, :focus states interactively`
      ]
    });
  }
  
  return issues;
}

// Sync uploaded reference screenshots to BackstopJS reference folder
app.post('/api/sync-references', async (req, res) => {
  try {
    const scenarioDataPath = path.join(configDir, 'scenario_screenshots.json');
    
    if (!await fs.pathExists(scenarioDataPath)) {
      return res.status(404).json({ error: 'No scenario data found' });
    }
    
    const scenarioData = await fs.readJson(scenarioDataPath);
    const referenceDir = path.join(configDir, 'bitmaps_reference');
    await fs.ensureDir(referenceDir);
    
    let syncedCount = 0;
    
    for (const [, data] of Object.entries(scenarioData)) {
      if (data.referenceScreenshot) {
        const sourcePath = data.referenceScreenshot.path;
        
        // Get the scenario configuration to check for selectors
        const configPath = path.join(configDir, 'backstop.json');
        const config = await fs.readJson(configPath);
        const scenario = config.scenarios.find(s => s.label === data.scenario);
        
        let fileName;
        if (scenario && scenario.selectors && scenario.selectors.length > 0) {
          // If scenario has specific selectors, include them in filename
          const selectorName = scenario.selectors[0].replace(/[^a-zA-Z0-9]/g, '-').replace(/^-+|-+$/g, '');
          fileName = `backstop_default_${data.scenario}_0_${selectorName}_0_${data.viewport}.png`;
        } else {
          // Full page screenshot
          fileName = `backstop_default_${data.scenario}_0_${data.viewport}.png`;
        }
        
        const destPath = path.join(referenceDir, fileName);
        
        if (await fs.pathExists(sourcePath)) {
          await fs.copy(sourcePath, destPath);
          syncedCount++;
          console.log(`Synced reference: ${fileName}`);
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: `Synced ${syncedCount} reference screenshots to BackstopJS`,
      syncedCount 
    });
  } catch (error) {
    console.error('Error syncing references:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get report status
app.get('/api/report-status', async (req, res) => {
  try {
    const reportPath = path.join(configDir, 'html_report', 'index.html');
    const reportExists = await fs.pathExists(reportPath);
    
    if (reportExists) {
      const stats = await fs.stat(reportPath);
      res.json({
        exists: true,
        lastModified: stats.mtime,
        url: '/report/index.html'
      });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get scenario screenshots
app.get('/api/scenario-screenshots', async (req, res) => {
  try {
    const scenarioDataPath = path.join(configDir, 'scenario_screenshots.json');
    
    if (await fs.pathExists(scenarioDataPath)) {
      const data = await fs.readJson(scenarioDataPath);
      res.json(data);
    } else {
      res.json({});
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get screenshots for specific scenario
app.get('/api/scenario-screenshots/:scenario/:viewport', async (req, res) => {
  try {
    const { scenario, viewport } = req.params;
    const scenarioKey = `${scenario}_${viewport}`;
    const scenarioDataPath = path.join(configDir, 'scenario_screenshots.json');
    
    if (await fs.pathExists(scenarioDataPath)) {
      const data = await fs.readJson(scenarioDataPath);
      const scenarioData = data[scenarioKey] || {
        scenario,
        viewport,
        screenshots: [],
        referenceScreenshot: null
      };
      res.json(scenarioData);
    } else {
      res.json({
        scenario,
        viewport,
        screenshots: [],
        referenceScreenshot: null
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to find all matching BackstopJS files
async function findBackstopFiles(scenario, viewport) {
  const referenceDir = path.join(configDir, 'bitmaps_reference');
  const matchingFiles = [];
  
  if (!(await fs.pathExists(referenceDir))) {
    return matchingFiles;
  }
  
  try {
    const files = await fs.readdir(referenceDir);
    
    // Look for files that match the scenario and viewport
    const scenarioPattern = new RegExp(`backstop_default_${scenario}_.*_${viewport}\\.png$`);
    
    for (const file of files) {
      if (scenarioPattern.test(file)) {
        matchingFiles.push(file);
      }
    }
  } catch (error) {
    console.error('Error reading bitmaps_reference directory:', error);
  }
  
  return matchingFiles;
}

// Delete scenario screenshot
app.delete('/api/scenario-screenshots/:scenario/:viewport/:filename', async (req, res) => {
  try {
    const { scenario, viewport, filename } = req.params;
    const scenarioKey = `${scenario}_${viewport}`;
    const scenarioDataPath = path.join(configDir, 'scenario_screenshots.json');
    
    console.log(`\n=== DELETE SCREENSHOT REQUEST ===`);
    console.log(`Scenario: ${scenario}, Viewport: ${viewport}, Filename: ${filename}`);
    console.log(`Scenario Key: ${scenarioKey}`);
    
    if (await fs.pathExists(scenarioDataPath)) {
      const data = await fs.readJson(scenarioDataPath);
      
      if (data[scenarioKey]) {
        // Remove from screenshots array  
        data[scenarioKey].screenshots = data[scenarioKey].screenshots.filter(
          screenshot => screenshot.filename !== filename
        );
        
        // Check if the deleted screenshot was the reference screenshot
        const wasReferenceScreenshot = data[scenarioKey].referenceScreenshot?.filename === filename;
        console.log(`Was reference screenshot: ${wasReferenceScreenshot}`);
        
        // Clear reference if it was the reference screenshot
        if (wasReferenceScreenshot) {
          data[scenarioKey].referenceScreenshot = null;
        }
        
        // Delete physical file from uploads
        const filePath = path.join(uploadsDir, filename);
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
          console.log(`✓ Deleted uploaded file: ${filename}`);
        } else {
          console.log(`⚠ Uploaded file not found: ${filename}`);
        }
        
        // Always try to delete matching BackstopJS reference images (not just if it was reference)
        console.log(`Looking for BackstopJS files for scenario: ${scenario}, viewport: ${viewport}`);
        const backstopFiles = await findBackstopFiles(scenario, viewport);
        console.log(`Found ${backstopFiles.length} matching BackstopJS files:`, backstopFiles);
        
        for (const backstopFile of backstopFiles) {
          const backstopRefPath = path.join(configDir, 'bitmaps_reference', backstopFile);
          
          if (await fs.pathExists(backstopRefPath)) {
            await fs.remove(backstopRefPath);
            console.log(`✓ Deleted BackstopJS reference image: ${backstopFile}`);
          } else {
            console.log(`⚠ BackstopJS file not found: ${backstopFile}`);
          }
        }
        
        // Save updated data
        await fs.writeJson(scenarioDataPath, data, { spaces: 2 });
        
        console.log(`=== DELETE COMPLETED ===\n`);
        res.json({ message: 'Screenshot deleted successfully' });
      } else {
        console.log(`❌ Scenario not found: ${scenarioKey}`);
        res.status(404).json({ error: 'Scenario not found' });
      }
    } else {
      console.log(`❌ No scenario data found`);
      res.status(404).json({ error: 'No scenario data found' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve uploaded screenshots
app.use('/uploads', express.static(uploadsDir));
app.use('/backstop_data', express.static(configDir));

// Debug route for image serving
app.get('/debug/image/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    console.log('Debug image request:', filename);
    console.log('File path:', filePath);
    console.log('File exists:', await fs.pathExists(filePath));
    
    if (await fs.pathExists(filePath)) {
      const stat = await fs.stat(filePath);
      console.log('File size:', stat.size);
      res.sendFile(filePath);
    } else {
      res.status(404).send('File not found');
    }
  } catch (error) {
    console.error('Error serving debug image:', error);
    res.status(500).send('Server error');
  }
});

// Get reference screenshots
app.get('/api/reference-screenshots', async (req, res) => {
  try {
    const referenceDir = path.join(configDir, 'bitmaps_reference');
    const screenshots = [];
    
    if (await fs.pathExists(referenceDir)) {
      const files = await fs.readdir(referenceDir);
      const imageFiles = files.filter(file => 
        /\.(png|jpg|jpeg|gif)$/i.test(file)
      );
      
      for (const file of imageFiles) {
        const filePath = path.join(referenceDir, file);
        const stats = await fs.stat(filePath);
        
        // Parse BackstopJS filename pattern: scenarioLabel_viewportLabel_selectorIndex_viewportLabel.png
        const nameParts = file.replace(/\.(png|jpg|jpeg|gif)$/i, '').split('_');
        let scenario = 'Unknown';
        let viewport = 'Unknown';
        
        if (nameParts.length >= 2) {
          scenario = nameParts[1] || 'Unknown';
          if (nameParts.length >= 4) {
            viewport = nameParts[3] || 'Unknown';
          }
        }
        
        screenshots.push({
          filename: file,
          path: `/backstop_data/bitmaps_reference/${file}`,
          scenario: scenario,
          viewport: viewport,
          generated: stats.mtime,
          size: stats.size
        });
      }
      
      // Sort by generation time (newest first)
      screenshots.sort((a, b) => new Date(b.generated) - new Date(a.generated));
    }
    
    res.json({ screenshots });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get list of scenarios
app.get('/api/scenarios', async (req, res) => {
  try {
    const configPath = path.join(configDir, 'backstop.json');
    let config = defaultConfig;
    
    if (await fs.pathExists(configPath)) {
      config = await fs.readJson(configPath);
    }
    
    res.json({ scenarios: config.scenarios || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Design Comparison API Endpoints

// Initialize design comparison engine
let designEngine = null;

// Configure design comparison
app.post('/api/design-comparison/config', async (req, res) => {
  try {
    const { figmaAccessToken, figmaFileKey, tolerance } = req.body;
    
    if (!figmaAccessToken || !figmaFileKey) {
      return res.status(400).json({ 
        error: 'figmaAccessToken and figmaFileKey are required' 
      });
    }

    designEngine = new DesignComparisonEngine({
      figmaAccessToken,
      figmaFileKey,
      tolerance,
      cacheDirectory: path.join(__dirname, 'design-cache')
    });

    // Initialize the Figma client
    designEngine.initializeFigmaClient();

    // Save configuration to file (without the access token for security)
    const configToSave = {
      figmaFileKey,
      tolerance,
      configured: true
    };
    await saveDesignComparisonConfig(configToSave);

    res.json({ 
      message: 'Design comparison configured successfully',
      config: { figmaFileKey, tolerance, configured: true }
    });

  } catch (error) {
    console.error('Error configuring design comparison:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get design comparison configuration
app.get('/api/design-comparison/config', async (req, res) => {
  try {
    // Load from file first
    const savedConfig = await loadDesignComparisonConfig();
    
    if (savedConfig) {
      res.json({
        configured: savedConfig.configured || false,
        config: {
          figmaFileKey: savedConfig.figmaFileKey,
          tolerance: savedConfig.tolerance,
          lastUpdated: savedConfig.lastUpdated
        }
      });
      return;
    }

    // Fallback to in-memory designEngine
    if (!designEngine) {
      return res.json({ 
        configured: false,
        message: 'Design comparison not configured'
      });
    }

    res.json({
      configured: true,
      config: {
        figmaFileKey: designEngine.config.figmaFileKey,
        tolerance: designEngine.config.tolerance,
        cacheDirectory: designEngine.config.cacheDirectory
      }
    });

  } catch (error) {
    console.error('Error getting design comparison config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Run design comparison for a scenario
app.post('/api/design-comparison/run', async (req, res) => {
  try {
    if (!designEngine) {
      return res.status(400).json({ 
        error: 'Design comparison not configured. Please configure Figma settings first.' 
      });
    }

    const { scenario } = req.body;
    
    if (!scenario || !scenario.url) {
      return res.status(400).json({ 
        error: 'Scenario with URL is required' 
      });
    }

    console.log(`Running design comparison for scenario: ${scenario.label}`);
    
    const result = await designEngine.runComparison(scenario);
    
    res.json({
      message: 'Design comparison completed',
      result: {
        scenario: result.scenario.label,
        timestamp: result.timestamp,
        totalMismatches: result.comparison?.totalMismatches || 0,
        summary: result.comparison?.summary,
        reportPath: result.reportPath,
        errors: result.errors
      }
    });

  } catch (error) {
    console.error('Error running design comparison:', error);
    res.status(500).json({ error: error.message });
  }
});

// Run design comparison for multiple scenarios
app.post('/api/design-comparison/batch', async (req, res) => {
  try {
    if (!designEngine) {
      return res.status(400).json({ 
        error: 'Design comparison not configured. Please configure Figma settings first.' 
      });
    }

    const { scenarios } = req.body;
    
    if (!scenarios || !Array.isArray(scenarios)) {
      return res.status(400).json({ 
        error: 'Array of scenarios is required' 
      });
    }

    console.log(`Running batch design comparison for ${scenarios.length} scenarios`);
    
    const results = await designEngine.runBatchComparison(scenarios);
    
    const summary = {
      totalScenarios: scenarios.length,
      completedScenarios: results.filter(r => !r.error).length,
      failedScenarios: results.filter(r => r.error).length,
      totalMismatches: results.reduce((sum, r) => sum + (r.comparison?.totalMismatches || 0), 0)
    };

    res.json({
      message: 'Batch design comparison completed',
      summary,
      results: results.map(r => ({
        scenario: r.scenario.label,
        timestamp: r.timestamp,
        totalMismatches: r.comparison?.totalMismatches || 0,
        reportPath: r.reportPath,
        error: r.error
      }))
    });

  } catch (error) {
    console.error('Error running batch design comparison:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get design comparison reports
app.get('/api/design-comparison/reports', async (req, res) => {
  try {
    const reportsDir = path.join(__dirname, 'design-cache');
    
    if (!await fs.pathExists(reportsDir)) {
      return res.json({ reports: [] });
    }

    const files = await fs.readdir(reportsDir);
    const reports = [];

    for (const file of files) {
      if (file.endsWith('.json') && file.startsWith('design-comparison-')) {
        try {
          const filePath = path.join(reportsDir, file);
          const reportData = await fs.readJson(filePath);
          const stats = await fs.stat(filePath);
          
          reports.push({
            filename: file,
            htmlFilename: file.replace('.json', '.html'),
            scenario: reportData.metadata?.scenario,
            url: reportData.metadata?.url,
            timestamp: reportData.metadata?.timestamp,
            totalMismatches: reportData.statistics?.totalMismatches || 0,
            size: stats.size,
            created: stats.birthtime
          });
        } catch (error) {
          console.error(`Error reading report ${file}:`, error);
        }
      }
    }

    // Sort by creation time (newest first)
    reports.sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json({ reports });

  } catch (error) {
    console.error('Error getting design comparison reports:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific design comparison report
app.get('/api/design-comparison/reports/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const reportPath = path.join(__dirname, 'design-cache', filename);
    
    if (!await fs.pathExists(reportPath)) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const reportData = await fs.readJson(reportPath);
    res.json(reportData);

  } catch (error) {
    console.error('Error getting design comparison report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve HTML reports
app.get('/api/design-comparison/reports/:filename/html', async (req, res) => {
  try {
    const { filename } = req.params;
    const htmlFilename = filename.replace('.json', '.html');
    const htmlPath = path.join(__dirname, 'design-cache', htmlFilename);
    
    if (!await fs.pathExists(htmlPath)) {
      return res.status(404).json({ error: 'HTML report not found' });
    }

    const htmlContent = await fs.readFile(htmlPath, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);

  } catch (error) {
    console.error('Error serving HTML report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete design comparison report
app.delete('/api/design-comparison/reports/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const jsonPath = path.join(__dirname, 'design-cache', filename);
    const htmlPath = path.join(__dirname, 'design-cache', filename.replace('.json', '.html'));
    
    const deletedFiles = [];
    
    if (await fs.pathExists(jsonPath)) {
      await fs.remove(jsonPath);
      deletedFiles.push(filename);
    }
    
    if (await fs.pathExists(htmlPath)) {
      await fs.remove(htmlPath);
      deletedFiles.push(filename.replace('.json', '.html'));
    }

    if (deletedFiles.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ 
      message: 'Report deleted successfully',
      deletedFiles
    });

  } catch (error) {
    console.error('Error deleting design comparison report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get BackstopJS integration script
app.get('/api/design-comparison/backstop-script', async (req, res) => {
  try {
    if (!designEngine) {
      return res.status(400).json({ 
        error: 'Design comparison not configured' 
      });
    }

    const script = designEngine.getBackstopIntegrationScript();
    
    res.setHeader('Content-Type', 'text/javascript');
    res.send(script);

  } catch (error) {
    console.error('Error getting BackstopJS integration script:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Figma pages list
app.get('/api/design-comparison/pages', async (req, res) => {
  try {
    const { fileId, page = 1, limit = 20 } = req.query;
    const figmaToken = req.headers['x-figma-token'];
    
    console.log(`📄 Figma pages requested for file: ${fileId}, page: ${page}, limit: ${limit}`);
    
    if (!figmaToken) {
      return res.status(401).json({ error: 'Figma token is required' });
    }

    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }
    
    const { FigmaAPIClient } = require('./figma-integration');
    const figmaClient = new FigmaAPIClient({ 
      accessToken: figmaToken, 
      fileKey: fileId 
    });

    const fileData = await figmaClient.getFile();
    const document = fileData.document;

    if (!document || !document.children) {
      return res.status(500).json({ error: 'Invalid Figma file structure' });
    }

    // Extract all pages from Figma document
    const allPages = document.children.map(page => ({
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

    // Apply pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    
    const paginatedPages = allPages.slice(startIndex, endIndex);
    const hasMore = endIndex < allPages.length;
    const total = allPages.length;

    console.log(`✅ Found ${total} total pages, returning ${paginatedPages.length} for page ${pageNum}`);
    res.json({ 
      pages: paginatedPages,
      total,
      hasMore,
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });

  } catch (error) {
    console.error('❌ Error fetching Figma pages:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch Figma pages', 
      details: error.message 
    });
  }
});

// Get Figma layers list with refined filtering strategy
app.get('/api/design-comparison/layers', async (req, res) => {
  try {
    const figmaToken = req.headers['x-figma-token'];
    const { 
      fileId, 
      pageId,
      type, 
      search, 
      mainOnly = 'true',
      minWidth = '100',
      minHeight = '100',
      includeInvisible = 'false',
      page = 1,
      limit = 30
    } = req.query;

    console.log('🎨 Figma layers requested for file:', fileId, pageId ? `, page: ${pageId}` : '');
    console.log('📋 Filter params - mainOnly:', mainOnly, ', minWidth:', minWidth, ', minHeight:', minHeight, ', includeInvisible:', includeInvisible);
    console.log('📄 Pagination - page:', page, ', limit:', limit);

    if (!figmaToken || !fileId) {
      return res.status(400).json({ 
        error: 'X-Figma-Token header and fileId parameter are required' 
      });
    }

    // Initialize Figma client for this request
    const { FigmaAPIClient } = require('./figma-integration');
    const figmaClient = new FigmaAPIClient({
      accessToken: figmaToken,
      fileKey: fileId
    });

    let layers;

    // Use refined filtering strategy for main layers by default
    if (mainOnly === 'true') {
      const filterOptions = {
        pageId: pageId,
        minWidth: parseInt(minWidth, 10),
        minHeight: parseInt(minHeight, 10),
        includeInvisible: includeInvisible === 'true',
        includeTypes: type ? type.split(',') : ['FRAME', 'COMPONENT', 'INSTANCE']
      };

      layers = await figmaClient.getMainLayersList(filterOptions);
    } else {
      // Fallback to all layers for backward compatibility
      layers = await figmaClient.getLayersList(pageId);
      
      // Apply legacy filters
      if (type) {
        const types = type.split(',');
        layers = figmaClient.filterLayersByType(layers, types);
      }
    }

    console.log(`✅ Found ${layers.length} layers after filtering`);
    if (layers.length > 0) {
      console.log('📄 Sample layers:', layers.slice(0, 2).map(l => ({ name: l.name, type: l.type, page: l.pageName })));
    }

    // Search by name if specified (works for both main and all layers)
    if (search) {
      layers = figmaClient.searchLayers(layers, search);
    }

    // Store total count before pagination
    const totalLayers = layers.length;

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLayers = layers.slice(startIndex, endIndex);
    const hasMore = endIndex < totalLayers;

    // Add summary information to response
    const allLayersForStats = mainOnly === 'true' ? 
      await figmaClient.getLayersList() : // Get all layers for comparison stats
      layers;
    
    const stats = figmaClient.getLayerStats(layers);
    const allStats = mainOnly === 'true' ? figmaClient.getLayerStats(allLayersForStats) : stats;

    const summary = {
      totalLayers: totalLayers,
      totalAllLayers: mainOnly === 'true' ? allLayersForStats.length : totalLayers,
      filterStrategy: mainOnly === 'true' ? 'main-layers' : 'all-layers',
      appliedFilters: {
        types: type ? type.split(',') : (mainOnly === 'true' ? ['FRAME', 'COMPONENT', 'INSTANCE'] : 'all'),
        minWidth: mainOnly === 'true' ? parseInt(minWidth, 10) : 'none',
        minHeight: mainOnly === 'true' ? parseInt(minHeight, 10) : 'none',
        includeInvisible: mainOnly === 'true' ? (includeInvisible === 'true') : 'all',
        nameSearch: search || 'none'
      },
      layerStats: stats,
      comparisonStats: mainOnly === 'true' ? {
        filteredOut: allStats.total - stats.total,
        percentageKept: Math.round((stats.total / allStats.total) * 100),
        reasonsFiltered: {
          wrongType: Object.keys(allStats.byType)
            .filter(t => !['FRAME', 'COMPONENT', 'INSTANCE'].includes(t))
            .reduce((sum, t) => sum + allStats.byType[t], 0),
          tooSmall: allStats.bySize.tooSmall,
          invisible: includeInvisible === 'false' ? allStats.byVisibility.hidden : 0
        }
      } : null
    };

    res.json({
      layers: paginatedLayers,
      total: totalLayers,
      page: page,
      limit: limit,
      hasMore: hasMore,
      summary
    });

  } catch (error) {
    console.error('Error getting Figma layers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific layer details
app.get('/api/design-comparison/layers/:layerId', async (req, res) => {
  try {
    const figmaToken = req.headers['x-figma-token'];
    const { fileId } = req.query;
    const { layerId } = req.params;

    if (!figmaToken || !fileId || !layerId) {
      return res.status(400).json({ 
        error: 'X-Figma-Token header, fileId parameter, and layerId are required' 
      });
    }

    // Initialize Figma client for this request
    const { FigmaAPIClient } = require('./figma-integration');
    const figmaClient = new FigmaAPIClient({
      accessToken: figmaToken,
      fileKey: fileId
    });

    const layerDetails = await figmaClient.getLayerDetails(layerId);

    res.json(layerDetails);

  } catch (error) {
    console.error('Error getting layer details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get layer elements with pagination
app.get('/api/design-comparison/layer-elements', async (req, res) => {
  try {
    const figmaToken = req.headers['x-figma-token'];
    const { fileId, layerId, page = 1, limit = 30 } = req.query;

    if (!figmaToken || !fileId || !layerId) {
      return res.status(400).json({ 
        error: 'X-Figma-Token header, fileId, and layerId parameters are required' 
      });
    }

    // Parse pagination parameters
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 30;

    console.log(`🔧 Figma layer elements requested for layer: ${layerId}, page: ${pageNum}, limit: ${limitNum}`);

    // Initialize Figma client for this request
    const { FigmaAPIClient } = require('./figma-integration');
    const figmaClient = new FigmaAPIClient({
      accessToken: figmaToken,
      fileKey: fileId
    });

    // Get layer details which should include child elements
    const layerDetails = await figmaClient.getLayerDetails(layerId);
    
    // Extract elements/children from the layer
    let elements = [];
    if (layerDetails && layerDetails.children) {
      elements = layerDetails.children;
    } else if (layerDetails && layerDetails.elements) {
      elements = layerDetails.elements;
    }

    // Store total count before pagination
    const totalElements = elements.length;

    // Apply pagination
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedElements = elements.slice(startIndex, endIndex);
    const hasMore = endIndex < totalElements;

    console.log(`✅ Found ${totalElements} elements, returning ${paginatedElements.length} (page ${pageNum})`);

    res.json({
      elements: paginatedElements,
      total: totalElements,
      page: pageNum,
      limit: limitNum,
      hasMore: hasMore
    });

  } catch (error) {
    console.error('Error getting layer elements:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export selected layers
app.post('/api/design-comparison/export-layers', async (req, res) => {
  try {
    const figmaToken = req.headers['x-figma-token'];
    const { fileId, layerIds, format = 'png', scale = 1 } = req.body;

    if (!figmaToken || !fileId || !layerIds || !Array.isArray(layerIds) || layerIds.length === 0) {
      return res.status(400).json({ 
        error: 'X-Figma-Token header, fileId, and layerIds array are required' 
      });
    }

    // Initialize Figma client for this request
    const { FigmaAPIClient } = require('./figma-integration');
    const figmaClient = new FigmaAPIClient({
      accessToken: figmaToken,
      fileKey: fileId
    });

    console.log(`Exporting ${layerIds.length} layers from Figma`);
    
    const exportedLayers = await figmaClient.exportLayers(layerIds, { format, scale });
    
    res.json({
      message: 'Layers exported successfully',
      exportedLayers,
      total: exportedLayers.length
    });

  } catch (error) {
    console.error('Error exporting layers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export layers as downloadable files for screenshot upload
app.post('/api/design-comparison/export-layers-for-upload', async (req, res) => {
  try {
    const figmaToken = req.headers['x-figma-token'];
    const { fileId, layerId, format = 'png', scale = 2, layerName = 'figma-layer' } = req.body;

    if (!figmaToken || !fileId || !layerId) {
      return res.status(400).json({ 
        error: 'X-Figma-Token header, fileId, and layerId are required' 
      });
    }

    // Initialize Figma client for this request
    const { FigmaAPIClient } = require('./figma-integration');
    const figmaClient = new FigmaAPIClient({
      accessToken: figmaToken,
      fileKey: fileId
    });

    console.log(`Exporting layer ${layerId} from Figma for upload`);
    
    // Get the image URL from Figma
    const images = await figmaClient.getImages([layerId], format, scale);
    
    if (!images.images[layerId]) {
      throw new Error('Failed to get image URL from Figma');
    }

    const imageUrl = images.images[layerId];
    
    // Download the image from Figma with proper headers
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'PixelPilot-App/1.0'
      }
    });

    // Verify the image was downloaded successfully
    if (!imageResponse.data || imageResponse.data.byteLength === 0) {
      throw new Error('Downloaded image is empty or invalid');
    }

    // Set appropriate headers for file download
    const fileName = `${layerName.replace(/[^a-zA-Z0-9]/g, '_')}_figma.${format}`;
    
    res.setHeader('Content-Type', `image/${format}`);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', imageResponse.data.byteLength);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Send the image buffer directly
    res.send(Buffer.from(imageResponse.data));

  } catch (error) {
    console.error('Error exporting layer for upload:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download Figma layer as file for screenshot upload (alternative approach)
app.post('/api/design-comparison/download-figma-layer', async (req, res) => {
  try {
    const figmaToken = req.headers['x-figma-token'];
    const { layerId, layerName, fileId } = req.body;

    console.log('Download Figma Layer Request:', {
      hasToken: !!figmaToken,
      layerId,
      layerName,
      fileId,
      hasDesignEngine: !!designEngine,
      headers: Object.keys(req.headers),
      body: req.body
    });

    if (!figmaToken || !layerId) {
      const error = `Missing required fields: ${!figmaToken ? 'X-Figma-Token header' : ''} ${!layerId ? 'layerId in body' : ''}`.trim();
      console.error('Validation error:', error);
      return res.status(400).json({ 
        error: 'X-Figma-Token header and layerId are required',
        details: error,
        received: {
          hasToken: !!figmaToken,
          layerId: layerId || 'missing',
          bodyKeys: Object.keys(req.body)
        }
      });
    }

    console.log(`Downloading Figma layer ${layerId} for upload`);
    
    let figmaClient;
    
    // Try to use existing designEngine first
    if (designEngine && designEngine.figmaClient) {
      figmaClient = designEngine.figmaClient;
      console.log('Using existing design engine Figma client');
    } else {
      // Create a temporary Figma client for this request
      const { FigmaAPIClient } = require('./figma-integration');
      
      // We need a file ID - try to get it from request body or use a default
      let figmaFileKey = fileId;
      
      // If no fileId provided, try to get from saved config
      if (!figmaFileKey) {
        const savedConfig = await loadDesignComparisonConfig();
        if (savedConfig && savedConfig.figmaFileKey) {
          figmaFileKey = savedConfig.figmaFileKey;
          console.log('Using saved figma file key from config');
        }
      }
      
      if (!figmaFileKey) {
        return res.status(400).json({ 
          error: 'Figma file key required. Please provide fileId in request body or configure Design Comparison settings first.'
        });
      }
      
      figmaClient = new FigmaAPIClient({
        accessToken: figmaToken,
        fileKey: figmaFileKey
      });
      console.log('Created temporary Figma client');
    }
    
    // Get high-quality image from Figma (scale 2 for good quality)
    const images = await figmaClient.getImages([layerId], 'png', 2);
    
    if (!images.images[layerId]) {
      throw new Error('Failed to get image URL from Figma');
    }

    const imageUrl = images.images[layerId];
    console.log(`Got image URL from Figma: ${imageUrl ? 'yes' : 'no'}`);
    
    // Download the image with proper error handling
    const axios = require('axios');
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      validateStatus: function (status) {
        return status < 400; // Accept status codes less than 400
      }
    });

    // Validate the downloaded image
    if (!imageResponse.data || imageResponse.data.byteLength === 0) {
      throw new Error('Failed to download image: empty response');
    }

    console.log(`Downloaded image: ${imageResponse.data.byteLength} bytes`);

    // Create a safe filename by sanitizing both layer name and layer ID
    const safeLayerName = (layerName || 'figma-layer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeLayerId = layerId.replace(/[^a-zA-Z0-9_-]/g, '_'); // Replace colon and other invalid chars
    const fileName = `${safeLayerName}_${safeLayerId}.png`;
    
    console.log('Filename generation:', {
      original: { layerName, layerId },
      sanitized: { safeLayerName, safeLayerId },
      finalFileName: fileName
    });
    
    // Return image data as JSON response with base64 encoding for reliable transfer
    const base64Image = Buffer.from(imageResponse.data).toString('base64');
    
    console.log('Response preparation:', {
      imageSize: imageResponse.data.byteLength,
      base64Length: base64Image.length,
      fileName
    });
    
    res.json({
      success: true,
      fileName,
      imageData: `data:image/png;base64,${base64Image}`,
      size: imageResponse.data.byteLength,
      contentType: 'image/png'
    });

  } catch (error) {
    console.error('Error downloading Figma layer:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get layer thumbnails
app.post('/api/design-comparison/layer-thumbnails', async (req, res) => {
  try {
    const figmaToken = req.headers['x-figma-token'];
    const { layerIds, size = 'small', fileId } = req.body;
    
    if (!figmaToken) {
      return res.status(400).json({ 
        error: 'X-Figma-Token header is required for layer thumbnails' 
      });
    }
    
    if (!layerIds || !Array.isArray(layerIds)) {
      return res.status(400).json({ 
        error: 'Array of layer IDs is required' 
      });
    }

    console.log(`Generating ${size} thumbnails for ${layerIds.length} layers`);
    
    // Limit the number of thumbnails to prevent overloading
    const maxThumbnails = 100;
    if (layerIds.length > maxThumbnails) {
      return res.status(400).json({
        error: `Too many layer IDs requested. Maximum allowed: ${maxThumbnails}, requested: ${layerIds.length}`
      });
    }
    
    let figmaClient;
    
    // Try to use existing designEngine first
    if (designEngine && designEngine.figmaClient) {
      figmaClient = designEngine.figmaClient;
      console.log('Using existing design engine Figma client for thumbnails');
    } else {
      // Create a temporary Figma client for this request
      const { FigmaAPIClient } = require('./figma-integration');
      
      // We need a file ID - try to get it from request body or use saved config
      let figmaFileKey = fileId;
      
      if (!figmaFileKey) {
        const savedConfig = await loadDesignComparisonConfig();
        if (savedConfig && savedConfig.figmaFileKey) {
          figmaFileKey = savedConfig.figmaFileKey;
          console.log('Using saved figma file key from config for thumbnails');
        }
      }
      
      if (!figmaFileKey) {
        return res.status(400).json({ 
          error: 'Figma file key required. Please provide fileId in request body or configure Design Comparison settings first.'
        });
      }
      
      figmaClient = new FigmaAPIClient({
        accessToken: figmaToken,
        fileKey: figmaFileKey
      });
      console.log('Created temporary Figma client for thumbnails');
    }
    
    // Use different scales based on size request
    // For frames, we want better quality thumbnails
    const scale = size === 'large' ? 0.5 : size === 'medium' ? 0.3 : 0.2;
    
    // Get images with appropriate scale for frames
    const images = await figmaClient.getImages(layerIds, 'png', scale);
    
    // Return the image URLs for client-side loading
    const thumbnails = {};
    for (const [layerId, imageUrl] of Object.entries(images.images || {})) {
      if (imageUrl) {
        thumbnails[layerId] = {
          url: imageUrl,
          scale: scale,
          size: size
        };
      }
    }

    res.json({ 
      thumbnails,
      total: Object.keys(thumbnails).length,
      scale: scale,
      requestedCount: layerIds.length,
      successCount: Object.keys(thumbnails).length
    });

  } catch (error) {
    console.error('Error generating thumbnails:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get bulk layer thumbnails using GET with query params
app.get('/api/design-comparison/bulk-thumbnails', async (req, res) => {
  try {
    const figmaToken = req.headers['x-figma-token'];
    const { fileId, ids, scale = 0.5 } = req.query;

    if (!figmaToken || !fileId || !ids) {
      return res.status(400).json({ 
        error: 'X-Figma-Token header, fileId, and ids query parameters are required' 
      });
    }

    // Parse the comma-separated layer IDs
    const layerIds = ids.split(',').map(id => id.trim()).filter(Boolean);
    
    if (layerIds.length === 0) {
      return res.status(400).json({ 
        error: 'At least one layer ID is required' 
      });
    }

    // Limit the number of thumbnails to prevent overloading
    const maxThumbnails = 50; // Reduced for GET requests
    if (layerIds.length > maxThumbnails) {
      return res.status(400).json({
        error: `Too many layer IDs requested. Maximum allowed: ${maxThumbnails}, requested: ${layerIds.length}`
      });
    }

    console.log(`📸 Bulk thumbnails requested for ${layerIds.length} layers in file: ${fileId}`);

    // Initialize Figma client for this request
    const { FigmaAPIClient } = require('./figma-integration');
    const figmaClient = new FigmaAPIClient({
      accessToken: figmaToken,
      fileKey: fileId
    });

    // Use Figma's bulk image export API: /images/{file_id}?ids=ID1,ID2,ID3
    const scaleValue = parseFloat(scale) || 0.5;
    const images = await figmaClient.getImages(layerIds, 'png', scaleValue);
    
    if (!images || !images.images) {
      throw new Error('Failed to get images from Figma API');
    }

    console.log(`✅ Retrieved ${Object.keys(images.images).length} thumbnail URLs from Figma`);

    // Return the thumbnail URLs mapped by layer ID
    res.json({
      thumbnails: images.images,
      total: Object.keys(images.images).length,
      requested: layerIds.length,
      scale: scaleValue
    });

  } catch (error) {
    console.error('Error getting bulk thumbnails:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get layer types summary
app.get('/api/design-comparison/layer-types', async (req, res) => {
  try {
    if (!designEngine || !designEngine.figmaClient) {
      return res.status(400).json({ 
        error: 'Design comparison not configured or Figma client not initialized' 
      });
    }

    const layers = await designEngine.figmaClient.getLayersList();
    
    // Count layers by type
    const typeCounts = layers.reduce((acc, layer) => {
      acc[layer.type] = (acc[layer.type] || 0) + 1;
      return acc;
    }, {});

    // Get available types with counts
    const layerTypes = Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count,
      label: type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
    })).sort((a, b) => b.count - a.count);

    res.json({
      layerTypes,
      totalLayers: layers.length
    });

  } catch (error) {
    console.error('Error getting layer types:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('PixelPilot BackstopJS Dashboard Backend');
});

// Global error handling to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  console.error('Stack:', error.stack);
  // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

app.listen(port, async () => {
  console.log(`Server running on http://localhost:${port}`);
  await initializeServer();
});
