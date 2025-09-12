import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
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
import pixelPilotLogo from '../assets/pixelpilot-logo.svg'

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

  // Fetch batch information
  const fetchBatchInfo = async () => {
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/batches`)
      setBatchInfo(response.data)
    } catch (error) {
      console.error('Error fetching batch info:', error)
      setBatchInfo(null)
    }
  }

  // Define loadBackstopReport function first
  const loadBackstopReport = React.useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/test-results`)
      if (response.data && !response.data.error) {
        setBackstopReport(response.data)
        // Also fetch batch info when loading report
        fetchBatchInfo()
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

  // Enhanced state for batch processing
  const [batchProgress, setBatchProgress] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [estimatedTime, setEstimatedTime] = useState(null)
  const [processedCount, setProcessedCount] = useState(0)
  const [currentBatch, setCurrentBatch] = useState(null)
  const [batchInfo, setBatchInfo] = useState(null)
  const [showBatchSelector, setShowBatchSelector] = useState(false)

  // Socket connection with enhanced batch processing support
  useEffect(() => {
    const socket = io('http://localhost:5000')
    
    socket.on('connect', () => {
      setSocketConnected(true)
    })

    socket.on('disconnect', () => {
      setSocketConnected(false)
    })

    // Enhanced progress tracking for batch processing
    socket.on('test-progress', (data) => {
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId)
      }

      // Handle different types of progress updates
      if (data.status === 'started') {
        setMessage(`🚀 Starting batch test: ${data.totalCount} scenarios`)
        setBatchProgress({
          totalBatches: Math.ceil(data.totalCount / data.batchSize),
          batchSize: data.batchSize,
          maxConcurrent: data.maxConcurrent,
          totalCount: data.totalCount
        })
      } else if (data.status === 'running') {
        setProcessedCount(data.processedCount || 0)
        setCurrentBatch(data.batchIndex + 1)
        
        if (data.eta) {
          setEstimatedTime(data.eta)
        }
        
        setMessage(data.message || `Processing batch ${data.batchIndex + 1}...`)
        
        // Update individual scenario status
        if (data.currentScenario) {
          setLiveScenarioResults(prev => ({
            ...prev,
            [data.currentScenario]: {
              status: 'running',
              mismatchPercentage: data.mismatchPercentage,
              timestamp: data.timestamp,
              batchIndex: data.batchIndex,
              progress: data.batchProgress
            }
          }))
        }
      } else if (data.status === 'batch-complete') {
        setMessage(`✅ Batch ${data.batchIndex + 1} completed`)
        
        // Update all scenarios in the completed batch
        if (data.batchResults && data.batchResults.tests) {
          const batchUpdates = {}
          data.batchResults.tests.forEach(test => {
            batchUpdates[test.pair.label] = {
              status: test.status === 'pass' ? 'passed' : 'failed',
              mismatchPercentage: test.misMatchPercentage || 0,
              timestamp: data.timestamp,
              batchIndex: data.batchIndex
            }
          })
          setLiveScenarioResults(prev => ({ ...prev, ...batchUpdates }))
        }
      } else if (data.status === 'validating') {
        setMessage(data.message || 'Validating URLs...')
      } else if (data.scenario) {
        // Individual scenario update (legacy support)
        setLiveScenarioResults(prev => ({
          ...prev,
          [data.scenario]: {
            status: data.status,
            mismatchPercentage: data.mismatchPercentage,
            timestamp: new Date().toISOString()
          }
        }))
      }
    })

    socket.on('test-complete', (data) => {
      setTestRunning(false)
      setLiveScenarioResults({})
      setBatchProgress(null)
      setSessionId(null)
      setEstimatedTime(null)
      setProcessedCount(0)
      setCurrentBatch(null)
      
      if (data.sessionId) {
        setMessage(`✅ Test completed: ${data.totalScenarios} scenarios in ${data.batchCount || 1} batches`)
      } else {
        setMessage('✅ Test completed successfully')
      }
      
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
  }, [loadBackstopReport, sessionId])

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
    setBatchProgress(null)
    setProcessedCount(0)
    setCurrentBatch(null)
    setEstimatedTime(null)

    try {
      const filter = selectedScenarios.join("|")
      
      // Determine batch configuration based on scenario count
      const scenarioCount = selectedScenarios.length
      const batchConfig = {
        filter,
        batchSize: scenarioCount > 1000 ? 25 : scenarioCount > 500 ? 50 : scenarioCount > 100 ? 100 : scenarioCount,
        maxConcurrent: scenarioCount > 1000 ? 2 : scenarioCount > 500 ? 3 : scenarioCount > 100 ? 5 : 10
      }
      
      if (scenarioCount > 50) {
        setMessage(`🚀 Starting batch test: ${scenarioCount} scenarios (${batchConfig.batchSize} per batch, ${batchConfig.maxConcurrent} concurrent)`)
      }

      await axios.post(`${API_BASE}/projects/${project.id}/test`, batchConfig)
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
      setBatchProgress(null)
      setProcessedCount(0)
      setCurrentBatch(null)
      setEstimatedTime(null)
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

  const unselectAllScenarios = () => {
    setSelectedScenarios([])
  }

  const toggleAllScenarios = () => {
    if (selectedScenarios.length === scenarios.length) {
      // All are selected, so unselect all
      unselectAllScenarios()
    } else {
      // Not all are selected, so select all
      selectAllScenarios()
    }
  }

  // Filter scenarios
  const filteredScenarios = scenarios.filter(scenario => {
    const matchesSearch = scenario.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         scenario.url.toLowerCase().includes(searchTerm.toLowerCase())
    const isSelected = selectedScenarios.includes(scenario.label)
    return matchesSearch && (!showSelectedOnly || isSelected)
  })

  return (
    <Box sx={{ width: '100%', py: 2 }}>
      {/* Compact Page Header */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2, 
            mb: 1 
          }}>
            <Box
              component="img"
              src={pixelPilotLogo}
              alt="PixelPilot Logo"
              sx={{
                width: 32,
                height: 32,
                flexShrink: 0
              }}
            />
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
              Visual Testing
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Execute tests with real-time tracking
          </Typography>
        </Box>
        <Chip
          size="small"
          icon={socketConnected ? <CheckCircle /> : <WarningAmber />}
          label={socketConnected ? 'Connected' : 'Disconnected'}
          color={socketConnected ? 'success' : 'warning'}
          variant="outlined"
        />
      </Box>

      {/* Alert Messages */}
      {message && (
        <Alert 
          severity={message.includes('Error') || message.includes('Failed') ? 'error' : 
                   message.includes('approved') || message.includes('completed') ? 'success' : 'info'} 
          sx={{ mb: 2, borderRadius: '8px' }}
          onClose={() => setMessage('')}
        >
          {message}
        </Alert>
      )}

      {/* Compact Control Panel */}
      <Card elevation={0} sx={{ mb: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            {/* Test Actions */}
            <Grid item xs={12} lg={9}>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <Button
                  variant="contained"
                  size="medium"
                  startIcon={testRunning ? <CircularProgress size={18} /> : <PlayArrow />}
                  onClick={runTest}
                  disabled={testRunning || selectedScenarios.length === 0}
                  sx={{
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 3,
                    py: 1
                  }}
                >
                  {testRunning ? (
                    selectedScenarios.length > 50 ? 
                    `Batch Processing (${processedCount}/${selectedScenarios.length})` : 
                    'Running...'
                  ) : (
                    selectedScenarios.length > 50 ? 
                    `Batch Run (${selectedScenarios.length})` : 
                    'Run Test'
                  )}
                </Button>
                
                <Button
                  variant="outlined"
                  size="medium"
                  startIcon={<CheckCircle />}
                  onClick={approveImages}
                  disabled={!backstopReport || testRunning}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, px: 2, py: 1 }}
                >
                  Approve
                </Button>
                
                <Button
                  variant="outlined"
                  size="medium"
                  startIcon={<GetApp />}
                  onClick={downloadResults}
                  disabled={!backstopReport}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, px: 2, py: 1 }}
                >
                  Export
                </Button>
                
                {backstopReport && (
                  <Button
                    variant="outlined"
                    size="medium"
                    startIcon={<Visibility />}
                    onClick={() => window.open(`${API_BASE}/projects/${project.id}/report/index.html`, '_blank')}
                    sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, px: 2, py: 1 }}
                  >
                    View Report
                  </Button>
                )}
                
                {batchInfo && batchInfo.batchCount > 0 && (
                  <Button
                    variant="outlined"
                    size="medium"
                    startIcon={<List />}
                    onClick={() => setShowBatchSelector(!showBatchSelector)}
                    sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, px: 2, py: 1 }}
                  >
                    Batch Reports ({batchInfo.batchCount})
                  </Button>
                )}
                
                <Button
                  variant="outlined"
                  size="medium"
                  startIcon={<Refresh />}
                  onClick={() => window.location.reload()}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, px: 2, py: 1 }}
                >
                  Reset
                </Button>
              </Box>
            </Grid>

            {/* Batch Report Selector */}
            {showBatchSelector && batchInfo && batchInfo.batchCount > 0 && (
              <Grid item xs={12}>
                <Card elevation={0} sx={{ mt: 2, borderRadius: '8px', border: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <List sx={{ color: 'primary.main', fontSize: 18 }} />
                      Batch Report Selection
                      <Chip size="small" label={`${batchInfo.batchCount} batches`} sx={{ ml: 1 }} />
                    </Typography>
                    
                    {batchInfo.summaryInfo && (
                      <Box sx={{ mb: 2, p: 2, bgcolor: 'info.lighter', borderRadius: '6px' }}>
                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: 'info.dark' }}>
                          Complete Test Summary
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', color: 'info.dark' }}>
                          {batchInfo.summaryInfo.totalScenarios} scenarios • {batchInfo.summaryInfo.passed} passed • {batchInfo.summaryInfo.failed} failed
                        </Typography>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => window.open(batchInfo.summaryInfo.url, '_blank')}
                          sx={{ mt: 1, textTransform: 'none', fontSize: '0.75rem' }}
                        >
                          View Complete Summary
                        </Button>
                      </Box>
                    )}
                    
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
                      {batchInfo.batches.map((batch) => (
                        <Paper
                          key={batch.number}
                          elevation={1}
                          sx={{
                            p: 2,
                            cursor: batch.hasHtmlReport ? 'pointer' : 'default',
                            transition: 'all 0.2s',
                            border: '1px solid',
                            borderColor: batch.hasHtmlReport ? 'primary.light' : 'grey.300',
                            bgcolor: batch.hasHtmlReport ? 'white' : 'grey.100',
                            '&:hover': batch.hasHtmlReport ? {
                              transform: 'translateY(-2px)',
                              boxShadow: 3,
                              borderColor: 'primary.main'
                            } : {}
                          }}
                          onClick={() => batch.hasHtmlReport && window.open(batch.url, '_blank')}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: batch.hasHtmlReport ? 'primary.main' : 'text.secondary' }}>
                            Batch {batch.number + 1}
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1 }}>
                            Index: {batch.number} • Directory: {batch.directory}
                          </Typography>
                          {batch.hasHtmlReport ? (
                            <Chip 
                              size="small" 
                              label="View Report" 
                              color="primary" 
                              sx={{ fontSize: '0.7rem' }} 
                            />
                          ) : (
                            <Chip 
                              size="small" 
                              label="No HTML Report" 
                              sx={{ fontSize: '0.7rem', bgcolor: 'grey.200', color: 'text.secondary' }} 
                            />
                          )}
                        </Paper>
                      ))}
                    </Box>
                    
                    <Box sx={{ mt: 2, p: 1, bgcolor: 'grey.100', borderRadius: '4px' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        <strong>Tip:</strong> Click on any batch card to view its detailed BackstopJS report with diff images and comparison details.
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Selection Info */}
            <Grid item xs={12} lg={3}>
              <Box sx={{ textAlign: { xs: 'left', lg: 'right' } }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  {selectedScenarios.length}/{scenarios?.length || 0}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  scenarios selected
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Enhanced Stats Dashboard with Real-time Progress */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <Card elevation={0} sx={{ textAlign: 'center', p: 1.5, borderRadius: '8px', bgcolor: 'primary.lighter' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {testRunning ? processedCount : selectedScenarios.length}
            </Typography>
            <Typography variant="caption" sx={{ color: 'primary.dark', fontWeight: 500 }}>
              {testRunning ? 'Processed' : 'Selected'}
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card elevation={0} sx={{ textAlign: 'center', p: 1.5, borderRadius: '8px', bgcolor: 'success.lighter' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
              {Object.values(scenarioResults).filter(r => r.status === 'passed').length}
            </Typography>
            <Typography variant="caption" sx={{ color: 'success.dark', fontWeight: 500 }}>
              Passed
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card elevation={0} sx={{ textAlign: 'center', p: 1.5, borderRadius: '8px', bgcolor: 'error.lighter' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main' }}>
              {Object.values(scenarioResults).filter(r => r.status === 'failed' || r.status === 'network_error').length}
            </Typography>
            <Typography variant="caption" sx={{ color: 'error.dark', fontWeight: 500 }}>
              Failed
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card elevation={0} sx={{ textAlign: 'center', p: 1.5, borderRadius: '8px', bgcolor: 'warning.lighter' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>
              {testRunning && estimatedTime ? estimatedTime.formatted : Object.values(liveScenarioResults).filter(r => r.status === 'running').length}
            </Typography>
            <Typography variant="caption" sx={{ color: 'warning.dark', fontWeight: 500 }}>
              {testRunning && estimatedTime ? 'ETA' : 'Running'}
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Batch Progress Indicator */}
      {testRunning && batchProgress && (
        <Card elevation={0} sx={{ mb: 2, borderRadius: '12px', border: '1px solid', borderColor: 'primary.main', bgcolor: 'primary.lighter' }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'primary.dark' }}>
                Batch Processing Progress
              </Typography>
              <Chip 
                size="small" 
                label={`Batch ${currentBatch || 1}/${batchProgress.totalBatches}`}
                sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 500 }}
              />
            </Box>
            
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={8}>
                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" sx={{ color: 'primary.dark', mb: 0.5 }}>
                    Overall Progress: {processedCount}/{batchProgress.totalCount} scenarios
                  </Typography>
                  <Box sx={{ 
                    width: '100%', 
                    height: 8, 
                    bgcolor: 'rgba(255,255,255,0.3)', 
                    borderRadius: 1,
                    overflow: 'hidden'
                  }}>
                    <Box sx={{ 
                      width: `${Math.round((processedCount / batchProgress.totalCount) * 100)}%`, 
                      height: '100%', 
                      bgcolor: 'primary.main',
                      transition: 'width 0.3s ease'
                    }} />
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={4} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                <Typography variant="body2" sx={{ color: 'primary.dark' }}>
                  <strong>Batch Size:</strong> {batchProgress.batchSize} | <strong>Parallel:</strong> {batchProgress.maxConcurrent}
                </Typography>
                {estimatedTime && (
                  <Typography variant="body2" sx={{ color: 'primary.dark' }}>
                    <strong>ETA:</strong> {estimatedTime.formatted}
                  </Typography>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Test Results Summary - Compact */}
      {Object.keys(scenarioResults).length > 0 && (
        <Card elevation={0} sx={{ mb: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assessment sx={{ color: 'primary.main', fontSize: 20 }} />
              Performance Overview
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={6} sm={4} md={2}>
                <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'success.lighter', borderRadius: '8px' }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {(() => {
                      const totalResults = Object.values(scenarioResults)
                      const passedResults = totalResults.filter(r => r.status === 'passed')
                      if (totalResults.length === 0) return '0'
                      return Math.round((passedResults.length / totalResults.length) * 100)
                    })()}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'success.dark', fontWeight: 500 }}>
                    Success
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'warning.lighter', borderRadius: '8px' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'warning.main' }}>
                    {(() => {
                      const mismatchResults = Object.values(scenarioResults)
                        .filter(r => r.status === 'failed' && typeof r.misMatchPercentage !== 'undefined' && r.misMatchPercentage > 0)
                      if (mismatchResults.length === 0) return '0.0'
                      const avgMismatch = mismatchResults.reduce((acc, r) => acc + r.misMatchPercentage, 0) / mismatchResults.length
                      return avgMismatch.toFixed(1)
                    })()}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'warning.dark', fontWeight: 500 }}>
                    Avg Diff
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'error.lighter', borderRadius: '8px' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>
                    {Object.values(scenarioResults).filter(r => r.status === 'network_error').length}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'error.dark', fontWeight: 500 }}>
                    Network
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'warning.lighter', borderRadius: '8px' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'warning.main' }}>
                    {Object.values(scenarioResults).filter(r => r.isSameDimensions === false).length}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'warning.dark', fontWeight: 500 }}>
                    Size Issues
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'info.lighter', borderRadius: '8px' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'info.main' }}>
                    {(() => {
                      if (backstopReport?.testSuite?.date) {
                        return new Date(backstopReport.testSuite.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      } else if (backstopReport?.testSuite && typeof backstopReport.testSuite === 'string') {
                        return 'Recent'
                      }
                      return 'Never'
                    })()}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'info.dark', fontWeight: 500 }}>
                    Last Run
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Compact Configuration - Only show when config is available */}
      {config && (
        <Card elevation={0} sx={{ mb: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={8}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Settings sx={{ fontSize: 16, color: 'primary.main' }} />
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
                        borderRadius: '6px',
                        fontSize: '0.75rem'
                      }}
                    />
                  ))}
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  <strong>Scenarios:</strong> {scenarios?.length || 0} | <strong>Engine:</strong> BackstopJS | <strong>Threshold:</strong> {config?.misMatchThreshold || 0.1}%
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Scenario Selection */}
      <Card elevation={0} sx={{ borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <List sx={{ color: 'primary.main', fontSize: 20 }} />
              Scenarios ({filteredScenarios.length})
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ 
                  minWidth: '160px',
                  '& .MuiOutlinedInput-root': { borderRadius: '6px', fontSize: '0.875rem' }
                }}
                InputProps={{
                  startAdornment: <Search sx={{ color: 'text.secondary', mr: 1, fontSize: 18 }} />
                }}
              />
              <Button
                variant={showSelectedOnly ? 'contained' : 'outlined'}
                size="small"
                startIcon={<FilterList />}
                onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                sx={{ borderRadius: '6px', textTransform: 'none', fontSize: '0.875rem' }}
              >
                {showSelectedOnly ? 'All' : 'Selected'}
              </Button>
              <ButtonGroup size="small" sx={{ '& .MuiButton-root': { borderRadius: '6px', textTransform: 'none', fontSize: '0.875rem' } }}>
                <Button
                  variant="outlined"
                  onClick={selectAllScenarios}
                  disabled={selectedScenarios.length === scenarios.length}
                  startIcon={<CheckCircleRounded fontSize="small" />}
                >
                  Select All ({scenarios.length})
                </Button>
                <Button
                  variant="outlined"
                  onClick={unselectAllScenarios}
                  color="secondary"
                  disabled={selectedScenarios.length === 0}
                  startIcon={<Clear fontSize="small" />}
                >
                  Clear All
                </Button>
              </ButtonGroup>
              
              <Chip 
                label={`${selectedScenarios.length}/${scenarios.length} selected`}
                size="small"
                color={selectedScenarios.length === 0 ? 'default' : 'primary'}
                sx={{ 
                  borderRadius: '6px',
                  fontWeight: 500,
                  fontSize: '0.8rem'
                }}
              />
            </Box>
          </Box>

          {/* Compact Scenario List */}
          <Box sx={{ display: 'grid', gap: 1.5 }}>
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
                    p: 2, 
                    border: '1px solid', 
                    borderColor: selectedScenarios.includes(scenario.label) ? 'primary.main' : 'divider', 
                    borderRadius: '8px', 
                    cursor: 'pointer', 
                    transition: 'all 0.2s',
                    bgcolor: selectedScenarios.includes(scenario.label) ? 'primary.lighter' : 'background.paper',
                    '&:hover': { 
                      borderColor: 'primary.main',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)'
                    }
                  }}
                  onClick={() => handleScenarioSelection(scenario.label)}
                >
                  <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                    {selectedScenarios.includes(scenario.label) ? (
                      <CheckCircleRounded sx={{ color: 'primary.main', fontSize: 20, mt: 0.25 }} />
                    ) : (
                      <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 20, mt: 0.25 }} />
                    )}
                    
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography 
                        variant="subtitle1" 
                        sx={{ 
                          fontWeight: 600,
                          color: selectedScenarios.includes(scenario.label) ? 'primary.dark' : 'text.primary',
                          mb: 0.5,
                          lineHeight: 1.3
                        }}
                      >
                        {scenario.label}
                      </Typography>

                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: 'text.secondary',
                          mb: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Link sx={{ fontSize: 14 }} />
                        {scenario.url}
                      </Typography>

                      {/* Status Display */}
                      {displayStatus && (
                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                          <Chip
                            size="small"
                            icon={getStatusIcon(displayStatus)}
                            label={
                              displayStatus === 'passed' ? 'Passed' :
                              displayStatus === 'failed' ? 'Failed' :
                              displayStatus === 'network_error' ? 'Network Error' :
                              displayStatus === 'running' ? 'Running' : 'Pending'
                            }
                            sx={{
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              height: '20px',
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
                              fontWeight: 500,
                              '& .MuiChip-icon': { fontSize: '14px' }
                            }}
                          />
                          
                          {typeof displayMismatch !== 'undefined' && displayMismatch > 0 && (
                            <Chip
                              size="small"
                              label={`${displayMismatch}%`}
                              sx={{
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                height: '20px',
                                bgcolor: 'background.paper',
                                color: 'text.secondary',
                                border: '1px solid',
                                borderColor: 'divider'
                              }}
                            />
                          )}
                          
                          {liveResult?.timestamp && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <AccessTime sx={{ fontSize: 10 }} />
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
              <Card elevation={0} sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default', borderRadius: '8px' }}>
                <Typography variant="subtitle1" sx={{ color: 'text.secondary', mb: 0.5 }}>
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
    </Box>
  )
}

export default TestRunner
