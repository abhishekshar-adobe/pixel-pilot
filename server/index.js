const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const backstop = require('backstopjs');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

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
    const filename = `${sanitizedScenario}_${sanitizedViewport}_${timestamp}_${file.originalname}`;
    cb(null, filename);
  }
});
const upload = multer({ storage });

// Store scenario-screenshot associations
let scenarioScreenshots = {};

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

// Initialize directories and load data
async function initializeServer() {
  await loadScenarioScreenshots();
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
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { scenario, viewport, isReference } = req.body;
    
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
    
    // Add to screenshots array
    scenarioScreenshots[scenarioKey].screenshots.push(screenshotData);
    
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
          // BackstopJS removes dots and converts to lowercase for selectors
          const selectorName = scenarioConfig.selectors[0]
            .replace(/^\./, '') // Remove leading dot
            .replace(/[^a-zA-Z0-9]/g, '-') // Replace non-alphanumeric with dash
            .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
            .toLowerCase(); // BackstopJS uses lowercase
          backstopFilename = `backstop_default_${scenario}_0_${selectorName}_${viewportIndex}_${viewport}.png`;
        } else {
          // Full page screenshot
          backstopFilename = `backstop_default_${scenario}_${viewportIndex}_${viewport}.png`;
        }
        
        const referencePath = path.join(referenceDir, backstopFilename);
        await fs.copy(req.file.path, referencePath);
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
        .replace(/^\./, '')
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/^-+|-+$/g, '')
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
    const { scenario, viewport } = req.body;
    const scenarioKey = `${scenario}_${viewport}`;
    
    // Load scenario screenshots data
    const scenarioDataPath = path.join(configDir, 'scenario_screenshots.json');
    const scenarioScreenshots = await fs.readJson(scenarioDataPath).catch(() => ({}));
    
    const referenceData = scenarioScreenshots[scenarioKey]?.referenceScreenshot;
    if (!referenceData) {
      return res.status(400).json({ error: 'No reference screenshot found for this scenario-viewport combination' });
    }
    
    // Load BackstopJS config
    const configPath = path.join(configDir, 'backstop.json');
    const config = await fs.readJson(configPath);
    
    const scenarioConfig = config.scenarios.find(s => s.label === scenario);
    const viewportIndex = config.viewports.findIndex(v => v.label === viewport);
    
    if (!scenarioConfig || viewportIndex === -1) {
      return res.status(400).json({ error: 'Scenario or viewport not found in BackstopJS config' });
    }
    
    // Generate backstop filename
    let backstopFilename;
    if (scenarioConfig.selectors && scenarioConfig.selectors.length > 0) {
      const selectorName = scenarioConfig.selectors[0]
        .replace(/^\./, '')
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
      backstopFilename = `backstop_default_${scenario}_0_${selectorName}_${viewportIndex}_${viewport}.png`;
    } else {
      backstopFilename = `backstop_default_${scenario}_${viewportIndex}_${viewport}.png`;
    }
    
    // Copy to BackstopJS reference directory
    const referenceDir = path.join(configDir, config.paths.bitmaps_reference.replace('backstop_data/', ''));
    await fs.ensureDir(referenceDir);
    
    const sourcePath = referenceData.path;
    const targetPath = path.join(referenceDir, backstopFilename);
    
    if (!(await fs.pathExists(sourcePath))) {
      return res.status(400).json({ error: 'Source reference file not found' });
    }
    
    await fs.copy(sourcePath, targetPath);
    
    res.json({
      message: `Successfully synced reference to BackstopJS`,
      backstopFilename,
      sourcePath,
      targetPath
    });
    
  } catch (error) {
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
    
    res.json(config.scenarios || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('PixelPilot BackstopJS Dashboard Backend');
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
