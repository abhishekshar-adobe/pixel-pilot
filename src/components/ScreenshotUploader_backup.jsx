import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  Grid,
  Paper,
  MenuItem,
  Stack,
  CircularProgress,
  Chip,
  Avatar,
  Select,
  FormControl,
  InputLabel,
  CardMedia,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Skeleton,
  Checkbox,
  FormControlLabel,
  Divider,
  Badge
} from '@mui/material'
import {
  CloudUpload,
  Visibility,
  Delete,
  CheckCircle,
  Image as ImageIcon,
  Sync,
  SyncProblem,
  Warning,
  AccountTree,
  Search,
  FilterAlt,
  Close,
  GetApp,
  Layers as LayersIcon
} from '@mui/icons-material'

const API_BASE = 'http://localhost:5000/api'

function ScreenshotUploader() {
  const [config, setConfig] = useState(null)
  const [selectedScenario, setSelectedScenario] = useState('')
  const [uploading, setUploading] = useState({})
  const [syncing, setSyncing] = useState({})
  const [syncStatus, setSyncStatus] = useState({})
  const [message, setMessage] = useState('')
  const [viewportData, setViewportData] = useState({})
  
  // Figma integration state
  const [figmaDialogOpen, setFigmaDialogOpen] = useState(false)
  const [currentViewport, setCurrentViewport] = useState(null)
  const [figmaToken, setFigmaToken] = useState('')
  const [figmaFileKey, setFigmaFileKey] = useState('')
  const [figmaLayers, setFigmaLayers] = useState([])
  const [filteredLayers, setFilteredLayers] = useState([])
  const [loadingLayers, setLoadingLayers] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [layerTypeFilter, setLayerTypeFilter] = useState('all')
  const [showFramesOnly, setShowFramesOnly] = useState(false)
  const [selectedLayer, setSelectedLayer] = useState(null)
  const [layerThumbnails, setLayerThumbnails] = useState({})
  const [loadingThumbnails, setLoadingThumbnails] = useState(false)
  const [tabValue, setTabValue] = useState(0)
  const [layerFilterSummary, setLayerFilterSummary] = useState(null)

  useEffect(() => {
    loadConfig()
    loadFigmaCredentials()
  }, [])

  const loadConfig = async () => {
    try {
      const response = await axios.get(`${API_BASE}/config`)
      setConfig(response.data)
    } catch (error) {
      setMessage(`Error loading config: ${error.message}`)
    }
  }

  const loadFigmaCredentials = () => {
    // Load saved Figma credentials from localStorage
    const savedToken = localStorage.getItem('figmaAccessToken')
    const savedFileKey = localStorage.getItem('figmaFileKey')
    
    if (savedToken) setFigmaToken(savedToken)
    if (savedFileKey) setFigmaFileKey(savedFileKey)
  }

  const loadViewportData = async () => {
    if (!selectedScenario || !config?.viewports) return
    
    try {
      const data = {}
      for (const viewport of config.viewports) {
        try {
          const response = await axios.get(`${API_BASE}/scenario-screenshots/${encodeURIComponent(selectedScenario)}/${encodeURIComponent(viewport.label)}`)
          data[viewport.label] = response.data
        } catch {
          data[viewport.label] = { screenshots: [] }
        }
      }
      setViewportData(data)
    } catch (error) {
      console.error('Error loading viewport data:', error)
    }
  }

  useEffect(() => {
    if (selectedScenario && config?.viewports) {
      loadViewportData()
      checkSyncStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScenario, config])

  const handleFileSelect = (viewportLabel, file) => {
    if (file && file.type.startsWith('image/')) {
      uploadScreenshot(viewportLabel, file)
    } else {
      setMessage('Please select a valid image file')
    }
  }

  const uploadScreenshot = async (viewportLabel, file) => {
    console.log('uploadScreenshot called:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      viewportLabel,
      selectedScenario,
      existingScreenshots: viewportData[viewportLabel]?.screenshots?.length || 0
    })

    if (!file || !selectedScenario || !viewportLabel) {
      console.error('Missing required parameters:', { file: !!file, selectedScenario, viewportLabel })
      setMessage('Please select a file and scenario')
      return
    }

    // Check if there's already a screenshot for this configuration
    if (viewportData[viewportLabel]?.screenshots?.length > 0) {
      console.warn('Existing screenshot found, blocking upload')
      setMessage(`A screenshot already exists for ${viewportLabel}. Please delete it first.`)
      return
    }

    setUploading(prev => ({ ...prev, [viewportLabel]: true }))
    
    try {
      const formData = new FormData()
      formData.append('screenshot', file)
      formData.append('scenario', selectedScenario)
      formData.append('viewport', viewportLabel)
      formData.append('isReference', 'true') // Always set as reference

      console.log('Sending upload request with:', {
        fileName: file.name,
        scenario: selectedScenario,
        viewport: viewportLabel,
        fileSize: file.size
      })

      const response = await axios.post(`${API_BASE}/upload-screenshot`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      console.log('Upload response:', response.data)
      setMessage(`✅ Reference screenshot uploaded and synced successfully for ${viewportLabel}!`)
      
      // Reload viewport data and check sync status
      await loadViewportData()
      await checkSyncStatus(viewportLabel)
      
    } catch (error) {
      console.error('Upload error:', error)
      setMessage(`Error uploading screenshot: ${error.message}`)
    } finally {
      setUploading(prev => ({ ...prev, [viewportLabel]: false }))
    }
  }

  const checkSyncStatus = async (viewportLabel = null) => {
    if (!selectedScenario) return

    try {
      const viewportsToCheck = viewportLabel ? [viewportLabel] : config?.viewports?.map(v => v.label) || []
      
      for (const viewport of viewportsToCheck) {
        const response = await axios.get(`${API_BASE}/sync-status/${encodeURIComponent(selectedScenario)}/${encodeURIComponent(viewport)}`)
        setSyncStatus(prev => ({
          ...prev,
          [`${selectedScenario}_${viewport}`]: response.data
        }))
      }
    } catch (error) {
      console.error('Error checking sync status:', error)
    }
  }

  const manualSync = async (viewportLabel) => {
    if (!selectedScenario || !viewportLabel) return

    setSyncing(prev => ({ ...prev, [viewportLabel]: true }))
    
    try {
      const response = await axios.post(`${API_BASE}/sync-reference`, {
        scenario: selectedScenario,
        viewport: viewportLabel
      })

      setMessage(`✅ Manual sync completed for ${viewportLabel}: ${response.data.message}`)
      await checkSyncStatus(viewportLabel)
      
    } catch (error) {
      setMessage(`❌ Sync failed for ${viewportLabel}: ${error.response?.data?.error || error.message}`)
    } finally {
      setSyncing(prev => ({ ...prev, [viewportLabel]: false }))
    }
  }

  const getSyncStatusIcon = (viewportLabel) => {
    const statusKey = `${selectedScenario}_${viewportLabel}`
    const status = syncStatus[statusKey]
    
    if (!status) return null
    
    if (status.synced) {
      return <CheckCircle color="success" fontSize="small" />
    } else if (status.hasReference) {
      return <Warning color="warning" fontSize="small" />
    } else {
      return <SyncProblem color="error" fontSize="small" />
    }
  }

  const getSyncStatusText = (viewportLabel) => {
    const statusKey = `${selectedScenario}_${viewportLabel}`
    const status = syncStatus[statusKey]
    
    if (!status) return 'Unknown'
    
    if (status.synced) {
      return 'Synced to BackstopJS'
    } else if (status.hasReference) {
      return 'Not synced to BackstopJS'
    } else {
      return 'No reference image'
    }
  }

  const deleteScreenshot = async (viewportLabel, filename) => {
    try {
      await axios.delete(`${API_BASE}/scenario-screenshots/${encodeURIComponent(selectedScenario)}/${encodeURIComponent(viewportLabel)}/${filename}`)
      setMessage(`Screenshot and synced reference image deleted successfully for ${viewportLabel}`)
      await loadViewportData()
      await checkSyncStatus(viewportLabel)
    } catch (error) {
      setMessage(`Error deleting screenshot: ${error.message}`)
    }
  }

  // Figma integration functions
  const openFigmaDialog = (viewport) => {
    setCurrentViewport(viewport)
    setFigmaDialogOpen(true)
    setTabValue(0)
    setSelectedLayer(null)
    
    if (figmaToken && figmaFileKey) {
      loadFigmaLayers()
    }
  }

  const loadFigmaLayers = async () => {
    if (!figmaToken || !figmaFileKey) return

    setLoadingLayers(true)
    try {
      const response = await axios.get(`${API_BASE}/design-comparison/layers`, {
        headers: {
          'X-Figma-Token': figmaToken
        },
        params: {
          fileId: figmaFileKey,
          mainOnly: 'true', // Use refined filtering strategy
          minWidth: '100',
          minHeight: '100',
          includeInvisible: 'false'
        }
      })

      // Handle new API response structure
      const layersData = response.data.layers || response.data
      const summary = response.data.summary

      console.log('Loaded Figma layers:', {
        totalLayers: layersData.length,
        filterStrategy: summary?.filterStrategy,
        appliedFilters: summary?.appliedFilters
      })

      setFigmaLayers(layersData)
      setFilteredLayers(layersData)
      setLayerFilterSummary(summary) // Store summary for UI display
      loadLayerThumbnails(layersData)
    } catch (error) {
      setMessage(`Error loading Figma layers: ${error.message}`)
    } finally {
      setLoadingLayers(false)
    }
  }

  const loadLayerThumbnails = async (layers) => {
    if (!layers || layers.length === 0) return

    setLoadingThumbnails(true)
    try {
      const layerIds = layers.map(layer => layer.id)
      const response = await axios.post(`${API_BASE}/design-comparison/layer-thumbnails`, {
        layerIds,
        size: 'medium',
        fileId: figmaFileKey // Add fileId to request
      }, {
        headers: {
          'X-Figma-Token': figmaToken // Add token header
        }
      })

      // Handle the new response format where each thumbnail is an object with url property
      const thumbnailUrls = {}
      Object.entries(response.data.thumbnails || {}).forEach(([layerId, thumbnailData]) => {
        if (thumbnailData && thumbnailData.url) {
          thumbnailUrls[layerId] = thumbnailData.url
        }
      })

      setLayerThumbnails(thumbnailUrls)
    } catch (error) {
      console.error('Error loading thumbnails:', error)
    } finally {
      setLoadingThumbnails(false)
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

    // Sort frames first for better UX
    filtered.sort((a, b) => {
      if (a.type === 'FRAME' && b.type !== 'FRAME') return -1
      if (a.type !== 'FRAME' && b.type === 'FRAME') return 1
      return a.name.localeCompare(b.name)
    })

    setFilteredLayers(filtered)
  }

  useEffect(() => {
    filterLayers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, layerTypeFilter, showFramesOnly, figmaLayers])

  const selectFigmaLayer = async () => {
    if (!selectedLayer || !currentViewport) return

    setUploading(prev => ({ ...prev, [currentViewport.label]: true }))

    try {
      console.log(`Importing Figma layer: ${selectedLayer.name} (${selectedLayer.id})`)
      console.log('Figma credentials:', {
        hasToken: !!figmaToken,
        tokenLength: figmaToken ? figmaToken.length : 0,
        hasFileKey: !!figmaFileKey,
        fileKey: figmaFileKey
      })
      
      // Validate required fields before making request
      if (!figmaToken) {
        throw new Error('Figma access token is required. Please configure Figma settings first.')
      }
      
      if (!figmaFileKey) {
        throw new Error('Figma file key is required. Please configure Figma settings first.')
      }
      
      // Use the reliable backend download approach
      const downloadResponse = await axios.post(`${API_BASE}/design-comparison/download-figma-layer`, {
        layerId: selectedLayer.id,
        layerName: selectedLayer.name,
        fileId: figmaFileKey // Include the file ID in the request
      }, {
        headers: {
          'X-Figma-Token': figmaToken,
          'Content-Type': 'application/json'
        }
      })

      if (!downloadResponse.data.success || !downloadResponse.data.imageData) {
        throw new Error(downloadResponse.data.error || 'Failed to download image from Figma')
      }

      // Convert base64 data to blob
      const base64Data = downloadResponse.data.imageData.split(',')[1] // Remove data:image/png;base64, prefix
      
      console.log('Base64 conversion:', {
        originalSize: downloadResponse.data.size,
        base64Length: base64Data.length,
        expectedBase64Length: Math.ceil(downloadResponse.data.size * 4/3) // Base64 is ~33% larger
      });
      
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      
      // Create blob with correct MIME type
      const imageBlob = new Blob([bytes], { type: 'image/png' })
      
      console.log('Blob creation:', {
        originalSize: downloadResponse.data.size,
        binaryStringLength: binaryString.length,
        bytesLength: bytes.length,
        blobSize: imageBlob.size,
        sizesMatch: imageBlob.size === downloadResponse.data.size
      });
      
      // Verify the blob is valid
      if (imageBlob.size === 0) {
        throw new Error('Downloaded image is empty')
      }
      
      if (imageBlob.size !== downloadResponse.data.size) {
        console.error('Size mismatch detected:', {
          expected: downloadResponse.data.size,
          actual: imageBlob.size,
          difference: Math.abs(imageBlob.size - downloadResponse.data.size)
        });
        // Don't throw error, but log the discrepancy
      }

      // Create a proper File object
      const fileName = downloadResponse.data.fileName || `${selectedLayer.name.replace(/[^a-zA-Z0-9]/g, '_')}_figma.png`
      const file = new File([imageBlob], fileName, { 
        type: 'image/png',
        lastModified: Date.now()
      })
      
      console.log(`Created file: ${fileName}, Size: ${file.size} bytes, Type: ${file.type}`)
      console.log('File validation:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        blobSize: imageBlob.size,
        blobType: imageBlob.type
      })
      
      // Additional validation
      if (file.size === 0) {
        throw new Error('Created file has zero size')
      }
      
      if (file.size !== imageBlob.size) {
        console.warn('File size mismatch:', { fileSize: file.size, blobSize: imageBlob.size })
      }
      
      // Upload as screenshot using the existing upload function
      await uploadScreenshot(currentViewport.label, file)
      
      setFigmaDialogOpen(false)
      setMessage(`✅ Figma layer "${selectedLayer.name}" uploaded successfully for ${currentViewport.label}!`)
    } catch (error) {
      console.error('Figma import error:', error)
      setMessage(`Error importing from Figma: ${error.message}`)
    } finally {
      setUploading(prev => ({ ...prev, [currentViewport.label]: false }))
    }
  }

  const saveFigmaCredentials = () => {
    console.log('Saving Figma credentials:', {
      hasToken: !!figmaToken,
      tokenLength: figmaToken ? figmaToken.length : 0,
      hasFileKey: !!figmaFileKey,
      fileKey: figmaFileKey
    })
    
    if (!figmaToken || !figmaFileKey) {
      setMessage('Please enter both Figma access token and file key')
      return
    }
    
    localStorage.setItem('figmaAccessToken', figmaToken)
    localStorage.setItem('figmaFileKey', figmaFileKey)
    
    setMessage('Figma credentials saved successfully!')
    
    // Switch to layer selection tab and load layers
    setTabValue(1)
    if (figmaToken && figmaFileKey) {
      loadFigmaLayers()
    }
  }

  const getLayerTypeIcon = (type) => {
    switch (type) {
      case 'FRAME': return '🖼️'
      case 'GROUP': return '📁'
      case 'TEXT': return '📝'
      case 'RECTANGLE': return '▭'
      case 'ELLIPSE': return '⭕'
      case 'COMPONENT': return '🧩'
      case 'INSTANCE': return '📋'
      default: return '📄'
    }
  }

  if (!config) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <CircularProgress />
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
                <ImageIcon sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {Object.values(viewportData).reduce((total, viewport) => total + (viewport.screenshots?.length || 0), 0)}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Total Screenshots
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
                <CheckCircle sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {Object.values(syncStatus).filter(status => status === 'synced').length}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Synced References
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white',
              height: '100%'
            }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <AccountTree sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {config?.viewports?.length || 0}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Available Viewports
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: selectedScenario 
                ? 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
                : 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
              color: selectedScenario ? '#8B4513' : 'white',
              height: '100%'
            }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                {selectedScenario ? (
                  <CheckCircle sx={{ fontSize: 32, mb: 1 }} />
                ) : (
                  <Warning sx={{ fontSize: 32, mb: 1 }} />
                )}
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {selectedScenario ? 'Selected' : 'Select Scenario'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Current Status
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Message Alert */}
        {message && (
          <Alert 
            severity={message.includes('Error') ? 'error' : 'success'}
            sx={{ 
              mb: 3,
              borderRadius: 2,
              '& .MuiAlert-icon': { fontSize: 24 },
              '& .MuiAlert-message': { fontSize: '1rem' }
            }}
            onClose={() => setMessage('')}
          >
            {message}
          </Alert>
        )}
      </Box>

      {/* Scenario Selection Card */}
      <Card sx={{ 
        mb: 4,
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        border: '1px solid',
        borderColor: 'divider'
      }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
            <Avatar sx={{ bgcolor: 'secondary.main' }}>
              <AccountTree />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Scenario Selection
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Choose a scenario to upload reference screenshots for visual regression testing
              </Typography>
            </Box>
          </Stack>
          
          <Alert 
            severity="info" 
            sx={{ 
              mb: 3,
              borderRadius: 2,
              bgcolor: 'info.50',
              border: '1px solid',
              borderColor: 'info.200'
            }}
          >
            <Typography variant="body2">
              <strong>Auto-Reference Mode:</strong> All uploaded images are automatically saved as reference screenshots 
              for the selected viewport and synced with BackstopJS for visual regression testing.
            </Typography>
          </Alert>
          
          <FormControl fullWidth>
            <InputLabel>Select Scenario</InputLabel>
            <Select
              value={selectedScenario}
              label="Select Scenario"
              onChange={(e) => setSelectedScenario(e.target.value)}
              sx={{ borderRadius: 2 }}
            >
              {config?.scenarios?.map((scenario, index) => (
                <MenuItem key={index} value={scenario.label}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: '0.75rem' }}>
                      {index + 1}
                    </Avatar>
                    <Box>
                      <Typography variant="body1">{scenario.label}</Typography>
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

      {/* Viewports Grid */}
      {selectedScenario && config?.viewports && (
        <Box>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            <LayersIcon sx={{ mr: 1 }} />
            Viewport Screenshots
          </Typography>
          
          <Grid container spacing={3}>
            {config.viewports.map((viewport, index) => {
              const viewportScreenshots = viewportData[viewport.label]?.screenshots || []
              const hasScreenshot = viewportScreenshots.length > 0
              const isUploading = uploading[viewport.label]
              const syncStatusForViewport = syncStatus[viewport.label]

              return (
                <Grid item xs={12} md={6} lg={4} key={index}>
                  <Card sx={{ 
                    borderRadius: 3,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    border: '1px solid',
                    borderColor: hasScreenshot ? 'success.main' : 'divider',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.15)'
                    },
                    transition: 'all 0.3s ease'
                  }}>
                    {/* Card Header */}
                    <Box sx={{ 
                      background: hasScreenshot 
                        ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      p: 2,
                      borderRadius: '12px 12px 0 0'
                    }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <ImageIcon />
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {viewport.label}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1}>
                          <Chip 
                            label={`${viewport.width}×${viewport.height}`}
                            size="small"
                            sx={{ 
                              bgcolor: 'rgba(255,255,255,0.15)',
                              color: 'white',
                              border: '1px solid rgba(255,255,255,0.3)'
                            }}
                          />
                          {hasScreenshot && (
                            <Chip 
                              icon={<CheckCircle />}
                              label="Has Image"
                              size="small"
                              sx={{ 
                                bgcolor: 'rgba(255,255,255,0.15)',
                                color: 'white',
                                border: '1px solid rgba(255,255,255,0.3)'
                              }}
                            />
                          )}
                        </Stack>
                      </Stack>
                    </Box>

                    <CardContent sx={{ flex: 1, p: 3 }}>
                      {/* Existing Screenshot */}
                      {hasScreenshot && (
                        <Box sx={{ mb: 3 }}>
                          <Card 
                            variant="outlined" 
                            sx={{ 
                              border: 2, 
                              borderColor: 'success.main',
                              borderRadius: 2,
                              overflow: 'hidden'
                            }}
                          >
                            <CardMedia
                              component="img"
                              height="180"
                              image={`http://localhost:5000/uploads/${viewportScreenshots[0].filename}`}
                              alt={viewportScreenshots[0].originalName}
                              sx={{ objectFit: 'contain', bgcolor: 'grey.50' }}
                            />
                            <CardContent sx={{ p: 2 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.5 }}>
                                    {viewportScreenshots[0].originalName}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    Uploaded {new Date(viewportScreenshots[0].uploadedAt).toLocaleDateString()}
                                  </Typography>
                                </Box>
                                <Chip 
                                  label="Reference" 
                                  color="success" 
                                  size="small" 
                                  icon={<CheckCircle />}
                                />
                              </Box>
                              
                              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                                <Button
                                  variant="outlined"
                                  color="error"
                                  startIcon={<Delete />}
                                  onClick={() => deleteScreenshot(viewport.label, viewportScreenshots[0].filename)}
                                  size="small"
                                  sx={{ flex: 1, borderRadius: 2 }}
                                >
                                  Delete
                                </Button>
                                <Button
                                  variant="outlined"
                                  startIcon={<Visibility />}
                                  onClick={() => window.open(`http://localhost:5000/uploads/${viewportScreenshots[0].filename}`, '_blank')}
                                  size="small"
                                  sx={{ flex: 1, borderRadius: 2 }}
                                >
                                  View
                                </Button>
                              </Stack>

                              {/* Sync Status */}
                              <Card variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                  <Stack direction="row" alignItems="center" spacing={1}>
                                    {getSyncStatusIcon(viewport.label)}
                                    <Typography variant="caption" fontWeight={500}>
                                      {getSyncStatusText(viewport.label)}
                                    </Typography>
                                  </Stack>
                                </Stack>
                                <Button
                                  variant="contained"
                                  size="small"
                                  startIcon={syncing[viewport.label] ? <CircularProgress size={16} color="inherit" /> : <Sync />}
                                  onClick={() => manualSync(viewport.label)}
                                  disabled={syncing[viewport.label]}
                                  fullWidth
                                  sx={{ 
                                    borderRadius: 2,
                                    fontSize: '0.75rem',
                                    background: syncStatusForViewport === 'synced' 
                                      ? 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)'
                                      : 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)'
                                  }}
                                >
                                  {syncing[viewport.label] ? 'Syncing...' : 'Sync to BackstopJS'}
                                </Button>
                              </Card>
                            </CardContent>
                          </Card>
                        </Box>
                      )}

                      {/* Upload Section */}
                      {!hasScreenshot && (
                        <Box>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                            <CloudUpload sx={{ mr: 1 }} />
                            Add Reference Image
                          </Typography>
                          
                          <Stack spacing={3}>
                            {/* Local File Upload */}
                            <Card
                              variant="outlined"
                              sx={{
                                border: '2px dashed',
                                borderColor: 'grey.300',
                                borderRadius: 3,
                                p: 3,
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                bgcolor: 'grey.50',
                                '&:hover': {
                                  borderColor: 'primary.main',
                                  bgcolor: 'primary.50',
                                  transform: 'translateY(-2px)',
                                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)'
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
                              
                              <Stack alignItems="center" spacing={2}>
                                <Avatar sx={{ 
                                  bgcolor: 'primary.main', 
                                  width: 56, 
                                  height: 56,
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                }}>
                                  {isUploading ? <CircularProgress size={24} color="inherit" /> : <CloudUpload />}
                                </Avatar>
                                <Box>
                                  <Typography variant="h6" fontWeight="bold" color="text.primary">
                                    {isUploading ? 'Uploading...' : 'Upload Local File'}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {isUploading ? 'Please wait while we process your image' : 'Click to select an image file from your computer'}
                                  </Typography>
                                </Box>
                              </Stack>
                            </Card>

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

                          {/* Figma Layer Selection */}
                          <Paper
                            sx={{
                              border: '2px dashed',
                              borderColor: 'secondary.main',
                              borderRadius: 2,
                              p: 2,
                              textAlign: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                borderColor: 'secondary.dark',
                                bgcolor: 'action.hover'
                              }
                            }}
                            onClick={() => openFigmaDialog(viewport)}
                          >
                            <Stack alignItems="center" spacing={1}>
                              <Avatar sx={{ bgcolor: 'secondary.main', width: 40, height: 40 }}>
                                <LayersIcon />
                              </Avatar>
                              <Typography variant="subtitle1" fontWeight="bold">
                                Select from Figma
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Choose layer from Figma design
                              </Typography>
                            </Stack>
                          </Paper>
                        </Stack>

                        <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold', mt: 2, display: 'block', textAlign: 'center' }}>
                          Both options auto-sync as BackstopJS reference
                        </Typography>
                      </Box>
                    )}

                    {/* Status Information */}
                    {hasScreenshot && (
                      <Alert severity="info" sx={{ mt: 2 }}>
                        <Typography variant="body2">
                          <strong>Current Reference:</strong> One reference screenshot is active for this viewport. 
                          Delete it to upload a new reference image that will automatically sync with BackstopJS.
                        </Typography>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}

      {!selectedScenario && (
        <Alert severity="info" sx={{ mt: 3 }}>
          Please select a scenario to view viewport upload options.
        </Alert>
      )}

      {/* Figma Layer Selection Dialog */}
      <Dialog 
        open={figmaDialogOpen} 
        onClose={() => setFigmaDialogOpen(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh',
            bgcolor: '#f8f9fa'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#fff', 
          borderBottom: '1px solid #e0e0e0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 1000
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                🎨 Select Figma Layer for {currentViewport?.label}
              </Typography>
            </Box>
            <Button
              onClick={() => setFigmaDialogOpen(false)}
              size="large"
              sx={{ minWidth: 'auto', p: 1.5 }}
            >
              <Close />
            </Button>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ 
          bgcolor: '#f8f9fa', 
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <Box sx={{ 
            bgcolor: '#fff', 
            borderRadius: 2, 
            mb: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <Tabs 
              value={tabValue} 
              onChange={(e, v) => setTabValue(v)} 
              sx={{ 
                '& .MuiTab-root': { 
                  fontSize: '1rem', 
                  fontWeight: 'bold',
                  minHeight: 64
                }
              }}
            >
              <Tab label="🔧 Figma Settings" />
              <Tab label="🖼️ Layer Selection" disabled={!figmaToken || !figmaFileKey} />
            </Tabs>
          </Box>

          {/* Tab 0: Figma Settings */}
          {tabValue === 0 && (
            <Box sx={{ 
              bgcolor: '#fff', 
              p: 4, 
              borderRadius: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <Stack spacing={4}>
                <Alert severity="info" sx={{ fontSize: '1rem' }}>
                  🔐 Enter your Figma credentials to access layers. These will be saved locally for convenience.
                </Alert>
                
                <TextField
                  label="Figma Access Token"
                  type="password"
                  value={figmaToken}
                  onChange={(e) => setFigmaToken(e.target.value)}
                  placeholder="Enter your Figma personal access token"
                  fullWidth
                  size="large"
                  helperText="🔑 Get your token from Figma Account Settings > Personal Access Tokens"
                />
                
                <TextField
                  label="Figma File Key"
                  value={figmaFileKey}
                  onChange={(e) => setFigmaFileKey(e.target.value)}
                  placeholder="e.g., ABC123def456 (from figma.com/file/ABC123def456/...)"
                  fullWidth
                  size="large"
                  helperText="📋 Copy the file key from your Figma file URL"
                />
                
                <Button
                  variant="contained"
                  onClick={saveFigmaCredentials}
                  disabled={!figmaToken || !figmaFileKey}
                  size="large"
                  sx={{ alignSelf: 'flex-start', px: 4, py: 1.5 }}
                >
                  💾 Save & Load Layers
                </Button>
              </Stack>
            </Box>
          )}

          {/* Tab 1: Layer Selection */}
          {tabValue === 1 && (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Search and Filters */}
              <Box sx={{ 
                bgcolor: '#fff', 
                p: 3, 
                borderRadius: 2, 
                mb: 3,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      size="large"
                      placeholder="🔍 Search layers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="large">
                      <InputLabel>Layer Type</InputLabel>
                      <Select
                        value={layerTypeFilter}
                        label="Layer Type"
                        onChange={(e) => setLayerTypeFilter(e.target.value)}
                      >
                        <MenuItem value="all">All Types</MenuItem>
                        <MenuItem value="FRAME">🖼️ Frames</MenuItem>
                        <MenuItem value="GROUP">📁 Groups</MenuItem>
                        <MenuItem value="TEXT">📝 Text</MenuItem>
                        <MenuItem value="COMPONENT">🧩 Components</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} md={3}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', height: '100%' }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={showFramesOnly}
                            onChange={(e) => setShowFramesOnly(e.target.checked)}
                          />
                        }
                        label="Frames Only"
                      />
                      <Chip 
                        icon={<FilterAlt />}
                        label={`${filteredLayers.length} layers`}
                        color="primary"
                        variant="outlined"
                      />
                      {layerFilterSummary?.comparisonStats && (
                        <Chip 
                          label={`${layerFilterSummary.comparisonStats.percentageKept}% kept`}
                          color="success"
                          variant="outlined"
                          size="small"
                          title={`Filtered out ${layerFilterSummary.comparisonStats.filteredOut} layers from ${layerFilterSummary.totalAllLayers} total`}
                        />
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Layer Grid */}
              {loadingLayers ? (
                <Box sx={{ 
                  bgcolor: '#fff', 
                  p: 4, 
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <Grid container spacing={3}>
                    {[...Array(8)].map((_, i) => (
                      <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
                        <Skeleton 
                          variant="rectangular" 
                          height={200} 
                          sx={{ borderRadius: 2 }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ) : filteredLayers.length > 0 ? (
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                  <Grid container spacing={3}>
                    {filteredLayers.map((layer) => (
                      <Grid item xs={12} sm={6} md={4} lg={3} key={layer.id}>
                        <Card
                          sx={{
                            height: '100%',
                            cursor: 'pointer',
                            border: selectedLayer?.id === layer.id ? '3px solid #1976d2' : '1px solid #e0e0e0',
                            borderRadius: 2,
                            transition: 'all 0.3s ease',
                            bgcolor: selectedLayer?.id === layer.id ? '#e3f2fd' : '#fff',
                            '&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                              borderColor: '#1976d2'
                            },
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                          onClick={() => setSelectedLayer(layer)}
                        >
                          {/* Selection Indicator */}
                          {selectedLayer?.id === layer.id && (
                            <Box sx={{ 
                              position: 'absolute', 
                              top: 8, 
                              left: 8, 
                              zIndex: 2,
                              bgcolor: '#1976d2',
                              color: '#fff',
                              borderRadius: '50%',
                              p: 0.5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              ✓
                            </Box>
                          )}

                          {/* Layer Type Badge */}
                          <Box sx={{ 
                            position: 'absolute', 
                            top: 8, 
                            right: 8, 
                            zIndex: 2
                          }}>
                            <Stack spacing={1} alignItems="flex-end">
                              <Chip 
                                label={layer.type} 
                                size="small"
                                color={layer.type === 'FRAME' ? 'primary' : 'default'}
                                variant={layer.type === 'FRAME' ? 'filled' : 'outlined'}
                                sx={{
                                  fontWeight: 'bold',
                                  bgcolor: layer.type === 'FRAME' ? '#1976d2' : 'rgba(255,255,255,0.9)',
                                  color: layer.type === 'FRAME' ? '#fff' : '#666'
                                }}
                              />
                              {layer.width && layer.height && (
                                <Chip 
                                  label={`${Math.round(layer.width)}×${Math.round(layer.height)}`}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    fontSize: '0.7rem',
                                    height: 20,
                                    bgcolor: 'rgba(255,255,255,0.95)',
                                    color: '#666',
                                    fontWeight: 'bold'
                                  }}
                                />
                              )}
                            </Stack>
                          </Box>

                          {/* Layer Thumbnail */}
                          <Box sx={{ 
                            height: 160, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            bgcolor: '#f5f5f5',
                            position: 'relative',
                            overflow: 'hidden'
                          }}>
                            {loadingThumbnails ? (
                              <Skeleton 
                                variant="rectangular" 
                                width={80} 
                                height={80} 
                                sx={{ borderRadius: 1 }}
                              />
                            ) : layerThumbnails[layer.id] ? (
                              <Box
                                component="img"
                                src={layerThumbnails[layer.id]}
                                alt={layer.name}
                                sx={{
                                  maxWidth: '100%',
                                  maxHeight: '100%',
                                  objectFit: 'contain',
                                  borderRadius: 1,
                                  transition: 'transform 0.3s ease',
                                  '&:hover': {
                                    transform: 'scale(1.05)'
                                  }
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <Box
                                sx={{
                                  width: 60,
                                  height: 60,
                                  borderRadius: 2,
                                  backgroundColor: layer.type === 'FRAME' ? '#e3f2fd' : '#f5f5f5',
                                  border: layer.type === 'FRAME' ? '2px solid #1976d2' : '2px solid #e0e0e0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Typography 
                                  variant="h3"
                                  color={layer.type === 'FRAME' ? 'primary' : 'text.secondary'}
                                  sx={{ fontWeight: layer.type === 'FRAME' ? 'bold' : 'normal' }}
                                >
                                  {getLayerTypeIcon(layer.type)}
                                </Typography>
                              </Box>
                            )}
                          </Box>

                          {/* Layer Info */}
                          <CardContent sx={{ p: 2 }}>
                            <Typography 
                              variant="subtitle1" 
                              noWrap 
                              sx={{ 
                                fontWeight: 'bold',
                                mb: 1
                              }}
                              title={layer.name}
                            >
                              {layer.name}
                            </Typography>
                            
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                              <Box sx={{ 
                                bgcolor: '#f5f5f5', 
                                px: 1.5, 
                                py: 0.5, 
                                borderRadius: 1,
                                border: '1px solid #e0e0e0'
                              }}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                                  {Math.round(layer.width)} × {Math.round(layer.height)} px
                                </Typography>
                              </Box>
                              
                              {layer.type === 'FRAME' && (
                                <Box sx={{ 
                                  bgcolor: '#1976d2', 
                                  color: '#fff', 
                                  px: 1, 
                                  py: 0.5, 
                                  borderRadius: 1,
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold'
                                }}>
                                  FRAME
                                </Box>
                              )}
                            </Box>
                            
                            {/* Selection indicator */}
                            {selectedLayer?.id === layer.id && (
                              <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 1,
                                color: '#1976d2',
                                fontWeight: 'bold'
                              }}>
                                <Typography variant="caption">
                                  ✓ SELECTED FOR IMPORT
                                </Typography>
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ) : (
                <Box sx={{ 
                  textAlign: 'center', 
                  py: 8,
                  bgcolor: '#fff',
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                    🔍 No layers found
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Try adjusting your search or filters
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ 
          bgcolor: '#fff', 
          borderTop: '1px solid #e0e0e0',
          p: 3,
          position: 'sticky',
          bottom: 0,
          zIndex: 1000,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.1)'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Typography variant="body1" color="text.secondary">
              {selectedLayer && `Selected: ${selectedLayer.name}`}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button 
                onClick={() => setFigmaDialogOpen(false)}
                size="large"
                variant="outlined"
              >
                Cancel
              </Button>
              {tabValue === 1 && (
                <Button
                  variant="contained"
                  onClick={selectFigmaLayer}
                  disabled={!selectedLayer || uploading[currentViewport?.label]}
                  startIcon={uploading[currentViewport?.label] ? <CircularProgress size={16} /> : <GetApp />}
                  size="large"
                >
                  {uploading[currentViewport?.label] ? 'Importing...' : 'Import Selected Layer'}
                </Button>
              )}
            </Box>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default ScreenshotUploader
