const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const backstop = require('backstopjs');
const sharp = require('sharp');
const axios = require('axios');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const { DesignComparisonEngine } = require('./design-comparison-engine');
const { getLatestTestResults } = require('./utils/test-results');
const { validateProject, PROJECTS_FILE } = require('./utils/project-utils');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
  }
});
const port = 5000;

app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173"],
  credentials: true
}));
app.use(express.json());

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.ensureDir(path.join(__dirname, 'data'));
    // Initialize projects file if it doesn't exist
    const exists = await fs.pathExists(PROJECTS_FILE);
    if (!exists) {
      await fs.writeJson(PROJECTS_FILE, [], { spaces: 2 });
    }
  } catch (err) {
    console.error('Error initializing data directory:', err);
  }
}

ensureDataDir();

// URL validation function for pre-testing
async function validateUrl(url) {
  try {
    console.log(`🔍 Starting validation for: ${url}`);
    
    // Basic URL format validation
    let validatedUrl;
    try {
      validatedUrl = new URL(url);
    } catch (urlError) {
      console.log(`❌ Invalid URL format: ${url}`);
      return {
        valid: false,
        type: 'INVALID_FORMAT',
        message: `Invalid URL format: ${urlError.message}`,
        severity: 'high'
      };
    }

    // Test network connectivity for all URLs including localhost
    console.log(`🌐 Testing network connectivity: ${url}`);
    
    // Special handling for Adobe AEM URLs - they might be slower
    const isAdobeAEM = url.includes('aem.enablementadobe.com');
    const timeoutMs = isAdobeAEM ? 15000 : 8000; // 15s for Adobe AEM, 8s for others
    
    console.log(`⏱️ Using timeout: ${timeoutMs/1000}s ${isAdobeAEM ? '(Adobe AEM detected)' : ''}`);
    
    // Create a promise with manual timeout control
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Manual timeout after ${timeoutMs/1000} seconds`)), timeoutMs);
    });
    
    const requestPromise = axios.get(url, {
      timeout: timeoutMs,
      headers: {
        'User-Agent': isAdobeAEM ? 
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' :
          'PixelPilot-BackstopJS-Validator/1.0'
      },
      validateStatus: function () {
        return true; // Don't throw on any status code
      },
      maxRedirects: 5, // More redirects for Adobe URLs
      followRedirect: true,
      // Disable SSL verification for Adobe AEM URLs to handle certificate issues
      httpsAgent: isAdobeAEM ? new (require('https').Agent)({
        rejectUnauthorized: false
      }) : undefined
    });

    const response = await Promise.race([requestPromise, timeoutPromise]);
    console.log(`📡 Response received for ${url}: ${response.status}`);

    // Check response status
    if (response.status >= 200 && response.status < 400) {
      console.log(`✅ URL accessible: ${url} (${response.status})`);
      return {
        valid: true,
        type: 'SUCCESS',
        message: `URL accessible (${response.status})`,
        severity: 'info',
        statusCode: response.status
      };
    } else if (response.status >= 400 && response.status < 500) {
      console.log(`❌ Client error for ${url}: ${response.status}`);
      return {
        valid: false,
        type: 'CLIENT_ERROR',
        message: `Client error: ${response.status} ${response.statusText}`,
        severity: 'high',
        statusCode: response.status
      };
    } else if (response.status >= 500) {
      console.log(`❌ Server error for ${url}: ${response.status}`);
      return {
        valid: false,
        type: 'SERVER_ERROR',
        message: `Server error: ${response.status} ${response.statusText}`,
        severity: 'high',
        statusCode: response.status
      };
    }

  } catch (error) {
    console.log(`❌ Network error for ${url}:`, error.message);
    
    // Network connectivity errors
    if (error.code === 'ECONNREFUSED') {
      return {
        valid: false,
        type: 'CONNECTION_REFUSED',
        message: 'Connection refused - server not responding',
        severity: 'high'
      };
    } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_NONAME') {
      return {
        valid: false,
        type: 'DNS_ERROR',
        message: 'DNS resolution failed - domain not found',
        severity: 'high'
      };
    } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return {
        valid: false,
        type: 'TIMEOUT',
        message: 'Request timeout - server not responding in time',
        severity: 'medium'
      };
    } else if (error.code === 'ECONNRESET') {
      return {
        valid: false,
        type: 'CONNECTION_RESET',
        message: 'Connection reset by server',
        severity: 'medium'
      };
    } else if (error.message?.includes('Manual timeout')) {
      return {
        valid: false,
        type: 'TIMEOUT',
        message: `Validation timeout - server took too long to respond (${error.message})`,
        severity: 'medium'
      };
    } else {
      return {
        valid: false,
        type: 'NETWORK_ERROR',
        message: `Network error: ${error.message}`,
        severity: 'high'
      };
    }
  }
}

// Function to create mock BackstopJS results for invalid scenarios and append to report
async function appendInvalidScenariosToReport(projectId, config, invalidScenarios, backstopResult) {
  try {
    console.log(`� DEBUG: appendInvalidScenariosToReport called with:`);
    console.log(`   - ProjectId: ${projectId}`);
    console.log(`   - InvalidScenarios count: ${invalidScenarios.length}`);
    console.log(`   - BackstopResult: ${backstopResult ? 'exists' : 'null/undefined'}`);
    console.log(`   - BackstopResult tests count: ${backstopResult?.tests?.length || 0}`);
    console.log(`   - Config paths: ${JSON.stringify(config.paths)}`);
    
    // Ensure backstopResult has a proper structure
    const safeBackstopResult = backstopResult || { tests: [] };
    if (!safeBackstopResult.tests) {
      safeBackstopResult.tests = [];
    }
    
    console.log(`�📋 Generating mock results for ${invalidScenarios.length} invalid scenarios...`);
    
    const mockResults = [];
    
    // Create mock test results for each invalid scenario across all viewports
    for (const { scenario, reason, message, validation, matchedFilter } of invalidScenarios) {
      for (const viewport of config.viewports || []) {
        const mockResult = {
          pair: {
            reference: null,
            test: null,
            selector: scenario.selector || 'document',
            fileName: `${projectId}_${scenario.label}_${viewport.label}_network_error`,
            label: scenario.label,
            viewportLabel: viewport.label,
            url: scenario.url,
            referenceUrl: scenario.referenceUrl || scenario.url,
            expect: 0,
            viewportSize: {
              width: viewport.width,
              height: viewport.height
            },
            diff: {
              isSameDimensions: false,
              dimensionDifference: {
                width: 0,
                height: 0
              },
              misMatchPercentage: 100, // 100% mismatch for network errors
              analysisTime: 0,
              getDiffImage: null
            }
          },
          status: 'fail',
          error: `Network Error [${reason}]: ${message}${matchedFilter !== undefined ? (matchedFilter ? ' (Matched Filter)' : ' (Outside Filter - Shown for Awareness)') : ''}`,
          networkError: true,
          errorType: reason,
          matchedFilter: matchedFilter,
          originalValidation: validation || null,
          timestamp: new Date().toISOString()
        };
        
        mockResults.push(mockResult);
      }
    }
    
    // Merge mock results with actual BackstopJS results
    const enhancedResult = {
      ...safeBackstopResult,
      tests: [
        ...(safeBackstopResult.tests || []),
        ...mockResults
      ],
      hasNetworkErrors: true,
      networkErrorCount: invalidScenarios.length,
      totalScenarios: (safeBackstopResult.tests?.length || 0) + mockResults.length,
      validScenariosCount: safeBackstopResult.tests?.length || 0,
      invalidScenariosCount: invalidScenarios.length
    };
    
    // Write enhanced report to BackstopJS report location
    const reportPath = path.join(config.paths.html_report, 'config.js');
    
    // First, try to read the existing report that BackstopJS generated
    let existingReportContent = null;
    try {
      if (await fs.pathExists(reportPath)) {
        existingReportContent = await fs.readFile(reportPath, 'utf8');
        console.log('📖 Found existing BackstopJS report, will enhance it');
        
        // Extract the existing report data
        const reportMatch = existingReportContent.match(/report\((.*)\);/s);
        if (reportMatch) {
          const existingReportData = JSON.parse(reportMatch[1]);
          console.log(`📊 Existing report has ${existingReportData.tests?.length || 0} tests`);
          
          // Merge with existing data instead of replacing
          enhancedResult.tests = [
            ...(existingReportData.tests || []),
            ...mockResults
          ];
          enhancedResult.totalScenarios = enhancedResult.tests.length;
          enhancedResult.validScenariosCount = existingReportData.tests?.length || 0;
          
          console.log(`🔄 Merged report: ${enhancedResult.validScenariosCount} existing + ${mockResults.length} new = ${enhancedResult.totalScenarios} total`);
        }
      } else {
        console.log('⚠️  No existing BackstopJS report found, creating new one');
      }
    } catch (readError) {
      console.warn('⚠️  Could not read existing report, will create new one:', readError.message);
    }
    
    const reportData = `report(${JSON.stringify(enhancedResult, null, 2)});`;
    
    console.log(`🔧 DEBUG: About to write enhanced report to: ${reportPath}`);
    console.log(`🔧 DEBUG: Enhanced result has ${enhancedResult.tests?.length || 0} tests`);
    console.log(`🔧 DEBUG: Network error tests: ${enhancedResult.tests?.filter(t => t.networkError)?.length || 0}`);
    
    // Create backup of original report before overwriting
    const originalBackup = path.join(config.paths.html_report, 'config_original_backup.js');
    try {
      if (await fs.pathExists(reportPath)) {
        await fs.copy(reportPath, originalBackup);
        console.log(`📋 Original report backed up to: ${originalBackup}`);
      }
    } catch (backupError) {
      console.warn('⚠️  Could not backup original report:', backupError.message);
    }
    
    const enhancedReportData = `report(${JSON.stringify(enhancedResult, null, 2)});`;
    
    // Read original content for size comparison
    let originalContent = '';
    try {
      if (await fs.pathExists(reportPath)) {
        originalContent = await fs.readFile(reportPath, 'utf8');
      }
    } catch (error) {
      console.warn('⚠️  Could not read original content for comparison:', error.message);
    }
    
    // Write enhanced report with retry mechanism
    let writeSuccess = false;
    let writeAttempts = 0;
    const maxWriteAttempts = 3;
    
    while (!writeSuccess && writeAttempts < maxWriteAttempts) {
      try {
        writeAttempts++;
        console.log(`🔧 Writing enhanced report (attempt ${writeAttempts}/${maxWriteAttempts})...`);
        
        await fs.writeFile(reportPath, enhancedReportData, 'utf8');
        
        // Verify the write was successful by reading back
        const verifyContent = await fs.readFile(reportPath, 'utf8');
        
        // Simple verification: check if content changed and is longer than before
        const hasScenarioLabel = invalidScenarios.length > 0 ? 
          verifyContent.includes(invalidScenarios[0].scenario.label) : true;
        const hasNetworkError = verifyContent.includes('networkError');
        const sizeIncreased = verifyContent.length > originalContent.length;
        
        if (hasScenarioLabel && hasNetworkError && sizeIncreased) {
          writeSuccess = true;
          console.log(`✅ Enhanced report successfully written and verified`);
          console.log(`📊 Verified ${invalidScenarios.length} invalid scenarios in report`);
          console.log(`📈 Report size increased from ${originalContent.length} to ${verifyContent.length} bytes`);
        } else {
          console.log(`🔍 DEBUG verification details:`, {
            hasScenarioLabel,
            hasNetworkError, 
            sizeIncreased,
            originalLength: originalContent.length,
            newLength: verifyContent.length,
            searchingFor: invalidScenarios[0]?.scenario?.label
          });
          // Don't fail if it's close - just warn and continue
          if (sizeIncreased) {
            writeSuccess = true;
            console.log('⚠️  Report was written (size increased) but verification incomplete - continuing anyway');
          } else {
            throw new Error(`Enhanced content verification failed - no size increase detected`);
          }
        }
        
      } catch (writeError) {
        console.error(`❌ Write attempt ${writeAttempts} failed:`, writeError.message);
        if (writeAttempts < maxWriteAttempts) {
          console.log(`🔄 Retrying write in 1 second...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw writeError;
        }
      }
    }
    
    console.log(`📊 Final report contains: ${enhancedResult.totalScenarios} total scenarios (${enhancedResult.validScenariosCount} tested + ${enhancedResult.invalidScenariosCount} network errors)`);
    
    // Verify the file was written correctly
    console.log(`🔧 DEBUG: Verifying written file...`);
    const verifyContent = await fs.readFile(reportPath, 'utf8');
    const verifyMatch = verifyContent.match(/report\((.*)\);/s);
    if (verifyMatch) {
      const verifyData = JSON.parse(verifyMatch[1]);
      console.log(`🔧 DEBUG: Verification - file has ${verifyData.tests?.length || 0} tests`);
      const networkTestInFile = verifyData.tests?.find(t => t.pair?.label === 'network-test');
      console.log(`🔧 DEBUG: "network-test" found in file: ${networkTestInFile ? 'YES' : 'NO'}`);
      
      if (networkTestInFile) {
        console.log(`🔧 DEBUG: network-test details:`, {
          status: networkTestInFile.status,
          networkError: networkTestInFile.networkError,
          errorType: networkTestInFile.errorType
        });
      }
    } else {
      console.log(`🔧 DEBUG: Could not parse written file for verification`);
    }
    
    // Also create a backup of the enhanced report
    const backupReportPath = path.join(config.paths.html_report, `config_enhanced_${Date.now()}.js`);
    await fs.writeFile(backupReportPath, reportData, 'utf8');
    console.log(`📋 Enhanced report backup created: ${backupReportPath}`);
    
    return enhancedResult;
    
  } catch (error) {
    console.error('Error appending invalid scenarios to report:', error);
    throw error;
  }
}

