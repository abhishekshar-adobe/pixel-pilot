import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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
  Divider,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox
} from '@mui/material'
import {
  PlayArrow,
  CheckCircle,
  GetApp,
  Refresh,
  Visibility,
  Assessment,
  Settings,
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

  // Pagination and virtualization state for large datasets
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [viewMode, setViewMode] = useState('detailed') // 'compact' | 'detailed'
  const [sortBy, setSortBy] = useState('label') // 'label' | 'status' | 'url'
  const [sortOrder, setSortOrder] = useState('asc') // 'asc' | 'desc'
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'passed' | 'failed' | 'pending' | 'running'

  // Refs for performance optimization
  const listRef = useRef(null)
  const searchInputRef = useRef(null)

  // Fetch batch information
  const fetchBatchInfo = React.useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/batches`)
      setBatchInfo(response.data)
    } catch (error) {
      console.error('Error fetching batch info:', error)
      setBatchInfo(null)
    }
  }, [project.id])

  // Open latest combined report
  const openLatestReport = async () => {
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/runs-latest-combined`)
      if (response.data && response.data.latestRunId) {
        const reportUrl = `${API_BASE}/projects/${project.id}/runs/${response.data.latestRunId}/report/index.html`
        window.open(reportUrl, '_blank')
      } else {
        // Fallback to regular report if no batch runs exist
        window.open(`${API_BASE}/projects/${project.id}/report/index.html`, '_blank')
      }
    } catch (error) {
      console.error('Error opening latest report:', error)
      // Fallback to regular report on error
      window.open(`${API_BASE}/projects/${project.id}/report/index.html`, '_blank')
    }
  }

  // Define loadBackstopReport function first
  const loadBackstopReport = React.useCallback(async () => {
    try {
      console.log('Loading test results for project:', project.id)
      const response = await axios.get(`${API_BASE}/projects/${project.id}/test-results`)
      console.log('API Response:', response.data)
      if (response.data && !response.data.error) {
        setBackstopReport(response.data)
        // Also fetch batch info when loading report
        fetchBatchInfo()
        if (response.data?.tests) {
          const results = {}
          console.log('Loading test results:', response.data.tests.length, 'tests found')
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
            
            const testLabel = test.pair?.label || test.label
            if (testLabel) {
              results[testLabel] = {
                status,
                misMatchPercentage: test.misMatchPercentage || (test.pair?.diff?.misMatchPercentage || 0),
                isSameDimensions: test.isSameDimensions,
                networkError: test.pair?.networkError || test.pair?.cliError || null,
                errorMessage: test.error || null
              }
              console.log('Added result for scenario:', testLabel, 'status:', status)
            } else {
              console.warn('Test without label found:', test)
            }
          })
          console.log('Final scenario results:', results)
          setScenarioResults(results)
        } else {
          console.log('No tests found in response data')
        }
      } else {
        setBackstopReport(null)
        setMessage('No test results found. Click "Run Visual Test" to generate your first results.')
        console.log('No test results found or error in response:', response.data)
      }
    } catch (error) {
      setBackstopReport(null)
      setMessage('No test results found. Click "Run Visual Test" to generate your first results.')
      console.error('Error loading backstop report:', error)
    }
  }, [project.id, fetchBatchInfo])

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

  // Load scenarios and test results on mount
  useEffect(() => {
    if (initialScenarios.length > 0) {
      setSelectedScenarios(initialScenarios.map(s => s.label))
    }
    // Always load backstop report to show previous test results
    loadBackstopReport()
  }, [initialScenarios, loadBackstopReport])

  // Update scenarios when initialScenarios changes
  useEffect(() => {
    setScenarios(initialScenarios)
    console.log('Scenarios updated:', initialScenarios.map(s => ({ label: s.label, url: s.url })))
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
      const scenarioCount = selectedScenarios.length
      const batchConfig = {
        filter,
        batchSize: scenarioCount > 1000 ? 25 : scenarioCount > 500 ? 50 : scenarioCount > 100 ? 100 : scenarioCount,
        maxConcurrent: scenarioCount > 1000 ? 2 : scenarioCount > 500 ? 3 : scenarioCount > 100 ? 5 : 10
      }

      // Always show batch message, even for small runs
      setMessage(`🚀 Starting batch test: ${scenarioCount} scenarios (${batchConfig.batchSize} per batch, ${batchConfig.maxConcurrent} concurrent)`)

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

  const downloadResults = async () => {
    if (backstopReport) {
      try {
        const response = await axios.get(`${API_BASE}/projects/${project.id}/export-results`, {
          responseType: 'blob'
        })
        
        // Create blob URL and download
        const blob = new Blob([response.data], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        
        // Extract filename from response headers or create default
        const contentDisposition = response.headers['content-disposition']
        let filename = `test-results-${project.id}.csv`
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/)
          if (filenameMatch) {
            filename = filenameMatch[1]
          }
        }
        
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      } catch (error) {
        console.error('Error downloading CSV:', error)
        setMessage('Failed to export test results')
      }
    }
  }

  // Memoized filtering and sorting for performance with large datasets
  const filteredAndSortedScenarios = useMemo(() => {
    let filtered = scenarios.filter(scenario => {
      // Search filter
      const matchesSearch = scenario.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           scenario.url.toLowerCase().includes(searchTerm.toLowerCase())
      
      // Selection filter
      const isSelected = selectedScenarios.includes(scenario.label)
      const matchesSelection = !showSelectedOnly || isSelected
      
      // Status filter
      const result = scenarioResults[scenario.label] || {}
      const liveResult = liveScenarioResults[scenario.label]
      const displayStatus = liveResult?.status || result.status || 'pending'
      
      let matchesStatus = true
      if (statusFilter !== 'all') {
        if (statusFilter === 'failed') {
          matchesStatus = displayStatus === 'failed' || displayStatus === 'network_error'
        } else {
          matchesStatus = displayStatus === statusFilter
        }
      }
      
      return matchesSearch && matchesSelection && matchesStatus
    })

    // Sort scenarios
    filtered.sort((a, b) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'status': {
          const aResult = scenarioResults[a.label] || {}
          const bResult = scenarioResults[b.label] || {}
          const aLive = liveScenarioResults[a.label]
          const bLive = liveScenarioResults[b.label]
          aValue = aLive?.status || aResult.status || 'pending'
          bValue = bLive?.status || bResult.status || 'pending'
          break
        }
        case 'url':
          aValue = a.url
          bValue = b.url
          break
        default: // 'label'
          aValue = a.label
          bValue = b.label
      }
      
      const comparison = aValue.localeCompare(bValue)
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [scenarios, searchTerm, selectedScenarios, showSelectedOnly, statusFilter, sortBy, sortOrder, scenarioResults, liveScenarioResults])

  // Paginated scenarios for rendering
  const paginatedScenarios = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredAndSortedScenarios.slice(startIndex, startIndex + pageSize)
  }, [filteredAndSortedScenarios, currentPage, pageSize])

  const totalPages = Math.ceil(filteredAndSortedScenarios.length / pageSize)

  // Optimized callback functions for performance
  const handleScenarioSelection = useCallback((scenarioLabel) => {
    setSelectedScenarios(prev => 
      prev.includes(scenarioLabel) 
        ? prev.filter(s => s !== scenarioLabel)
        : [...prev, scenarioLabel]
    )
  }, [])

  const handlePageChange = useCallback((event, newPage) => {
    setCurrentPage(newPage)
    // Scroll to top of list when page changes
    if (listRef.current) {
      listRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const handlePageSizeChange = useCallback((event) => {
    setPageSize(event.target.value)
    setCurrentPage(1) // Reset to first page when page size changes
  }, [])

  const handleSortChange = useCallback((newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(newSortBy)
      setSortOrder('asc')
    }
    setCurrentPage(1) // Reset to first page when sorting changes
  }, [sortBy])

  const selectAllScenarios = useCallback(() => {
    setSelectedScenarios(filteredAndSortedScenarios.map(s => s.label))
  }, [filteredAndSortedScenarios])

  const unselectAllScenarios = useCallback(() => {
    setSelectedScenarios([])
  }, [])

  const selectAllFiltered = useCallback(() => {
    setSelectedScenarios(prev => {
      const filteredLabels = filteredAndSortedScenarios.map(s => s.label)
      const newSelection = [...new Set([...prev, ...filteredLabels])]
      return newSelection
    })
  }, [filteredAndSortedScenarios])

  const unselectAllFiltered = useCallback(() => {
    setSelectedScenarios(prev => {
      const filteredLabels = new Set(filteredAndSortedScenarios.map(s => s.label))
      return prev.filter(label => !filteredLabels.has(label))
    })
  }, [filteredAndSortedScenarios])

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
                  Export CSV
                </Button>
                
                {backstopReport && (
                  <Button
                    variant="outlined"
                    size="medium"
                    startIcon={<Visibility />}
                    onClick={openLatestReport}
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

      {/* Consolidated Stats Dashboard */}
      <Card elevation={0} sx={{ mb: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assessment sx={{ color: 'primary.main', fontSize: 20 }} />
            Test Overview
          </Typography>
          
          <Grid container spacing={2}>
            {/* Selected/Processing Count */}
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'primary.lighter', borderRadius: '8px' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {testRunning ? processedCount : selectedScenarios.length}
                </Typography>
                <Typography variant="caption" sx={{ color: 'primary.dark', fontWeight: 500 }}>
                  {testRunning ? 'Processed' : 'Selected'}
                </Typography>
              </Box>
            </Grid>

            {/* Passed Count */}
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'success.lighter', borderRadius: '8px' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                  {Object.values(scenarioResults).filter(r => r.status === 'passed').length}
                </Typography>
                <Typography variant="caption" sx={{ color: 'success.dark', fontWeight: 500 }}>
                  Passed
                </Typography>
              </Box>
            </Grid>

            {/* Failed Count */}
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'error.lighter', borderRadius: '8px' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main' }}>
                  {Object.values(scenarioResults).filter(r => r.status === 'failed' || r.status === 'network_error').length}
                </Typography>
                <Typography variant="caption" sx={{ color: 'error.dark', fontWeight: 500 }}>
                  Failed
                </Typography>
              </Box>
            </Grid>

            {/* Running/ETA */}
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'warning.lighter', borderRadius: '8px' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>
                  {testRunning && estimatedTime ? estimatedTime.formatted : Object.values(liveScenarioResults).filter(r => r.status === 'running').length}
                </Typography>
                <Typography variant="caption" sx={{ color: 'warning.dark', fontWeight: 500 }}>
                  {testRunning && estimatedTime ? 'ETA' : 'Running'}
                </Typography>
              </Box>
            </Grid>

            {/* Success Rate */}
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'info.lighter', borderRadius: '8px' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
                  {(() => {
                    const totalResults = Object.values(scenarioResults)
                    const passedResults = totalResults.filter(r => r.status === 'passed')
                    if (totalResults.length === 0) return '0'
                    return Math.round((passedResults.length / totalResults.length) * 100)
                  })()}%
                </Typography>
                <Typography variant="caption" sx={{ color: 'info.dark', fontWeight: 500 }}>
                  Success Rate
                </Typography>
              </Box>
            </Grid>

            {/* Last Run Date */}
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'grey.100', borderRadius: '8px' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'grey.700' }}>
                  {(() => {
                    if (backstopReport?.testSuite?.date) {
                      const date = new Date(backstopReport.testSuite.date)
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    } else if (backstopReport?.testSuite && typeof backstopReport.testSuite === 'string') {
                      return 'Recent'
                    }
                    return 'Never'
                  })()}
                </Typography>
                <Typography variant="caption" sx={{ color: 'grey.600', fontWeight: 500, display: 'block' }}>
                  {(() => {
                    if (backstopReport?.testSuite?.date) {
                      const date = new Date(backstopReport.testSuite.date)
                      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                    }
                    return 'Last Run'
                  })()}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Compact Configuration Info */}
          {config && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Settings sx={{ fontSize: 16 }} />
                  <strong>Viewports:</strong> {config?.viewports?.length || 0}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  <strong>Scenarios:</strong> {scenarios?.length || 0}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  <strong>Engine:</strong> BackstopJS
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  <strong>Threshold:</strong> {config?.misMatchThreshold || 0.1}%
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {config?.viewports?.slice(0, 3).map((viewport, index) => (
                  <Chip
                    key={index}
                    size="small"
                    icon={getViewportIcon(viewport)}
                    label={`${viewport.width}×${viewport.height}`}
                    sx={{
                      bgcolor: 'primary.lighter',
                      color: 'primary.dark',
                      fontWeight: 500,
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      height: '24px'
                    }}
                  />
                ))}
                {config?.viewports?.length > 3 && (
                  <Chip
                    size="small"
                    label={`+${config.viewports.length - 3} more`}
                    sx={{
                      bgcolor: 'grey.200',
                      color: 'text.secondary',
                      fontWeight: 500,
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      height: '24px'
                    }}
                  />
                )}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

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

      {/* Enhanced Scenario Management */}
      <Card elevation={0} sx={{ borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2 }}>
          {/* Header with Summary Stats */}
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <List sx={{ color: 'primary.main', fontSize: 20 }} />
                Scenarios
              </Typography>
            </Box>
            
            {/* View Mode Toggle */}
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newMode) => newMode && setViewMode(newMode)}
              size="small"
              sx={{ '& .MuiToggleButton-root': { px: 2, py: 0.5, borderRadius: '6px' } }}
            >
              <ToggleButton value="compact">
                <Tooltip title="Compact View">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <List sx={{ fontSize: 16 }} />
                    Compact
                  </Box>
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="detailed">
                <Tooltip title="Detailed View">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Assessment sx={{ fontSize: 16 }} />
                    Detailed
                  </Box>
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Enhanced Controls - Reorganized Layout */}
          <Box sx={{ mb: 3 }}>
            {/* Top Row - Search and Primary Filters */}
            <Box sx={{ mb: 2.5, display: 'flex', gap: 2.5, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Search */}
              <TextField
                ref={searchInputRef}
                size="small"
                placeholder="Search scenarios or URLs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ 
                  minWidth: '280px',
                  flexGrow: 1,
                  maxWidth: '450px',
                  '& .MuiOutlinedInput-root': { 
                    borderRadius: '10px', 
                    fontSize: '0.875rem',
                    '&:hover': {
                      borderColor: 'primary.main'
                    }
                  }
                }}
                InputProps={{
                  startAdornment: <Search sx={{ color: 'text.secondary', mr: 1.5, fontSize: 20 }} />
                }}
              />

              {/* Status Filter */}
              <FormControl size="small" sx={{ minWidth: '140px' }}>
                <InputLabel sx={{ fontSize: '0.875rem' }}>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                  sx={{ 
                    borderRadius: '10px', 
                    fontSize: '0.875rem',
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main'
                    }
                  }}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="passed">✅ Passed</MenuItem>
                  <MenuItem value="failed">❌ Failed</MenuItem>
                  <MenuItem value="pending">⏳ Pending</MenuItem>
                  <MenuItem value="running">🏃 Running</MenuItem>
                </Select>
              </FormControl>

              {/* Show Selected Only Filter */}
              <Button
                variant={showSelectedOnly ? 'contained' : 'outlined'}
                size="small"
                startIcon={<FilterList sx={{ fontSize: 18 }} />}
                onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                sx={{ 
                  borderRadius: '10px', 
                  textTransform: 'none', 
                  fontSize: '0.875rem',
                  minWidth: '140px',
                  px: 2.5,
                  py: 1,
                  fontWeight: 500,
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: 2
                  }
                }}
              >
                {showSelectedOnly ? 'Show All' : 'Selected Only'}
              </Button>
            </Box>

            {/* Bottom Row - Sort, Display, and Actions */}
            <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {/* Left Side - Sort Controls */}
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: '110px' }}>
                  <InputLabel sx={{ fontSize: '0.875rem' }}>Sort By</InputLabel>
                  <Select
                    value={sortBy}
                    label="Sort By"
                    onChange={(e) => handleSortChange(e.target.value)}
                    sx={{ 
                      borderRadius: '10px', 
                      fontSize: '0.875rem',
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'primary.main'
                      }
                    }}
                  >
                    <MenuItem value="label">📝 Name</MenuItem>
                    <MenuItem value="url">🔗 URL</MenuItem>
                    <MenuItem value="status">📊 Status</MenuItem>
                  </Select>
                </FormControl>

                <Tooltip title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}>
                  <IconButton 
                    size="small" 
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    sx={{ 
                      bgcolor: 'background.default',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: '10px',
                      width: 40,
                      height: 40,
                      fontSize: '16px',
                      fontWeight: 'bold',
                      '&:hover': { 
                        bgcolor: 'action.hover',
                        borderColor: 'primary.main',
                        transform: 'translateY(-1px)'
                      }
                    }}
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </IconButton>
                </Tooltip>

                <FormControl size="small" sx={{ minWidth: '90px' }}>
                  <InputLabel sx={{ fontSize: '0.875rem' }}>Show</InputLabel>
                  <Select
                    value={pageSize}
                    label="Show"
                    onChange={handlePageSizeChange}
                    sx={{ 
                      borderRadius: '10px', 
                      fontSize: '0.875rem',
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'primary.main'
                      }
                    }}
                  >
                    <MenuItem value={25}>25</MenuItem>
                    <MenuItem value={50}>50</MenuItem>
                    <MenuItem value={100}>100</MenuItem>
                    <MenuItem value={250}>250</MenuItem>
                    <MenuItem value={500}>500</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Right Side - Selection Actions */}
              <ButtonGroup 
                size="small" 
                sx={{ 
                  '& .MuiButton-root': { 
                    borderRadius: '10px', 
                    textTransform: 'none', 
                    fontSize: '0.875rem',
                    px: 2,
                    py: 1,
                    fontWeight: 500,
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: 1
                    }
                  },
                  '& .MuiButtonGroup-grouped:not(:last-of-type)': {
                    borderTopRightRadius: '10px',
                    borderBottomRightRadius: '10px',
                    mr: 1
                  },
                  '& .MuiButtonGroup-grouped:not(:first-of-type)': {
                    borderTopLeftRadius: '10px',
                    borderBottomLeftRadius: '10px'
                  }
                }}
              >
                <Button
                  variant="outlined"
                  onClick={selectAllScenarios}
                  disabled={selectedScenarios.length === scenarios.length}
                  startIcon={<CheckCircleRounded fontSize="small" />}
                >
                  All ({scenarios.length})
                </Button>
                <Button
                  variant="outlined"
                  onClick={selectAllFiltered}
                  disabled={selectedScenarios.length === filteredAndSortedScenarios.length || filteredAndSortedScenarios.length === 0}
                  startIcon={<FilterList fontSize="small" />}
                >
                  Filtered ({filteredAndSortedScenarios.length})
                </Button>
                <Button
                  variant="outlined"
                  onClick={unselectAllScenarios}
                  color="secondary"
                  disabled={selectedScenarios.length === 0}
                  startIcon={<Clear fontSize="small" />}
                >
                  Clear
                </Button>
              </ButtonGroup>
            </Box>
          </Box>

          {/* Pagination - Top */}
          {totalPages > 1 && (
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredAndSortedScenarios.length)} of {filteredAndSortedScenarios.length} scenarios
              </Typography>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={handlePageChange}
                size="small"
                showFirstButton
                showLastButton
                sx={{ '& .MuiPaginationItem-root': { borderRadius: '6px' } }}
              />
            </Box>
          )}

          {/* Optimized Scenario List with ref */}
          <Box ref={listRef} sx={{ display: 'grid', gap: viewMode === 'compact' ? 1 : 1.5 }}>
            {paginatedScenarios.map((scenario) => {
              const result = scenarioResults[scenario.label] || {}
              const liveResult = liveScenarioResults[scenario.label]
              const displayStatus = liveResult?.status || result.status
              const displayMismatch = liveResult?.mismatchPercentage || result.misMatchPercentage
              const isSelected = selectedScenarios.includes(scenario.label)

              return viewMode === 'compact' ? (
                // Compact View - List Item Style for Dense Display
                <ListItem
                  key={scenario.label || scenario.url}
                  disablePadding
                  sx={{
                    border: '1px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    borderRadius: '4px',
                    mb: 0.5,
                    bgcolor: isSelected ? 'primary.lighter' : 'background.paper',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: isSelected ? 'primary.lighter' : 'action.hover'
                    }
                  }}
                >
                  <ListItemButton
                    onClick={() => handleScenarioSelection(scenario.label)}
                    sx={{ py: 0.5, px: 1 }}
                  >
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <Checkbox
                        checked={isSelected}
                        size="small"
                        sx={{ p: 0 }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="body2" sx={{ fontWeight: 500, flex: 1, minWidth: 0, mr: 1 }}>
                            {scenario.label}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {displayStatus && getStatusIcon(displayStatus)}
                            {typeof displayMismatch !== 'undefined' && displayMismatch > 0 && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                                {displayMismatch}%
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      }
                      secondary={
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: 'text.secondary',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: '0.7rem'
                          }}
                        >
                          {scenario.url}
                        </Typography>
                      }
                      sx={{ my: 0 }}
                    />
                  </ListItemButton>
                </ListItem>
              ) : (
                // Detailed View - Card Style for Rich Information
                <Paper
                  key={scenario.label || scenario.url}
                  elevation={0}
                  sx={{ 
                    p: 2, 
                    border: '1px solid', 
                    borderColor: isSelected ? 'primary.main' : 'divider', 
                    borderRadius: '8px', 
                    cursor: 'pointer', 
                    transition: 'all 0.2s',
                    bgcolor: isSelected ? 'primary.lighter' : 'background.paper',
                    '&:hover': { 
                      borderColor: 'primary.main',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)'
                    }
                  }}
                  onClick={() => handleScenarioSelection(scenario.label)}
                >
                  <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                    {isSelected ? (
                      <CheckCircleRounded sx={{ color: 'primary.main', fontSize: 20, mt: 0.25 }} />
                    ) : (
                      <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 20, mt: 0.25 }} />
                    )}
                    
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography 
                        variant="subtitle1" 
                        sx={{ 
                          fontWeight: 600,
                          color: isSelected ? 'primary.dark' : 'text.primary',
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
            
            {/* Empty State */}
            {paginatedScenarios.length === 0 && (
              <Card elevation={0} sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default', borderRadius: '8px' }}>
                <Typography variant="subtitle1" sx={{ color: 'text.secondary', mb: 0.5 }}>
                  {filteredAndSortedScenarios.length === 0 ? 'No scenarios found' : 'Page is empty'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {filteredAndSortedScenarios.length === 0 
                    ? (searchTerm || statusFilter !== 'all' 
                        ? 'Try adjusting your search or filter criteria' 
                        : 'No scenarios available for testing')
                    : 'This page has no items. Try going to a different page.'
                  }
                </Typography>
              </Card>
            )}
          </Box>

          {/* Pagination - Bottom */}
          {totalPages > 1 && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredAndSortedScenarios.length)} of {filteredAndSortedScenarios.length} scenarios
              </Typography>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={handlePageChange}
                size="small"
                showFirstButton
                showLastButton
                sx={{ '& .MuiPaginationItem-root': { borderRadius: '6px' } }}
              />
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

export default TestRunner
