import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardMedia,
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
  Link,
  Stack,
  Grid,
  Paper
} from '@mui/material'
import {
  PlayArrow,
  PhotoCamera,
  OpenInNew,
  Launch,
  CheckCircleOutline,
  ErrorOutline,
  InfoOutlined,
  ExpandMore,
  SelectAll,
  Clear,
  SyncAlt,
  CheckCircle
} from '@mui/icons-material'

const API_BASE = 'http://localhost:5000/api'

function TestRunner() {
  const [testRunning, setTestRunning] = useState(false)
  const [referenceRunning, setReferenceRunning] = useState(false)
  const [approveRunning, setApproveRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [reportAvailable, setReportAvailable] = useState(false)
  const [reportUrl, setReportUrl] = useState('')
  const [scenarios, setScenarios] = useState([])
  const [selectedScenarios, setSelectedScenarios] = useState([])
  const [runAllScenarios, setRunAllScenarios] = useState(true)
  const [referenceScreenshots, setReferenceScreenshots] = useState([])

  useEffect(() => {
    checkReportStatus()
    loadScenarios()
    fetchReferenceScreenshots()
  }, [])

  const loadScenarios = async () => {
    try {
      const response = await axios.get(`${API_BASE}/scenarios`)
      setScenarios(response.data)
    } catch (error) {
      console.error('Error loading scenarios:', error)
    }
  }

  const checkReportStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/report-status`)
      setReportAvailable(response.data.exists)
      if (response.data.exists) {
        setReportUrl(`http://localhost:5000${response.data.url}`)
      }
    } catch (error) {
      console.error('Error checking report status:', error)
    }
  }

  const fetchReferenceScreenshots = async () => {
    try {
      const response = await axios.get(`${API_BASE}/reference-screenshots`)
      setReferenceScreenshots(response.data.screenshots || [])
    } catch (error) {
      console.error('Error fetching reference screenshots:', error)
      setReferenceScreenshots([])
    }
  }

  const runReference = async () => {
    setReferenceRunning(true)
    setMessage('')
    setTestResult(null)
    
    try {
      const filter = runAllScenarios ? undefined : selectedScenarios.join('|')
      const response = await axios.post(`${API_BASE}/reference`, { filter })
      setMessage('Reference screenshots generated successfully!')
      setTestResult(response.data)
      await checkReportStatus()
      await fetchReferenceScreenshots() // Fetch reference screenshots after generation
    } catch (error) {
      setMessage(`Error generating reference: ${error.response?.data?.error || error.message}`)
    } finally {
      setReferenceRunning(false)
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
      await checkReportStatus()
      await fetchReferenceScreenshots() // Fetch updated reference screenshots
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
      
      if (response.data.reportPath) {
        setReportAvailable(true)
        setReportUrl(`http://localhost:5000${response.data.reportPath}`)
        setMessage(prev => `${prev} - Click "Open Report" to view results.`)
      }
      
    } catch (error) {
      const errorData = error.response?.data
      if (errorData?.reportPath) {
        setMessage(`Test completed with differences detected - Click "Open Report" to view results.`)
        setTestResult(errorData)
        setReportAvailable(true)
        setReportUrl(`http://localhost:5000${errorData.reportPath}`)
      } else {
        setMessage(`Error running test: ${errorData?.error || error.message}`)
      }
    } finally {
      setTestRunning(false)
      await checkReportStatus()
    }
  }

  const openReport = () => {
    if (reportUrl) {
      window.open(reportUrl, '_blank')
    }
  }

  const openReportInFrame = () => {
    if (reportUrl) {
      window.open(reportUrl, 'backstop-report', 'width=1200,height=800,scrollbars=yes,resizable=yes')
    }
  }

  const syncReferences = async () => {
    try {
      setMessage('Syncing uploaded reference screenshots...')
      const response = await axios.post(`${API_BASE}/sync-references`)
      setMessage(response.data.message)
    } catch (error) {
      setMessage(`Error syncing references: ${error.response?.data?.error || error.message}`)
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

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
        Test Runner
      </Typography>
      
      {message && (
        <Alert 
          severity={message.includes('Error') && !message.includes('differences') ? 'error' : 'success'}
          sx={{ mb: 3 }}
        >
          {message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Scenario Selection Card */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Scenario Selection
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Choose which scenarios to test. You can run all scenarios or select specific ones.
              </Typography>
              
              <FormControl component="fieldset" sx={{ mb: 2 }}>
                <RadioGroup
                  value={runAllScenarios ? 'all' : 'selected'}
                  onChange={(e) => setRunAllScenarios(e.target.value === 'all')}
                >
                  <FormControlLabel 
                    value="all" 
                    control={<Radio />} 
                    label={`Run All Scenarios (${scenarios.length} total)`}
                  />
                  <FormControlLabel 
                    value="selected" 
                    control={<Radio />} 
                    label={`Run Selected Scenarios (${selectedScenarios.length} selected)`}
                  />
                </RadioGroup>
              </FormControl>

              {!runAllScenarios && (
                <Box>
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <Button 
                      size="small"
                      startIcon={<SelectAll />}
                      onClick={selectAllScenarios}
                      variant="outlined"
                    >
                      Select All
                    </Button>
                    <Button 
                      size="small"
                      startIcon={<Clear />}
                      onClick={clearScenarioSelection}
                      variant="outlined"
                    >
                      Clear Selection
                    </Button>
                  </Stack>
                  
                  <Paper variant="outlined" sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
                    {scenarios.length > 0 ? (
                      scenarios.map((scenario) => (
                        <FormControlLabel
                          key={scenario.label || scenario.url}
                          control={
                            <Checkbox
                              checked={selectedScenarios.includes(scenario.label)}
                              onChange={() => handleScenarioSelection(scenario.label)}
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2" fontWeight={500}>
                                {scenario.label}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {scenario.url}
                              </Typography>
                            </Box>
                          }
                          sx={{ display: 'flex', width: '100%', mb: 1 }}
                        />
                      ))
                    ) : (
                      <Alert severity="info" variant="outlined">
                        No scenarios configured. Please add scenarios in the Scenario Manager first.
                      </Alert>
                    )}
                  </Paper>
                </Box>
              )}

              {!runAllScenarios && selectedScenarios.length === 0 && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Please select at least one scenario to run tests.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Test Operations Card */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                BackstopJS Operations
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Use these controls to generate reference screenshots and run visual regression tests.
                {!runAllScenarios && selectedScenarios.length > 0 && (
                  <Box component="span" sx={{ display: 'block', mt: 1 }}>
                    Running tests for: {selectedScenarios.map(name => (
                      <Chip key={name} label={name} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                    ))}
                  </Box>
                )}
              </Typography>

              <Stack spacing={2}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={referenceRunning ? <LinearProgress sx={{ width: 20 }} /> : <PhotoCamera />}
                  onClick={runReference}
                  disabled={referenceRunning || testRunning || approveRunning || !canRunTest}
                  fullWidth
                >
                  {referenceRunning ? 'Generating References...' : 'Generate Reference Screenshots'}
                </Button>

                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<SyncAlt />}
                  onClick={syncReferences}
                  disabled={referenceRunning || testRunning || approveRunning}
                  fullWidth
                  color="info"
                >
                  Sync Uploaded References
                </Button>

                <Button
                  variant="outlined"
                  size="large"
                  startIcon={testRunning ? <LinearProgress sx={{ width: 20 }} /> : <PlayArrow />}
                  onClick={runTest}
                  disabled={testRunning || referenceRunning || approveRunning || !canRunTest}
                  fullWidth
                >
                  {testRunning ? 'Running Test...' : 'Run Visual Regression Test'}
                </Button>

                <Button
                  variant="contained"
                  size="large"
                  startIcon={approveRunning ? <LinearProgress sx={{ width: 20 }} /> : <CheckCircle />}
                  onClick={runApprove}
                  disabled={testRunning || referenceRunning || approveRunning || !canRunTest}
                  fullWidth
                  color="success"
                  sx={{ 
                    backgroundColor: 'success.main',
                    '&:hover': { backgroundColor: 'success.dark' }
                  }}
                >
                  {approveRunning ? 'Approving Tests...' : 'Approve Test Results as References'}
                </Button>

                {reportAvailable && (
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      startIcon={<OpenInNew />}
                      onClick={openReport}
                      color="success"
                      sx={{ flex: 1 }}
                    >
                      Open Report (New Tab)
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Launch />}
                      onClick={openReportInFrame}
                      color="success"
                      sx={{ flex: 1 }}
                    >
                      Open Report (Popup)
                    </Button>
                  </Stack>
                )}
              </Stack>

              <Alert severity="info" sx={{ mt: 3 }}>
                <AlertTitle>Instructions</AlertTitle>
                <List dense>
                  <ListItem sx={{ pl: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Typography variant="body2" fontWeight={600}>1.</Typography>
                    </ListItemIcon>
                    <ListItemText primary="Select Scenarios: Choose which scenarios to test using the selection panel" />
                  </ListItem>
                  <ListItem sx={{ pl: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Typography variant="body2" fontWeight={600}>2.</Typography>
                    </ListItemIcon>
                    <ListItemText primary="Generate Reference Screenshots: Creates baseline images for comparison" />
                  </ListItem>
                  <ListItem sx={{ pl: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Typography variant="body2" fontWeight={600}>3.</Typography>
                    </ListItemIcon>
                    <ListItemText primary="Run Visual Regression Test: Compares current state with reference images" />
                  </ListItem>
                  <ListItem sx={{ pl: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Typography variant="body2" fontWeight={600}>4.</Typography>
                    </ListItemIcon>
                    <ListItemText primary="Approve Test Results: When changes are intentional, approve test images as new references" />
                  </ListItem>
                  <ListItem sx={{ pl: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Typography variant="body2" fontWeight={600}>5.</Typography>
                    </ListItemIcon>
                    <ListItemText primary="Open Report: View detailed diff screenshots and results" />
                  </ListItem>
                </List>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>Note:</strong> Make sure you have configured scenarios and viewports before running tests.
                  The BackstopJS HTML report will show diff screenshots when visual differences are detected.
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>💡 Tip:</strong> Use "Approve Test Results" when visual changes are intentional (e.g., after design updates). 
                  This promotes the current test images to become the new reference baselines.
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {testResult && (
        <Grid item xs={12}>
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Test Results
              </Typography>
              {testResult.success === false && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <AlertTitle>Visual Differences Detected!</AlertTitle>
                  Check the report below for detailed diff screenshots.
                </Alert>
              )}
              {testResult.success === true && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  <AlertTitle>All Tests Passed!</AlertTitle>
                  No visual differences detected.
                </Alert>
              )}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle2">Raw Test Results (Click to expand)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Paper variant="outlined" sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
                    <Typography 
                      component="pre" 
                      variant="caption" 
                      sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
                    >
                      {JSON.stringify(testResult, null, 2)}
                    </Typography>
                  </Paper>
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        </Grid>
      )}

      {reportAvailable && (
        <Grid item xs={12}>
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                BackstopJS Report (Embedded)
              </Typography>
              <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <iframe
                  src={reportUrl}
                  width="100%"
                  height="600px"
                  style={{ border: 'none' }}
                  title="BackstopJS Report"
                />
              </Paper>
            </CardContent>
          </Card>
        </Grid>
      )}

      <Grid item xs={12}>
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Test Status
            </Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={4}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body2" fontWeight={600}>Reference Generation:</Typography>
                  <Chip 
                    label={referenceRunning ? 'Running...' : 'Ready'}
                    color={referenceRunning ? 'warning' : 'success'}
                    size="small"
                    icon={referenceRunning ? <LinearProgress sx={{ width: 16 }} /> : <CheckCircleOutline />}
                  />
                </Stack>
              </Grid>
              <Grid item xs={12} md={4}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body2" fontWeight={600}>Test Execution:</Typography>
                  <Chip 
                    label={testRunning ? 'Running...' : 'Ready'}
                    color={testRunning ? 'warning' : 'success'}
                    size="small"
                    icon={testRunning ? <LinearProgress sx={{ width: 16 }} /> : <CheckCircleOutline />}
                  />
                </Stack>
              </Grid>
              <Grid item xs={12} md={4}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body2" fontWeight={600}>Report:</Typography>
                  <Chip 
                    label={reportAvailable ? 'Available' : 'Not Available'}
                    color={reportAvailable ? 'success' : 'default'}
                    size="small"
                    icon={reportAvailable ? <CheckCircleOutline /> : <ErrorOutline />}
                  />
                </Stack>
              </Grid>
            </Grid>
            
            {reportAvailable && (
              <Alert severity="success">
                <AlertTitle>Report Ready!</AlertTitle>
                Click the "Open Report" buttons above to view detailed diff screenshots and test results.
              </Alert>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <InfoOutlined sx={{ mr: 1 }} />
              Tips & Best Practices
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon><Typography variant="body2">•</Typography></ListItemIcon>
                <ListItemText 
                  primary="Scenario Selection" 
                  secondary="Use the radio buttons to choose between running all scenarios or specific ones"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><Typography variant="body2">•</Typography></ListItemIcon>
                <ListItemText 
                  primary="Generate References First" 
                  secondary="Always generate reference screenshots before running your first test"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><Typography variant="body2">•</Typography></ListItemIcon>
                <ListItemText 
                  primary="Review Reports" 
                  secondary="Review the HTML report that opens after test completion to see diff screenshots"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><Typography variant="body2">•</Typography></ListItemIcon>
                <ListItemText 
                  primary="Update Baselines" 
                  secondary="Upload new reference screenshots if you need to update baselines"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><Typography variant="body2">•</Typography></ListItemIcon>
                <ListItemText 
                  primary="Configure Properly" 
                  secondary="Configure scenarios with appropriate selectors and delays for best results"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><Typography variant="body2">•</Typography></ListItemIcon>
                <ListItemText 
                  primary="Test Responsive Design" 
                  secondary="Use different viewports to test responsive design"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><Typography variant="body2">•</Typography></ListItemIcon>
                <ListItemText 
                  primary="Diff Screenshots" 
                  secondary="When tests fail, the report will show before/after/diff images side by side"
                />
              </ListItem>
            </List>
            
            {reportAvailable && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>Quick Access:</Typography>
                <Typography variant="body2">
                  <strong>Direct Report Link:</strong>{' '}
                  <Link 
                    href={reportUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    sx={{ color: 'primary.main' }}
                  >
                    {reportUrl}
                  </Link>
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Reference Screenshots Display */}
      {referenceScreenshots.length > 0 && (
        <Grid item xs={12}>
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Reference Screenshots ({referenceScreenshots.length})
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Generated reference screenshots for visual regression testing
              </Typography>
              
              <Grid container spacing={2}>
                {referenceScreenshots.map((screenshot, index) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={screenshot.filename || index}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardMedia
                        component="img"
                        height="200"
                        image={`http://localhost:5000${screenshot.path}`}
                        alt={screenshot.scenario || `Reference ${index + 1}`}
                        sx={{ 
                          objectFit: 'contain',
                          bgcolor: 'grey.100'
                        }}
                      />
                      <CardContent sx={{ p: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                          {screenshot.scenario || `Reference ${index + 1}`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {screenshot.viewport || 'Unknown viewport'}
                        </Typography>
                        <Chip
                          label={screenshot.filename}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                        {screenshot.generated && (
                          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                            Generated: {new Date(screenshot.generated).toLocaleString()}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Box>
  )
}

export default TestRunner
