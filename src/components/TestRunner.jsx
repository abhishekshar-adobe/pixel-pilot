import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Typography,
  Alert,
  Chip,
  Paper,
  Stack,
  TextField,
  CircularProgress,
  Divider
} from '@mui/material'
import {
  PlayArrow,
  CheckCircle,
  GetApp,
  Refresh,
  Visibility,
  Assessment,
  Settings,
  List,
  Search,
  FilterList,
  Link,
  AccessTime,
  CheckCircleRounded,
  RadioButtonUnchecked,
  Computer,
  Tablet,
  PhoneIphone,
  Error,
  WarningAmber,
  Clear
} from '@mui/icons-material'
import axios from 'axios'
import io from 'socket.io-client'

const API_BASE = 'http://localhost:5000/api'

// Helper functions
const getViewportIcon = (viewport) => {
  const { width } = viewport
  if (width <= 768) return <PhoneIphone sx={{ fontSize: 16 }} />
  if (width <= 1024) return <Tablet sx={{ fontSize: 16 }} />
  return <Computer sx={{ fontSize: 16 }} />
}

const getStatusIcon = (status) => {
  switch (status) {
    case 'passed':
      return <CheckCircle sx={{ color: '#4caf50', fontSize: 16 }} />
    case 'failed':
      return <Error sx={{ color: '#f44336', fontSize: 16 }} />
    case 'network_error':
      return <Clear sx={{ color: '#d32f2f', fontSize: 16 }} />
    case 'running':
      return <AccessTime sx={{ color: '#ff9800', fontSize: 16 }} />
    default:
      return <RadioButtonUnchecked sx={{ color: '#9e9e9e', fontSize: 16 }} />
  }
}

