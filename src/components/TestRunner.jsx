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

  useEffect(() => {
    loadScenarios()
  }, [])

  const loadScenarios = async () => {
    try {
      const response = await axios.get(`${API_BASE}/scenarios`)
      setScenarios(response.data.scenarios || response.data || [])
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
    
    try {
      const filter = runAllScenarios ? undefined : selectedScenarios.join('|')
      const response = await axios.post(`${API_BASE}/test`, { filter })
      setMessage(response.data.message || 'Visual regression test completed!')
      setTestResult(response.data)
      
    } catch (error) {
      const errorData = error.response?.data
      if (errorData?.reportPath) {
        setMessage(`Test completed with differences detected.`)
        setTestResult(errorData)
      } else {
        setMessage(`Error running test: ${errorData?.error || error.message}`)
      }
    } finally {
      setTestRunning(false)
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
    <Box sx={{ maxWidth: '1400px', mx: 'auto' }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
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

      <Grid container spacing={4}>
        {/* Left Panel - Scenario Configuration */}
        <Grid item xs={12} lg={5}>
          <Card sx={{ 
            height: 'fit-content',
            borderRadius: 3,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            border: '1px solid',
            borderColor: 'divider'
          }}>
            <CardContent sx={{ p: 3 }}>
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
                  onChange={(e) => setRunAllScenarios(e.target.value === 'all')}
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

              {!runAllScenarios && (
                <Collapse in={!runAllScenarios}>
                  <Box>
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
                    
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        p: 2, 
                        maxHeight: 280, 
                        overflow: 'auto',
                        borderRadius: 2,
                        bgcolor: 'grey.50'
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
                                  <Typography variant="body1" fontWeight={500}>
                                    {scenario.label}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    {scenario.url}
                                  </Typography>
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
                  </Box>
                </Collapse>
              )}

              {!runAllScenarios && selectedScenarios.length === 0 && (
                <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                  <AlertTitle>Selection Required</AlertTitle>
                  Please select at least one scenario to run tests.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Panel - Test Execution */}
        <Grid item xs={12} lg={7}>
          <Stack spacing={3}>
            {/* Test Actions Card */}
            <Card sx={{ 
              borderRadius: 3,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              border: '1px solid',
              borderColor: 'divider'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <Science />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      Test Execution
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Run visual regression tests and manage baselines
                    </Typography>
                  </Box>
                </Stack>

                <Divider sx={{ mb: 3 }} />

                {!runAllScenarios && selectedScenarios.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Selected scenarios for testing:
                    </Typography>
                    <Box>
                      {selectedScenarios.map(name => (
                        <Chip 
                          key={name} 
                          label={name} 
                          size="small" 
                          sx={{ mr: 0.5, mb: 0.5 }}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                )}

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

                {/* Quick Info */}
                <Alert 
                  severity="info" 
                  sx={{ 
                    mt: 3, 
                    borderRadius: 2,
                    bgcolor: 'info.50',
                    border: '1px solid',
                    borderColor: 'info.200'
                  }}
                  icon={<InfoOutlined />}
                >
                  <AlertTitle sx={{ fontWeight: 600 }}>Quick Guide</AlertTitle>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>Run Test:</strong> Compare current state with reference images
                  </Typography>
                  <Typography variant="body2">
                    • <strong>Approve:</strong> Accept current images as new references when changes are intentional
                  </Typography>
                </Alert>
              </CardContent>
            </Card>

            {/* Test Results Card */}
            {testResult && (
              <Fade in={Boolean(testResult)}>
                <Card sx={{ 
                  borderRadius: 3,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  border: '1px solid',
                  borderColor: testResult?.success === false ? 'error.main' : 'success.main'
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                      <Avatar sx={{ 
                        bgcolor: testResult?.success === false ? 'error.main' : 'success.main'
                      }}>
                        {testResult?.success === false ? <BugReport /> : <CheckCircle />}
                      </Avatar>
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>
                          Test Results
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {testResult?.success === false ? 'Visual differences detected' : 'All tests passed successfully'}
                        </Typography>
                      </Box>
                    </Stack>

                    <Divider sx={{ mb: 3 }} />

                    {testResult.success === false && (
                      <Alert 
                        severity="error" 
                        sx={{ mb: 2, borderRadius: 2 }}
                        icon={<WarningAmber />}
                      >
                        <AlertTitle sx={{ fontWeight: 600 }}>Visual Differences Found</AlertTitle>
                        Review the differences and approve if changes are intentional.
                      </Alert>
                    )}
                    
                    {testResult.success === true && (
                      <Alert 
                        severity="success" 
                        sx={{ mb: 2, borderRadius: 2 }}
                        icon={<CheckCircle />}
                      >
                        <AlertTitle sx={{ fontWeight: 600 }}>Perfect Match!</AlertTitle>
                        All visual regression tests passed without any differences.
                      </Alert>
                    )}

                    <Accordion 
                      expanded={expandedResult}
                      onChange={() => setExpandedResult(!expandedResult)}
                      sx={{ borderRadius: 2, '&:before': { display: 'none' } }}
                    >
                      <AccordionSummary 
                        expandIcon={<ExpandMore />}
                        sx={{ borderRadius: 2 }}
                      >
                        <Typography variant="subtitle1" fontWeight={600}>
                          Detailed Test Results
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Paper 
                          variant="outlined" 
                          sx={{ 
                            p: 2, 
                            maxHeight: 300, 
                            overflow: 'auto',
                            borderRadius: 2,
                            bgcolor: 'grey.50'
                          }}
                        >
                          <Typography 
                            component="pre" 
                            variant="caption" 
                            sx={{ 
                              fontFamily: 'monospace', 
                              whiteSpace: 'pre-wrap',
                              fontSize: '0.75rem'
                            }}
                          >
                            {JSON.stringify(testResult, null, 2)}
                          </Typography>
                        </Paper>
                      </AccordionDetails>
                    </Accordion>
                  </CardContent>
                </Card>
              </Fade>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  )
}

export default TestRunner