// Helper function to create auto-backup
async function createAutoBackup(projectId, configPath, config, description = 'Automated backup created after test execution') {
  try {
    console.log('📦 Creating auto-backup...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `auto_backup_${timestamp}`;
    const backupId = `${timestamp}_${backupName}`;
    const backupDir = path.join(__dirname, 'backstop_data', projectId, 'backups', backupId);
    
    console.log(`📁 Creating backup directory: ${backupDir}`);
    await fs.ensureDir(backupDir);
    
    // Parse current test results for metadata
    const reportPath = path.join(config.paths.html_report, 'config.js');
    console.log(`📄 Looking for report at: ${reportPath}`);
    let testResults = null;
    if (await fs.pathExists(reportPath)) {
      console.log('📄 Report found, parsing results...');
      const resultsContent = await fs.readFile(reportPath, 'utf8');
      testResults = parseBackstopResults(resultsContent);
    } else {
      console.log('⚠️  Report config.js not found at expected path');
    }
    
    // Create backup metadata
    const backupMetadata = {
      id: backupId,
      name: `Auto Backup - ${new Date().toLocaleDateString()}`,
      description,
      projectId,
      timestamp: new Date().toISOString(),
      testSummary: {
        totalTests: testResults?.tests?.length || 0,
        passedTests: testResults?.tests?.filter(t => t.status === 'pass')?.length || 0,
        failedTests: testResults?.tests?.filter(t => t.status === 'fail')?.length || 0,
        avgMismatch: testResults?.tests?.filter(t => t.status === 'fail')
          .reduce((acc, t) => acc + parseFloat(t.pair?.diff?.misMatchPercentage || 0), 0) / 
          (testResults?.tests?.filter(t => t.status === 'fail')?.length || 1)
      },
      scenarios: testResults?.tests?.map(test => ({
        label: test.pair.label,
        viewport: test.pair.viewportLabel,
        status: test.status,
        mismatchPercentage: test.pair?.diff?.misMatchPercentage || 0,
        url: test.pair.url
      })) || []
    };
    
    // Copy all test artifacts
    console.log('📁 Copying test artifacts to backup...');
    await Promise.all([
      // Copy HTML report
      fs.copy(path.join(config.paths.html_report), path.join(backupDir, 'html_report')),
      // Copy test images
      fs.copy(path.join(config.paths.bitmaps_test), path.join(backupDir, 'bitmaps_test')),
      // Copy reference images
      fs.copy(path.join(config.paths.bitmaps_reference), path.join(backupDir, 'bitmaps_reference')),
      // Save metadata
      fs.writeJson(path.join(backupDir, 'backup-metadata.json'), backupMetadata, { spaces: 2 }),
      // Save raw config
      fs.copy(configPath, path.join(backupDir, 'backstop-config.json'))
    ]);
    
    console.log(`✅ Auto-backup created successfully: ${backupId}`);
    console.log(`📊 Backup contains ${backupMetadata.testSummary.totalTests} test results`);
    
    // Emit backup creation notification
    io.emit('backup-created', {
      projectId,
      backupId,
      name: backupMetadata.name,
      timestamp: backupMetadata.timestamp
    });
    
    return { success: true, backupId, backupMetadata };
  } catch (backupError) {
    console.error('❌ Failed to create auto-backup:', backupError);
    console.error('❌ Backup error details:', backupError.stack);
    return { success: false, error: backupError.message };
  }
}

// Add request logging for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Add error logging middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  console.error('Stack:', err.stack);
  res.status(500).json({ error: err.message });
});

// =================== PROJECT MANAGEMENT ENDPOINTS ===================

// Get all projects
app.get('/api/projects', async (req, res) => {
  try {
    console.log('Reading projects from:', PROJECTS_FILE);
    if (!await fs.pathExists(PROJECTS_FILE)) {
      console.log('Projects file does not exist');
      return res.json([]);
    }
    const projects = await fs.readJson(PROJECTS_FILE);
    
    // Add scenario count and status for each project
    const projectsWithStats = await Promise.all(projects.map(async (project) => {
      try {
        const { configPath } = await validateProject(project.id);
        if (await fs.pathExists(configPath)) {
          const config = await fs.readJson(configPath);
          return {
            ...project,
            scenarioCount: config.scenarios?.length || 0,
            hasConfig: true
          };
        }
        return { ...project, scenarioCount: 0, hasConfig: false };
      } catch (err) {
        return { ...project, scenarioCount: 0, hasConfig: false };
      }
    }));
    
    return res.json(projectsWithStats);
  } catch (err) {
    console.error('Error loading projects:', err);
    return res.status(500).json({ error: 'Failed to load projects' });
  }
});

// Create new project
app.post('/api/projects', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const projects = await fs.readJson(PROJECTS_FILE);
    const newProject = {
      id: uuidv4(),
      name,
      createdAt: new Date().toISOString()
    };
    
    projects.push(newProject);
    await fs.writeJson(PROJECTS_FILE, projects, { spaces: 2 });

    // Create project directory structure
    const projectDir = path.join(__dirname, 'backstop_data', newProject.id);
    const projectPaths = {
      base: projectDir,
      reference: path.join(projectDir, 'bitmaps_reference'),
      test: path.join(projectDir, 'bitmaps_test'),
      scripts: path.join(projectDir, 'engine_scripts'),
      html: path.join(projectDir, 'html_report'),
      ci: path.join(projectDir, 'ci_report')
    };

    // Create directories
    await Promise.all(Object.values(projectPaths).map(p => fs.ensureDir(p)));
    
    // Copy default engine scripts
    const defaultScriptsDir = path.join(__dirname, 'backstop_data', 'engine_scripts');
    if (await fs.pathExists(defaultScriptsDir)) {
      await fs.copy(defaultScriptsDir, projectPaths.scripts, { overwrite: false });
    }
    
    // Initialize backstop.json config
    const config = {
      id: `backstop_${newProject.id}`,
      viewports: DEFAULT_VIEWPORTS,
      scenarios: [],
      paths: {
        bitmaps_reference: projectPaths.reference,
        bitmaps_test: projectPaths.test,
        engine_scripts: projectPaths.scripts,
        html_report: projectPaths.html,
        ci_report: projectPaths.ci
      },
      report: ['browser'],
      engine: 'puppeteer',
      engineOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: 'new',
        defaultViewport: null
      },
      asyncCaptureLimit: 1,
      asyncCompareLimit: 50,
      debug: false,
      debugWindow: false,
      scenarioLogsInReports: true,
      puppeteerOffscreenCapture: true
    };
    
    await fs.writeJson(path.join(projectDir, 'backstop.json'), config, { spaces: 2 });

    res.status(201).json(newProject);
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ 
      error: 'Failed to create project',
      details: err.message
    });
  }
});

// Delete project
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const projects = await fs.readJson(PROJECTS_FILE);
    
    const updatedProjects = projects.filter(p => p.id !== id);
    await fs.writeJson(PROJECTS_FILE, updatedProjects, { spaces: 2 });

    // Remove project directory
    const projectDir = path.join(__dirname, 'backstop_data', id);
    await fs.remove(projectDir);

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Initialize project structure
app.post('/api/projects/:projectId/initialize', async (req, res) => {
  try {
    const { projectId } = req.params;
    await validateProject(projectId);
    
    const initializeDir = path.join(__dirname, 'backstop_data', projectId);
    const initializePaths = {
      base: initializeDir,
      reference: path.join(initializeDir, 'bitmaps_reference'),
      test: path.join(initializeDir, 'bitmaps_test'),
      scripts: path.join(initializeDir, 'engine_scripts'),
      html: path.join(initializeDir, 'html_report'),
      ci: path.join(initializeDir, 'ci_report')
    };

    // Create directories
    await Promise.all(Object.values(initializePaths).map(p => fs.ensureDir(p)));
    
    // Copy default engine scripts
    const defaultScriptsDir = path.join(__dirname, 'backstop_data', 'engine_scripts');
    if (await fs.pathExists(defaultScriptsDir)) {
      await fs.copy(defaultScriptsDir, initializePaths.scripts, { overwrite: false });
    }

    res.json({ message: 'Project structure initialized successfully' });
  } catch (err) {
    console.error('Error initializing project structure:', err);
    res.status(500).json({ error: 'Failed to initialize project structure' });
  }
});

// =================== PROJECT-SCOPED CONFIG ENDPOINTS ===================

// Get project config
app.get('/api/projects/:projectId/config', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { configPath } = await validateProject(projectId);
    const config = await fs.readJson(configPath);
    res.json(config);
  } catch (err) {
    console.error('Error loading config:', err);
    if (err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ 
        error: 'Failed to load config',
        details: err.message
      });
    }
  }
});

// Update project config
app.post('/api/projects/:projectId/config', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { configPath } = await validateProject(projectId);
    const incomingConfig = req.body;
    
    const config = {
      ...incomingConfig,
      id: `backstop_${projectId}`,
      projectId,
      paths: {
        bitmaps_reference: path.join(__dirname, 'backstop_data', projectId, 'bitmaps_reference'),
        bitmaps_test: path.join(__dirname, 'backstop_data', projectId, 'bitmaps_test'),
        engine_scripts: path.join(__dirname, 'backstop_data', projectId, 'engine_scripts'),
        html_report: path.join(__dirname, 'backstop_data', projectId, 'html_report'),
        ci_report: path.join(__dirname, 'backstop_data', projectId, 'ci_report')
      }
    };
    
    await fs.writeJson(configPath, config, { spaces: 2 });
    res.json({ message: 'Configuration updated successfully' });
  } catch (err) {
    console.error('Error updating config:', err);
    if (err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ 
        error: 'Failed to update config',
        details: err.message
      });
    }
  }
});

// =================== PROJECT-SCOPED SCENARIO ENDPOINTS ===================

// Get project scenarios
app.get('/api/projects/:projectId/scenarios', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { configPath } = await validateProject(projectId);
    const config = await fs.readJson(configPath);
    res.json({ scenarios: config.scenarios || [] });
  } catch (err) {
    console.error('Error loading scenarios:', err);
    if (err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ 
        error: 'Failed to load scenarios',
        details: err.message
      });
    }
  }
});

// Update project scenarios
app.post('/api/projects/:projectId/scenarios', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { configPath } = await validateProject(projectId);
    const config = await fs.readJson(configPath);
    config.scenarios = req.body.scenarios;
    await fs.writeJson(configPath, config, { spaces: 2 });
    res.json({ message: 'Scenarios saved successfully' });
  } catch (err) {
    console.error('Error saving scenarios:', err);
    if (err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ 
        error: 'Failed to save scenarios',
        details: err.message
      });
    }
  }
});

// =================== PROJECT-SCOPED TEST ENDPOINTS ===================

// Get project test results
app.get('/api/projects/:projectId/test-results', async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log('Getting test results for project:', projectId);
    
    await validateProject(projectId);
    
    // First, try to get enhanced results from config.js (includes invalid scenarios)
    const enhancedResults = await getEnhancedTestResults(projectId);
    if (enhancedResults) {
      console.log(`📊 Returning enhanced test results: ${enhancedResults.tests?.length || 0} total tests`);
      return res.json(enhancedResults);
    }
    
    // Fallback to original method if enhanced results not available
    const results = await getLatestTestResults(projectId);
    
    if (!results) {
      return res.status(404).json({ error: 'No test results found for this project' });
    }
    res.json(results);
  } catch (err) {
    console.error('Error fetching test results:', err);
    if (err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch test results',
        details: err.message
      });
    }
  }
});

// Helper function to get enhanced test results (includes invalid scenarios)
async function getEnhancedTestResults(projectId) {
  try {
    const htmlReportPath = path.join(__dirname, 'backstop_data', projectId, 'html_report', 'config.js');
    
    if (!await fs.pathExists(htmlReportPath)) {
      console.log('📄 Enhanced config.js not found, falling back to standard results');
      return null;
    }
    
    // Read the enhanced config.js file
    const configContent = await fs.readFile(htmlReportPath, 'utf8');
    const reportMatch = configContent.match(/report\((.*)\);/s);
    
    if (!reportMatch) {
      console.log('⚠️  Could not parse enhanced config.js file');
      return null;
    }
    
    const enhancedReport = JSON.parse(reportMatch[1]);
    
    // Add metadata about the enhancement
    const enhancedResults = {
      ...enhancedReport,
      isEnhanced: true,
      hasNetworkErrors: enhancedReport.hasNetworkErrors || false,
      networkErrorCount: enhancedReport.networkErrorCount || 0,
      totalTests: enhancedReport.tests?.length || 0,
      validTests: enhancedReport.tests?.filter(test => !test.networkError)?.length || 0,
      invalidTests: enhancedReport.tests?.filter(test => test.networkError)?.length || 0,
      testSuite: {
        name: enhancedReport.testSuite || `backstop_${projectId}`,
        date: new Date().toISOString(), // Use current date for enhanced reports
        enhanced: true
      }
    };
    
    console.log(`📊 Enhanced results summary: ${enhancedResults.totalTests} total (${enhancedResults.validTests} valid + ${enhancedResults.invalidTests} network errors)`);
    
    return enhancedResults;
    
  } catch (error) {
    console.error('❌ Error reading enhanced test results:', error);
    return null;
  }
}

