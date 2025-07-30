import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Avatar,
  Stack,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Paper,
  Chip,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Skeleton,
  CircularProgress,
  InputAdornment
} from '@mui/material'
import {
  CloudUpload,
  PhotoLibrary,
  SyncAlt,
  DevicesIcon,
  TuneIcon,
  WebIcon,
  LayersIcon,
  Delete,
  Visibility,
  GetApp,
  Search,
  FilterAlt
} from '@mui/icons-material'
import axios from 'axios'

const API_BASE = 'http://localhost:5000/api'

const ScreenshotUploader = () => {
  // State management
  const [viewports, setViewports] = useState([])
  const [scenarios, setScenarios] = useState([])
  const [selectedScenario, setSelectedScenario] = useState('')
  const [viewportData, setViewportData] = useState({})
  const [syncStatus, setSyncStatus] = useState({})
  const [uploading, setUploading] = useState({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  
  // Figma integration state
  const [figmaDialogOpen, setFigmaDialogOpen] = useState(false)
  const [currentViewport, setCurrentViewport] = useState(null)
  const [figmaToken, setFigmaToken] = useState('')
  const [figmaFileKey, setFigmaFileKey] = useState('')
  const [tabValue, setTabValue] = useState(0)
  const [figmaLayers, setFigmaLayers] = useState([])
  const [filteredLayers, setFilteredLayers] = useState([])
  const [selectedLayer, setSelectedLayer] = useState(null)
  const [loadingLayers, setLoadingLayers] = useState(false)
  const [loadingThumbnails, setLoadingThumbnails] = useState(false)
  const [layerThumbnails, setLayerThumbnails] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [layerTypeFilter, setLayerTypeFilter] = useState('all')
  const [showFramesOnly, setShowFramesOnly] = useState(false)
  const [layerFilterSummary, setLayerFilterSummary] = useState(null)

  // Load initial data
  useEffect(() => {
    loadConfiguration()
    
    // Load saved Figma credentials
    const savedToken = localStorage.getItem('figmaToken')
    const savedFileKey = localStorage.getItem('figmaFileKey')
    if (savedToken) setFigmaToken(savedToken)
    if (savedFileKey) setFigmaFileKey(savedFileKey)
  }, [])

  const loadConfiguration = async () => {
    try {
      const response = await axios.get(`${API_BASE}/config`)
      if (response.data && response.data.viewports && response.data.scenarios) {
        setViewports(response.data.viewports)
        setScenarios(response.data.scenarios)
        
        // Load viewport data for each viewport
        for (const viewport of response.data.viewports) {
          await loadViewportData(viewport.label)
        }
      }
    } catch (error) {
      setMessage('Error loading configuration: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadViewportData = async (viewportLabel) => {
    try {
      const response = await axios.get(`${API_BASE}/screenshots/${viewportLabel}`)
      setViewportData(prev => ({
        ...prev,
        [viewportLabel]: response.data
      }))
      
      // Check sync status
      await checkSyncStatus(viewportLabel)
    } catch (error) {
      console.error(`Error loading data for ${viewportLabel}:`, error)
    }
  }

  const checkSyncStatus = async (viewportLabel) => {
    try {
      const response = await axios.get(`${API_BASE}/sync-status/${viewportLabel}`)
      setSyncStatus(prev => ({
        ...prev,
        [viewportLabel]: response.data.status
      }))
    } catch (error) {
      console.error(`Error checking sync status for ${viewportLabel}:`, error)
    }
  }

  const handleFileSelect = async (viewportLabel, file) => {
    if (!selectedScenario) {
      setMessage('Please select a scenario first')
      return
    }

    setUploading(prev => ({ ...prev, [viewportLabel]: true }))
    
    try {
      const formData = new FormData()
      formData.append('screenshot', file)
      formData.append('scenario', selectedScenario)
      formData.append('viewport', viewportLabel)

      await axios.post(`${API_BASE}/upload`, formData)
      setMessage(`✅ Screenshot uploaded successfully for ${viewportLabel}!`)
      
      // Reload data
      await loadViewportData(viewportLabel)
    } catch (error) {
      setMessage(`❌ Error uploading screenshot: ${error.message}`)
    } finally {
      setUploading(prev => ({ ...prev, [viewportLabel]: false }))
    }
  }

  const deleteScreenshot = async (viewportLabel) => {
    try {
      const data = viewportData[viewportLabel]
      if (data && data.screenshots && data.screenshots.length > 0) {
        const screenshotPath = data.screenshots[0]
        await axios.delete(`${API_BASE}/screenshot`, {
          data: { path: screenshotPath, viewport: viewportLabel }
        })
        setMessage(`✅ Screenshot deleted for ${viewportLabel}`)
        await loadViewportData(viewportLabel)
      }
    } catch (error) {
      setMessage(`❌ Error deleting screenshot: ${error.message}`)
    }
  }

  const viewScreenshot = (screenshotUrl) => {
    window.open(screenshotUrl, '_blank')
  }

  const loadFigmaLayers = async () => {
    if (!figmaToken || !figmaFileKey) return

    setLoadingLayers(true)
    try {
      const response = await axios.post(`${API_BASE}/figma/layers`, {
        token: figmaToken,
        fileKey: figmaFileKey
      })
      
      const layersData = response.data.layers || []
      const summary = response.data.summary || {
        total: layersData.length,
        filtered: layersData.length,
        filterStrategy: 'none',
        appliedFilters: []
      }

      setFigmaLayers(layersData)
      setFilteredLayers(layersData)
      setLayerFilterSummary(summary)
    } catch (error) {
      setMessage(`Error loading Figma layers: ${error.message}`)
    } finally {
      setLoadingLayers(false)
    }
  }

  const filterLayers = () => {
    let filtered = [...figmaLayers]

    if (searchTerm) {
      filtered = filtered.filter(layer => 
        layer.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (layerTypeFilter !== 'all') {
      filtered = filtered.filter(layer => layer.type === layerTypeFilter)
    }

    if (showFramesOnly) {
      filtered = filtered.filter(layer => layer.type === 'FRAME')
    }

    filtered.sort((a, b) => {
      if (a.type === 'FRAME' && b.type !== 'FRAME') return -1
      if (a.type !== 'FRAME' && b.type === 'FRAME') return 1
      return a.name.localeCompare(b.name)
    })

    setFilteredLayers(filtered)
  }

  useEffect(() => {
    filterLayers()
  }, [searchTerm, layerTypeFilter, showFramesOnly, figmaLayers])

  const selectFigmaLayer = async () => {
    if (!selectedLayer || !currentViewport) return

    setUploading(prev => ({ ...prev, [currentViewport.label]: true }))
    
    try {
      const response = await axios.post(`${API_BASE}/figma/import`, {
        token: figmaToken,
        fileKey: figmaFileKey,
        nodeId: selectedLayer.id,
        scenario: selectedScenario,
        viewport: currentViewport.label,
        scale: 2
      })
      
      setMessage(`✅ Figma layer "${selectedLayer.name}" uploaded successfully for ${currentViewport.label}!`)
      setFigmaDialogOpen(false)
      
      // Reload viewport data
      await loadViewportData(currentViewport.label)
      await checkSyncStatus(currentViewport.label)
      
    } catch (error) {
      setMessage(`❌ Error importing from Figma: ${error.message}`)
    } finally {
      setUploading(prev => ({ ...prev, [currentViewport.label]: false }))
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <CircularProgress sx={{ mr: 2 }} />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading configuration...
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: 3 }}>
      {/* Modern Dashboard Header */}
      <Box sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 3,
        p: 4,
        mb: 4,
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <Box sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 200,
          height: 200,
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          transform: 'translate(30%, -30%)'
        }} />
        
        <Stack direction="row" alignItems="center" spacing={3} sx={{ position: 'relative', zIndex: 1 }}>
          <Avatar sx={{ 
            width: 64, 
            height: 64, 
            bgcolor: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(10px)'  
          }}>
            <CloudUpload sx={{ fontSize: 32 }} />
          </Avatar>
          <Box>
            <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
              Screenshot Upload
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 400 }}>
              Upload reference screenshots and manage visual test assets
            </Typography>
          </Box>
        </Stack>

        {/* Status Cards */}
        <Grid container spacing={3} sx={{ mt: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ 
              p: 2, 
              bgcolor: 'rgba(255,255,255,0.15)', 
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 2
            }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'rgba(76, 175, 80, 0.2)' }}>
                  <PhotoLibrary sx={{ color: '#4caf50' }} />
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                    {Object.values(viewportData).reduce((total, data) => total + (data?.screenshots?.length || 0), 0)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total Screenshots
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ 
              p: 2, 
              bgcolor: 'rgba(255,255,255,0.15)', 
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 2
            }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'rgba(33, 150, 243, 0.2)' }}>
                  <SyncAlt sx={{ color: '#2196f3' }} />
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                    {Object.values(syncStatus).filter(status => status === 'synced').length}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Synced References
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ 
              p: 2, 
              bgcolor: 'rgba(255,255,255,0.15)', 
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 2
            }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'rgba(156, 39, 176, 0.2)' }}>
                  <DevicesIcon sx={{ color: '#9c27b0' }} />
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                    {viewports.length}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Available Viewports
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ 
              p: 2, 
              bgcolor: 'rgba(255,255,255,0.15)', 
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 2
            }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'rgba(255, 152, 0, 0.2)' }}>
                  <TuneIcon sx={{ color: '#ff9800' }} />
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                    {selectedScenario || 'None'}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Selected Scenario
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* Message Display */}
      {message && (
        <Alert 
          severity={message.includes('Error') || message.includes('❌') ? "error" : "success"} 
          sx={{ mb: 3, borderRadius: 2 }}
          onClose={() => setMessage('')}
        >
          {message}
        </Alert>
      )}

      {/* Scenario Selection Card */}
      <Card sx={{ mb: 4, borderRadius: 3, boxShadow: 3 }}>
        <Box sx={{
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          p: 3,
          borderRadius: '12px 12px 0 0'
        }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
              <TuneIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: 'white' }}>
                Scenario Configuration
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, color: 'white' }}>
                Select which scenario these screenshots will be used for
              </Typography>
            </Box>
          </Stack>
        </Box>
        
        <CardContent sx={{ p: 3 }}>
          <FormControl fullWidth>
            <InputLabel>Select Scenario</InputLabel>
            <Select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              label="Select Scenario"
              sx={{ borderRadius: 2 }}
            >
              {scenarios.map((scenario) => (
                <MenuItem key={scenario.label} value={scenario.label}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                      <WebIcon sx={{ fontSize: 18 }} />
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {scenario.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {scenario.url}
                      </Typography>
                    </Box>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {/* Viewport Cards */}
      {selectedScenario && (
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 3, color: 'text.primary' }}>
            Viewport Configuration
          </Typography>
          
          <Grid container spacing={3}>
            {viewports.map((viewport, index) => {
              const data = viewportData[viewport.label] || {}
              const screenshots = data.screenshots || []
              const hasScreenshot = screenshots.length > 0
              const isUploading = uploading[viewport.label]
              const syncStatusForViewport = syncStatus[viewport.label]
              
              return (
                <Grid item xs={12} md={6} lg={4} key={index}>
                  <Card sx={{ 
                    height: '100%',
                    borderRadius: 3,
                    boxShadow: 3,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6
                    }
                  }}>
                    {/* Gradient Header */}
                    <Box sx={{
                      background: `linear-gradient(135deg, ${viewport.color || '#2196f3'} 0%, ${viewport.darkColor || '#1565c0'} 100%)`,
                      p: 3,
                      color: 'white'
                    }}>
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                          <DevicesIcon />
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {viewport.label}
                          </Typography>
                          <Typography variant="body2" sx={{ opacity: 0.9 }}>
                            {viewport.width} × {viewport.height}
                          </Typography>
                        </Box>
                        <Chip
                          label={hasScreenshot ? 'Has Reference' : 'No Reference'}
                          sx={{
                            bgcolor: hasScreenshot ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.3)'
                          }}
                        />
                      </Stack>
                    </Box>

                    <CardContent sx={{ p: 3, flex: 1 }}>
                      {/* Sync Status */}
                      <Alert 
                        severity={
                          syncStatusForViewport === 'synced' ? 'success' : 
                          syncStatusForViewport === 'outdated' ? 'warning' : 'info'
                        }
                        sx={{ mb: 3, borderRadius: 2 }}
                      >
                        <Typography variant="body2">
                          <strong>Sync Status:</strong> {
                            syncStatusForViewport === 'synced' ? 'In sync with BackstopJS' :
                            syncStatusForViewport === 'outdated' ? 'Reference needs update' :
                            'No reference set'
                          }
                        </Typography>
                      </Alert>

                      {/* Screenshot Display */}
                      {hasScreenshot ? (
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                            Current Reference:
                          </Typography>
                          <Box sx={{ 
                            border: '2px solid',
                            borderColor: 'grey.200',
                            borderRadius: 2,
                            overflow: 'hidden'
                          }}>
                            <img
                              src={screenshots[0]}
                              alt={`${viewport.label} reference`}
                              style={{
                                width: '100%',
                                height: 'auto',
                                display: 'block'
                              }}
                            />
                          </Box>
                          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                            <Button
                              variant="outlined"
                              color="error"
                              onClick={() => deleteScreenshot(viewport.label)}
                              startIcon={<Delete />}
                              size="small"
                              sx={{ borderRadius: 2 }}
                            >
                              Delete
                            </Button>
                            <Button
                              variant="outlined"
                              onClick={() => viewScreenshot(screenshots[0])}
                              startIcon={<Visibility />}
                              size="small"
                              sx={{ borderRadius: 2 }}
                            >
                              View Full
                            </Button>
                          </Stack>
                        </Box>
                      ) : (
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}>
                            Upload Interface
                          </Typography>
                          
                          <Stack spacing={2}>
                            {/* Local File Upload */}
                            <Paper
                              sx={{
                                border: '2px dashed',
                                borderColor: 'grey.300',
                                borderRadius: 2,
                                p: 2,
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                  borderColor: 'primary.main',
                                  bgcolor: 'action.hover'
                                }
                              }}
                              onClick={() => document.getElementById(`file-input-${viewport.label}`).click()}
                            >
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files[0]
                                  if (file) {
                                    handleFileSelect(viewport.label, file)
                                  }
                                }}
                                style={{ display: 'none' }}
                                id={`file-input-${viewport.label}`}
                              />
                              
                              <Stack alignItems="center" spacing={1}>
                                <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                                  {isUploading ? <CircularProgress size={20} color="inherit" /> : <CloudUpload />}
                                </Avatar>
                                <Typography variant="subtitle1" fontWeight="bold">
                                  {isUploading ? 'Uploading...' : 'Upload Local File'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Select image from your computer
                                </Typography>
                              </Stack>
                            </Paper>

                            {/* Figma Integration */}
                            <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: 'info.50' }}>
                              <CardContent sx={{ p: 3, textAlign: 'center' }}>
                                <Stack alignItems="center" spacing={2}>
                                  <Avatar sx={{ 
                                    bgcolor: 'info.main', 
                                    width: 48, 
                                    height: 48 
                                  }}>
                                    <LayersIcon />
                                  </Avatar>
                                  <Box>
                                    <Typography variant="h6" fontWeight="bold" color="info.main">
                                      Import from Figma
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      Connect to Figma and import designs directly
                                    </Typography>
                                  </Box>
                                  <Button
                                    variant="contained"
                                    onClick={() => {
                                      setCurrentViewport(viewport)
                                      setFigmaDialogOpen(true)
                                    }}
                                    disabled={isUploading}
                                    sx={{
                                      borderRadius: 2,
                                      px: 3,
                                      background: 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)',
                                      '&:hover': {
                                        background: 'linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)',
                                        transform: 'translateY(-1px)',
                                        boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
                                      }
                                    }}
                                  >
                                    Connect to Figma
                                  </Button>
                                </Stack>
                              </CardContent>
                            </Card>
                          </Stack>

                          <Typography variant="caption" color="primary" sx={{ 
                            fontWeight: 'bold', 
                            mt: 2, 
                            display: 'block', 
                            textAlign: 'center' 
                          }}>
                            Both options auto-sync as BackstopJS reference
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        </Box>
      )}

      {/* Figma Integration Dialog */}
      <Dialog
        open={figmaDialogOpen}
        onClose={() => setFigmaDialogOpen(false)}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: 3,
            boxShadow: '0 8px 40px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)',
          color: 'white',
          p: 3
        }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
              <LayersIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Import from Figma
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {currentViewport ? `For ${currentViewport.label} (${currentViewport.width}×${currentViewport.height})` : ''}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0 }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Connect" />
            <Tab label="Browse Layers" disabled={!figmaToken || !figmaFileKey} />
          </Tabs>
          
          {tabValue === 0 && (
            <Box sx={{ p: 3 }}>
              <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                Connect your Figma account to import designs directly as reference screenshots.
              </Alert>
              
              <Stack spacing={3}>
                <TextField
                  label="Figma Access Token"
                  value={figmaToken}
                  onChange={(e) => setFigmaToken(e.target.value)}
                  fullWidth
                  type="password"
                  helperText="Get your token from Figma Settings > Account > Personal access tokens"
                />
                
                <TextField
                  label="Figma File Key"
                  value={figmaFileKey}
                  onChange={(e) => setFigmaFileKey(e.target.value)}
                  fullWidth
                  helperText="Extract from your Figma file URL"
                />
              </Stack>
            </Box>
          )}
          
          {tabValue === 1 && (
            <Box sx={{ p: 3, maxHeight: 500, overflow: 'auto' }}>
              {/* Layer Browser Content */}
              {loadingLayers ? (
                <Stack spacing={2}>
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} variant="rectangular" height={60} />
                  ))}
                </Stack>
              ) : (
                <List>
                  {filteredLayers.map((layer) => (
                    <ListItem key={layer.id} disablePadding>
                      <ListItemButton
                        onClick={() => setSelectedLayer(layer)}
                        selected={selectedLayer?.id === layer.id}
                        sx={{ borderRadius: 1, mb: 1 }}
                      >
                        <ListItemAvatar>
                          <Avatar variant="rounded" sx={{ bgcolor: 'grey.300' }}>
                            <LayersIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={layer.name}
                          secondary={`${layer.type} • ${Math.round(layer.absoluteBoundingBox?.width || 0)}×${Math.round(layer.absoluteBoundingBox?.height || 0)}`}
                        />
                        <Chip
                          label={layer.type}
                          size="small"
                          variant="outlined"
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                  
                  {filteredLayers.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No layers found. Connect to Figma to browse available layers.
                      </Typography>
                    </Box>
                  )}
                </List>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ 
          bgcolor: '#fff', 
          borderTop: '1px solid #e0e0e0',
          p: 3,
          gap: 2
        }}>
          <Button 
            onClick={() => setFigmaDialogOpen(false)}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          
          {tabValue === 0 && (
            <Button
              onClick={async () => {
                localStorage.setItem('figmaToken', figmaToken)
                localStorage.setItem('figmaFileKey', figmaFileKey)
                await loadFigmaLayers()
                setTabValue(1)
              }}
              variant="contained"
              disabled={!figmaToken || !figmaFileKey || loadingLayers}
              sx={{
                borderRadius: 2,
                background: 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)'
              }}
            >
              {loadingLayers ? 'Connecting...' : 'Connect & Browse'}
            </Button>
          )}
          
          {tabValue === 1 && selectedLayer && (
            <Button
              variant="contained"
              onClick={selectFigmaLayer}
              disabled={!selectedLayer || uploading[currentViewport?.label]}
              startIcon={uploading[currentViewport?.label] ? <CircularProgress size={16} /> : <GetApp />}
              sx={{
                borderRadius: 2,
                background: 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)'
              }}
            >
              {uploading[currentViewport?.label] ? 'Importing...' : 'Import Selected Layer'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default ScreenshotUploader
