import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import axios from 'axios'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  Checkbox,
  Chip,
  Alert,
  AlertTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Grid,
  Paper,
  Divider,
  Avatar,
  Badge,
  IconButton,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  CircularProgress,
  Fade,
  Collapse
} from '@mui/material'
import {
  PlayArrow,
  CheckCircleOutline,
  ExpandMore,
  SelectAll,
  Clear,
  CheckCircle,
  RocketLaunch,
  Science,
  Visibility,
  Timeline,
  BugReport,
  Speed,
  AutoFixHigh,
  Assessment,
  TrendingUp,
  CheckCircleRounded,
  RadioButtonUnchecked,
  Settings,
  Refresh,
  InfoOutlined,
  WarningAmber,
  Search,
  Link,
  PhoneIphone,
  Tablet,
  Computer,
  AccessTime,
  Error
} from '@mui/icons-material'

const API_BASE = 'http://localhost:5000/api'

// Helper function to render status chip
const getStatusChip = (status, misMatchPercentage) => {
  const statusConfig = {
    pending: { color: 'default', icon: <RadioButtonUnchecked />, label: 'Not Run' },
    running: { color: 'primary', icon: <CircularProgress size={16} />, label: 'Running...' },
    passed: { color: 'success', icon: <CheckCircle />, label: 'Passed' },
    failed: { color: 'error', icon: <Clear />, label: `Failed (${misMatchPercentage}% diff)` }
  };

  const config = statusConfig[status];
  return config ? (
    <Chip
      size="small"
      icon={config.icon}
      label={config.label}
      color={config.color}
      variant="outlined"
      sx={{ ml: 1 }}
    />
  ) : null;
};

