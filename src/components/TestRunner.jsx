import { useState, useEffect } from 'react'
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
  WarningAmber
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

function TestRunner() {
  const [testRunning, setTestRunning] = useState(false)
  const [approveRunning, setApproveRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [scenarios, setScenarios] = useState([])
  const [selectedScenarios, setSelectedScenarios] = useState([])
  const [runAllScenarios, setRunAllScenarios] = useState(true)
  const [activeStep, setActiveStep] = useState(0)
  const [expandedResult, setExpandedResult] = useState(false)
  const [scenarioResults, setScenarioResults] = useState({}) // Track test results per scenario
  const [currentScenario, setCurrentScenario] = useState(null) // Currently running scenario
  const [backstopReport, setBackstopReport] = useState(null)

  useEffect(() => {
    const init = async () => {
      await loadScenarios()
      await loadBackstopReport()
      // Set all scenarios as selected when runAllScenarios is true
      if (runAllScenarios && scenarios.length > 0) {
        setSelectedScenarios(scenarios.map(s => s.label))
      }
    }
    init()
  }, [])

  const loadBackstopReport = async () => {
    try {
      const response = await axios.get(`${API_BASE}/test-results`)
      setBackstopReport(response.data)
      
      // Update scenario results from BackstopJS report
      if (response.data?.tests) {
        const results = {}
        response.data.tests.forEach(test => {
          results[test.pair.label] = {
            status: test.status === 'pass' ? 'passed' : 'failed',
            misMatchPercentage: test.misMatchPercentage,
            isSameDimensions: test.isSameDimensions,
            diff: test.pair.diffImage,
            test: test.pair.test,
            reference: test.pair.reference
          }
        })
        setScenarioResults(results)
      }
    } catch (error) {
      console.error('Error loading BackstopJS report:', error)
    }
  }

  const loadScenarios = async () => {
    try {
      const response = await axios.get(`${API_BASE}/scenarios`)
      const loadedScenarios = response.data.scenarios || response.data || []
      setScenarios(loadedScenarios)
      // Set all scenarios as selected if in "Run All" mode
      if (runAllScenarios) {
        setSelectedScenarios(loadedScenarios.map(s => s.label))
      }
    } catch (error) {
      console.error('Error loading scenarios:', error)
    }
  }

  const runApprove = async () => {
    setApproveRunning(true)
    setMessage('')
    setTestResult(null)
    
    try {
      const filter = runAllScenarios ? undefined : selectedScenarios.join('|')
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
    setTestRunning(true)
    setMessage('')
    setTestResult(null)
    
    // Initialize results for all scenarios as pending
    const scenariosToTest = runAllScenarios ? scenarios : scenarios.filter(s => selectedScenarios.includes(s.label));
    const initialResults = {};
    scenariosToTest.forEach(s => {
      initialResults[s.label] = { status: 'pending' };
    });
    setScenarioResults(initialResults);
    
    try {
      const filter = runAllScenarios ? undefined : selectedScenarios.join('|')
      
      // First check if we need to create any reference images
      for (const scenario of scenariosToTest) {
        setCurrentScenario(scenario.label);
        setScenarioResults(prev => ({
          ...prev,
          [scenario.label]: { status: 'running' }
        }));
        
        if (scenario.referenceUrl) {
          try {
            await axios.get(`${API_BASE}/check-reference/${encodeURIComponent(scenario.label)}?viewport=all`);
          } catch (error) {
            console.log('Reference check failed, will be created during test');
          }
        }
      }
      
      // Run the test
      const response = await axios.post(`${API_BASE}/test`, { filter });
      
      // Process test results
      const results = {...scenarioResults}; // Preserve existing results
      const testResults = response.data.result || {};
      
      // Mark all tested scenarios as passed if no differences found
      if (response.data.success) {
        scenariosToTest.forEach(scenario => {
          results[scenario.label] = {
            status: 'passed',
            misMatchPercentage: 0,
            isSameDimensions: true
          };
        });
      } else {
        // Update individual scenario results
        Object.entries(testResults).forEach(([scenarioLabel, result]) => {
          results[scenarioLabel] = {
            status: result.success ? 'passed' : 'failed',
            misMatchPercentage: result.misMatchPercentage,
            isSameDimensions: result.isSameDimensions,
            diff: result.diffImage,
            test: result.testImage,
            reference: result.referenceImage
          };
        });
      }
      
      setScenarioResults(results);
      setMessage(response.data.message || 'Visual regression test completed!')
      setTestResult(response.data)
      
      // Load latest BackstopJS report after test completes
      await loadBackstopReport()
      
    } catch (error) {
      const errorData = error.response?.data
      if (errorData?.reportPath) {
        setMessage(`Test completed with differences detected.`)
        setTestResult(errorData)
        // Load latest BackstopJS report even if test had differences
        await loadBackstopReport()
      } else {
        setMessage(`Error running test: ${errorData?.error || error.message}`)
      }
    } finally {
      setTestRunning(false)
      setCurrentScenario(null)
    }
  }

  const handleScenarioSelection = (scenarioLabel) => {
    if (selectedScenarios.includes(scenarioLabel)) {
      setSelectedScenarios(selectedScenarios.filter(s => s !== scenarioLabel))
    } else {
      setSelectedScenarios([...selectedScenarios, scenarioLabel])
    }
  }

  const selectAllScenarios = () => {
    setSelectedScenarios(scenarios.map(s => s.label))
  }

  const clearScenarioSelection = () => {
    setSelectedScenarios([])
  }

  const canRunTest = runAllScenarios || selectedScenarios.length > 0
  
  const getTestStatusColor = () => {
    if (testRunning || approveRunning) return 'warning'
    if (testResult?.success === true) return 'success'
    if (testResult?.success === false) return 'error'
    return 'default'
  }

  const getTestStatusText = () => {
    if (testRunning) return 'Running Tests...'
    if (approveRunning) return 'Approving Changes...'
    if (testResult?.success === true) return 'All Tests Passed'
    if (testResult?.success === false) return 'Differences Detected'
    return 'Ready to Test'
  }

  return (
    <Box sx={{ 
      width: '100%', 
      p: 0
    }}>
      {/* Header Section */}
      <Box sx={{ mb: 4, px: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
            <RocketLaunch />
          </Avatar>
          <Box>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: 'text.primary' }}>
              Test Runner
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400 }}>
              Execute visual regression tests and manage reference baselines
            </Typography>
          </Box>
        </Stack>

        {/* Status Cards Row */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              height: '100%'
            }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Speed sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {scenarios.length}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Scenarios Available
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white',
              height: '100%'
            }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Visibility sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {runAllScenarios ? scenarios.length : selectedScenarios.length}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Selected for Testing
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${
                getTestStatusColor() === 'success' ? '#4facfe 0%, #00f2fe 100%' :
                getTestStatusColor() === 'error' ? '#fa709a 0%, #fee140 100%' :
                getTestStatusColor() === 'warning' ? '#a8edea 0%, #fed6e3 100%' :
                '#d299c2 0%, #fef9d7 100%'
              })`,
              color: getTestStatusColor() === 'warning' ? 'text.primary' : 'white',
              height: '100%'
            }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                {testRunning || approveRunning ? (
                  <CircularProgress size={32} sx={{ mb: 1, color: 'inherit' }} />
                ) : (
                  <Assessment sx={{ fontSize: 32, mb: 1 }} />
                )}
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Status
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {getTestStatusText()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
              color: '#8B4513',
              height: '100%'
            }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <TrendingUp sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Progress
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  {testRunning || approveRunning ? 'In Progress' : 'Ready'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

      {/* Message Alert */}
        {message && (
          <Fade in={Boolean(message)}>
            <Alert 
              severity={message.includes('Error') && !message.includes('differences') ? 'error' : 'success'}
              sx={{ 
                mb: 3,
                borderRadius: 2,
                '& .MuiAlert-icon': { fontSize: 24 },
                '& .MuiAlert-message': { fontSize: '1rem' }
              }}
              action={
                <IconButton color="inherit" size="small" onClick={() => setMessage('')}>
                  <Clear />
                </IconButton>
              }
            >
              {message}
            </Alert>
          </Fade>
        )}
      </Box>

      <Grid container spacing={4} sx={{ width: '100%', margin: 0 }}>
        {/* Test Configuration Panel */}
        <Grid item xs={12} sx={{ width: '100%', padding: 0 }}>
          <Card sx={{ 
            borderRadius: 3,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            border: '1px solid',
            borderColor: 'divider',
            width: '100%',
            maxWidth: 'none'
          }}>
            <CardContent sx={{ 
              p: 3, 
              width: '100%'
            }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <Avatar sx={{ bgcolor: 'secondary.main' }}>
                  <Settings />
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Test Configuration
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Select scenarios and configure test parameters
                  </Typography>
                </Box>
              </Stack>

              <Divider sx={{ mb: 3 }} />
              
              <FormControl component="fieldset" sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Execution Mode
                </Typography>
                <RadioGroup
                  value={runAllScenarios ? 'all' : 'selected'}
                  onChange={(e) => {
                    const isAll = e.target.value === 'all';
                    setRunAllScenarios(isAll);
                    if (isAll) {
                      setSelectedScenarios(scenarios.map(s => s.label));
                    } else {
                      setSelectedScenarios([]);
                    }
                  }}
                >
                  <FormControlLabel 
                    value="all" 
                    control={<Radio />} 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography>Run All Scenarios</Typography>
                        <Badge badgeContent={scenarios.length} color="primary" />
                      </Box>
                    }
                    sx={{ mb: 1 }}
                  />
                  <FormControlLabel 
                    value="selected" 
                    control={<Radio />} 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography>Run Selected Scenarios</Typography>
                        <Badge badgeContent={selectedScenarios.length} color="secondary" />
                      </Box>
                    }
                  />
                </RadioGroup>
              </FormControl>

              <Box>
                {!runAllScenarios && (
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <Button 
                      size="small"
                      startIcon={<SelectAll />}
                      onClick={selectAllScenarios}
                      variant="outlined"
                      sx={{ borderRadius: 2 }}
                    >
                      Select All
                    </Button>
                    <Button 
                      size="small"
                      startIcon={<Clear />}
                      onClick={clearScenarioSelection}
                      variant="outlined"
                      color="secondary"
                      sx={{ borderRadius: 2 }}
                    >
                      Clear All
                    </Button>
                  </Stack>
                )}

                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 2, 
                    height: '400px', 
                    overflowY: 'auto',
                    borderRadius: 2,
                    bgcolor: 'grey.50',
                    opacity: runAllScenarios ? 0.7 : 1,
                    pointerEvents: 'auto',
                    width: '100%',
                    '&::-webkit-scrollbar': {
                      width: '8px',
                      height: '8px'
                    },
                    '&::-webkit-scrollbar-track': {
                      background: '#f1f1f1',
                      borderRadius: '4px'
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: '#888',
                      borderRadius: '4px',
                      '&:hover': {
                        background: '#555'
                      }
                    }
                  }}
                >
                      {scenarios.length > 0 ? (
                        <Stack spacing={1}>
                          {scenarios.map((scenario) => (
                            <Paper
                              key={scenario.label || scenario.url}
                              sx={{ 
                                p: 2, 
                                border: '1px solid',
                                borderColor: selectedScenarios.includes(scenario.label) ? 'primary.main' : 'divider',
                                borderRadius: 2,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': {
                                  borderColor: 'primary.main',
                                  boxShadow: 1
                                }
                              }}
                              onClick={() => handleScenarioSelection(scenario.label)}
                            >
                              <Stack direction="row" alignItems="center" spacing={2}>
                                {selectedScenarios.includes(scenario.label) ? (
                                  <CheckCircleRounded color="primary" />
                                ) : (
                                  <RadioButtonUnchecked color="disabled" />
                                )}
                                <Box sx={{ flex: 1 }}>
                                  <Stack spacing={1}>
                                    <Stack direction="row" alignItems="center">
                                      <Typography variant="body1" fontWeight={500}>
                                        {scenario.label}
                                      </Typography>
                                      {getStatusChip(
                                        scenarioResults[scenario.label]?.status || 'pending',
                                        scenarioResults[scenario.label]?.misMatchPercentage
                                      )}
                                      {currentScenario === scenario.label && (
                                        <CircularProgress size={16} sx={{ ml: 1 }} />
                                      )}
                                    </Stack>
                                    <Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        {scenario.url}
                                      </Typography>
                                      {scenario.referenceUrl && (
                                        <Typography variant="caption" color="primary" sx={{ display: 'block' }}>
                                          Reference URL: {scenario.referenceUrl}
                                        </Typography>
                                      )}
                                    </Box>
                                    {scenarioResults[scenario.label]?.status === 'failed' && (
                                      <Alert severity="error" sx={{ mt: 1 }}>
                                        <Stack direction="row" spacing={2} alignItems="center">
                                          <Typography variant="caption">
                                            Mismatch: {scenarioResults[scenario.label].misMatchPercentage}%
                                          </Typography>
                                          {!scenarioResults[scenario.label].isSameDimensions && (
                                            <Typography variant="caption">
                                              Different dimensions detected
                                            </Typography>
                                          )}
                                        </Stack>
                                      </Alert>
                                    )}
                                  </Stack>
                                </Box>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      ) : (
                        <Alert severity="info" variant="outlined" sx={{ borderRadius: 2 }}>
                          <AlertTitle>No Scenarios Found</AlertTitle>
                          Please configure scenarios in the Scenario Manager first.
                        </Alert>
                      )}
                    </Paper>
                    
                    {!runAllScenarios && selectedScenarios.length === 0 && (
                      <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                        <AlertTitle>Selection Required</AlertTitle>
                        Please select at least one scenario to run tests.
                      </Alert>
                    )}
                  </Box>

                  {/* Test Execution Panel */}
                  <Card sx={{ 
                    mt: 4,
                    borderRadius: 3,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    border: '1px solid',
                    borderColor: 'divider'
                  }}>
                    <CardContent sx={{ p: 3 }}>
                      <Stack spacing={2}>
                        <Button
                          variant="contained"
                          size="large"
                          startIcon={testRunning ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />}
                          onClick={runTest}
                          disabled={testRunning || approveRunning || !canRunTest}
                          fullWidth
                          sx={{ 
                            py: 2,
                            borderRadius: 3,
                            fontSize: '1.1rem',
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                            }
                          }}
                        >
                          {testRunning ? 'Running Visual Tests...' : 'Run Visual Regression Test'}
                        </Button>

                        <Button
                          variant="contained"
                          size="large"
                          startIcon={approveRunning ? <CircularProgress size={20} color="inherit" /> : <AutoFixHigh />}
                          onClick={runApprove}
                          disabled={testRunning || approveRunning || !canRunTest}
                          fullWidth
                          color="success"
                          sx={{ 
                            py: 2,
                            borderRadius: 3,
                            fontSize: '1.1rem',
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #3d8bfe 0%, #00d9fe 100%)',
                            }
                          }}
                        >
                          {approveRunning ? 'Approving Changes...' : 'Approve & Update References'}
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default TestRunner