function TestRunner({ project, config, scenarios: initialScenarios = [] }) {
  const [scenarios, setScenarios] = useState(initialScenarios)
  const [selectedScenarios, setSelectedScenarios] = useState([])
  const [scenarioResults, setScenarioResults] = useState({})
  const [liveScenarioResults, setLiveScenarioResults] = useState({})
  const [testRunning, setTestRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [backstopReport, setBackstopReport] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)

  // Define loadBackstopReport function first
  const loadBackstopReport = React.useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/test-results`)
      if (response.data && !response.data.error) {
        setBackstopReport(response.data)
        if (response.data?.tests) {
          const results = {}
          response.data.tests.forEach(test => {
            // Handle different test statuses, but distinguish network errors
            let status = 'pending'
            if (test.status === 'pass') {
              status = 'passed'
            } else if (test.status === 'fail') {
              // Check if it's a network/CLI error vs regular visual diff
              if (test.pair?.networkError || test.pair?.cliError) {
                status = 'network_error' // Keep as network_error for UI distinction
              } else {
                status = 'failed'
              }
            }
            
            results[test.pair.label] = {
              status,
              misMatchPercentage: test.misMatchPercentage || (test.pair?.diff?.misMatchPercentage || 0),
              isSameDimensions: test.isSameDimensions,
              networkError: test.pair?.networkError || test.pair?.cliError || null,
              errorMessage: test.error || null
            }
          })
          setScenarioResults(results)
        }
      } else {
        setBackstopReport(null)
        setMessage('No test results found. Click "Run Visual Test" to generate your first results.')
      }
    } catch {
      setBackstopReport(null)
      setMessage('No test results found. Click "Run Visual Test" to generate your first results.')
    }
  }, [project.id])

  // Socket connection
  useEffect(() => {
    const socket = io('http://localhost:5000')
    
    socket.on('connect', () => {
      setSocketConnected(true)
    })

    socket.on('disconnect', () => {
      setSocketConnected(false)
    })

    socket.on('test-progress', (data) => {
      setLiveScenarioResults(prev => ({
        ...prev,
        [data.scenario]: {
          status: data.status,
          mismatchPercentage: data.mismatchPercentage,
          timestamp: new Date().toISOString()
        }
      }))
    })

    socket.on('test-complete', () => {
      setTestRunning(false)
      setLiveScenarioResults({})
      loadBackstopReport()
    })

    socket.on('report-enhanced', (data) => {
      console.log('Report enhanced with invalid scenarios:', data)
      setMessage(`Report enhanced with ${data.networkErrorCount} network error scenarios`)
      // Reload the report to show enhanced data
      setTimeout(() => {
        loadBackstopReport()
      }, 1000)
    })

    socket.on('report-enhancement-failed', (data) => {
      console.error('Report enhancement failed:', data)
      setMessage(`Warning: Failed to enhance report with invalid scenarios - ${data.error}`)
    })

    return () => socket.disconnect()
  }, [loadBackstopReport])

  // Load scenarios on mount
  useEffect(() => {
    if (initialScenarios.length > 0) {
      setSelectedScenarios(initialScenarios.map(s => s.label))
      loadBackstopReport()
    }
  }, [initialScenarios, loadBackstopReport])

  // Update scenarios when initialScenarios changes
  useEffect(() => {
    setScenarios(initialScenarios)
  }, [initialScenarios])

  const runTest = async () => {
    setTestRunning(true)
    setMessage("")
    setLiveScenarioResults({})

    try {
      const filter = selectedScenarios.join("|")
      await axios.post(`${API_BASE}/projects/${project.id}/test`, { filter })
      await loadBackstopReport()
    } catch (error) {
      const errorData = error.response?.data
      if (errorData?.reportPath) {
        setMessage(`Test completed with differences detected.`)
        await loadBackstopReport()
      } else {
        setMessage(`Error running test: ${errorData?.error || error.message}`)
      }
    } finally {
      setTestRunning(false)
    }
  }

  const approveImages = async () => {
    try {
      await axios.post(`${API_BASE}/projects/${project.id}/approve`)
      setMessage('✅ Test images approved as new references!')
      await loadBackstopReport()
    } catch (error) {
      setMessage(`Error approving images: ${error.response?.data?.error || error.message}`)
    }
  }

  const downloadResults = () => {
    if (backstopReport) {
      window.open(`${API_BASE}/projects/${project.id}/report/index.html`, '_blank')
    }
  }

  const handleScenarioSelection = (scenarioLabel) => {
    setSelectedScenarios(prev => 
      prev.includes(scenarioLabel) 
        ? prev.filter(s => s !== scenarioLabel)
        : [...prev, scenarioLabel]
    )
  }

  const selectAllScenarios = () => {
    setSelectedScenarios(scenarios.map(s => s.label))
  }

  // Filter scenarios
  const filteredScenarios = scenarios.filter(scenario => {
    const matchesSearch = scenario.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         scenario.url.toLowerCase().includes(searchTerm.toLowerCase())
    const isSelected = selectedScenarios.includes(scenario.label)
    return matchesSearch && (!showSelectedOnly || isSelected)
  })

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
              {Object.values(scenarioResults).filter(r => r.status === 'failed' || r.status === 'network_error').length}
            </Typography>
            <Typography variant="body2" sx={{ color: 'error.dark', fontWeight: 500 }}>
              Failed
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card elevation={0} sx={{ textAlign: 'center', p: 3, borderRadius: '16px', bgcolor: 'warning.lighter' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
              {Object.values(scenarioResults).filter(r => r.status === 'network_error').length + Object.values(liveScenarioResults).filter(r => r.status === 'running').length}
            </Typography>
            <Typography variant="body2" sx={{ color: 'warning.dark', fontWeight: 500 }}>
              Network/Running
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
                      const totalResults = Object.values(scenarioResults)
                      const passedResults = totalResults.filter(r => r.status === 'passed')
                      if (totalResults.length === 0) return '0'
                      return Math.round((passedResults.length / totalResults.length) * 100)
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
                        .filter(r => r.status === 'failed' && typeof r.misMatchPercentage !== 'undefined' && r.misMatchPercentage > 0)
                      if (mismatchResults.length === 0) return '0.0'
                      const avgMismatch = mismatchResults.reduce((acc, r) => acc + r.misMatchPercentage, 0) / mismatchResults.length
                      return avgMismatch.toFixed(1)
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
                    {Object.values(scenarioResults).filter(r => r.status === 'network_error').length}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'error.dark', fontWeight: 500 }}>
                    Network Errors
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 3, bgcolor: 'warning.lighter', borderRadius: '12px' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
                    {Object.values(scenarioResults).filter(r => r.isSameDimensions === false).length}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'warning.dark', fontWeight: 500 }}>
                    Size Issues
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 3, bgcolor: 'info.lighter', borderRadius: '12px' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'info.main' }}>
                    {(() => {
                      if (backstopReport?.testSuite?.date) {
                        return new Date(backstopReport.testSuite.date).toLocaleDateString()
                      } else if (backstopReport?.testSuite && typeof backstopReport.testSuite === 'string') {
                        return 'Recent'
                      }
                      return 'Never'
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

      {/* Scenario Selection */}
      <Card elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <List sx={{ color: 'primary.main' }} />
              Scenarios ({filteredScenarios.length})
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Search scenarios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ 
                  minWidth: '200px',
                  '& .MuiOutlinedInput-root': { borderRadius: '8px' }
                }}
                InputProps={{
                  startAdornment: <Search sx={{ color: 'text.secondary', mr: 1 }} />
                }}
              />
              <Button
                variant={showSelectedOnly ? 'contained' : 'outlined'}
                size="small"
                startIcon={<FilterList />}
                onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                sx={{ borderRadius: '8px', textTransform: 'none' }}
              >
                {showSelectedOnly ? 'Show All' : 'Selected Only'}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={selectAllScenarios}
                sx={{ borderRadius: '8px', textTransform: 'none' }}
              >
                Select All
              </Button>
            </Box>
          </Box>

          {/* Scenario List */}
          <Box sx={{ display: 'grid', gap: 2 }}>
            {filteredScenarios.map((scenario) => {
              const result = scenarioResults[scenario.label] || {}
              const liveResult = liveScenarioResults[scenario.label]
              const displayStatus = liveResult?.status || result.status
              const displayMismatch = liveResult?.mismatchPercentage || result.misMatchPercentage

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
                      boxShadow: '0 4px 8px -2px rgba(0, 0, 0, 0.1)'
                    }
                  }}
                  onClick={() => handleScenarioSelection(scenario.label)}
                >
                  <Stack direction="row" alignItems="flex-start" spacing={2}>
                    {selectedScenarios.includes(scenario.label) ? (
                      <CheckCircleRounded sx={{ color: 'primary.main', fontSize: 24 }} />
                    ) : (
                      <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 24 }} />
                    )}
                    
                    <Box sx={{ flex: 1 }}>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          fontWeight: 600,
                          color: selectedScenarios.includes(scenario.label) ? 'primary.dark' : 'text.primary',
                          mb: 1
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

                      {/* Status Display */}
                      {displayStatus && (
                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                          <Chip
                            size="small"
                            icon={getStatusIcon(displayStatus)}
                            label={
                              displayStatus === 'passed' ? '✅ Passed' :
                              displayStatus === 'failed' ? '❌ Failed' :
                              displayStatus === 'network_error' ? '🚫 Network Error' :
                              displayStatus === 'running' ? '⏳ Running' : 'Pending'
                            }
                            sx={{
                              borderRadius: '8px',
                              bgcolor: displayStatus === 'passed' ? 'rgba(76, 175, 80, 0.1)' :
                                       displayStatus === 'failed' ? 'rgba(244, 67, 54, 0.1)' :
                                       displayStatus === 'network_error' ? 'rgba(211, 47, 47, 0.1)' :
                                       displayStatus === 'running' ? 'rgba(255, 152, 0, 0.1)' :
                                       'background.default',
                              color: displayStatus === 'passed' ? '#4caf50' :
                                     displayStatus === 'failed' ? '#f44336' :
                                     displayStatus === 'network_error' ? '#d32f2f' :
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
                          
                          {/* Show network error details */}
                          {result.networkError && (
                            <Chip
                              size="small"
                              label={`${result.networkError.type}: ${result.networkError.message.substring(0, 30)}...`}
                              sx={{
                                borderRadius: '8px',
                                bgcolor: 'error.lighter',
                                color: 'error.dark',
                                border: '1px solid',
                                borderColor: 'error.main',
                                maxWidth: '200px'
                              }}
                              title={result.networkError.message}
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
                    </Box>
                  </Stack>
                </Paper>
              )
            })}
            
            {filteredScenarios.length === 0 && (
              <Card elevation={0} sx={{ p: 6, textAlign: 'center', bgcolor: 'background.default', borderRadius: '12px' }}>
                <Typography variant="h6" sx={{ color: 'text.secondary', mb: 1 }}>
                  No scenarios found
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {searchTerm ? 'Try adjusting your search terms' : 'No scenarios available for testing'}
                </Typography>
              </Card>
            )}
          </Box>
        </CardContent>
      </Card>
    </Container>
  )
}

export default TestRunner