function TestRunner({ project, config }) {
  // Socket.IO state
  const socketRef = useRef(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [realTimeProgress, setRealTimeProgress] = useState(0);
  const [realTimeScenario, setRealTimeScenario] = useState(null);
  const [realTimeMessage, setRealTimeMessage] = useState('');
  const [liveScenarioResults, setLiveScenarioResults] = useState({}); // Real-time scenario status with viewport details
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [initialSelection, setInitialSelection] = useState([]);
  const [testRunning, setTestRunning] = useState(false)
  const [approveRunning, setApproveRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [scenarios, setScenarios] = useState([])
  const [selectedScenarios, setSelectedScenarios] = useState([])
  // Removed runAllScenarios, always use selectedScenarios
  const [activeStep, setActiveStep] = useState(0)
  const [expandedResult, setExpandedResult] = useState(false)
  const [scenarioResults, setScenarioResults] = useState({}) // Track test results per scenario
  const [currentScenario, setCurrentScenario] = useState(null) // Currently running scenario
  const [backstopReport, setBackstopReport] = useState(null)

  useEffect(() => {
    const init = async () => {
      await loadScenarios();
      await loadBackstopReport();
    };
    init();
  }, []);

  // Socket.IO connection effect
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    
    socketRef.current.on('connect', () => {
      setSocketConnected(true);
      console.log('Connected to Socket.IO server');
    });
    
    socketRef.current.on('disconnect', () => {
      setSocketConnected(false);
      console.log('Disconnected from Socket.IO server');
    });
    
    socketRef.current.on('test-progress', (progress) => {
      console.log('Test progress:', progress);
      setRealTimeProgress(progress.percent || 0);
      setRealTimeScenario(progress.scenario || null);
      setRealTimeMessage(progress.message || '');
      setTestRunning(progress.status === 'running' || progress.status === 'started');
      
      // Update individual scenario status with enhanced details
      if (progress.scenario && progress.status === 'scenario-complete') {
        setLiveScenarioResults(prev => ({
          ...prev,
          [progress.scenario]: {
            status: progress.scenarioStatus,
            mismatchPercentage: progress.mismatchPercentage,
            viewport: progress.viewport,
            timestamp: progress.timestamp,
            executionTime: progress.testDetails?.executionTime,
            selector: progress.testDetails?.selector,
            hasInteractions: progress.testDetails?.hasInteractions,
            hasDelay: progress.testDetails?.hasDelay,
            requiresSameDimensions: progress.testDetails?.requiresSameDimensions
          }
        }));
      } else if (progress.scenario && progress.viewport) {
        // For running scenarios, show running status
        const scenarioKey = `${progress.scenario}_${progress.viewport}`;
        setLiveScenarioResults(prev => ({
          ...prev,
          [progress.scenario]: {
            scenario: progress.scenario,
            viewport: progress.viewport,
            status: 'running',
            timestamp: new Date().toISOString()
          }
        }));
      }
    });
    
    socketRef.current.on('test-complete', async (result) => {
      console.log('Test complete:', result);
      setTestRunning(false);
      setRealTimeProgress(100);
      setMessage(result.message || 'Test completed');
      
      // Clear live scenario results to reset "running" status
      setLiveScenarioResults({});
      setRealTimeScenario(null);
      setRealTimeMessage('');
      
      // Reload test results after completion
      setTimeout(() => {
        loadBackstopReport();
      }, 1000);
      
      // Auto-create backup if test was successful
      if (result.success) {
        try {
          const timestamp = new Date().toISOString().split('T')[0];
          const backupName = `Auto-backup-${timestamp}`;
          await axios.post(`${API_BASE}/projects/${project.id}/backups`, {
            name: backupName,
            description: `Automatic backup created after successful test run on ${timestamp}`
          });
          console.log('Auto-backup created successfully');
        } catch (backupError) {
          console.warn('Failed to create auto-backup:', backupError);
        }
      }
    });
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const loadBackstopReport = async () => {
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/test-results`);
      if (response.data && !response.data.error) {
        setBackstopReport(response.data);
        // Update scenario results from BackstopJS report
        if (response.data?.tests) {
          const results = {};
          response.data.tests.forEach(test => {
            results[test.pair.label] = {
              status: test.status === 'pass' ? 'passed' : 'failed',
              misMatchPercentage: test.misMatchPercentage,
              isSameDimensions: test.isSameDimensions,
              diff: test.pair.diffImage,
              test: test.pair.test,
              reference: test.pair.reference
            };
          });
          setScenarioResults(results);
        }
      } else {
        setBackstopReport(null);
        // Show a friendly message and enable test button
        setMessage('No test results found for this project. Click "Run Visual Regression Test" to generate your first results.');
      }
    } catch (error) {
      setBackstopReport(null);
      setMessage('No test results found for this project. Click "Run Visual Regression Test" to generate your first results.');
    }
  };

  const loadScenarios = async () => {
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/scenarios`);
      const loadedScenarios = response.data.scenarios || response.data || [];
      setScenarios(loadedScenarios);
      // Set all scenarios as selected on first load
      if (loadedScenarios.length > 0) {
        setSelectedScenarios(loadedScenarios.map(s => s.label));
        setInitialSelection(loadedScenarios.map(s => s.label));
      }
    } catch (error) {
      console.error('Error loading scenarios:', error);
    }
  };

  const runApprove = async () => {
    setApproveRunning(true)
    setMessage('')
    setTestResult(null)
    
    try {
      const filter = selectedScenarios.length > 0 ? selectedScenarios.join('|') : undefined
      const response = await axios.post(`${API_BASE}/approve`, { filter })
      setMessage('✅ Test images approved as new references! All failing tests are now passing.')
      setTestResult(response.data)
    } catch (error) {
      setMessage(`Error approving tests: ${error.response?.data?.error || error.message}`)
    } finally {
      setApproveRunning(false)
    }
  }

  // Helper function to get viewport icon based on width
  const getViewportIcon = (viewport) => {
    if (!viewport || !viewport.width) return <Computer sx={{ fontSize: 16 }} />;
    
    const width = viewport.width;
    if (width <= 768) return <PhoneIphone sx={{ fontSize: 16 }} />;
    if (width <= 1024) return <Tablet sx={{ fontSize: 16 }} />;
    return <Computer sx={{ fontSize: 16 }} />;
  };

  const getStatusIcon = (status, mismatchPercentage = 0) => {
    switch (status) {
      case 'passed':
        return <CheckCircle sx={{ color: '#4caf50', fontSize: 16 }} />;
      case 'failed':
        return <Error sx={{ color: '#f44336', fontSize: 16 }} />;
      case 'running':
        return <AccessTime sx={{ color: '#ff9800', fontSize: 16 }} />;
      default:
        return <RadioButtonUnchecked sx={{ color: '#9e9e9e', fontSize: 16 }} />;
    }
  };

  const runTest = async () => {
    setTestRunning(true);
    setMessage("");
    setTestResult(null);
    
    // Clear live scenario results to reset any previous "running" states
    setLiveScenarioResults({});
    setRealTimeProgress(0);
    setRealTimeScenario(null);
    setRealTimeMessage('');

    // Step 1: Create backup of last test results before running new test
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const backupName = `Pre-test-backup-${timestamp}`;
      await axios.post(`${API_BASE}/projects/${project.id}/backups`, {
        name: backupName,
        description: `Backup created before test run on ${timestamp}`
      });
      console.log('Pre-test backup created successfully');
      setMessage("Backing up previous results...");
    } catch (backupError) {
      console.warn('Failed to create pre-test backup:', backupError);
      // Continue with test even if backup fails
    }

    // Initialize results for all scenarios as pending
    const scenariosToTest = scenarios.filter(s => selectedScenarios.includes(s.label));
    const initialResults = {};
    scenariosToTest.forEach(s => {
      initialResults[s.label] = { status: "pending" };
    });
    setScenarioResults(initialResults);

    try {
      const filter = selectedScenarios.join("|");
      // Actually trigger the backend test API
      const response = await axios.post(`${API_BASE}/projects/${project.id}/test`, { filter });
      // After running, fetch test results
      await loadBackstopReport();
    } catch (error) {
      const errorData = error.response?.data;
      if (errorData?.reportPath) {
        setMessage(`Test completed with differences detected.`);
        setTestResult(errorData);
        await loadBackstopReport();
      } else {
        setMessage(`Error running test: ${errorData?.error || error.message}`);
      }
    } finally {
      setTestRunning(false);
      setCurrentScenario(null);
      
      // Clear live scenario results when test ends (success, error, or interruption)
      setLiveScenarioResults({});
      setRealTimeScenario(null);
      setRealTimeMessage('');
    }
  };

  const handleScenarioSelection = (scenarioLabel) => {
    if (selectedScenarios.includes(scenarioLabel)) {
      setSelectedScenarios(selectedScenarios.filter(s => s !== scenarioLabel));
    } else {
      setSelectedScenarios([...selectedScenarios, scenarioLabel]);
    }
  };

  const handleSelectAll = () => {
    setSelectedScenarios(scenarios.map(s => s.label));
  };
  const handleDeselectAll = () => {
    setSelectedScenarios([]);
  };
  const handleResetSelection = () => {
    setSelectedScenarios(initialSelection);
  };
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  const handleShowSelectedOnly = (e) => {
    setShowSelectedOnly(e.target.checked);
  };
  const filteredScenarios = scenarios.filter(s => {
    const matchesSearch =
      s.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.url?.toLowerCase().includes(searchTerm.toLowerCase());
    const isSelected = selectedScenarios.includes(s.label);
    return matchesSearch && (!showSelectedOnly || isSelected);
  });
  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
          Visual Regression Testing
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: '600px', mx: 'auto' }}>
          Execute visual regression tests with real-time progress tracking and comprehensive reporting
        </Typography>
        {/* Connection Status */}
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <Chip
            size="small"
            icon={socketConnected ? <CheckCircle /> : <WarningAmber />}
            label={socketConnected ? 'Real-time Connected' : 'Real-time Disconnected'}
            color={socketConnected ? 'success' : 'warning'}
            variant="outlined"
          />
        </Box>
      </Box>

      {/* Alert Messages */}
      {message && (
        <Alert 
          severity={message.includes('Error') || message.includes('Failed') ? 'error' : 
                   message.includes('approved') || message.includes('completed') ? 'success' : 'info'} 
          sx={{ mb: 3, borderRadius: '12px' }}
          onClose={() => setMessage('')}
        >
          {message}
        </Alert>
      )}

      {/* Main Control Panel */}
      <Card elevation={0} sx={{ mb: 4, borderRadius: '16px', border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PlayArrow sx={{ color: 'primary.main' }} />
            Test Controls
          </Typography>
          
          <Grid container spacing={4} alignItems="center">
            {/* Test Actions */}
            <Grid item xs={12} lg={8}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={testRunning ? <CircularProgress size={20} /> : <PlayArrow />}
                  onClick={runTest}
                  disabled={testRunning || selectedScenarios.length === 0}
                  sx={{
                    borderRadius: '12px',
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 4,
                    py: 1.5,
                    minWidth: '200px'
                  }}
                >
                  {testRunning ? 'Running Tests...' : 'Run Visual Test'}
                </Button>
                
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<CheckCircle />}
                  onClick={approveImages}
                  disabled={!backstopReport || testRunning}
                  sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 600, px: 3, py: 1.5 }}
                >
                  Approve Images
                </Button>
                
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<GetApp />}
                  onClick={downloadResults}
                  disabled={!backstopReport}
                  sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 600, px: 3, py: 1.5 }}
                >
                  Export Results
                </Button>
                
                {backstopReport && (
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<Visibility />}
                    onClick={() => window.open(`${API_BASE}/projects/${project.id}/report/index.html`, '_blank')}
                    sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 600, px: 3, py: 1.5 }}
                  >
                    View Report
                  </Button>
                )}
                
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<Refresh />}
                  onClick={() => window.location.reload()}
                  sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 600, px: 3, py: 1.5 }}
                >
                  Reset
                </Button>
              </Box>
            </Grid>

            {/* Selection Info */}
            <Grid item xs={12} lg={4}>
              <Box sx={{ textAlign: { xs: 'left', lg: 'right' } }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  {selectedScenarios.length} of {scenarios?.length || 0}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  scenarios selected for testing
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Quick Stats Dashboard */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <Card elevation={0} sx={{ textAlign: 'center', p: 3, borderRadius: '16px', bgcolor: 'primary.lighter' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {selectedScenarios.length}
            </Typography>
            <Typography variant="body2" sx={{ color: 'primary.dark', fontWeight: 500 }}>
              Selected
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card elevation={0} sx={{ textAlign: 'center', p: 3, borderRadius: '16px', bgcolor: 'success.lighter' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
              {Object.values(scenarioResults).filter(r => r.status === 'passed').length}
            </Typography>
            <Typography variant="body2" sx={{ color: 'success.dark', fontWeight: 500 }}>
              Passed
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card elevation={0} sx={{ textAlign: 'center', p: 3, borderRadius: '16px', bgcolor: 'error.lighter' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>
              {Object.values(scenarioResults).filter(r => r.status === 'failed').length}
            </Typography>
            <Typography variant="body2" sx={{ color: 'error.dark', fontWeight: 500 }}>
              Failed
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card elevation={0} sx={{ textAlign: 'center', p: 3, borderRadius: '16px', bgcolor: 'warning.lighter' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
              {Object.values(liveScenarioResults).filter(r => r.status === 'running').length}
            </Typography>
            <Typography variant="body2" sx={{ color: 'warning.dark', fontWeight: 500 }}>
              Running
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Test Results Summary - Only show when there are results */}
      {Object.keys(scenarioResults).length > 0 && (
        <Card elevation={0} sx={{ mb: 4, borderRadius: '16px', border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assessment sx={{ color: 'primary.main' }} />
              Performance Overview
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 3, bgcolor: 'success.lighter', borderRadius: '12px' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {(() => {
                      const totalResults = Object.values(scenarioResults);
                      const passedResults = totalResults.filter(r => r.status === 'passed');
                      if (totalResults.length === 0) return '0';
                      return Math.round((passedResults.length / totalResults.length) * 100);
                    })()}%
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'success.dark', fontWeight: 500 }}>
                    Success Rate
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 3, bgcolor: 'warning.lighter', borderRadius: '12px' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
                    {(() => {
                      const mismatchResults = Object.values(scenarioResults)
                        .filter(r => typeof r.misMatchPercentage !== 'undefined' && r.misMatchPercentage > 0);
                      if (mismatchResults.length === 0) return '0.0';
                      const avgMismatch = mismatchResults.reduce((acc, r) => acc + r.misMatchPercentage, 0) / mismatchResults.length;
                      return avgMismatch.toFixed(1);
                    })()}%
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'warning.dark', fontWeight: 500 }}>
                    Avg Mismatch
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 3, bgcolor: 'error.lighter', borderRadius: '12px' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>
                    {Object.values(scenarioResults).filter(r => r.isSameDimensions === false).length}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'error.dark', fontWeight: 500 }}>
                    Size Issues
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 3, bgcolor: 'info.lighter', borderRadius: '12px' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'info.main' }}>
                    {(() => {
                      if (backstopReport?.testSuite?.date) {
                        return new Date(backstopReport.testSuite.date).toLocaleDateString();
                      } else if (backstopReport?.testSuite && typeof backstopReport.testSuite === 'string') {
                        return 'Recent';
                      }
                      return 'Never';
                    })()}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'info.dark', fontWeight: 500 }}>
                    Last Run
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Test Configuration - Only show when config is available */}
      {config && (
        <Card elevation={0} sx={{ mb: 4, borderRadius: '16px', border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Settings sx={{ color: 'primary.main' }} />
              Configuration
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: '12px' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Computer sx={{ fontSize: 18 }} />
                    Viewports ({config?.viewports?.length || 0})
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {config?.viewports?.map((viewport, index) => (
                      <Chip
                        key={index}
                        size="small"
                        icon={getViewportIcon(viewport)}
                        label={`${viewport.width}×${viewport.height}`}
                        sx={{
                          bgcolor: 'primary.lighter',
                          color: 'primary.dark',
                          fontWeight: 500,
                          borderRadius: '8px'
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: '12px' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                    Settings
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                    <strong>Scenarios:</strong> {scenarios?.length || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                    <strong>Engine:</strong> BackstopJS
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    <strong>Threshold:</strong> {config?.misMatchThreshold || 0.1}%
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Test Overview Statistics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ p: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar sx={{ bgcolor: 'primary.light', width: 48, height: 48 }}>
                <Assessment sx={{ color: 'primary.main' }} />
              </Avatar>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {scenarios.length}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Total Scenarios
                </Typography>
              </Box>
            </Stack>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ p: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar sx={{ bgcolor: 'success.light', width: 48, height: 48 }}>
                <CheckCircle sx={{ color: 'success.main' }} />
              </Avatar>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {Object.values(scenarioResults).filter(r => r.status === 'passed').length}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Passed Tests
                </Typography>
              </Box>
            </Stack>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ p: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar sx={{ bgcolor: 'error.light', width: 48, height: 48 }}>
                <BugReport sx={{ color: 'error.main' }} />
              </Avatar>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {Object.values(scenarioResults).filter(r => r.status === 'failed').length}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Failed Tests
                </Typography>
              </Box>
            </Stack>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ p: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar sx={{ bgcolor: 'warning.light', width: 48, height: 48 }}>
                <Speed sx={{ color: 'warning.main' }} />
              </Avatar>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {Object.values(liveScenarioResults).filter(r => r.status === 'running').length}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Running Now
                </Typography>
              </Box>
            </Stack>
          </Card>
        </Grid>
      </Grid>

      {/* Test History & Performance Trends */}
      {Object.keys(scenarioResults).length > 0 && (
        <Card elevation={0} sx={{ mb: 4, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUp sx={{ color: 'primary.main' }} />
              Test Performance Overview
            </Typography>
            
            <Grid container spacing={3}>
              {/* Success Rate */}
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: '8px' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {(() => {
                      const totalResults = Object.values(scenarioResults);
                      const passedResults = totalResults.filter(r => r.status === 'passed');
                      
                      if (totalResults.length === 0) return '0';
                      
                      return Math.round((passedResults.length / totalResults.length) * 100);
                    })()}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Success Rate
                  </Typography>
                </Box>
              </Grid>
              
              {/* Average Mismatch */}
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: '8px' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
                    {(() => {
                      const mismatchResults = Object.values(scenarioResults)
                        .filter(r => typeof r.misMatchPercentage !== 'undefined' && r.misMatchPercentage > 0);
                      
                      if (mismatchResults.length === 0) return '0.0';
                      
                      const avgMismatch = mismatchResults.reduce((acc, r) => acc + r.misMatchPercentage, 0) / mismatchResults.length;
                      return avgMismatch.toFixed(1);
                    })()}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Avg Mismatch
                  </Typography>
                </Box>
              </Grid>
              
              {/* Dimension Issues */}
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: '8px' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>
                    {Object.values(scenarioResults).filter(r => r.isSameDimensions === false).length}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Dimension Issues
                  </Typography>
                </Box>
              </Grid>
              
              {/* Last Test Run */}
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: '8px' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {(() => {
                      if (backstopReport?.testSuite?.date) {
                        // New format: testSuite is an object with date
                        return new Date(backstopReport.testSuite.date).toLocaleDateString();
                      } else if (backstopReport?.testSuite && typeof backstopReport.testSuite === 'string') {
                        // Old format: try to get date from current timestamp as fallback
                        return 'Recent';
                      }
                      return 'Never';
                    })()}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Last Test Run
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Test Execution Panel */}
      <Card 
        elevation={0}
        sx={{ 
          mt: 2,
          borderRadius: '16px',
          border: '1px solid',
          borderColor: 'divider',
          background: theme => `linear-gradient(145deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
          position: 'relative',
          overflow: 'visible'
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={3}>
            <Box>
              <Typography 
                variant="h6" 
                sx={{ 
                  mb: 1,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <Science sx={{ color: 'primary.main' }} />
                Visual Regression Testing
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: 'text.secondary',
                  maxWidth: '600px'
                }}
              >
                Compare your current UI state against approved reference images to detect visual changes.
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="large"
              startIcon={testRunning ? (
                <CircularProgress 
                  size={20} 
                  color="inherit" 
                  thickness={4}
                  sx={{ color: 'white' }} 
                />
              ) : (
                <PlayArrow />
              )}
              onClick={runTest}
              disabled={testRunning || approveRunning || scenarios.length === 0 || selectedScenarios.length === 0}
              fullWidth
              sx={{ 
                py: 2,
                borderRadius: '12px',
                fontSize: '1.1rem',
                fontWeight: 600,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: '0 8px 16px -4px rgba(59, 130, 246, 0.2)'
                },
                '&:disabled': {
                  bgcolor: 'action.disabledBackground'
                }
              }}
            >
              {testRunning ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  Running Visual Tests...
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontWeight: 500
                    }}
                  >
                    This may take a few moments
                  </Typography>
                </Box>
              ) : (
                'Run Visual Regression Test'
              )}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Real-time progress display */}
      {testRunning && (
        <Card sx={{ mb: 3, border: '1px solid', borderColor: 'primary.main' }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
              Real-time Test Progress
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={realTimeProgress} 
              sx={{ mb: 2, height: 8, borderRadius: 4 }}
            />
            <Typography variant="body2" sx={{ mb: 1 }}>
              Progress: {realTimeProgress.toFixed(0)}%
            </Typography>
            {realTimeScenario && (
              <Typography variant="body2" sx={{ mb: 1 }}>
                Current Scenario: {realTimeScenario}
              </Typography>
            )}
            {realTimeMessage && (
              <Typography variant="body2" color="text.secondary">
                {realTimeMessage}
              </Typography>
            )}
            {!socketConnected && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Real-time connection lost. Progress may not be accurate.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Enhanced Test Configuration Overview */}
      {scenarios.length > 0 && (
        <Card elevation={0} sx={{ mb: 4, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoOutlined sx={{ color: 'primary.main' }} />
              Test Configuration Details
            </Typography>
            
            <Grid container spacing={3}>
              {/* Engine Information */}
              <Grid item xs={12} md={4}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Test Engine
                  </Typography>
                  <Chip
                    label="Puppeteer"
                    icon={<Speed />}
                    sx={{ borderRadius: '8px', bgcolor: 'rgba(33, 150, 243, 0.1)', color: '#2196f3' }}
                  />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Headless Chrome automation
                  </Typography>
                </Stack>
              </Grid>
              
              {/* Viewport Coverage */}
              <Grid item xs={12} md={4}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Viewport Coverage
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {config?.viewports?.map((viewport, index) => (
                      <Chip
                        key={index}
                        size="small"
                        icon={getViewportIcon(viewport)}
                        label={`${viewport.width}x${viewport.height}`}
                        sx={{ borderRadius: '6px', bgcolor: 'background.default' }}
                      />
                    ))}
                  </Box>
                </Stack>
              </Grid>
              
              {/* Test Complexity */}
              <Grid item xs={12} md={4}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Test Complexity
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      size="small"
                      label={`${scenarios.filter(s => s.selectors?.length > 1).length} Multi-selector`}
                      sx={{ borderRadius: '6px', bgcolor: 'rgba(156, 39, 176, 0.1)', color: '#9c27b0' }}
                    />
                    <Chip
                      size="small"
                      label={`${scenarios.filter(s => s.delay > 0).length} With Delays`}
                      sx={{ borderRadius: '6px', bgcolor: 'rgba(255, 152, 0, 0.1)', color: '#ff9800' }}
                    />
                  </Box>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Scenario Selection UI */}
      <Box sx={{ mt: 6 }}>
        <Box 
          sx={{ 
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 3
          }}
        >
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Assessment sx={{ color: 'primary.main' }} />
            Select Scenarios to Test
          </Typography>
          <Box 
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: 'primary.lighter',
              color: 'primary.dark',
              py: 0.5,
              px: 2,
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            {selectedScenarios.length} selected
          </Box>
        </Box>
        {scenarios.length > 0 ? (
          <Box>
            <Card
              elevation={0}
              sx={{
                mb: 3,
                borderRadius: '12px',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper'
              }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={9}>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        variant="outlined"
                        startIcon={<SelectAll />}
                        onClick={handleSelectAll}
                        sx={{
                          borderRadius: '8px',
                          textTransform: 'none',
                          fontWeight: 500
                        }}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<Clear />}
                        onClick={handleDeselectAll}
                        sx={{
                          borderRadius: '8px',
                          textTransform: 'none',
                          fontWeight: 500
                        }}
                      >
                        Deselect All
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={handleResetSelection}
                        sx={{
                          borderRadius: '8px',
                          textTransform: 'none',
                          fontWeight: 500
                        }}
                      >
                        Reset Selection
                      </Button>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box 
                      sx={{ 
                        position: 'relative',
                        width: '100%'
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Search scenarios..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        style={{
                          padding: '12px',
                          paddingLeft: '40px',
                          borderRadius: '8px',
                          border: '1px solid',
                          borderColor: 'rgba(0, 0, 0, 0.23)',
                          width: '100%',
                          fontSize: '0.9375rem',
                          transition: 'all 0.2s'
                        }}
                      />
                      <Search 
                        sx={{ 
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'text.secondary'
                        }} 
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Checkbox 
                          checked={showSelectedOnly} 
                          onChange={handleShowSelectedOnly}
                          sx={{
                            '&.Mui-checked': {
                              color: 'primary.main'
                            }
                          }}
                        />
                      }
                      label={
                        <Typography sx={{ fontWeight: 500 }}>
                          Show Selected Only
                        </Typography>
                      }
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
            
            {/* Test Performance Insights */}
            {Object.keys(liveScenarioResults).length > 0 && (
              <Card elevation={0} sx={{ mb: 3, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Timeline sx={{ color: 'primary.main' }} />
                    Real-Time Test Insights
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {/* Average execution time */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: '8px' }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {Math.round(Object.values(liveScenarioResults)
                            .filter(r => r.executionTime)
                            .reduce((acc, r) => acc + r.executionTime, 0) / 
                            Object.values(liveScenarioResults).filter(r => r.executionTime).length) || 0}ms
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Avg Execution Time
                        </Typography>
                      </Box>
                    </Grid>
                    
                    {/* Interactive scenarios count */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: '8px' }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>
                          {Object.values(liveScenarioResults).filter(r => r.hasInteractions).length}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Interactive Tests
                        </Typography>
                      </Box>
                    </Grid>
                    
                    {/* Scenarios with delays */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: '8px' }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
                          {Object.values(liveScenarioResults).filter(r => r.hasDelay).length}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          With Delays
                        </Typography>
                      </Box>
                    </Grid>
                    
                    {/* Average mismatch percentage */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: '8px' }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main' }}>
                          {(() => {
                            const mismatchResults = Object.values(liveScenarioResults)
                              .filter(r => r.mismatchPercentage > 0);
                            
                            if (mismatchResults.length === 0) return '0.0';
                            
                            const avgMismatch = mismatchResults.reduce((acc, r) => acc + r.mismatchPercentage, 0) / mismatchResults.length;
                            return avgMismatch.toFixed(1);
                          })()}%
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Avg Mismatch
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}
            
            <Box sx={{ display: 'grid', gap: 2 }}>
              {filteredScenarios.map((scenario) => {
                const result = scenarioResults[scenario.label] || {};
                const liveResult = liveScenarioResults[scenario.label];
                
                // Use live result if available, otherwise fall back to static result
                const displayStatus = liveResult?.status || result.status;
                const displayMismatch = liveResult?.mismatchPercentage || result.misMatchPercentage;
                const displayViewport = config?.viewports?.[0];

                return (
                  <Paper
                    key={scenario.label || scenario.url}
                    elevation={0}
                    sx={{ 
                      p: 3, 
                      border: '1px solid', 
                      borderColor: selectedScenarios.includes(scenario.label) ? 'primary.main' : 'divider', 
                      borderRadius: '12px', 
                      cursor: 'pointer', 
                      transition: 'all 0.2s',
                      bgcolor: selectedScenarios.includes(scenario.label) ? 'primary.lighter' : 'background.paper',
                      '&:hover': { 
                        borderColor: 'primary.main',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 8px -2px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06)'
                      }
                    }}
                    onClick={() => handleScenarioSelection(scenario.label)}
                  >
                    <Stack direction="row" alignItems="flex-start" spacing={2}>
                      {selectedScenarios.includes(scenario.label) ? (
                        <CheckCircleRounded 
                          sx={{ 
                            color: 'primary.main',
                            fontSize: 24
                          }} 
                        />
                      ) : (
                        <RadioButtonUnchecked 
                          sx={{ 
                            color: 'text.secondary',
                            fontSize: 24
                          }} 
                        />
                      )}
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontWeight: 600,
                              color: selectedScenarios.includes(scenario.label) ? 'primary.dark' : 'text.primary',
                            }}
                          >
                            {scenario.label}
                          </Typography>
                        </Stack>

                        {/* Viewport information */}
                        {displayViewport && (
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                            {getViewportIcon(displayViewport)}
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              {displayViewport.width}x{displayViewport.height}
                            </Typography>
                            <Chip
                              size="small"
                              label={displayViewport.width <= 768 ? 'Mobile' : displayViewport.width <= 1024 ? 'Tablet' : 'Desktop'}
                              sx={{
                                height: 20,
                                fontSize: '0.75rem',
                                borderRadius: '10px',
                                bgcolor: 'background.default',
                                color: 'text.secondary'
                              }}
                            />
                          </Stack>
                        )}
                        
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: 'text.secondary',
                            mb: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                          }}
                        >
                          <Link sx={{ fontSize: 16 }} />
                          {scenario.url}
                        </Typography>

                        {/* Real-time status display */}
                        {displayStatus && (
                          <Box 
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              flexWrap: 'wrap',
                              gap: 2 
                            }}
                          >
                            <Chip
                              size="small"
                              icon={getStatusIcon(displayStatus, displayMismatch)}
                              label={
                                displayStatus === 'passed' ? '✅ Passed' :
                                displayStatus === 'failed' ? `❌ Failed` :
                                displayStatus === 'running' ? '⏳ Running' : 'Pending'
                              }
                              sx={{
                                borderRadius: '8px',
                                bgcolor: displayStatus === 'passed' ? 'rgba(76, 175, 80, 0.1)' :
                                         displayStatus === 'failed' ? 'rgba(244, 67, 54, 0.1)' :
                                         displayStatus === 'running' ? 'rgba(255, 152, 0, 0.1)' :
                                         'background.default',
                                color: displayStatus === 'passed' ? '#4caf50' :
                                       displayStatus === 'failed' ? '#f44336' :
                                       displayStatus === 'running' ? '#ff9800' :
                                       'text.secondary',
                                fontWeight: 500
                              }}
                            />
                            {typeof displayMismatch !== 'undefined' && displayMismatch > 0 && (
                              <Chip
                                size="small"
                                label={`Diff: ${displayMismatch}%`}
                                sx={{
                                  borderRadius: '8px',
                                  bgcolor: 'background.paper',
                                  color: 'text.secondary',
                                  border: '1px solid',
                                  borderColor: 'divider'
                                }}
                              />
                            )}
                            {/* Test execution time */}
                            {liveResult?.executionTime && (
                              <Chip
                                size="small"
                                icon={<Speed sx={{ fontSize: 12 }} />}
                                label={`${liveResult.executionTime}ms`}
                                sx={{
                                  borderRadius: '8px',
                                  bgcolor: 'background.default',
                                  color: 'text.secondary',
                                  fontSize: '0.75rem'
                                }}
                              />
                            )}
                            {/* Selector information */}
                            {scenario.selectors && scenario.selectors.length > 0 && (
                              <Chip
                                size="small"
                                icon={<Search sx={{ fontSize: 12 }} />}
                                label={`${scenario.selectors.length} selector${scenario.selectors.length > 1 ? 's' : ''}`}
                                sx={{
                                  borderRadius: '8px',
                                  bgcolor: 'rgba(33, 150, 243, 0.1)',
                                  color: '#2196f3',
                                  fontSize: '0.75rem'
                                }}
                              />
                            )}
                            {/* Delay information */}
                            {scenario.delay && scenario.delay > 0 && (
                              <Chip
                                size="small"
                                icon={<AccessTime sx={{ fontSize: 12 }} />}
                                label={`${scenario.delay}ms delay`}
                                sx={{
                                  borderRadius: '8px',
                                  bgcolor: 'rgba(156, 39, 176, 0.1)',
                                  color: '#9c27b0',
                                  fontSize: '0.75rem'
                                }}
                              />
                            )}
                            {liveResult?.timestamp && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <AccessTime sx={{ fontSize: 12 }} />
                                {new Date(liveResult.timestamp).toLocaleTimeString()}
                              </Typography>
                            )}
                          </Box>
                        )}
                        {/* Show last test result details if available */}
                        {result.status && !displayStatus && (
                          <Box 
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              flexWrap: 'wrap',
                              gap: 2 
                            }}
                          >
                            {getStatusChip(result.status, result.misMatchPercentage)}
                            {typeof result.misMatchPercentage !== 'undefined' && (
                              <Chip
                                size="small"
                                label={`Diff: ${result.misMatchPercentage}%`}
                                sx={{
                                  borderRadius: '8px',
                                  bgcolor: 'background.paper',
                                  fontWeight: 500
                                }}
                              />
                            )}
                            {typeof result.isSameDimensions !== 'undefined' && (
                              <Chip
                                size="small"
                                icon={result.isSameDimensions ? <CheckCircle /> : <WarningAmber />}
                                label={result.isSameDimensions ? 'Dimensions OK' : 'Dimensions Mismatch'}
                                color={result.isSameDimensions ? 'success' : 'warning'}
                                sx={{
                                  borderRadius: '8px',
                                  fontWeight: 500
                                }}
                              />
                            )}
                          </Box>
                        )}
                        
                        {/* Advanced scenario details (expandable) */}
                        {(scenario.readyEvent || scenario.readySelector || scenario.hideSelectors?.length > 0 || scenario.removeSelectors?.length > 0) && (
                          <Accordion elevation={0} sx={{ mt: 2, bgcolor: 'transparent' }}>
                            <AccordionSummary
                              expandIcon={<ExpandMore />}
                              sx={{ 
                                px: 0, 
                                minHeight: 'auto',
                                '& .MuiAccordionSummary-content': { 
                                  margin: '8px 0',
                                  alignItems: 'center'
                                }
                              }}
                            >
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                <Settings sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                                Advanced Configuration
                              </Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ px: 0, pt: 0 }}>
                              <Grid container spacing={2}>
                                {scenario.readyEvent && (
                                  <Grid item xs={12} sm={6}>
                                    <Chip
                                      size="small"
                                      label={`Ready Event: ${scenario.readyEvent}`}
                                      sx={{ borderRadius: '6px', bgcolor: 'rgba(156, 39, 176, 0.1)', color: '#9c27b0' }}
                                    />
                                  </Grid>
                                )}
                                {scenario.readySelector && (
                                  <Grid item xs={12} sm={6}>
                                    <Chip
                                      size="small"
                                      label={`Ready Selector: ${scenario.readySelector}`}
                                      sx={{ borderRadius: '6px', bgcolor: 'rgba(76, 175, 80, 0.1)', color: '#4caf50' }}
                                    />
                                  </Grid>
                                )}
                                {scenario.hideSelectors?.length > 0 && (
                                  <Grid item xs={12} sm={6}>
                                    <Chip
                                      size="small"
                                      label={`Hidden: ${scenario.hideSelectors.length} elements`}
                                      sx={{ borderRadius: '6px', bgcolor: 'rgba(158, 158, 158, 0.1)', color: '#9e9e9e' }}
                                    />
                                  </Grid>
                                )}
                                {scenario.removeSelectors?.length > 0 && (
                                  <Grid item xs={12} sm={6}>
                                    <Chip
                                      size="small"
                                      label={`Removed: ${scenario.removeSelectors.length} elements`}
                                      sx={{ borderRadius: '6px', bgcolor: 'rgba(244, 67, 54, 0.1)', color: '#f44336' }}
                                    />
                                  </Grid>
                                )}
                              </Grid>
                            </AccordionDetails>
                          </Accordion>
                        )}
                      </Box>
                    </Stack>
                  </Paper>
                );
              })}
            </Box>
          </Box>
        ) : (
          <Card
            elevation={0}
            sx={{ 
              borderRadius: '16px',
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              p: 4,
              textAlign: 'center'
            }}
          >
            <Assessment 
              sx={{ 
                fontSize: 48,
                color: 'text.secondary',
                mb: 2,
                opacity: 0.5
              }} 
            />
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600,
                mb: 1
              }}
            >
              No Scenarios Found
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                color: 'text.secondary',
                mb: 3,
                maxWidth: '400px',
                mx: 'auto'
              }}
            >
              Please configure scenarios in the Scenario Manager first to start running visual regression tests.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<Settings />}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 500
              }}
              onClick={() => {
                // Navigation would go here in a router setup
  );
}

export default TestRunner