// Run BackstopJS test for project
app.post('/api/projects/:projectId/test', async (req, res) => {
  let tempConfigPath = null; // For cleanup
  let configToUse = null;
  let validScenarios = []; // Move outside try block for catch block access
  let invalidScenarios = []; // Move outside try block for catch block access
  let config = null; // Move outside try block for catch block access
  const { projectId } = req.params; // Move projectId outside try block
  
  console.log(`\n🚀 === TEST REQUEST RECEIVED ===`);
  console.log(`📝 Project ID: ${projectId}`);
  console.log(`🔍 Filter: ${req.body.filter || 'none'}`);
  console.log(`📋 Request body:`, req.body);
  
  try {
    console.log(`📂 Validating project: ${projectId}`);
    const { configPath } = await validateProject(projectId);
    configToUse = configPath; // Initialize with original config path
    
    console.log(`📄 Config path: ${configPath}`);
    if (!await fs.pathExists(configPath)) {
      return res.status(404).json({ error: 'Config not found for this project' });
    }

    console.log(`📖 Reading configuration...`);
    config = await fs.readJson(configPath);
    console.log(`📊 Found ${config.scenarios?.length || 0} scenarios in configuration`);
    
    // Log scenario names
    if (config.scenarios) {
      console.log(`📋 Available scenarios:`);
      config.scenarios.forEach((scenario, index) => {
        console.log(`   ${index + 1}. "${scenario.label}" -> ${scenario.url}`);
      });
    }
    // Ensure all paths exist
    await Promise.all([
      fs.ensureDir(config.paths.bitmaps_reference),
      fs.ensureDir(config.paths.bitmaps_test),
      fs.ensureDir(config.paths.html_report)
    ]);

    // ENHANCED PRE-VALIDATION: Check all URLs and separate valid/invalid scenarios
    console.log('🔍 Enhanced pre-validation: Checking all URLs to prevent BackstopJS interruption...');
    io.emit('test-progress', {
      status: 'validating',
      percent: 5,
      message: 'Pre-validating all URLs to ensure stable test execution...'
    });

    // validScenarios and invalidScenarios already declared outside try block
    const validationResults = [];
    
    const scenariosToValidate = config.scenarios || [];
    
    for (let i = 0; i < scenariosToValidate.length; i++) {
      const scenario = scenariosToValidate[i];
      const progressPercent = 5 + ((i / scenariosToValidate.length) * 15); // 5% to 20%
      
      if (!scenario.url) {
        console.warn(`⚠️ Skipping scenario "${scenario.label}" - no URL provided`);
        invalidScenarios.push({
          scenario,
          reason: 'NO_URL',
          message: 'No URL provided for this scenario'
        });
        continue;
      }
      
      console.log(`🌐 Validating (${i + 1}/${scenariosToValidate.length}): ${scenario.url}`);
      io.emit('test-progress', {
        status: 'validating',
        percent: progressPercent,
        message: `Validating URLs... (${i + 1}/${scenariosToValidate.length}) ${scenario.label}`
      });
      
      const validation = await validateUrl(scenario.url);
      validationResults.push({ scenario, validation });
      
      console.log(`🔍 Validation result for "${scenario.label}":`, {
        url: scenario.url,
        valid: validation.valid,
        type: validation.type,
        message: validation.message,
        severity: validation.severity
      });
      
      if (validation.valid) {
        validScenarios.push(scenario);
        console.log(`✅ Valid: ${scenario.label} - Added to BackstopJS execution`);
      } else {
        console.warn(`❌ Invalid: ${scenario.label} - ${validation.message}`);
        invalidScenarios.push({
          scenario,
          reason: validation.type,
          message: validation.message,
          validation
        });
        
        console.log(`🚫 Added to invalid scenarios list:`, {
          label: scenario.label,
          reason: validation.type,
          message: validation.message
        });
        
        // Emit warning but don't stop the test
        io.emit('test-warning', {
          scenario: scenario.label,
          type: validation.type,
          message: validation.message,
          severity: validation.severity,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Report validation summary
    console.log(`\n📊 URL Validation Summary:`);
    console.log(`✅ Valid scenarios: ${validScenarios.length}`);
    console.log(`❌ Invalid scenarios: ${invalidScenarios.length}`);
    console.log(`📋 Total scenarios: ${scenariosToValidate.length}`);
    
    if (invalidScenarios.length > 0) {
      console.log(`\n🚫 Invalid scenarios (will be excluded from BackstopJS but included in final report):`);
      invalidScenarios.forEach(({ scenario, reason, message }) => {
        console.log(`   - ${scenario.label}: ${reason} - ${message}`);
      });
    }

    // If no valid scenarios, return error
    if (validScenarios.length === 0) {
      io.emit('test-complete', {
        status: 'failed',
        percent: 100,
        message: 'No valid URLs found - all scenarios have network issues',
        invalidScenarios: invalidScenarios.length
      });

      return res.status(400).json({
        success: false,
        error: 'No valid URLs found',
        message: 'All scenarios have network connectivity issues',
        invalidScenarios: invalidScenarios.length,
        details: invalidScenarios.map(({ scenario, reason, message }) => ({
          scenario: scenario.label,
          reason,
          message
        }))
      });
    }

    // CREATE FILTERED CONFIG WITH ONLY VALID SCENARIOS
    // This ensures BackstopJS won't be interrupted by network issues
    console.log(`\n🔧 Creating filtered config with ${validScenarios.length} valid scenarios...`);
    
    const validConfig = {
      ...config,
      scenarios: validScenarios
    };
    
    // Create temporary config file with only valid scenarios
    const validConfigPath = path.join(path.dirname(configPath), 'temp-valid-scenarios-config.json');
    await fs.writeJson(validConfigPath, validConfig, { spaces: 2 });
    configToUse = validConfigPath;
    tempConfigPath = validConfigPath; // For cleanup

    console.log(`✅ Filtered config created: ${validScenarios.length} valid scenarios will be tested`);
    console.log(`🔄 BackstopJS will run without interruptions from network issues`);

    // Emit test start event
    io.emit('test-progress', {
      status: 'started',
      percent: 25,
      message: 'Pre-validation completed. Preparing test execution...'
    });

    // Apply scenario filtering if requested - ONLY TO VALID SCENARIOS
    if (req.body.filter) {
      console.log(`\n🔍 Applying filter to ${validScenarios.length} valid scenarios: "${req.body.filter}"`);
      const filterScenarios = req.body.filter.split('|');
      console.log(`Filter scenarios: ${filterScenarios.join(', ')}`);
      
      // Filter only the valid scenarios
      const filteredValidScenarios = validScenarios.filter(scenario => 
        filterScenarios.includes(scenario.label)
      );
      
      console.log(`Valid scenarios after filtering: ${filteredValidScenarios.length}`);
      console.log(`Filtered valid scenario labels: ${filteredValidScenarios.map(s => s.label).join(', ')}`);
      
      // Also check if any filtered scenarios were invalid (and warn user)
      const filteredInvalidScenarios = invalidScenarios.filter(item =>
        filterScenarios.includes(item.scenario.label)
      );
      
      if (filteredInvalidScenarios.length > 0) {
        console.log(`\n⚠️  Warning: ${filteredInvalidScenarios.length} filtered scenarios have network issues and will be excluded from BackstopJS:`);
        filteredInvalidScenarios.forEach(item => {
          console.log(`   ❌ "${item.scenario.label}": ${item.reason} - ${item.message}`);
        });
        console.log(`   ℹ️  These scenarios will appear as network errors in the final report`);
      }
      
      if (filteredValidScenarios.length === 0 && filteredInvalidScenarios.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No scenarios match the filter criteria',
          filter: req.body.filter,
          availableScenarios: [...validScenarios, ...invalidScenarios.map(i => i.scenario)].map(s => s.label)
        });
      }
      
      if (filteredValidScenarios.length === 0) {
        console.log('\n❌ All filtered scenarios have network issues - cannot proceed with BackstopJS execution');
        console.log('   However, network error results will still be generated in the report');
        
        // Since all filtered scenarios are invalid, we still need to generate a report with network errors
        // Create an empty BackstopJS result and enhance it with network errors
        const emptyResult = {
          tests: [],
          passed: 0,
          failed: 0,
          pending: 0
        };
        
        // Mark filtered vs non-filtered invalid scenarios for better reporting
        invalidScenarios.forEach(item => {
          item.matchedFilter = filterScenarios.includes(item.scenario.label);
        });
        
        // Enhance with ALL invalid scenarios (both filtered and non-filtered)
        // This ensures users see all network issues, not just the filtered ones
        const enhancedResult = await appendInvalidScenariosToReport(projectId, config, invalidScenarios, emptyResult);
        
        return res.status(200).json({
          success: true,
          result: enhancedResult,
          reportPath: null,
          message: `All filtered scenarios had network issues - report generated with network error results (${filteredInvalidScenarios.length} matching filter, ${invalidScenarios.length - filteredInvalidScenarios.length} others shown for awareness)`,
          hasNetworkErrors: true,
          networkErrorCount: invalidScenarios.length,
          filteredNetworkErrorCount: filteredInvalidScenarios.length
        });
      }
      
      // Update the config to use only filtered valid scenarios
      const filteredConfig = {
        ...config,
        scenarios: filteredValidScenarios
      };
      // console.log(filteredConfig, "+++++++++++++++++++++++++++++++##########");
      // Update the temp config path
      tempConfigPath = path.join(path.dirname(configPath), 'temp-filtered-valid-config.json');
      await fs.writeJson(tempConfigPath, filteredConfig, { spaces: 2 });
      configToUse = tempConfigPath;
      
      // IMPORTANT: When filtering, we need to include ALL invalid scenarios in the report
      // Not just the ones that match the filter, because users should see all network issues
      // But we'll mark which ones match the filter vs which ones don't
      console.log(`\n📋 Report will include:`);
      console.log(`   ✅ ${filteredValidScenarios.length} valid scenarios (matching filter)`);
      console.log(`   ❌ ${filteredInvalidScenarios.length} invalid scenarios (matching filter)`);
      console.log(`   ⚠️  ${invalidScenarios.length - filteredInvalidScenarios.length} invalid scenarios (not matching filter, included for awareness)`);
      
      // Mark filtered vs non-filtered invalid scenarios for better reporting
      invalidScenarios.forEach(item => {
        item.matchedFilter = filterScenarios.includes(item.scenario.label);
      });
      
      console.log(`✅ Filter applied - BackstopJS will test ${filteredValidScenarios.length} valid scenarios`);
      console.log(`📝 Report will include ${invalidScenarios.length} total network error scenarios`);
    }

    // Check for missing reference images and auto-generate if needed
    const bitmapsRefDir = config.paths.bitmaps_reference;
    let missingReference = false;
    if (Array.isArray(config.scenarios)) {
      for (const scenario of config.scenarios) {
        // Build expected reference image filename (BackstopJS default convention)
        // Example: backstop_default_<label>_<index>_<scenarioLabel>_<breakpoint>.png
        // We'll check for each scenario label and viewport
        if (scenario.referenceUrl && scenario.label && Array.isArray(config.viewports)) {
          for (let v = 0; v < config.viewports.length; v++) {
            const viewport = config.viewports[v];
            const refName = `backstop_default_${scenario.label}_${v}_${scenario.label}_${viewport.label}.png`;
            const refPath = path.join(bitmapsRefDir, refName);
            if (!await fs.pathExists(refPath)) {
              missingReference = true;
              break;
            }
          }
        }
        if (missingReference) break;
      }
    }
    if (missingReference) {
      // Auto-generate reference images before running test
      console.log('🔧 Generating missing reference images...');
      io.emit('test-progress', {
        status: 'running',
        percent: 10,
        message: 'Generating reference images...'
      });
      await backstop('reference', { config: configToUse });
    }

    // Emit progress for test execution
    io.emit('test-progress', {
      status: 'running',
      percent: 30,
      message: 'Running visual regression tests...'
    });

    // Get the config to use for progress simulation (use filtered config if created)
    const configForProgress = tempConfigPath ? await fs.readJson(configToUse) : config;
    
    // Simulate scenario-by-scenario progress
    const scenariosToTest = configForProgress.scenarios || [];
    const viewports = configForProgress.viewports || [];
    
    for (let i = 0; i < scenariosToTest.length; i++) {
      const scenario = scenariosToTest[i];
      const progressPercent = 30 + ((i / scenariosToTest.length) * 60);
      
      // Emit progress for each viewport of this scenario
      for (const viewport of viewports) {
        io.emit('test-progress', {
          status: 'running',
          percent: progressPercent,
          scenario: scenario.label,
          viewport: {
            width: viewport.width,
            height: viewport.height,
            label: viewport.label
          },
          message: `Testing scenario: ${scenario.label} (${viewport.width}x${viewport.height})`
        });
        
        // Small delay to make progress visible
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    const result = await backstop('test', {
      config: configToUse,
      // Remove filter parameter since we're using filtered config file
    });

    console.log('✅ BackstopJS test completed successfully');
    console.log(`📊 BackstopJS result summary: ${result?.tests?.length || 0} tests executed`);
    console.log(`📋 Invalid scenarios count from validation phase: ${invalidScenarios.length}`);
    
    if (invalidScenarios.length > 0) {
      console.log(`🔍 Invalid scenarios detected during validation:`);
      invalidScenarios.forEach(({ scenario, reason, message }, index) => {
        console.log(`   ${index + 1}. "${scenario.label}" - ${reason}: ${message}`);
      });
    } else {
      console.log(`ℹ️  No invalid scenarios detected during validation - all URLs were accessible`);
    }

    console.log('📦 Creating auto-backup...');

    // Parse and emit individual scenario results
    if (result && result.tests) {
      for (const test of result.tests) {
        const scenarioName = test.pair.label;
        const viewport = test.pair.viewport;
        const status = test.status === 'pass' ? 'passed' : 'failed';
        const mismatchPercentage = test.diff ? parseFloat(test.diff.misMatchPercentage || 0) : 0;
        
        // Extract additional test details
        const testDetails = {
          executionTime: test.duration || null,
          dimensions: test.pair.viewportSize || viewport,
          selector: test.pair.selector || 'document',
          engineOptions: test.pair.engineOptions || {},
          hasInteractions: !!(test.pair.clickSelector || test.pair.hoverSelector),
          hasDelay: !!(test.pair.delay && test.pair.delay > 0),
          requiresSameDimensions: test.pair.requireSameDimensions || false
        };
        
        io.emit('test-progress', {
          status: 'scenario-complete',
          scenario: scenarioName,
          scenarioStatus: status,
          mismatchPercentage,
          viewport: {
            width: viewport.width,
            height: viewport.height,
            label: viewport.label
          },
          testDetails,
          timestamp: new Date().toISOString(),
          message: `${scenarioName} (${viewport.width}x${viewport.height}) - ${status === 'passed' ? 'Passed' : `Failed (${mismatchPercentage}% mismatch)`}`
        });
      }
    }

    // Emit completion
    const completionMessage = invalidScenarios.length > 0 
      ? `Test completed: ${validScenarios.length} tested, ${invalidScenarios.length} network errors excluded` 
      : 'Test completed successfully';
      
    io.emit('test-complete', {
      status: 'done',
      percent: 100,
      message: completionMessage,
      totalScenarios: validScenarios.length + invalidScenarios.length,
      validScenarios: validScenarios.length,
      invalidScenarios: invalidScenarios.length,
      hasNetworkErrors: invalidScenarios.length > 0
    });

    // Automatically create a backup of the test results
    await createAutoBackup(projectId, configPath, config, 'Automated backup created after successful test execution');

    res.json({
      success: true,
      result,
      message: completionMessage,
      reportPath: `/api/projects/${projectId}/report/index.html`,
      enhancedReport: invalidScenarios.length > 0,
      totalScenarios: validScenarios.length + invalidScenarios.length,
      validScenarios: validScenarios.length,
      invalidScenarios: invalidScenarios.length,
      networkErrorDetails: invalidScenarios.length > 0 ? invalidScenarios.map(({ scenario, reason, message }) => ({
        scenario: scenario.label,
        reason,
        message
      })) : []
    });

    // CRITICAL: Enhance report AFTER returning response to prevent BackstopJS from overwriting
    // This solves the timing issue where BackstopJS continues writing files asynchronously
    if (invalidScenarios.length > 0) {
      console.log(`🕒 Starting delayed report enhancement for ${invalidScenarios.length} invalid scenarios...`);
      
      // Delay to ensure BackstopJS has completely finished all async operations
      setTimeout(async () => {
        try {
          console.log('⏱️  BackstopJS has returned, now waiting additional time for async file operations...');
          
          // Wait for BackstopJS to finish all async file writing
          const reportPath = path.join(config.paths.html_report, 'config.js');
          let reportStable = false;
          let attempts = 0;
          const maxAttempts = 30; // Wait up to 15 seconds
          
          while (!reportStable && attempts < maxAttempts) {
            try {
              if (await fs.pathExists(reportPath)) {
                const reportContent = await fs.readFile(reportPath, 'utf8');
                
                // Check if file is stable (wait for two consecutive reads to be identical)
                await new Promise(resolve => setTimeout(resolve, 200));
                const reportContent2 = await fs.readFile(reportPath, 'utf8');
                
                if (reportContent === reportContent2 && reportContent.length > 100 && reportContent.includes('report(') && reportContent.includes(');')) {
                  console.log(`✅ BackstopJS report file is stable after ${attempts * 500}ms`);
                  reportStable = true;
                } else {
                  attempts++;
                  console.log(`🔄 Waiting for report file to stabilize... (${attempts}/${maxAttempts})`);
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              } else {
                attempts++;
                console.log(`🔄 Waiting for report file to exist... (${attempts}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            } catch (error) {
              attempts++;
              console.log(`⚠️  Error checking report stability (${attempts}/${maxAttempts}):`, error.message);
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          console.log('🔧 Starting delayed report enhancement process...');
          
          // Now enhance the report with invalid scenarios using our backup and stable system
          console.log('🔧 Reading current BackstopJS report for delayed enhancement...');
          
          // Ensure we have a proper result structure for the enhancement
          const enhancementResult = result || { 
            tests: [], 
            hasNetworkErrors: false, 
            networkErrorCount: 0 
          };
          
          console.log(`🔧 DEBUG: Enhancement result structure:`, {
            hasResult: !!result,
            testsCount: enhancementResult.tests?.length || 0,
            resultType: typeof enhancementResult
          });
          
          const enhancedResult = await appendInvalidScenariosToReport(projectId, config, invalidScenarios, enhancementResult);
          console.log('✅ Successfully enhanced report with invalid scenarios after delay');
          console.log(`📊 Enhanced result summary: ${enhancedResult.tests?.length || 0} total tests (including ${invalidScenarios.length} network errors)`);
          
          // Verify the enhancement was actually written
          setTimeout(async () => {
            try {
              const verifyPath = path.join(config.paths.html_report, 'config.js');
              const finalContent = await fs.readFile(verifyPath, 'utf8');
              const hasNetworkErrors = finalContent.includes('networkError');
              const hasInvalidLabel = invalidScenarios.some(inv => finalContent.includes(inv.scenario.label));
              
              console.log(`🔍 Final verification: networkErrors=${hasNetworkErrors}, invalidScenarios=${hasInvalidLabel}`);
              
              if (hasNetworkErrors && hasInvalidLabel) {
                console.log('🎉 SUCCESS: Final report contains enhanced data with invalid scenarios!');
              } else {
                console.log('⚠️  WARNING: Final report may not contain complete enhanced data');
              }
            } catch (verifyError) {
              console.error('❌ Could not verify final report:', verifyError.message);
            }
          }, 1000);
          
          // Emit socket update to notify frontend about the enhancement
          io.emit('report-enhanced', {
            status: 'enhanced',
            totalScenarios: enhancedResult.tests?.length || 0,
            networkErrorCount: invalidScenarios.length,
            message: `Report enhanced with ${invalidScenarios.length} invalid scenarios`,
            timestamp: new Date().toISOString()
          });
          
        } catch (delayedEnhancementError) {
          console.error('❌ Failed to enhance report with delayed enhancement:', delayedEnhancementError);
          console.error('Error details:', delayedEnhancementError.stack);
          
          // Emit error to frontend
          io.emit('report-enhancement-failed', {
            status: 'error',
            error: delayedEnhancementError.message,
            timestamp: new Date().toISOString()
          });
        }
      }, 3000); // 3 second delay to ensure BackstopJS is completely done
      
      console.log('⏱️  Response sent to client, report enhancement scheduled for 3 seconds delay');
    }
  } catch (error) {
    // BackstopJS throws error when there are visual differences, but this is expected
    console.error('BackstopJS test error (may be expected):', error);
    console.log('⚠️  Test completed with errors/differences, attempting to create auto-backup...');
    
    try {
      const { configPath } = await validateProject(projectId);
      const config = await fs.readJson(configPath);
      const reportPath = path.join(config.paths.html_report, 'index.html');
      const reportExists = await fs.pathExists(reportPath);
      
      // Emit completion with differences
      io.emit('test-complete', {
        status: 'completed_with_differences',
        percent: 100,
        message: 'Test completed with visual differences detected'
      });

      // Automatically create a backup of the test results (even with differences)
      await createAutoBackup(projectId, configPath, config, 'Automated backup created after test execution with visual differences');
      
      res.status(200).json({ 
        success: false, 
        error: error.message,
        reportPath: reportExists ? `/api/projects/${projectId}/report/index.html` : null,
        message: 'Test completed with visual differences detected',
        enhancedReport: invalidScenarios.length > 0,
        totalScenarios: (validScenarios?.length || 0) + (invalidScenarios?.length || 0),
        validScenarios: validScenarios?.length || 0,
        invalidScenarios: invalidScenarios?.length || 0,
        networkErrorDetails: invalidScenarios?.length > 0 ? invalidScenarios.map(({ scenario, reason, message }) => ({
          scenario: scenario.label,
          reason,
          message
        })) : []
      });

      // CRITICAL: Enhance report AFTER returning response (CATCH BLOCK VERSION)
      // This solves the timing issue where BackstopJS continues writing files asynchronously
      if (invalidScenarios && invalidScenarios.length > 0) {
        console.log(`🕒 Starting delayed report enhancement in catch block for ${invalidScenarios.length} invalid scenarios...`);
        
        // Delay to ensure BackstopJS has completely finished all async operations
        setTimeout(async () => {
          try {
            console.log('⏱️  BackstopJS has returned (with errors), now waiting additional time for async file operations...');
            
            // Wait for BackstopJS to finish all async file writing
            const reportPath = path.join(config.paths.html_report, 'config.js');
            let reportStable = false;
            let attempts = 0;
            const maxAttempts = 30; // Wait up to 15 seconds
            
            while (!reportStable && attempts < maxAttempts) {
              try {
                if (await fs.pathExists(reportPath)) {
                  const reportContent = await fs.readFile(reportPath, 'utf8');
                  
                  // Check if file is stable (wait for two consecutive reads to be identical)
                  await new Promise(resolve => setTimeout(resolve, 200));
                  const reportContent2 = await fs.readFile(reportPath, 'utf8');
                  
                  if (reportContent === reportContent2 && reportContent.length > 100 && reportContent.includes('report(') && reportContent.includes(');')) {
                    console.log(`✅ BackstopJS report file is stable after ${attempts * 500}ms (catch block)`);
                    reportStable = true;
                  } else {
                    attempts++;
                    console.log(`🔄 Waiting for report file to stabilize in catch block... (${attempts}/${maxAttempts})`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                  }
                } else {
                  attempts++;
                  console.log(`🔄 Waiting for report file to exist in catch block... (${attempts}/${maxAttempts})`);
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              } catch (error) {
                attempts++;
                console.log(`⚠️  Error checking report stability in catch block (${attempts}/${maxAttempts}):`, error.message);
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }

            console.log('🔧 Starting delayed report enhancement process in catch block...');
            
            // Create a proper result structure from the error context
            // BackstopJS error usually contains the result data
            let backstopResult = null;
            if (error.name === 'BackstopException' && error.result) {
              backstopResult = error.result;
            } else {
              // Try to read the existing report to get test results
              try {
                const reportContent = await fs.readFile(reportPath, 'utf8');
                const reportMatch = reportContent.match(/report\((.*)\);/s);
                if (reportMatch) {
                  backstopResult = JSON.parse(reportMatch[1]);
                }
              } catch (parseError) {
                console.warn('⚠️  Could not parse existing report, using empty result structure');
                backstopResult = { tests: [] };
              }
            }
            
            // Ensure we have a proper result structure for the enhancement
            const enhancementResult = backstopResult || { 
              tests: [], 
              hasNetworkErrors: false, 
              networkErrorCount: 0 
            };
            
            console.log(`🔧 DEBUG: Catch block enhancement result structure:`, {
              hasResult: !!backstopResult,
              testsCount: enhancementResult.tests?.length || 0,
              resultType: typeof enhancementResult
            });
            
            const enhancedResult = await appendInvalidScenariosToReport(projectId, config, invalidScenarios, enhancementResult);
            console.log('✅ Successfully enhanced report with invalid scenarios after delay (catch block)');
            console.log(`📊 Enhanced result summary: ${enhancedResult.tests?.length || 0} total tests (including ${invalidScenarios.length} network errors)`);
            
            // Verify the enhancement was actually written
            setTimeout(async () => {
              try {
                const verifyPath = path.join(config.paths.html_report, 'config.js');
                const finalContent = await fs.readFile(verifyPath, 'utf8');
                const hasNetworkErrors = finalContent.includes('networkError');
                const hasInvalidLabel = invalidScenarios.some(inv => finalContent.includes(inv.scenario.label));
                
                console.log(`🔍 Final verification (catch block): networkErrors=${hasNetworkErrors}, invalidScenarios=${hasInvalidLabel}`);
                
                if (hasNetworkErrors && hasInvalidLabel) {
                  console.log('🎉 SUCCESS: Final report contains enhanced data with invalid scenarios (catch block)!');
                } else {
                  console.log('⚠️  WARNING: Final report may not contain complete enhanced data (catch block)');
                }
              } catch (verifyError) {
                console.error('❌ Could not verify final report (catch block):', verifyError.message);
              }
            }, 1000);
            
            // Emit socket update to notify frontend about the enhancement
            io.emit('report-enhanced', {
              status: 'enhanced',
              totalScenarios: enhancedResult.tests?.length || 0,
              networkErrorCount: invalidScenarios.length,
              message: `Report enhanced with ${invalidScenarios.length} invalid scenarios (with visual differences)`,
              timestamp: new Date().toISOString()
            });
            
          } catch (delayedEnhancementError) {
            console.error('❌ Failed to enhance report with delayed enhancement (catch block):', delayedEnhancementError);
            console.error('Error details:', delayedEnhancementError.stack);
            
            // Emit error to frontend
            io.emit('report-enhancement-failed', {
              status: 'error',
              error: delayedEnhancementError.message,
              timestamp: new Date().toISOString()
            });
          }
        }, 3000); // 3 second delay to ensure BackstopJS is completely done
        
        console.log('⏱️  Response sent to client (catch block), report enhancement scheduled for 3 seconds delay');
      }
    } catch (configError) {
      res.status(500).json({ 
        success: false,
        error: `Configuration error: ${configError.message}`,
        reportPath: null,
        message: 'Test failed due to configuration error'
      });
    }
  } finally {
    // Try to create auto-backup even if test failed, but only if some artifacts exist
    try {
      const { configPath } = await validateProject(projectId);
      const config = await fs.readJson(configPath);
      
      // Check if there are any test artifacts to backup
      const hasHtmlReport = await fs.pathExists(path.join(config.paths.html_report, 'index.html'));
      const hasTestImages = await fs.pathExists(config.paths.bitmaps_test);
      const hasRefImages = await fs.pathExists(config.paths.bitmaps_reference);
      
      if (hasHtmlReport || hasTestImages || hasRefImages) {
        console.log('🔍 Found test artifacts, creating backup regardless of test outcome...');
        await createAutoBackup(projectId, configPath, config, 'Automated backup created after test run (may include partial results)');
      } else {
        console.log('🚫 No test artifacts found, skipping backup creation');
      }
    } catch (finalBackupError) {
      console.error('⚠️  Failed to create final auto-backup:', finalBackupError.message);
      // Don't throw error in finally block
    }
    
    // Clean up temporary config file if it was created
    if (tempConfigPath && await fs.pathExists(tempConfigPath)) {
      try {
        await fs.remove(tempConfigPath);
        console.log('Cleaned up temporary filtered config file');
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary config:', cleanupError.message);
      }
    }
  }
});

// Run BackstopJS reference for project
app.post('/api/projects/:projectId/reference', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { configPath } = await validateProject(projectId);
    const config = await fs.readJson(configPath);
    
    // Ensure reference paths exist
    await fs.ensureDir(config.paths.bitmaps_reference);
    
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
    console.error('Error creating reference:', error);
    res.status(500).json({ error: error.message });
  }
});

// Run BackstopJS approve for project
app.post('/api/projects/:projectId/approve', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { configPath } = await validateProject(projectId);
    const config = await fs.readJson(configPath);
    
    // Ensure reference paths exist
    await fs.ensureDir(config.paths.bitmaps_reference);
    
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
    console.error('Error approving test results:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================== PROJECT-SCOPED SCREENSHOT ENDPOINTS ===================

// Configure multer for screenshot uploads
const uploadsDir = path.join(__dirname, 'uploads');
fs.ensureDirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const { scenario, viewport } = req.body || {};
    const timestamp = Date.now();
    const sanitizedScenario = scenario ? scenario.replace(/[^a-zA-Z0-9]/g, '_') : 'unknown';
    const sanitizedViewport = viewport ? viewport.replace(/[^a-zA-Z0-9]/g, '_') : 'unknown';
    const sanitizedOriginalName = file.originalname.replace(/[<>:"/\\|?*]/g, '_');
    
    const filename = `${sanitizedScenario}_${sanitizedViewport}_${timestamp}_${sanitizedOriginalName}`;
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

// Upload screenshot for project
app.post('/api/projects/:projectId/screenshots/upload', upload.single('screenshot'), async (req, res) => {
  try {
    const { projectId } = req.params;
    await validateProject(projectId);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { scenario, viewport, isReference } = req.body;
    
    if (!scenario || !viewport) {
      return res.status(400).json({ error: 'Scenario and viewport are required' });
    }
    
    // Store screenshot metadata
    const scenarioDataPath = path.join(__dirname, 'backstop_data', projectId, 'scenario_screenshots.json');
    let scenarioScreenshots = {};
    
    if (await fs.pathExists(scenarioDataPath)) {
      scenarioScreenshots = await fs.readJson(scenarioDataPath);
    }
    
    const scenarioKey = `${scenario}_${viewport}`;
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
    
    scenarioScreenshots[scenarioKey].screenshots.push(screenshotData);
    
    if (isReference === 'true') {
      scenarioScreenshots[scenarioKey].referenceScreenshot = screenshotData;
    }
    
    await fs.writeJson(scenarioDataPath, scenarioScreenshots, { spaces: 2 });
    
    res.json({
      message: 'Screenshot uploaded successfully',
      filename: req.file.filename,
      scenarioKey,
      isReference: isReference === 'true',
      screenshotCount: scenarioScreenshots[scenarioKey].screenshots.length
    });
  } catch (error) {
    console.error('Error uploading screenshot:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get project screenshots
app.get('/api/projects/:projectId/screenshots', async (req, res) => {
  try {
    const { projectId } = req.params;
    await validateProject(projectId);
    
    const scenarioDataPath = path.join(__dirname, 'backstop_data', projectId, 'scenario_screenshots.json');
    
    if (!await fs.pathExists(scenarioDataPath)) {
      return res.json({});
    }
    
    const scenarioScreenshots = await fs.readJson(scenarioDataPath);
    res.json(scenarioScreenshots);
  } catch (error) {
    console.error('Error getting project screenshots:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve project reports
app.use('/api/projects/:projectId/report', (req, res, next) => {
  const { projectId } = req.params;
  const reportDir = path.join(__dirname, 'backstop_data', projectId, 'html_report');
  express.static(reportDir)(req, res, next);
});

// Serve project bitmap reference images
app.use('/api/projects/:projectId/bitmaps_reference', (req, res, next) => {
  const { projectId } = req.params;
  const bitmapsRefDir = path.join(__dirname, 'backstop_data', projectId, 'bitmaps_reference');
  express.static(bitmapsRefDir)(req, res, next);
});

// Serve project bitmap test images
app.use('/api/projects/:projectId/bitmaps_test', (req, res, next) => {
  const { projectId } = req.params;
  const bitmapsTestDir = path.join(__dirname, 'backstop_data', projectId, 'bitmaps_test');
  express.static(bitmapsTestDir)(req, res, next);
});

// Serve uploaded screenshots
app.use('/uploads', express.static(uploadsDir));

// Default viewports configuration
const DEFAULT_VIEWPORTS = [
  {
    label: 'phone',
    width: 320,
    height: 480
  },
  {
    label: 'tablet',
    width: 768,
    height: 1024
  },
  {
    label: 'Tablet_Landscape',
    width: 1024,
    height: 768
  },
  {
    label: 'desktop',
    width: 1920,
    height: 1080
  }
];

// Helper function to get all possible reference file patterns for a scenario
const getReferenceFilePatterns = (scenarioLabel, viewportLabel) => {
  const sanitizedScenario = scenarioLabel.trim().replace(/[^a-zA-Z0-9_]/g, '_');
  const sanitizedViewport = viewportLabel.trim().replace(/[^a-zA-Z0-9_]/g, '_');
  const referenceDir = path.join(__dirname, 'backstop_data', 'bitmaps_reference');
  
  // Return array of possible patterns for globbing
  return {
    referenceDir,
    patterns: [
      // Pattern for files with timestamp
      `*_${sanitizedScenario}_*_${sanitizedViewport}.png`,
      // Pattern for files without timestamp
      `${sanitizedScenario}_*_${sanitizedViewport}.png`
    ]
  };
};

// Helper function to find existing reference file
const findReferenceFile = async (scenarioLabel, viewportLabel) => {
  const { referenceDir, patterns } = getReferenceFilePatterns(scenarioLabel, viewportLabel);
  
  for (const pattern of patterns) {
    const files = await fs.readdir(referenceDir);
    const matchingFile = files.find(file => {
      const match = new RegExp(pattern.replace('*', '.*')).test(file);
      return match;
    });
    if (matchingFile) {
      return path.join(referenceDir, matchingFile);
    }
  }
  return null;
};

// Check if reference file exists
app.get('/api/check-reference/:scenarioLabel', async (req, res) => {
  try {
    const { scenarioLabel } = req.params;
    const { viewport = 'phone' } = req.query; // Default to phone viewport if not specified
    
    // Read the config to get available viewports
    const configPath = path.join(__dirname, 'backstop_data', 'backstop.json');
    const config = await fs.readJson(configPath);
    const viewports = config.viewports || DEFAULT_VIEWPORTS;
    
    // Check each viewport or just the specified one
    const results = {};
    const viewportsToCheck = viewport === 'all' ? viewports : [{ label: viewport }];
    
    for (const vp of viewportsToCheck) {
      const refPath = await findReferenceFile(scenarioLabel, vp.label);
      results[vp.label] = {
        exists: !!refPath,
        path: refPath
      };
    }
    
    res.json({ 
      exists: Object.values(results).some(r => r.exists), // true if any viewport has a reference
      viewports: results
    });
  } catch (error) {
    console.error('Error checking reference:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to check reference images'
    });
  }
});

// Create reference for a scenario
app.post('/api/reference', async (req, res) => {
  try {
    const { config } = req.body;
    
    // Ensure directories exist
    await fs.ensureDir(path.join(__dirname, 'backstop_data', 'bitmaps_reference'));
    
    // Create temporary config file
    const tempConfigPath = path.join(__dirname, 'backstop_data', 'temp-config.json');
    
    // Define default paths relative to backstop_data directory
    const defaultPaths = {
      bitmaps_reference: 'backstop_data/bitmaps_reference',
      bitmaps_test: 'backstop_data/bitmaps_test',
      engine_scripts: 'backstop_data/engine_scripts',
      html_report: 'backstop_data/html_report'
    };

    // Process scenarios to handle referenceUrl correctly
    const processedConfig = {
      ...config,
      scenarios: (config.scenarios || []).map(scenario => {
        if (scenario.referenceUrl) {
          // If using referenceUrl, we need to temporarily set it as the main URL
          // to capture the reference image
          return {
            ...scenario,
            originalUrl: scenario.url, // Save original URL
            url: scenario.referenceUrl, // Use reference URL for capture
          };
        }
        return scenario;
      }),
      viewports: config.viewports || DEFAULT_VIEWPORTS,
      paths: {
        ...defaultPaths,
        ...(config.paths || {})
      },
      report: ['browser'],
      engine: 'puppeteer',
      engineOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: 'new',
        defaultViewport: null
      },
      asyncCaptureLimit: 1, // Reduced to prevent memory issues
      asyncCompareLimit: 50,
      debug: false,
      debugWindow: false,
      scenarioLogsInReports: true,
      puppeteerOffscreenCapture: true
    };

    // Save the temporary config
    await fs.writeJson(tempConfigPath, processedConfig, { spaces: 2 });

    try {
      // Run backstop reference
      await backstop('reference', { 
        config: tempConfigPath,
        docker: false // Ensure we're using local Puppeteer
      });
      
      // If successful, update the main config to restore original URLs
      if (processedConfig.scenarios) {
        const updatedScenarios = processedConfig.scenarios.map(scenario => {
          if (scenario.originalUrl) {
            // Restore the original URL
            return {
              ...scenario,
              url: scenario.originalUrl,
              referenceUrl: scenario.url // Keep the reference URL
            };
          }
          return scenario;
        });
        
        await fs.writeJson(path.join(__dirname, 'backstop_data', 'backstop.json'), {
          ...config,
          scenarios: updatedScenarios
        }, { spaces: 2 });
      }
      
      // Clean up
      await fs.remove(tempConfigPath);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error during reference creation:', error);
      // Clean up even if there's an error
      await fs.remove(tempConfigPath);
      throw error;
    }
  } catch (error) {
    console.error('Error creating reference:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create necessary directories
const configDir = path.join(__dirname, 'backstop_data');
fs.ensureDirSync(configDir);

// Utility function to clean up old reference files for a scenario
const cleanupOldReferenceFiles = async (scenarioLabel, viewportLabel) => {
  try {
    const { referenceDir, patterns } = getReferenceFilePatterns(scenarioLabel, viewportLabel);
    const files = await fs.readdir(referenceDir);
    
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      const matchingFiles = files.filter(file => regex.test(file));
      
      // Keep the most recent file if there are multiple matches
      if (matchingFiles.length > 1) {
        matchingFiles.sort((a, b) => {
          const aTime = parseInt(a.split('_')[0]) || 0;
          const bTime = parseInt(b.split('_')[0]) || 0;
          return bTime - aTime;
        });
        
        // Remove all but the most recent file
        for (const file of matchingFiles.slice(1)) {
          await fs.remove(path.join(referenceDir, file));
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up reference files:', error);
  }
};

// Store scenario-screenshot associations
let scenarioScreenshots = {};

// Configuration storage
const configFilePath = path.join(configDir, 'design-comparison-config.json');

// Handle reference image upload
app.post('/api/upload-reference', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }

    const { label, viewportLabel } = req.body;
    if (!label) {
      return res.status(400).send('Label is required');
    }
    if (!viewportLabel) {
      return res.status(400).send('Viewport label is required');
    }

    // Read existing config
    const configPath = path.join(__dirname, 'backstop_data', 'backstop.json');
    const config = await fs.readJson(configPath);
    
    // Validate viewport exists
    const viewports = config.viewports || DEFAULT_VIEWPORTS;
    const viewport = viewports.find(v => v.label === viewportLabel);
    if (!viewport) {
      return res.status(400).send(`Invalid viewport label: ${viewportLabel}`);
    }

    const referencePath = getReferenceFilePath(label, viewportLabel);

    // Ensure directory exists
    await fs.ensureDir(path.dirname(referencePath));

    // Move uploaded file to reference location
    await fs.move(req.file.path, referencePath, { overwrite: true });

    // Update scenario if needed
    let scenarioUpdated = false;
    const scenarios = config.scenarios || [];
    const scenario = scenarios.find(s => s.label === label);
    
    if (!scenario) {
      // Create new scenario
      scenarios.push({
        label,
        url: '',  // User will need to set this
        referenceUrl: '',
        readySelector: '',
        delay: 0,
        requireSameDimensions: true
      });
      scenarioUpdated = true;
    }

    if (scenarioUpdated) {
      await fs.writeJson(configPath, {
        ...config,
        scenarios
      }, { spaces: 2 });
    }

    res.json({ 
      success: true, 
      message: 'Reference image uploaded successfully',
      path: referencePath,
      scenarioUpdated
    });
  } catch (error) {
    console.error('Error uploading reference image:', error);
    res.status(500).send('Error uploading reference image: ' + error.message);
  }
});

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
      let config = await fs.readJson(configPath);
      // Ensure projectId is set in config for downstream usage
      config.projectId = projectId;
      await fs.writeJson(configPath, config, { spaces: 2 });
      // Ensure all paths exist
      await Promise.all([
        fs.ensureDir(config.paths.bitmaps_reference),
        fs.ensureDir(config.paths.bitmaps_test),
        fs.ensureDir(config.paths.html_report)
      ]);

      // Check if reference images exist for all scenarios
      const referenceImagesMissing = config.scenarios.some(scenario => {
        const refImageName = `${config.id}_${scenario.label}_0_${scenario.selectors[0]}_0_${config.viewports[0].label}.png`;
        const refImagePath = path.join(config.paths.bitmaps_reference, refImageName);
        return !fs.existsSync(refImagePath) && scenario.referenceUrl;
      });

      if (referenceImagesMissing) {
        await backstop('reference', { config: configPath, filter: req.body.filter || undefined });
      }

      const result = await backstop('test', { 
        config: configPath,
        filter: req.body.filter || undefined
      });
      res.json({ 
        success: true, 
        result,
        message: 'Test completed successfully',
        reportPath: `/api/projects/${projectId}/report/index.html`
      });
      paths: Object.assign({}, defaultConfig.paths, incomingConfig.paths || {})
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
        
        // Sanitize scenario name to match BackstopJS naming convention
        // BackstopJS replaces spaces with underscores in scenario labels
        const sanitizedScenario = scenario.replace(/\s+/g, '_');
        
        if (scenarioConfig && scenarioConfig.selectors && scenarioConfig.selectors.length > 0) {
          // If scenario has specific selectors, include them in filename
          // BackstopJS selector naming convention:
          // - Removes # and . symbols
          // - Removes spaces around > (child selectors)
          // - Concatenates parts without additional separators
          // - Converts to lowercase
          const selectorName = scenarioConfig.selectors[0]
            .replace(/#/g, '') // Remove hash symbols
            .replace(/\./g, '') // Remove dots  
            .replace(/\s*>\s*/g, '') // Remove child selectors and spaces
            .replace(/\s+/g, '') // Remove remaining spaces
            .toLowerCase(); // BackstopJS uses lowercase
          backstopFilename = `backstop_default_${sanitizedScenario}_0_${selectorName}_${viewportIndex}_${viewport}.png`;
        } else {
          // Full page screenshot
          backstopFilename = `backstop_default_${sanitizedScenario}_${viewportIndex}_${viewport}.png`;
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
    
    // Sanitize scenario name to match BackstopJS naming convention
    const sanitizedScenario = scenario.replace(/\s+/g, '_');
    
    if (scenarioConfig.selectors && scenarioConfig.selectors.length > 0) {
      const selectorName = scenarioConfig.selectors[0]
        .replace(/#/g, '') // Remove hash symbols
        .replace(/\./g, '') // Remove dots  
        .replace(/\s*>\s*/g, '') // Remove child selectors and spaces
        .replace(/\s+/g, '') // Remove remaining spaces
        .toLowerCase(); // BackstopJS uses lowercase
      backstopFilename = `backstop_default_${sanitizedScenario}_0_${selectorName}_${viewportIndex}_${viewport}.png`;
    } else {
      backstopFilename = `backstop_default_${sanitizedScenario}_${viewportIndex}_${viewport}.png`;
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
    
    // Sanitize scenario name to match BackstopJS naming convention
    const sanitizedScenario = scenario.replace(/\s+/g, '_');
    
    if (scenarioConfig.selectors && scenarioConfig.selectors.length > 0) {
      const selectorName = scenarioConfig.selectors[0]
        .replace(/#/g, '') // Remove hash symbols
        .replace(/\./g, '') // Remove dots  
        .replace(/\s*>\s*/g, '') // Remove child selectors and spaces
        .replace(/\s+/g, '') // Remove remaining spaces
        .toLowerCase(); // BackstopJS uses lowercase
      backstopFilename = `backstop_default_${sanitizedScenario}_0_${selectorName}_${viewportIndex}_${viewport}.png`;
    } else {
      backstopFilename = `backstop_default_${sanitizedScenario}_${viewportIndex}_${viewport}.png`;
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
  console.log('📊 /api/test endpoint called - enhanced validation enabled');
  
  let tempConfigPath = null;
  const projectId = 'default'; // Use default project ID for this endpoint
  
  try {
    const configPath = path.join(configDir, 'backstop.json');
    let config = await fs.readJson(configPath);
    
    // ENHANCED PRE-VALIDATION: Check all URLs and separate valid/invalid scenarios
    console.log('🔍 Enhanced pre-validation: Checking all URLs to prevent BackstopJS interruption...');
    const validScenarios = [];
    const invalidScenarios = [];
    
    if (config.scenarios && config.scenarios.length > 0) {
      console.log(`🔗 Validating ${config.scenarios.length} scenario URLs...`);
      
      for (const scenario of config.scenarios) {
        console.log(`  🔍 Checking: "${scenario.label}" -> ${scenario.url}`);
        const validation = await validateUrl(scenario.url);
        
        if (validation.isValid) {
          console.log(`  ✅ "${scenario.label}" - URL is accessible`);
          validScenarios.push(scenario);
        } else {
          console.log(`  ❌ "${scenario.label}" - ${validation.reason}: ${validation.message}`);
          invalidScenarios.push({
            scenario: scenario,
            reason: validation.reason,
            message: validation.message
          });
        }
      }
      
      console.log(`✅ URL validation completed:`);
      console.log(`   📈 Valid scenarios: ${validScenarios.length}`);
      console.log(`   📉 Invalid scenarios: ${invalidScenarios.length}`);
      
      if (validScenarios.length === 0) {
        console.log('❌ No valid URLs found - cannot proceed with BackstopJS execution');
        return res.status(400).json({
          success: false,
          error: 'No valid URLs found',
          message: 'All scenarios have network connectivity issues',
          invalidScenarios: invalidScenarios.length,
          details: invalidScenarios.map(item => ({
            scenario: item.scenario.label,
            reason: item.reason,
            message: item.message
          }))
        });
      }
      
      // Create filtered configuration for BackstopJS with only valid scenarios
      if (invalidScenarios.length > 0) {
        console.log(`🔧 Creating filtered configuration with ${validScenarios.length} valid scenarios...`);
        const filteredConfig = {
          ...config,
          scenarios: validScenarios
        };
        
        tempConfigPath = path.join(configDir, 'temp-filtered-config.json');
        await fs.writeJson(tempConfigPath, filteredConfig, { spaces: 2 });
        console.log(`💾 Filtered configuration saved to: ${tempConfigPath}`);
      }
    }
    
    // Use filtered config if we have invalid scenarios, otherwise use original
    const configToUse = tempConfigPath || configPath;
    config = await fs.readJson(configToUse);
    
    // Ensure config has all required paths
    const defaultPaths = {
      bitmaps_reference: 'backstop_data/bitmaps_reference',
      bitmaps_test: 'backstop_data/bitmaps_test',
      engine_scripts: 'backstop_data/engine_scripts',
      html_report: 'backstop_data/html_report'
    };

    // Initialize or update paths
    config = {
      ...config,
      paths: {
        ...defaultPaths,
        ...(config.paths || {})
      },
      report: ['browser'],
      engine: 'puppeteer',
      engineOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: 'new'
      },
      asyncCaptureLimit: 2,
      asyncCompareLimit: 50,
      debug: false,
      debugWindow: false
    };

    // Process scenarios to ensure consistent naming and structure
    config.scenarios = (config.scenarios || []).map(scenario => ({
      ...scenario,
      label: scenario.label.trim(),
      selectors: ['document'],
      selectorExpansion: false,
      misMatchThreshold: scenario.misMatchThreshold || 0.1,
      requireSameDimensions: true
    }));

    // Check if any scenarios use referenceUrl
    const hasReferenceUrls = config.scenarios?.some(scenario => scenario.referenceUrl);
    
    if (hasReferenceUrls) {
      // Create a temporary config for reference capture
      const tempConfigPath = path.join(configDir, 'temp-reference-config.json');
      const referenceConfig = {
        ...config,
        scenarios: config.scenarios.map(scenario => {
          if (scenario.referenceUrl) {
            return {
              ...scenario,
              url: scenario.referenceUrl, // Use reference URL for capture
              selectors: ['document'],
              selectorExpansion: false,
              misMatchThreshold: scenario.misMatchThreshold || 0.1,
              requireSameDimensions: true,
              id: scenario.id // Maintain the same ID for consistency
            };
          }
          return scenario;
        })
      };
      
      // Write the temporary config
      await fs.writeJson(tempConfigPath, referenceConfig, { spaces: 2 });
      
      // Run reference capture first
      console.log('Running reference capture for scenarios with referenceUrl...');
      await backstop('reference', { config: tempConfigPath });
      
      // Clean up temporary config
      await fs.remove(tempConfigPath);
      
      // Restore original config for testing
      await fs.writeJson(configPath, config, { spaces: 2 });
    } else {
      // Write updated config back to file
      await fs.writeJson(configPath, config, { spaces: 2 });
    }
    
    // Ensure all paths exist
    await Promise.all(Object.values(config.paths).map(p => 
      fs.ensureDir(path.join(configDir, p))
    ));
    
    // Now run the test with enhanced configuration
    console.log('Running BackstopJS test...');
    console.log(`📊 Executing BackstopJS with ${validScenarios.length} valid scenarios...`);
    
    const result = await backstop('test', { 
      config: configToUse, // Use filtered config if available
      filter: req.body.filter || undefined
    });
    
    console.log('✅ BackstopJS test completed successfully');
    console.log(`📊 BackstopJS result summary: ${result?.tests?.length || 0} tests executed`);
    console.log(`📋 Invalid scenarios count from validation phase: ${invalidScenarios.length}`);
    
    if (invalidScenarios.length > 0) {
      console.log(`🔍 Invalid scenarios detected during validation:`);
      invalidScenarios.forEach(({ scenario, reason, message }, index) => {
        console.log(`   ${index + 1}. "${scenario.label}" - ${reason}: ${message}`);
      });
      
      // Enhanced report processing - add invalid scenarios to result
      console.log(`📝 Enhancing report with ${invalidScenarios.length} invalid scenario(s)`);
      try {
        const enhancedResult = await appendInvalidScenariosToReport(projectId, config, invalidScenarios, result);
        console.log('✅ Successfully enhanced report with invalid scenarios');
        console.log('📊 Enhanced result summary:', {
          originalTests: result.tests?.length || 0,
          totalTests: enhancedResult.tests?.length || 0,
          hasNetworkErrors: enhancedResult.hasNetworkErrors,
          networkErrorCount: enhancedResult.networkErrorCount
        });
        
        // Log details of network error tests that were added
        const networkErrorTests = enhancedResult.tests?.filter(test => test.status === 'network-error') || [];
        console.log(`🔍 Network error tests in enhanced result: ${networkErrorTests.length}`);
        networkErrorTests.forEach((test, index) => {
          console.log(`   ${index + 1}. "${test.pair.label}" - Status: ${test.status}, Reason: ${test.pair.reason}`);
        });
        
        // Update the result object for further processing
        result.tests = enhancedResult.tests;
        result.hasNetworkErrors = enhancedResult.hasNetworkErrors;
        result.networkErrorCount = enhancedResult.networkErrorCount;
        
        console.log(`✅ Enhanced report created with ${validScenarios.length} tested + ${invalidScenarios.length} network error scenarios`);
        
      } catch (enhancementError) {
        console.error('❌ Failed to enhance report with invalid scenarios:', enhancementError);
        console.error('Error details:', enhancementError.stack);
      }
    } else {
      console.log(`ℹ️  No invalid scenarios detected during validation - all URLs were accessible`);
    }
    
    // Get report path for frontend - strip backstop_data prefix from config path
    const htmlReportPath = config.paths.html_report.replace('backstop_data/', '');
    const reportPath = path.join(configDir, htmlReportPath, 'index.html');
    const reportExists = await fs.pathExists(reportPath);
    
    res.json({ 
      success: true, 
      result,
      reportPath: reportExists ? `/report/index.html` : null,
      message: hasReferenceUrls 
        ? 'Reference images captured and test completed successfully' 
        : 'Test completed successfully',
      referencesCreated: hasReferenceUrls,
      networkErrorCount: invalidScenarios.length,
      hasNetworkErrors: invalidScenarios.length > 0
    });
  } catch (error) {
    console.error('❌ Test execution error:', error);
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
        message: 'Test completed with visual differences detected',
        networkErrorCount: invalidScenarios.length,
        hasNetworkErrors: invalidScenarios.length > 0
      });
    } catch (configError) {
      res.status(500).json({ 
        success: false,
        error: `Configuration error: ${configError.message}`,
        reportPath: null,
        message: 'Test failed due to configuration error'
      });
    }
  } finally {
    // Cleanup temporary config file
    if (tempConfigPath) {
      try {
        await fs.remove(tempConfigPath);
        console.log(`🗑️  Cleaned up temporary configuration file: ${tempConfigPath}`);
      } catch (cleanupError) {
        console.warn('⚠️  Warning: Could not cleanup temporary config file:', cleanupError.message);
      }
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
        
        // Sanitize scenario name to match BackstopJS naming convention
        const sanitizedScenario = data.scenario.replace(/\s+/g, '_');
        
        if (scenario && scenario.selectors && scenario.selectors.length > 0) {
          // If scenario has specific selectors, include them in filename
          const selectorName = scenario.selectors[0]
            .replace(/#/g, '') // Remove hash symbols
            .replace(/\./g, '') // Remove dots  
            .replace(/\s*>\s*/g, '') // Remove child selectors and spaces
            .replace(/\s+/g, '') // Remove remaining spaces
            .toLowerCase(); // BackstopJS uses lowercase
          fileName = `backstop_default_${sanitizedScenario}_0_${selectorName}_0_${data.viewport}.png`;
        } else {
          // Full page screenshot
          fileName = `backstop_default_${sanitizedScenario}_0_${data.viewport}.png`;
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
    // Sanitize scenario name for pattern matching
    const sanitizedScenario = scenario.replace(/\s+/g, '_');
    const scenarioPattern = new RegExp(`backstop_default_${sanitizedScenario}_.*_${viewport}\\.png$`);
    
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
    const enhancedReportsDir = path.join(reportsDir, 'enhanced-reports');
    
    const reports = [];

    // Check for enhanced reports in enhanced-reports subdirectory
    if (await fs.pathExists(enhancedReportsDir)) {
      const enhancedFiles = await fs.readdir(enhancedReportsDir);
      
      for (const file of enhancedFiles) {
        if (file.endsWith('.html') && file.startsWith('enhanced-report-')) {
          try {
            const filePath = path.join(enhancedReportsDir, file);
            const stats = await fs.stat(filePath);
            
            // Extract timestamp from filename: enhanced-report-2025-08-01T06-27-27-046Z.html
            const timestampMatch = file.match(/enhanced-report-(.+)\.html$/);
            const timestamp = timestampMatch ? timestampMatch[1].replace(/-/g, ':').replace(/(\d{4}):(\d{2}):(\d{2})T/, '$1-$2-$3T') : null;
            
            reports.push({
              filename: file,
              type: 'enhanced',
              name: `Enhanced Analysis Report`,
              scenario: 'Enhanced Design Comparison',
              url: 'Multiple scenarios analyzed',
              timestamp: timestamp || stats.birthtime.toISOString(),
              reportUrl: `/api/design-comparison/reports/${file}/html`,
              size: stats.size,
              created: stats.birthtime,
              path: filePath
            });
          } catch (error) {
            console.error(`Error reading enhanced report ${file}:`, error);
          }
        }
      }
    }

    // Check for legacy design comparison reports in main directory
    if (await fs.pathExists(reportsDir)) {
      const files = await fs.readdir(reportsDir);
      
      for (const file of files) {
        if (file.endsWith('.json') && file.startsWith('design-comparison-')) {
          try {
            const filePath = path.join(reportsDir, file);
            const reportData = await fs.readJson(filePath);
            const stats = await fs.stat(filePath);
            
            reports.push({
              filename: file,
              type: 'legacy',
              htmlFilename: file.replace('.json', '.html'),
              name: `Design Comparison - ${reportData.metadata?.scenario || 'Unknown'}`,
              scenario: reportData.metadata?.scenario,
              url: reportData.metadata?.url,
              timestamp: reportData.metadata?.timestamp,
              totalMismatches: reportData.statistics?.totalMismatches || 0,
              size: stats.size,
              created: stats.birthtime,
              reportUrl: `/api/design-comparison/reports/${file}/html`
            });
          } catch (error) {
            console.error(`Error reading legacy report ${file}:`, error);
          }
        }
      }
    }

    // Sort by creation time (newest first)
    reports.sort((a, b) => new Date(b.created) - new Date(a.created));

    console.log(`📊 Found ${reports.length} design comparison reports`);
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
    let htmlPath;
    
    // Check if it's an enhanced report
    if (filename.startsWith('enhanced-report-') && filename.endsWith('.html')) {
      htmlPath = path.join(__dirname, 'design-cache', 'enhanced-reports', filename);
    } else {
      // Legacy format: JSON filename to HTML
      const htmlFilename = filename.replace('.json', '.html');
      htmlPath = path.join(__dirname, 'design-cache', htmlFilename);
    }
    
    if (!await fs.pathExists(htmlPath)) {
      console.log(`HTML report not found at: ${htmlPath}`);
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

      // Apply minWidth/minHeight filtering
      const minW = parseInt(minWidth, 10) || 0;
      const minH = parseInt(minHeight, 10) || 0;
      layers = layers.filter(layer => {
        if (!layer.bounds) return false;
        return layer.bounds.width >= minW && layer.bounds.height >= minH;
      });
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

    // Parse pagination params as integers
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 30;

    // Apply pagination
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
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
      page: pageNum,
      limit: limitNum,
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
    const { fileId, layerIds, format = 'jpg', scale = 1 } = req.body;

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
    const { fileId, layerId, format = 'jpg', scale = 2, layerName = 'figma-layer' } = req.body;

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
    
    // Get the image URL from Figma with dimension-aware scaling
    // Convert scale to max dimension for consistent behavior
    const maxDimension = scale * 1000; // Convert scale factor to approximate max dimension
    const images = await figmaClient.getImagesWithDimensions([layerId], format, maxDimension);
    
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
    
    // Get high-quality image from Figma with explicit dimensions for consistent resolution
    // Use explicit width/height instead of scale to prevent resolution issues
    const maxDimension = 2048; // Maximum dimension to prevent excessively large images
    const images = await figmaClient.getImagesWithDimensions([layerId], 'jpg', maxDimension);
    
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
    const fileName = `${safeLayerName}_${safeLayerId}.jpg`;
    
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
      imageData: `data:image/jpeg;base64,${base64Image}`,
      size: imageResponse.data.byteLength,
      contentType: 'image/jpeg'
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
    
    // Use dimension-aware scaling for consistent thumbnail quality
    // Define target dimensions for different thumbnail sizes
    const targetDimensions = {
      'small': 150,    // 150px max dimension
      'medium': 300,   // 300px max dimension  
      'large': 600     // 600px max dimension
    };
    
    const maxDimension = targetDimensions[size] || targetDimensions['small'];
    
    // Get images with proper dimension-aware scaling
    const images = await figmaClient.getImagesWithDimensions(layerIds, 'jpg', maxDimension);
    
    // Return the image URLs for client-side loading
    const thumbnails = {};
    for (const [layerId, imageUrl] of Object.entries(images.images || {})) {
      if (imageUrl) {
        thumbnails[layerId] = {
          url: imageUrl,
          maxDimension: maxDimension,
          size: size
        };
      }
    }

    res.json({ 
      thumbnails,
      total: Object.keys(thumbnails).length,
      maxDimension: maxDimension,
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

    // Use dimension-aware bulk image export with consistent scaling
    const scaleValue = parseFloat(scale) || 0.5;
    const maxDimension = scaleValue * 1000; // Convert scale to max dimension
    const images = await figmaClient.getImagesWithDimensions(layerIds, 'jpg', maxDimension);
    
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

// Enhanced Design Comparison Endpoints with Detailed Insights

// Run enhanced design comparison with detailed insights
app.post('/api/design-comparison/enhanced-run', async (req, res) => {
  try {
    const { scenarioConfig } = req.body;
    
    if (!scenarioConfig) {
      return res.status(400).json({ error: 'Scenario configuration is required' });
    }

    if (!designEngine) {
      return res.status(500).json({ error: 'Design comparison engine not initialized' });
    }

    console.log('🔍 Running enhanced design comparison with detailed insights...');
    
    // Run the enhanced comparison
    const results = await designEngine.runComparison(scenarioConfig);
    
    // Save results to cache
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsPath = path.join(configDir, `enhanced-comparison-${timestamp}.json`);
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2), 'utf8');
    
    console.log('✅ Enhanced design comparison completed');
    
    res.json({
      success: true,
      results: results,
      savedPath: resultsPath,
      enhancedFeatures: {
        visualAnalysis: !!results.visualAnalysis,
        detailedInsights: !!results.detailedInsights,
        enhancedRecommendations: !!results.enhancedRecommendations,
        actionableItems: results.detailedInsights?.actionableItems?.length || 0,
        prioritizedIssues: results.detailedInsights?.prioritizedIssues?.length || 0
      }
    });
    
  } catch (error) {
    console.error('Error in enhanced design comparison:', error);
    res.status(500).json({ 
      error: 'Enhanced design comparison failed',
      details: error.message 
    });
  }
});

// Get enhanced visual analysis for existing BackstopJS results
app.post('/api/design-comparison/visual-analysis', async (req, res) => {
  try {
    const { testConfig, scenarioConfig } = req.body;
    
    if (!designEngine || !designEngine.visualAnalysis) {
      return res.status(500).json({ error: 'Visual analysis engine not available' });
    }

    console.log('🎨 Performing enhanced visual analysis...');
    
    const analysis = await designEngine.performEnhancedVisualAnalysis(scenarioConfig || testConfig);
    
    res.json({
      success: true,
      analysis: analysis,
      timestamp: new Date().toISOString(),
      features: {
        backstopIntegration: !!analysis.backstopResults,
        overallInsights: !!analysis.overallInsights,
        testAnalyses: analysis.enhancedAnalysis?.length || 0
      }
    });
    
  } catch (error) {
    console.error('Error in visual analysis:', error);
    res.status(500).json({ 
      error: 'Visual analysis failed',
      details: error.message 
    });
  }
});

// Generate detailed mismatch insights
app.post('/api/design-comparison/detailed-insights', async (req, res) => {
  try {
    const { results, analysisOptions } = req.body;
    
    if (!results) {
      return res.status(400).json({ error: 'Analysis results are required' });
    }

    if (!designEngine || !designEngine.detailedInsights) {
      return res.status(500).json({ error: 'Detailed insights engine not available' });
    }

    console.log('🔬 Generating detailed mismatch insights...');
    
    const insights = await designEngine.generateDetailedInsights(results);
    
    res.json({
      success: true,
      insights: insights,
      options: analysisOptions,
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues: insights.prioritizedIssues?.length || 0,
        actionableItems: insights.actionableItems?.length || 0,
        crossReferences: insights.crossReferences?.length || 0
      }
    });
    
  } catch (error) {
    console.error('Error generating detailed insights:', error);
    res.status(500).json({ 
      error: 'Detailed insights generation failed',
      details: error.message 
    });
  }
});

// Get enhanced recommendations
app.post('/api/design-comparison/enhanced-recommendations', async (req, res) => {
  try {
    const { analysisResults, preferences } = req.body;
    
    if (!analysisResults) {
      return res.status(400).json({ error: 'Analysis results are required' });
    }

    if (!designEngine) {
      return res.status(500).json({ error: 'Design comparison engine not available' });
    }

    console.log('💡 Generating enhanced recommendations...');
    
    const recommendations = designEngine.generateEnhancedRecommendations(analysisResults);
    
    res.json({
      success: true,
      recommendations: recommendations,
      preferences: preferences,
      timestamp: new Date().toISOString(),
      categories: {
        immediate: recommendations.immediate?.length || 0,
        shortTerm: recommendations.shortTerm?.length || 0,
        longTerm: recommendations.longTerm?.length || 0,
        process: recommendations.process?.length || 0,
        tooling: recommendations.tooling?.length || 0
      }
    });
    
  } catch (error) {
    console.error('Error generating enhanced recommendations:', error);
    res.status(500).json({ 
      error: 'Enhanced recommendations generation failed',
      details: error.message 
    });
  }
});

// Analyze BackstopJS test results with enhanced insights
app.post('/api/design-comparison/analyze-backstop-results', async (req, res) => {
  try {
    const { testResultsPath, analysisDepth = 'standard' } = req.body;
    
    if (!designEngine || !designEngine.detailedInsights) {
      return res.status(500).json({ error: 'Analysis engine not available' });
    }

    console.log('📊 Analyzing BackstopJS results with enhanced insights...');
    
    // Check if BackstopJS results exist
    const backstopResultsPath = testResultsPath || path.join(__dirname, '../backstop_data/html_report/config.js');
    
    if (!await fs.pathExists(backstopResultsPath)) {
      return res.status(404).json({ 
        error: 'BackstopJS test results not found',
        path: backstopResultsPath 
      });
    }

    // Parse and analyze results
    const resultsContent = await fs.readFile(backstopResultsPath, 'utf8');
    const testResults = designEngine.parseBackstopResults(resultsContent);
    
    if (!testResults) {
      return res.status(400).json({ error: 'Could not parse BackstopJS results' });
    }

    // Perform enhanced analysis
    const analysis = await designEngine.detailedInsights.analyzeTestResults(testResults, {
      depth: analysisDepth,
      includeRecommendations: true,
      generateActionItems: true
    });
    
    res.json({
      success: true,
      testResults: testResults,
      enhancedAnalysis: analysis,
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: testResults.tests?.length || 0,
        failedTests: testResults.tests?.filter(t => t.status === 'fail')?.length || 0,
        analysisDepth: analysisDepth,
        insightsGenerated: true
      }
    });
    
  } catch (error) {
    console.error('Error analyzing BackstopJS results:', error);
    res.status(500).json({ 
      error: 'BackstopJS results analysis failed',
      details: error.message 
    });
  }
});

// Generate comprehensive enhanced report
app.post('/api/design-comparison/enhanced-report', async (req, res) => {
  try {
    const { analysisResults, reportOptions = {} } = req.body;
    
    if (!analysisResults) {
      return res.status(400).json({ error: 'Analysis results are required' });
    }

    if (!designEngine) {
      return res.status(500).json({ error: 'Design comparison engine not available' });
    }

    console.log('📋 Generating enhanced HTML report...');
    
    const reportPath = await designEngine.generateEnhancedReport(analysisResults);
    
    // Also save a JSON version for API access
    const jsonReportPath = reportPath.replace('.html', '.json');
    await fs.writeFile(jsonReportPath, JSON.stringify(analysisResults, null, 2), 'utf8');
    
    res.json({
      success: true,
      reportPath: reportPath,
      jsonReportPath: jsonReportPath,
      reportUrl: `/api/design-comparison/enhanced-reports/${path.basename(reportPath)}`,
      timestamp: new Date().toISOString(),
      options: reportOptions
    });
    
  } catch (error) {
    console.error('Error generating enhanced report:', error);
    res.status(500).json({ 
      error: 'Enhanced report generation failed',
      details: error.message 
    });
  }
});

// Serve enhanced reports
app.get('/api/design-comparison/enhanced-reports/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const reportsDir = path.join(configDir, 'enhanced-reports');
    const reportPath = path.join(reportsDir, filename);
    
    if (!await fs.pathExists(reportPath)) {
      return res.status(404).json({ error: 'Enhanced report not found' });
    }

    // Check if it's HTML or JSON
    if (filename.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
      const htmlContent = await fs.readFile(reportPath, 'utf8');
      res.send(htmlContent);
    } else if (filename.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
      const jsonContent = await fs.readFile(reportPath, 'utf8');
      res.send(jsonContent);
    } else {
      res.download(reportPath);
    }
    
  } catch (error) {
    console.error('Error serving enhanced report:', error);
    res.status(500).json({ 
      error: 'Failed to serve enhanced report',
      details: error.message 
    });
  }
});

// List available enhanced reports
app.get('/api/design-comparison/enhanced-reports', async (req, res) => {
  try {
    const reportsDir = path.join(configDir, 'enhanced-reports');
    
    if (!await fs.pathExists(reportsDir)) {
      return res.json({ reports: [], total: 0 });
    }

    const files = await fs.readdir(reportsDir);
    const reports = [];
    
    for (const file of files) {
      if (file.endsWith('.html') || file.endsWith('.json')) {
        const filePath = path.join(reportsDir, file);
        const stats = await fs.stat(filePath);
        
        reports.push({
          filename: file,
          type: file.endsWith('.html') ? 'html' : 'json',
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          url: `/api/design-comparison/enhanced-reports/${file}`
        });
      }
    }
    
    // Sort by creation date, newest first
    reports.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    res.json({
      reports: reports,
      total: reports.length,
      reportsDir: reportsDir
    });
    
  } catch (error) {
    console.error('Error listing enhanced reports:', error);
    res.status(500).json({ 
      error: 'Failed to list enhanced reports',
      details: error.message 
    });
  }
});

// Get analysis capabilities and status
app.get('/api/design-comparison/enhanced-capabilities', async (req, res) => {
  try {
    const capabilities = {
      engines: {
        designComparison: !!designEngine,
        detailedInsights: !!(designEngine && designEngine.detailedInsights),
        visualAnalysis: !!(designEngine && designEngine.visualAnalysis),
        figmaIntegration: !!(designEngine && designEngine.figmaClient),
      },
      features: {
        tokenComparison: true,
        visualRegression: true,
        pixelLevelAnalysis: !!(designEngine && designEngine.visualAnalysis),
        colorAnalysis: !!(designEngine && designEngine.visualAnalysis),
        layoutAnalysis: !!(designEngine && designEngine.visualAnalysis),
        severityClassification: !!(designEngine && designEngine.detailedInsights),
        actionableRecommendations: !!(designEngine && designEngine.detailedInsights),
        enhancedReporting: !!(designEngine),
        crossReferenceAnalysis: !!(designEngine && designEngine.detailedInsights)
      },
      supportedFormats: {
        input: ['backstop-config', 'test-results', 'figma-tokens'],
        output: ['json', 'html', 'insights', 'recommendations'],
        images: ['png', 'jpg', 'jpeg']
      },
      analysisDepth: ['basic', 'standard', 'comprehensive', 'expert'],
      timestamp: new Date().toISOString()
    };
    
    res.json(capabilities);
    
  } catch (error) {
    console.error('Error getting enhanced capabilities:', error);
    res.status(500).json({ 
      error: 'Failed to get enhanced capabilities',
      details: error.message 
    });
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

// =============================================================================
// FIGMA HTML/CSS GENERATION ENDPOINTS
// =============================================================================

const FigmaHTMLGenerator = require('./figma-html-generator');

// Generate HTML/CSS from Figma file
app.post('/api/figma/generate-html-css', async (req, res) => {
  try {
    const {
      figmaToken,
      figmaFileKey,
      pageId,
      frameIds = [],
      options = {}
    } = req.body;

    if (!figmaToken || !figmaFileKey) {
      return res.status(400).json({
        success: false,
        error: 'Figma access token and file key are required'
      });
    }

    console.log('🚀 Starting Figma to HTML/CSS generation...');
    console.log(`📄 File: ${figmaFileKey}, Page: ${pageId || 'first page'}`);

    const generator = new FigmaHTMLGenerator(figmaToken, figmaFileKey);
    
    const generationOptions = {
      pageId,
      frameIds,
      generateResponsive: options.generateResponsive !== false,
      includeInteractions: options.includeInteractions || false,
      outputFormat: options.outputFormat || 'separate',
      framework: options.framework || 'vanilla',
      cssFramework: options.cssFramework || 'custom',
      ...options
    };

    const result = await generator.generateFromFigma(generationOptions);

    // Save generated files
    const outputDir = path.join(__dirname, 'generated-code');
    await fs.ensureDir(outputDir);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const projectDir = path.join(outputDir, `figma-${figmaFileKey}-${timestamp}`);
    await fs.ensureDir(projectDir);

    // Save HTML
    if (typeof result.html === 'string') {
      await fs.writeFile(path.join(projectDir, 'index.html'), result.html);
    } else if (typeof result.html === 'object') {
      // Multiple components (React/Vue)
      for (const [filename, content] of Object.entries(result.html)) {
        await fs.writeFile(path.join(projectDir, filename), content);
      }
    }

    // Save CSS
    await fs.writeFile(path.join(projectDir, 'styles.css'), result.css);

    // Save design tokens as JSON
    const tokensObject = {};
    for (const [category, tokenMap] of Object.entries(result.designTokens)) {
      tokensObject[category] = Object.fromEntries(tokenMap);
    }
    await fs.writeFile(
      path.join(projectDir, 'design-tokens.json'), 
      JSON.stringify(tokensObject, null, 2)
    );

    // Save metadata
    await fs.writeFile(
      path.join(projectDir, 'metadata.json'), 
      JSON.stringify(result.metadata, null, 2)
    );

    console.log('✅ HTML/CSS generation completed successfully');
    console.log(`📁 Files saved to: ${projectDir}`);

    res.json({
      success: true,
      result: {
        ...result,
        outputDirectory: projectDir,
        downloadUrl: `/api/figma/download/${path.basename(projectDir)}`,
        previewUrl: `/api/figma/preview/${path.basename(projectDir)}`
      }
    });

  } catch (error) {
    console.error('❌ Error generating HTML/CSS from Figma:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get Figma file pages and frames for selection
app.post('/api/figma/get-structure', async (req, res) => {
  try {
    const { figmaToken, figmaFileKey } = req.body;

    if (!figmaToken || !figmaFileKey) {
      return res.status(400).json({
        success: false,
        error: 'Figma access token and file key are required'
      });
    }

    console.log('📋 Fetching Figma file structure...');

    const response = await axios.get(`https://api.figma.com/v1/files/${figmaFileKey}`, {
      headers: { 'X-FIGMA-TOKEN': figmaToken }
    });

    const figmaData = response.data;
    const structure = {
      name: figmaData.name,
      lastModified: figmaData.lastModified,
      pages: []
    };

    // Extract pages and frames
    for (const page of figmaData.document.children) {
      const pageInfo = {
        id: page.id,
        name: page.name,
        frames: []
      };

      if (page.children) {
        for (const child of page.children) {
          if (child.type === 'FRAME') {
            pageInfo.frames.push({
              id: child.id,
              name: child.name,
              width: child.absoluteBoundingBox?.width || 0,
              height: child.absoluteBoundingBox?.height || 0,
              type: child.type
            });
          }
        }
      }

      structure.pages.push(pageInfo);
    }

    console.log(`📄 Found ${structure.pages.length} pages with frames`);

    res.json({
      success: true,
      structure
    });

  } catch (error) {
    console.error('❌ Error fetching Figma structure:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Download generated code as ZIP
app.get('/api/figma/download/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const projectDir = path.join(__dirname, 'generated-code', projectId);

    if (!await fs.pathExists(projectDir)) {
      return res.status(404).json({
        success: false,
        error: 'Generated project not found'
      });
    }

    // Create ZIP file
    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${projectId}.zip"`);

    archive.pipe(res);
    archive.directory(projectDir, false);
    await archive.finalize();

  } catch (error) {
    console.error('❌ Error creating download:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Preview generated HTML/CSS
app.get('/api/figma/preview/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const projectDir = path.join(__dirname, 'generated-code', projectId);
    const htmlPath = path.join(projectDir, 'index.html');

    if (!await fs.pathExists(htmlPath)) {
      return res.status(404).json({
        success: false,
        error: 'Generated HTML file not found'
      });
    }

    let htmlContent = await fs.readFile(htmlPath, 'utf8');
    
    // Update CSS link to use the preview endpoint
    htmlContent = htmlContent.replace(
      'href="styles.css"',
      `href="/api/figma/preview/${projectId}/styles.css"`
    );

    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);

  } catch (error) {
    console.error('❌ Error serving preview:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Serve preview assets (CSS, images, etc.)
app.get('/api/figma/preview/:projectId/:filename', async (req, res) => {
  try {
    const { projectId, filename } = req.params;
    const projectDir = path.join(__dirname, 'generated-code', projectId);
    const filePath = path.join(projectDir, filename);

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Set appropriate content type
    const ext = path.extname(filename).toLowerCase();
    const contentTypes = {
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };

    if (contentTypes[ext]) {
      res.setHeader('Content-Type', contentTypes[ext]);
    }

    res.sendFile(filePath);

  } catch (error) {
    console.error('❌ Error serving preview asset:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List generated projects
app.get('/api/figma/generated-projects', async (req, res) => {
  try {
    const outputDir = path.join(__dirname, 'generated-code');
    
    if (!await fs.pathExists(outputDir)) {
      return res.json({ success: true, projects: [] });
    }

    const projectDirs = await fs.readdir(outputDir);
    const projects = [];

    for (const dirName of projectDirs) {
      const projectDir = path.join(outputDir, dirName);
      const metadataPath = path.join(projectDir, 'metadata.json');
      
      if (await fs.pathExists(metadataPath)) {
        const metadata = await fs.readJson(metadataPath);
        const stats = await fs.stat(projectDir);
        
        projects.push({
          id: dirName,
          name: dirName,
          metadata,
          createdAt: stats.birthtime,
          size: await calculateDirectorySize(projectDir),
          downloadUrl: `/api/figma/download/${dirName}`
        });
      }
    }

    // Sort by creation date (newest first)
    projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      projects
    });

  } catch (error) {
    console.error('❌ Error listing generated projects:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete generated project
app.delete('/api/figma/generated-projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const projectDir = path.join(__dirname, 'generated-code', projectId);

    if (!await fs.pathExists(projectDir)) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    await fs.remove(projectDir);

    console.log(`🗑️ Deleted generated project: ${projectId}`);

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to calculate directory size
async function calculateDirectorySize(dirPath) {
  let totalSize = 0;
  
  const files = await fs.readdir(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = await fs.stat(filePath);
    
    if (stats.isDirectory()) {
      totalSize += await calculateDirectorySize(filePath);
    } else {
      totalSize += stats.size;
    }
  }
  
  return totalSize;
}

// Global error handling to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  console.error('Stack:', error.stack);
  // Don't exit the process, just log the error
});

// =================== GENERAL ENDPOINTS ===================

// Server health check
app.get('/api/health', async (req, res) => {
  try {
    const projectsCount = await fs.readJson(PROJECTS_FILE).then(p => p.length).catch(() => 0);
    
    res.json({
      success: true,
      message: 'PixelPilot BackstopJS Dashboard is running',
      timestamp: new Date().toISOString(),
      projectsCount,
      endpoints: {
        projects: '/api/projects',
        config: '/api/projects/:projectId/config',
        scenarios: '/api/projects/:projectId/scenarios',
        test: '/api/projects/:projectId/test',
        reference: '/api/projects/:projectId/reference',
        screenshots: '/api/projects/:projectId/screenshots/upload'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// BACKUP MANAGEMENT SYSTEM
// ============================================

// Create backup of current test results
app.post('/api/projects/:projectId/backups', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { backupName, description } = req.body;
    
    const { configPath } = await validateProject(projectId);
    const config = await fs.readJson(configPath);
    
    // Check if there are recent test results to backup
    const reportPath = path.join(config.paths.html_report, 'config.js');
    if (!await fs.pathExists(reportPath)) {
      return res.status(404).json({ error: 'No test results found to backup. Please run a test first.' });
    }
    
    // Create backup directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `${timestamp}_${backupName?.replace(/[^a-zA-Z0-9]/g, '_') || 'backup'}`;
    const backupDir = path.join(__dirname, 'backstop_data', projectId, 'backups', backupId);
    
    await fs.ensureDir(backupDir);
    
    // Parse current test results for metadata
    const resultsContent = await fs.readFile(reportPath, 'utf8');
    const testResults = parseBackstopResults(resultsContent);
    
    // Create backup metadata
    const backupMetadata = {
      id: backupId,
      name: backupName || `Backup ${timestamp}`,
      description: description || 'Automated test results backup',
      projectId,
      timestamp: new Date().toISOString(),
      testSummary: {
        totalTests: testResults?.tests?.length || 0,
        passedTests: testResults?.tests?.filter(t => t.status === 'pass')?.length || 0,
        failedTests: testResults?.tests?.filter(t => t.status === 'fail')?.length || 0,
        avgMismatch: testResults?.tests?.filter(t => t.status === 'fail')
          .reduce((acc, t) => acc + parseFloat(t.pair?.diff?.misMatchPercentage || 0), 0) / 
          (testResults?.tests?.filter(t => t.status === 'fail')?.length || 1)
      },
      scenarios: testResults?.tests?.map(test => ({
        label: test.pair.label,
        viewport: test.pair.viewportLabel,
        status: test.status,
        mismatchPercentage: test.pair?.diff?.misMatchPercentage || 0,
        url: test.pair.url
      })) || []
    };
    
    // Copy all test artifacts
    await Promise.all([
      // Copy HTML report
      fs.copy(path.join(config.paths.html_report), path.join(backupDir, 'html_report')),
      // Copy test images
      fs.copy(path.join(config.paths.bitmaps_test), path.join(backupDir, 'bitmaps_test')),
      // Copy reference images
      fs.copy(path.join(config.paths.bitmaps_reference), path.join(backupDir, 'bitmaps_reference')),
      // Save metadata
      fs.writeJson(path.join(backupDir, 'backup-metadata.json'), backupMetadata, { spaces: 2 }),
      // Save raw config
      fs.copy(configPath, path.join(backupDir, 'backstop-config.json'))
    ]);
    
    res.json({
      success: true,
      backup: backupMetadata,
      message: `Backup created successfully: ${backupName || backupId}`
    });
    
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: `Failed to create backup: ${error.message}` });
  }
});

// Get list of all backups for a project
app.get('/api/projects/:projectId/backups', async (req, res) => {
  try {
    const { projectId } = req.params;
    const backupsDir = path.join(__dirname, 'backstop_data', projectId, 'backups');
    
    if (!await fs.pathExists(backupsDir)) {
      return res.json([]);
    }
    
    const backupFolders = await fs.readdir(backupsDir);
    const backups = [];
    
    for (const folder of backupFolders) {
      const metadataPath = path.join(backupsDir, folder, 'backup-metadata.json');
      if (await fs.pathExists(metadataPath)) {
        const metadata = await fs.readJson(metadataPath);
        const folderStats = await fs.stat(path.join(backupsDir, folder));
        
        backups.push({
          ...metadata,
          // Flatten test summary data for frontend consumption
          testCount: metadata.testSummary?.totalTests || 0,
          passedTests: metadata.testSummary?.passedTests || 0,
          failedTests: metadata.testSummary?.failedTests || 0,
          avgMismatch: metadata.testSummary?.avgMismatch || 0,
          size: await getFolderSize(path.join(backupsDir, folder)),
          createdAt: folderStats.birthtime,
          hasReport: await fs.pathExists(path.join(backupsDir, folder, 'html_report', 'index.html'))
        });
      }
    }
    
    // Sort by timestamp descending (newest first)
    backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(backups);
  } catch (error) {
    console.error('Error listing backups:', error);
    res.status(500).json({ error: `Failed to list backups: ${error.message}` });
  }
});

// Get backup statistics for a project (must come before individual backup route)
app.get('/api/projects/:projectId/backups/stats', async (req, res) => {
  try {
    const { projectId } = req.params;
    const backupsDir = path.join(__dirname, 'backstop_data', projectId, 'backups');
    
    if (!await fs.pathExists(backupsDir)) {
      return res.json({
        totalBackups: 0,
        totalTests: 0,
        totalSize: 0,
        averageFailureRate: 0
      });
    }
    
    const backupFolders = await fs.readdir(backupsDir);
    let totalBackups = 0;
    let totalTests = 0;
    let totalSize = 0;
    let totalFailures = 0;
    
    for (const folder of backupFolders) {
      const metadataPath = path.join(backupsDir, folder, 'backup-metadata.json');
      if (await fs.pathExists(metadataPath)) {
        totalBackups++;
        const folderSize = await getFolderSize(path.join(backupsDir, folder));
        totalSize += folderSize;
        
        try {
          const metadata = await fs.readJSON(metadataPath);
          if (metadata.testCount) {
            totalTests += metadata.testCount;
          }
          if (metadata.failedTests) {
            totalFailures += metadata.failedTests;
          }
        } catch (metaError) {
          console.warn(`Failed to read metadata for backup ${folder}:`, metaError);
        }
      }
    }
    
    const averageFailureRate = totalTests > 0 ? totalFailures / totalTests : 0;
    
    res.json({
      totalBackups,
      totalTests,
      totalSize,
      averageFailureRate
    });
  } catch (error) {
    console.error('Error getting backup stats:', error);
    res.status(500).json({ error: `Failed to get backup stats: ${error.message}` });
  }
});

// Get specific backup details
app.get('/api/projects/:projectId/backups/:backupId', async (req, res) => {
  try {
    const { projectId, backupId } = req.params;
    const backupDir = path.join(__dirname, 'backstop_data', projectId, 'backups', backupId);
    const metadataPath = path.join(backupDir, 'backup-metadata.json');
    
    if (!await fs.pathExists(metadataPath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    
    const metadata = await fs.readJson(metadataPath);
    res.json(metadata);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download backup as CSV
app.get('/api/projects/:projectId/backups/:backupId/csv', async (req, res) => {
  try {
    const { projectId, backupId } = req.params;
    const backupDir = path.join(__dirname, 'backstop_data', projectId, 'backups', backupId);
    const metadataPath = path.join(backupDir, 'backup-metadata.json');
    
    if (!await fs.pathExists(metadataPath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    
    const metadata = await fs.readJson(metadataPath);
    
    // Generate CSV content
    const csvHeader = 'Scenario,Viewport,Status,Mismatch%,URL,Timestamp\n';
    const csvRows = metadata.scenarios.map(scenario => 
      `"${scenario.label}","${scenario.viewport}","${scenario.status}","${scenario.mismatchPercentage}","${scenario.url}","${metadata.timestamp}"`
    ).join('\n');
    
    const csvContent = csvHeader + csvRows;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="backstop-results-${backupId}.csv"`);
    res.send(csvContent);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve backup HTML reports and assets
app.use('/api/projects/:projectId/backups/:backupId/report', (req, res, next) => {
  const { projectId, backupId } = req.params;
  const backupDir = path.join(__dirname, 'backstop_data', projectId, 'backups', backupId);
  const projectDir = path.join(__dirname, 'backstop_data', projectId);
  
  // First try to serve from backup directory
  express.static(backupDir)(req, res, (err) => {
    if (err || res.headersSent) {
      return next(err);
    }
    // If file not found in backup, try main project directory (for reference images)
    express.static(projectDir)(req, res, next);
  });
});

// Delete backup
app.delete('/api/projects/:projectId/backups/:backupId', async (req, res) => {
  try {
    const { projectId, backupId } = req.params;
    const backupDir = path.join(__dirname, 'backstop_data', projectId, 'backups', backupId);
    
    if (!await fs.pathExists(backupDir)) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    
    await fs.remove(backupDir);
    res.json({ success: true, message: 'Backup deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to parse BackstopJS results from config.js
function parseBackstopResults(resultsContent) {
  try {
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

// Helper function to calculate folder size
async function getFolderSize(folderPath) {
  let size = 0;
  
  try {
    const items = await fs.readdir(folderPath);
    
    for (const item of items) {
      const itemPath = path.join(folderPath, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isDirectory()) {
        size += await getFolderSize(itemPath);
      } else {
        size += stats.size;
      }
    }
  } catch (error) {
    console.error('Error calculating folder size:', error);
  }
  
  return size;
}

// 404 handler - should be after all other routes
app.use((req, res, next) => {
  if (!res.headersSent) {
    console.log(`404 Not Found: ${req.method} ${req.url}`);
    return res.status(404).json({ error: 'Endpoint not found' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Simple test-results endpoint for quick access (uses latest project)
app.get('/test-results', async (req, res) => {
  try {
    // Find the most recent project directory
    const backstopDataDir = path.join(__dirname, 'backstop_data');
    
    if (!await fs.pathExists(backstopDataDir)) {
      return res.status(404).json({ error: 'No test results found' });
    }
    
    const projectDirs = await fs.readdir(backstopDataDir);
    const projectDirsWithStats = [];
    
    for (const dir of projectDirs) {
      const fullPath = path.join(backstopDataDir, dir);
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        projectDirsWithStats.push({ name: dir, mtime: stats.mtime });
      }
    }
    
    if (projectDirsWithStats.length === 0) {
      return res.status(404).json({ error: 'No project directories found' });
    }
    
    // Sort by modification time, newest first
    projectDirsWithStats.sort((a, b) => b.mtime - a.mtime);
    const latestProjectId = projectDirsWithStats[0].name;
    
    console.log(`📊 Using latest project for /test-results: ${latestProjectId}`);
    
    // Get enhanced results from the latest project (includes network error scenarios)
    const enhancedResults = await getEnhancedTestResults(latestProjectId);
    if (enhancedResults) {
      console.log(`✅ Returning enhanced results: ${enhancedResults.tests?.length || 0} tests (${enhancedResults.invalidTests} network errors)`);
      return res.json(enhancedResults);
    }
    
    // Fallback to original method
    const results = await getLatestTestResults(latestProjectId);
    if (!results) {
      return res.status(404).json({ error: 'No test results found' });
    }
    
    console.log(`📊 Returning standard results: ${results.tests?.length || 0} tests`);
    res.json(results);
    
  } catch (error) {
    console.error('❌ Error in /test-results endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to fetch test results', 
      details: error.message 
    });
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

server.listen(port, async () => {
  console.log('🚀 PixelPilot BackstopJS Dashboard Started!');
  console.log(`📡 Server running on http://localhost:${port}`);
  console.log(`🔌 Socket.IO enabled for real-time updates`);
  console.log(`🔍 Health Check: http://localhost:${port}/api/health`);
  console.log(`📁 Projects API: http://localhost:${port}/api/projects`);
  console.log('🎯 Multi-project BackstopJS dashboard ready!');
  await ensureDataDir();
});
