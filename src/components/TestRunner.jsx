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
  Link
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
    });
    
    socketRef.current.on('test-complete', (result) => {
      console.log('Test complete:', result);
      setTestRunning(false);
      setRealTimeProgress(100);
      setMessage(result.message || 'Test completed');
      // Reload test results after completion
      setTimeout(() => {
        loadBackstopReport();
      }, 1000);
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

  const runTest = async () => {
    setTestRunning(true);
    setMessage("");
    setTestResult(null);

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
      setMessage("Test started. Please wait for results...");
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
    <Box 
      sx={{ 
        mb: 4, 
        px: { xs: 2, sm: 3, md: 4 },
        maxWidth: '1600px',
        mx: 'auto'
      }}
    >
      {/* Header Section */}
      <Box 
        sx={{ 
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 3,
          mb: 4,
          pt: 2
        }}
      >
        <Avatar 
          sx={{ 
            bgcolor: 'primary.main',
            width: 64,
            height: 64,
            borderRadius: '16px',
            boxShadow: '0 8px 16px -4px rgba(59, 130, 246, 0.2)'
          }}
        >
          <RocketLaunch sx={{ fontSize: 32 }} />
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Typography 
              variant="h3" 
              component="h1" 
              sx={{ 
                fontWeight: 700, 
                color: 'text.primary',
                fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem' },
                letterSpacing: '-0.025em'
              }}
            >
              Test Runner
            </Typography>
            {/* Socket.IO Connection Status */}
            <Chip
              size="small"
              icon={socketConnected ? <CheckCircle /> : <WarningAmber />}
              label={socketConnected ? 'Real-time Connected' : 'Real-time Disconnected'}
              color={socketConnected ? 'success' : 'warning'}
              variant="outlined"
              sx={{ ml: 'auto' }}
            />
          </Box>
          <Typography 
            variant="h6" 
            sx={{ 
              color: 'text.secondary',
              fontWeight: 400,
              fontSize: { xs: '1rem', sm: '1.1rem' },
              maxWidth: '600px'
            }}
          >
            Execute visual regression tests and manage reference baselines with real-time progress updates
          </Typography>
        </Box>
      </Box>

      {/* Message Alert */}
      {message && (
        <Fade in={Boolean(message)}>
          <Alert 
            severity={message.includes('Error') ? 'error' : 'info'}
            sx={{ 
              mb: 4,
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06)',
              '& .MuiAlert-icon': {
                fontSize: '24px'
              },
              '& .MuiAlert-message': {
                fontSize: '0.9375rem',
                fontWeight: 500
              }
            }}
            variant="filled"
            action={
              <IconButton 
                color="inherit" 
                size="small" 
                onClick={() => setMessage('')}
                sx={{
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.15)'
                  }
                }}
              >
                <Clear />
              </IconButton>
            }
          >
            {message}
          </Alert>
        </Fade>
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
            <Box sx={{ display: 'grid', gap: 2 }}>
              {filteredScenarios.map((scenario) => {
                const result = scenarioResults[scenario.label] || {};
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
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            fontWeight: 600,
                            color: selectedScenarios.includes(scenario.label) ? 'primary.dark' : 'text.primary',
                            mb: 0.5
                          }}
                        >
                          {scenario.label}
                        </Typography>
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
                        {/* Show last test result details if available */}
                        {result.status && (
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
                console.log('Navigate to scenarios');
              }}
            >
              Go to Scenario Manager
            </Button>
          </Card>
        )}
      </Box>
    </Box>
  );
}

export default TestRunner
