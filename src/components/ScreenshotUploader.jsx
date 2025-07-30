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
  InputAdornment,
  Tooltip
} from '@mui/material'
import {
  CloudUpload,
  PhotoLibrary,
  SyncAlt,
  Devices,
  Tune,
  Web,
  Layers,
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
  const [figmaPages, setFigmaPages] = useState([])
  const [selectedPage, setSelectedPage] = useState(null)
  const [figmaLayers, setFigmaLayers] = useState([])
  const [filteredLayers, setFilteredLayers] = useState([])
  const [selectedLayer, setSelectedLayer] = useState(null)
  const [layerElements, setLayerElements] = useState([])
  const [selectedElement, setSelectedElement] = useState(null)
  const [loadingPages, setLoadingPages] = useState(false)
  const [loadingLayers, setLoadingLayers] = useState(false)
  const [loadingElements, setLoadingElements] = useState(false)
  const [loadingThumbnails, setLoadingThumbnails] = useState({}) // Changed to object for individual loading states
  const [layerThumbnails, setLayerThumbnails] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [layerTypeFilter, setLayerTypeFilter] = useState('all')
  const [showFramesOnly, setShowFramesOnly] = useState(false)
  const [layerFilterSummary, setLayerFilterSummary] = useState(null)
  
  // Pagination state for infinite scroll
  const [pagesPagination, setPagesPagination] = useState({
    currentPage: 1,
    itemsPerPage: 20,
    hasMore: true,
    totalItems: 0
  })
  const [layersPagination, setLayersPagination] = useState({
    currentPage: 1,
    itemsPerPage: 30,
    hasMore: true,
    totalItems: 0
  })
  const [elementsPagination, setElementsPagination] = useState({
    currentPage: 1,
    itemsPerPage: 30,
    hasMore: true,
    totalItems: 0
  })
  const [loadingMorePages, setLoadingMorePages] = useState(false)
  const [loadingMoreLayers, setLoadingMoreLayers] = useState(false)
  const [loadingMoreElements, setLoadingMoreElements] = useState(false)

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
      }
    } catch (error) {
      setMessage('Error loading configuration: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadViewportData = React.useCallback(async (viewportLabel) => {
    if (!selectedScenario) return
    
    try {
      const response = await axios.get(`${API_BASE}/scenario-screenshots/${selectedScenario}/${viewportLabel}`)
      setViewportData(prev => ({
        ...prev,
        [viewportLabel]: response.data
      }))
      
      // Check sync status
      const syncResponse = await axios.get(`${API_BASE}/sync-status/${selectedScenario}/${viewportLabel}`)
      setSyncStatus(prev => ({
        ...prev,
        [viewportLabel]: syncResponse.data.status
      }))
    } catch (error) {
      console.error(`Error loading data for ${viewportLabel}:`, error)
    }
  }, [selectedScenario])

  // Load viewport data when scenario changes
  useEffect(() => {
    if (selectedScenario && viewports.length > 0) {
      viewports.forEach(viewport => {
        loadViewportData(viewport.label)
      })
    }
  }, [selectedScenario, viewports, loadViewportData])

  const checkSyncStatus = async (viewportLabel) => {
    if (!selectedScenario) return
    
    try {
      const response = await axios.get(`${API_BASE}/sync-status/${selectedScenario}/${viewportLabel}`)
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
      formData.append('isReference', 'true') // Enable auto-sync to BackstopJS reference

      await axios.post(`${API_BASE}/upload-screenshot`, formData)
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
    if (!selectedScenario) return
    
    try {
      const data = viewportData[viewportLabel]
      if (data && data.screenshots && data.screenshots.length > 0) {
        const screenshot = data.screenshots[0]
        const filename = screenshot.filename || screenshot
        await axios.delete(`${API_BASE}/scenario-screenshots/${selectedScenario}/${viewportLabel}/${filename}`)
        setMessage(`✅ Screenshot deleted for ${viewportLabel}`)
        await loadViewportData(viewportLabel)
      }
    } catch (error) {
      setMessage(`❌ Error deleting screenshot: ${error.message}`)
    }
  }

  const manualSync = async (viewportLabel) => {
    if (!selectedScenario) return
    
    setUploading(prev => ({ ...prev, [viewportLabel]: true }))
    
    try {
      console.log('Sending sync request for:', { scenario: selectedScenario, viewport: viewportLabel });
      
      const response = await axios.post(`${API_BASE}/sync-reference`, {
        scenario: selectedScenario,
        viewport: viewportLabel
      })
      
      console.log('Sync response received:', response.data);
      console.log('Response status:', response.status);
      console.log('Response success field:', response.data.success);
      
      // Check for successful response
      if (response.status === 200 && response.data && response.data.success === true) {
        setMessage(`✅ Successfully synced ${viewportLabel} reference to BackstopJS`)
        console.log('Sync successful, checking status...');
        
        // Small delay before checking status to ensure backend has processed
        setTimeout(async () => {
          await checkSyncStatus(viewportLabel)
        }, 500);
        
      } else {
        console.log('Sync failed, response data:', response.data);
        const errorMsg = response.data?.error || response.data?.message || 'Unknown error';
        setMessage(`❌ Failed to sync: ${errorMsg}`)
      }
    } catch (error) {
      console.error(`Error syncing reference for ${viewportLabel}:`, error)
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      const errorMsg = error.response?.data?.error || error.message || 'Network error';
      setMessage(`❌ Error syncing reference: ${errorMsg}`)
    } finally {
      setUploading(prev => ({ ...prev, [viewportLabel]: false }))
    }
  }

  const viewScreenshot = (screenshotUrl) => {
    window.open(screenshotUrl, '_blank')
  }

  const loadFigmaPages = React.useCallback(async (loadMore = false) => {
    if (!figmaToken || !figmaFileKey) return

    const isLoadingMore = loadMore && pagesPagination.hasMore
    
    if (isLoadingMore) {
      setLoadingMorePages(true)
    } else {
      setLoadingPages(true)
      // Reset pagination for fresh load
      setPagesPagination({
        currentPage: 1,
        itemsPerPage: 20,
        hasMore: true,
        totalItems: 0
      })
    }

    try {
      const response = await axios.get(`${API_BASE}/design-comparison/pages`, {
        headers: {
          'X-Figma-Token': figmaToken
        },
        params: {
          fileId: figmaFileKey,
          page: isLoadingMore ? pagesPagination.currentPage + 1 : 1,
          limit: pagesPagination.itemsPerPage
        }
      })
      
      const pagesData = response.data.pages || []
      const totalItems = response.data.total || pagesData.length
      const hasMore = response.data.hasMore !== undefined ? 
        response.data.hasMore : 
        (pagesData.length === pagesPagination.itemsPerPage)

      if (isLoadingMore) {
        // Append new pages to existing ones
        setFigmaPages(prev => [...prev, ...pagesData])
        setPagesPagination(prev => ({
          ...prev,
          currentPage: prev.currentPage + 1,
          hasMore,
          totalItems
        }))
      } else {
        // Replace pages for fresh load
        setFigmaPages(pagesData)
        setPagesPagination(prev => ({
          ...prev,
          currentPage: 1,
          hasMore,
          totalItems
        }))
        
        // Auto-select first page if available and no page is selected
        if (pagesData.length > 0 && !selectedPage) {
          setSelectedPage(pagesData[0])
        }
      }
    } catch (error) {
      setMessage(`Error loading Figma pages: ${error.message}`)
    } finally {
      if (isLoadingMore) {
        setLoadingMorePages(false)
      } else {
        setLoadingPages(false)
      }
    }
  }, [figmaToken, figmaFileKey, pagesPagination, selectedPage, setMessage])

  const loadBulkThumbnails = React.useCallback(async (layerIds) => {
    if (!figmaToken || !figmaFileKey || !layerIds || layerIds.length === 0) return
    
    // Filter out layers that already have thumbnails or are loading
    const layersToLoad = layerIds.filter(id => !layerThumbnails[id] && !loadingThumbnails[id])
    if (layersToLoad.length === 0) return

    // Mark all layers as loading
    setLoadingThumbnails(prev => {
      const updated = { ...prev }
      layersToLoad.forEach(id => { updated[id] = true })
      return updated
    })
    
    try {
      const response = await axios.get(`${API_BASE}/design-comparison/bulk-thumbnails`, {
        headers: { 'X-Figma-Token': figmaToken },
        params: { 
          fileId: figmaFileKey, 
          ids: layersToLoad.join(','),
          scale: 0.5
        }
      })
      
      if (response.data.thumbnails) {
        setLayerThumbnails(prev => ({
          ...prev,
          ...response.data.thumbnails
        }))
      }
    } catch (error) {
      console.error(`Failed to load bulk thumbnails:`, error)
    } finally {
      // Clear loading state for all requested layers
      setLoadingThumbnails(prev => {
        const updated = { ...prev }
        layersToLoad.forEach(id => { delete updated[id] })
        return updated
      })
    }
  }, [figmaToken, figmaFileKey, layerThumbnails, loadingThumbnails])

  const loadSingleThumbnail = async (layerId) => {
    // Use bulk loading for single thumbnails too
    await loadBulkThumbnails([layerId])
  }

  const loadFigmaLayers = React.useCallback(async (pageId, loadMore = false) => {
    if (!figmaToken || !figmaFileKey || !pageId) return

    const isLoadingMore = loadMore && layersPagination.hasMore
    
    if (isLoadingMore) {
      setLoadingMoreLayers(true)
    } else {
      setLoadingLayers(true)
      // Reset pagination for fresh load
      setLayersPagination({
        currentPage: 1,
        itemsPerPage: 30,
        hasMore: true,
        totalItems: 0
      })
    }

    try {
      const response = await axios.get(`${API_BASE}/design-comparison/layers`, {
        headers: {
          'X-Figma-Token': figmaToken
        },
        params: {
          fileId: figmaFileKey,
          pageId: pageId,
          mainOnly: 'false',
          minWidth: '100',
          minHeight: '100',
          includeInvisible: 'false',
          page: isLoadingMore ? layersPagination.currentPage + 1 : 1,
          limit: layersPagination.itemsPerPage
        }
      })
      
      const layersData = response.data.layers || []
      const totalItems = response.data.total || layersData.length
      const hasMore = response.data.hasMore !== undefined ? 
        response.data.hasMore : 
        (layersData.length === layersPagination.itemsPerPage)
      
      const summary = response.data.summary || {
        total: totalItems,
        filtered: layersData.length,
        filterStrategy: 'none',
        appliedFilters: []
      }

      if (isLoadingMore) {
        // Append new layers to existing ones
        setFigmaLayers(prev => [...prev, ...layersData])
        setFilteredLayers(prev => [...prev, ...layersData])
        setLayersPagination(prev => ({
          ...prev,
          currentPage: prev.currentPage + 1,
          hasMore,
          totalItems
        }))
      } else {
        // Replace layers for fresh load
        setFigmaLayers(layersData)
        setFilteredLayers(layersData)
        setLayersPagination(prev => ({
          ...prev,
          currentPage: 1,
          hasMore,
          totalItems
        }))
        
        // Clear previous selections
        setSelectedLayer(null)
        setLayerElements([])
        setSelectedElement(null)
      }
      
      setLayerFilterSummary(summary)
      
      // Load thumbnails for the current batch of layers
      const layerIds = layersData.map(layer => layer.id).filter(Boolean)
      if (layerIds.length > 0) {
        // Load thumbnails asynchronously without blocking the UI
        loadBulkThumbnails(layerIds).catch(error => {
          console.error('Failed to load thumbnails for layers:', error)
        })
      }
    } catch (error) {
      setMessage(`Error loading Figma layers: ${error.message}`)
    } finally {
      if (isLoadingMore) {
        setLoadingMoreLayers(false)
      } else {
        setLoadingLayers(false)
      }
    }
  }, [figmaToken, figmaFileKey, layersPagination, setMessage, loadBulkThumbnails])

  const loadLayerElements = React.useCallback(async (layerId, loadMore = false) => {
    if (!figmaToken || !figmaFileKey || !layerId) return

    const isLoadingMore = loadMore && elementsPagination.hasMore
    
    if (isLoadingMore) {
      setLoadingMoreElements(true)
    } else {
      setLoadingElements(true)
      // Reset pagination for fresh load
      setElementsPagination({
        currentPage: 1,
        itemsPerPage: 30,
        hasMore: true,
        totalItems: 0
      })
    }

    try {
      const response = await axios.get(`${API_BASE}/design-comparison/layer-elements`, {
        headers: {
          'X-Figma-Token': figmaToken
        },
        params: {
          fileId: figmaFileKey,
          layerId: layerId,
          page: isLoadingMore ? elementsPagination.currentPage + 1 : 1,
          limit: elementsPagination.itemsPerPage
        }
      })
      
      const elementsData = response.data.elements || []
      const totalItems = response.data.total || elementsData.length
      const hasMore = response.data.hasMore !== undefined ? 
        response.data.hasMore : 
        (elementsData.length === elementsPagination.itemsPerPage)

      if (isLoadingMore) {
        // Append new elements to existing ones
        setLayerElements(prev => [...prev, ...elementsData])
        setElementsPagination(prev => ({
          ...prev,
          currentPage: prev.currentPage + 1,
          hasMore,
          totalItems
        }))
      } else {
        // Replace elements for fresh load
        setLayerElements(elementsData)
        setElementsPagination(prev => ({
          ...prev,
          currentPage: 1,
          hasMore,
          totalItems
        }))
        
        // Clear previous element selection
        setSelectedElement(null)
      }
    } catch (error) {
      setMessage(`Error loading layer elements: ${error.message}`)
    } finally {
      if (isLoadingMore) {
        setLoadingMoreElements(false)
      } else {
        setLoadingElements(false)
      }
    }
  }, [figmaToken, figmaFileKey, elementsPagination, setMessage])

  const filterLayers = React.useCallback(() => {
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
  }, [searchTerm, layerTypeFilter, showFramesOnly, figmaLayers])

  useEffect(() => {
    filterLayers()
  }, [filterLayers])

  // Scroll detection for infinite loading
  const handleScroll = React.useCallback((event, type) => {
    const { scrollTop, scrollHeight, clientHeight } = event.target
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 200 // Load more when 200px from bottom

    if (!isNearBottom) return

    switch (type) {
      case 'pages':
        if (pagesPagination.hasMore && !loadingMorePages && !loadingPages) {
          loadFigmaPages(true)
        }
        break
      case 'layers':
        if (layersPagination.hasMore && !loadingMoreLayers && !loadingLayers && selectedPage) {
          loadFigmaLayers(selectedPage.id, true)
        }
        break
      case 'elements':
        if (elementsPagination.hasMore && !loadingMoreElements && !loadingElements && selectedLayer) {
          loadLayerElements(selectedLayer.id, true)
        }
        break
    }
  }, [pagesPagination, layersPagination, elementsPagination, loadingMorePages, loadingMoreLayers, loadingMoreElements, loadingPages, loadingLayers, loadingElements, selectedPage, selectedLayer, loadFigmaPages, loadFigmaLayers, loadLayerElements])

  // Reset pagination when dialog opens
  useEffect(() => {
    if (figmaDialogOpen) {
      setPagesPagination({
        currentPage: 1,
        itemsPerPage: 20,
        hasMore: true,
        totalItems: 0
      })
      setLayersPagination({
        currentPage: 1,
        itemsPerPage: 30,
        hasMore: true,
        totalItems: 0
      })
      setElementsPagination({
        currentPage: 1,
        itemsPerPage: 30,
        hasMore: true,
        totalItems: 0
      })
    }
  }, [figmaDialogOpen])

  const selectFigmaLayer = async (itemToImport = null) => {
    const item = itemToImport || selectedLayer || selectedElement
    if (!item || !currentViewport) return

    setUploading(prev => ({ ...prev, [currentViewport.label]: true }))
    
    try {
      // First, download the Figma layer/element as image data
      const downloadResponse = await axios.post(`${API_BASE}/design-comparison/download-figma-layer`, {
        layerId: item.id,
        layerName: item.name,
        fileId: figmaFileKey
      }, {
        headers: {
          'X-Figma-Token': figmaToken
        }
      })
      
      if (!downloadResponse.data.success) {
        throw new Error(downloadResponse.data.error || 'Failed to download Figma item')
      }
      
      // Convert base64 image data to file
      const base64Data = downloadResponse.data.imageData.split(',')[1]
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const imageFile = new File([byteArray], downloadResponse.data.fileName, { type: 'image/png' })
      
      // Upload the file through the regular screenshot upload endpoint
      const formData = new FormData()
      formData.append('screenshot', imageFile)
      formData.append('scenario', selectedScenario)
      formData.append('viewport', currentViewport.label)
      formData.append('isReference', 'true') // Enable auto-sync to BackstopJS reference

      await axios.post(`${API_BASE}/upload-screenshot`, formData)
      
      const itemType = tabValue === 3 ? 'element' : 'layer'
      setMessage(`✅ Figma ${itemType} "${item.name}" uploaded successfully for ${currentViewport.label}!`)
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
              <Tune />
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
                      <Web sx={{ fontSize: 18 }} />
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
            Upload Screenshots
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
                          <Devices />
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
                      {/* Compact Sync Status Indicator */}
                      {hasScreenshot && (
                        <Box sx={{ mb: 2 }}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <SyncAlt sx={{ 
                                color: syncStatusForViewport === 'synced' ? '#4caf50' : 
                                       syncStatusForViewport === 'outdated' ? '#ff9800' : '#757575',
                                fontSize: 18
                              }} />
                              <Typography variant="body2" color="text.secondary">
                                {syncStatusForViewport === 'synced' ? 'Synced' :
                                 syncStatusForViewport === 'outdated' ? 'Needs sync' : 'Not synced'}
                              </Typography>
                            </Stack>
                            
                            <Stack direction="row" spacing={1}>
                              <Button
                                variant="text"
                                size="small"
                                onClick={() => checkSyncStatus(viewport.label)}
                                sx={{ minWidth: 'auto', p: 0.5 }}
                              >
                                <SyncAlt sx={{ fontSize: 16 }} />
                              </Button>
                              <Button
                                variant={syncStatusForViewport === 'synced' ? 'outlined' : 'contained'}
                                color="primary"
                                onClick={() => manualSync(viewport.label)}
                                disabled={uploading[viewport.label]}
                                startIcon={uploading[viewport.label] ? <CircularProgress size={12} /> : null}
                                size="small"
                                sx={{ borderRadius: 1, fontSize: '0.75rem', py: 0.5, px: 1 }}
                              >
                                {uploading[viewport.label] 
                                  ? 'Syncing...' 
                                  : syncStatusForViewport === 'synced' 
                                    ? 'Re-sync' 
                                    : 'Sync'
                                }
                              </Button>
                            </Stack>
                          </Stack>
                        </Box>
                      )}

                      {/* Screenshot Display */}
                      {hasScreenshot ? (
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                            Current Reference:
                          </Typography>
                          {(() => {
                            // Use referenceScreenshot if available, otherwise use the latest screenshot
                            const screenshotToShow = viewportData.referenceScreenshot || 
                                                   screenshots[screenshots.length - 1];
                            console.log('Screenshot to show:', screenshotToShow);
                            console.log('Image URL:', `http://localhost:5000/uploads/${screenshotToShow.filename || screenshotToShow}`);
                            return (
                              <Box sx={{ 
                                border: '2px solid',
                                borderColor: 'grey.200',
                                borderRadius: 2,
                                overflow: 'hidden'
                              }}>
                                <img
                                  src={`http://localhost:5000/uploads/${screenshotToShow.filename || screenshotToShow}`}
                                  alt={`${viewport.label} reference`}
                                  style={{
                                    width: '100%',
                                    height: 'auto',
                                    display: 'block'
                                  }}
                                  onError={(e) => {
                                    console.error('Image failed to load:', e.target.src)
                                    console.error('Error event:', e)
                                    console.error('Screenshot data:', screenshotToShow)
                                  }}
                                  onLoad={() => console.log('Image loaded successfully')}
                                />
                              </Box>
                            );
                          })()}
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
                              onClick={() => {
                                const screenshotToShow = viewportData.referenceScreenshot || 
                                                       screenshots[screenshots.length - 1];
                                viewScreenshot(`http://localhost:5000/uploads/${screenshotToShow.filename || screenshotToShow}`)
                              }}
                              startIcon={<Visibility />}
                              size="small"
                              sx={{ borderRadius: 2 }}
                            >
                              View Full
                            </Button>
                            <Button
                              variant={syncStatusForViewport === 'synced' ? 'outlined' : 'contained'}
                              color="primary"
                              onClick={() => manualSync(viewport.label)}
                              disabled={uploading[viewport.label]}
                              startIcon={uploading[viewport.label] ? <CircularProgress size={16} /> : <SyncAlt />}
                              size="small"
                              sx={{ borderRadius: 2 }}
                            >
                              {uploading[viewport.label] 
                                ? 'Syncing...' 
                                : syncStatusForViewport === 'synced' 
                                  ? 'Re-sync' 
                                  : 'Sync to BackstopJS'
                              }
                            </Button>
                          </Stack>
                          
                          {/* Reference Screenshot Details */}
                          {(() => {
                            const screenshotToShow = viewportData.referenceScreenshot || 
                                                   screenshots[screenshots.length - 1];
                            return (
                              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                                <Typography variant="caption" display="block" color="text.secondary">
                                  <strong>File:</strong> {screenshotToShow?.originalName || 'Unknown'}
                                </Typography>
                                <Typography variant="caption" display="block" color="text.secondary">
                                  <strong>Uploaded:</strong> {screenshotToShow?.uploadedAt 
                                    ? new Date(screenshotToShow.uploadedAt).toLocaleString() 
                                    : 'Unknown'
                                  }
                                </Typography>
                                <Typography variant="caption" display="block" color="text.secondary">
                                  <strong>Size:</strong> {screenshotToShow?.size 
                                    ? `${(screenshotToShow.size / 1024).toFixed(1)} KB` 
                                    : 'Unknown'
                                  }
                                </Typography>
                                <Typography variant="caption" display="block" color="text.secondary">
                                  <strong>Type:</strong> {screenshotToShow?.isReference ? 'Reference Image' : 'Test Image'}
                                </Typography>
                              </Box>
                            );
                          })()}
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
                                    <Layers />
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
        fullScreen
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: 0,
            boxShadow: 'none'
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
              <Layers />
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
            <Tab label="Select Page" disabled={!figmaToken || !figmaFileKey} />
            <Tab label="Browse Layers" disabled={!selectedPage} />
            <Tab label="Layer Elements" disabled={!selectedLayer} />
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
            <Box 
              sx={{ p: 3, height: 'calc(100vh - 300px)', overflow: 'auto' }}
              onScroll={(e) => handleScroll(e, 'pages')}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Select a Page to Browse
                </Typography>
                {pagesPagination.totalItems > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Showing {figmaPages.length} of {pagesPagination.totalItems} pages
                  </Typography>
                )}
              </Stack>
              
              {loadingPages ? (
                <Grid container spacing={2}>
                  {[...Array(4)].map((_, i) => (
                    <Grid item xs={12} sm={6} key={i}>
                      <Card sx={{ borderRadius: 2 }}>
                        <Skeleton variant="rectangular" height={120} />
                        <CardContent>
                          <Skeleton variant="text" width="80%" />
                          <Skeleton variant="text" width="60%" />
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <>
                  <Grid container spacing={2}>
                    {figmaPages.map((page) => (
                      <Grid item xs={12} sm={6} key={page.id}>
                        <Card 
                          sx={{ 
                            borderRadius: 2,
                            cursor: 'pointer',
                            border: selectedPage?.id === page.id ? '2px solid' : '1px solid',
                            borderColor: selectedPage?.id === page.id ? 'primary.main' : 'divider',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: 3
                            }
                          }}
                          onClick={() => {
                            setSelectedPage(page)
                            loadFigmaLayers(page.id)
                          }}
                        >
                        {/* Page Preview */}
                        <Box sx={{ 
                          height: 120, 
                          bgcolor: page.backgroundColor ? 
                            `rgba(${Math.round(page.backgroundColor.r * 255)}, ${Math.round(page.backgroundColor.g * 255)}, ${Math.round(page.backgroundColor.b * 255)}, ${page.backgroundColor.a})` :
                            'grey.100',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden'
                        }}>
                          <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main' }}>
                            <Web sx={{ fontSize: 32 }} />
                          </Avatar>
                          
                          {/* Device Type Badge */}
                          {page.prototypeDevice && page.prototypeDevice.type && (
                            <Chip
                              label={page.prototypeDevice.type}
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                bgcolor: 'rgba(255,255,255,0.9)',
                                fontSize: '0.65rem'
                              }}
                            />
                          )}

                          {/* Selection Indicator */}
                          {selectedPage?.id === page.id && (
                            <Box sx={{
                              position: 'absolute',
                              top: 8,
                              left: 8,
                              bgcolor: 'primary.main',
                              color: 'white',
                              borderRadius: '50%',
                              width: 24,
                              height: 24,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              ✓
                            </Box>
                          )}
                        </Box>

                        {/* Page Info */}
                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="subtitle1" fontWeight="bold" noWrap title={page.name}>
                            {page.name}
                          </Typography>
                          
                          <Stack spacing={0.5} sx={{ mt: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              <strong>Type:</strong> {page.type}
                            </Typography>
                            {page.prototypeDevice && page.prototypeDevice.size && (
                              <Typography variant="caption" color="text.secondary">
                                <strong>Device:</strong> {page.prototypeDevice.size.width} × {page.prototypeDevice.size.height}
                              </Typography>
                            )}
                            {page.prototypeDevice && !page.prototypeDevice.size && (
                              <Typography variant="caption" color="text.secondary">
                                <strong>Device:</strong> {page.prototypeDevice.type || 'Unknown'}
                              </Typography>
                            )}
                            {page.flowStartingPoints && page.flowStartingPoints.length > 0 && (
                              <Typography variant="caption" color="success.main">
                                <strong>Has Flows:</strong> {page.flowStartingPoints.length} flow(s)
                              </Typography>
                            )}
                            {page.children !== undefined && (
                              <Typography variant="caption" color="info.main">
                                <strong>Children:</strong> {page.children} layer(s)
                              </Typography>
                            )}
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                  
                  {figmaPages.length === 0 && (
                    <Grid item xs={12}>
                      <Box sx={{ textAlign: 'center', py: 6 }}>
                        <Avatar sx={{ mx: 'auto', mb: 2, bgcolor: 'grey.300', width: 64, height: 64 }}>
                          <Web />
                        </Avatar>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          No pages found
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Connect to Figma to browse available pages
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
                
                {/* Load More Indicator for Pages */}
                {loadingMorePages && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <Stack alignItems="center" spacing={1}>
                      <CircularProgress size={24} />
                      <Typography variant="caption" color="text.secondary">
                        Loading more pages...
                      </Typography>
                    </Stack>
                  </Box>
                )}
                
                {!pagesPagination.hasMore && figmaPages.length > 0 && (
                  <Box sx={{ textAlign: 'center', mt: 3, py: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      No more pages to load
                    </Typography>
                  </Box>
                )}
              </>
              )}
            </Box>
          )}
          
          {tabValue === 2 && selectedPage && (
            <Box 
              sx={{ p: 3, height: 'calc(100vh - 300px)', overflow: 'auto' }}
              onScroll={(e) => handleScroll(e, 'layers')}
            >
              {/* Search and Filter Controls */}
              <Stack spacing={2} sx={{ mb: 3, position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1, pb: 2 }}>
                <TextField
                  placeholder="Search layers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    )
                  }}
                />
                <Stack direction="row" spacing={2}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Type Filter</InputLabel>
                    <Select
                      value={layerTypeFilter}
                      onChange={(e) => setLayerTypeFilter(e.target.value)}
                      label="Type Filter"
                    >
                      <MenuItem value="all">All Types</MenuItem>
                      <MenuItem value="FRAME">Frames</MenuItem>
                      <MenuItem value="COMPONENT">Components</MenuItem>
                      <MenuItem value="INSTANCE">Instances</MenuItem>
                      <MenuItem value="GROUP">Groups</MenuItem>
                      <MenuItem value="RECTANGLE">Rectangles</MenuItem>
                      <MenuItem value="TEXT">Text</MenuItem>
                    </Select>
                  </FormControl>
                  <Button
                    variant={showFramesOnly ? "contained" : "outlined"}
                    onClick={() => setShowFramesOnly(!showFramesOnly)}
                    startIcon={<FilterAlt />}
                    size="small"
                  >
                    Frames Only
                  </Button>
                </Stack>
                {layerFilterSummary && (
                  <Typography variant="caption" color="text.secondary">
                    Showing {filteredLayers.length} of {layerFilterSummary.total} layers
                  </Typography>
                )}
              </Stack>

              {/* Layer Browser Content */}
              {loadingLayers ? (
                <Grid container spacing={2}>
                  {[...Array(6)].map((_, i) => (
                    <Grid item xs={12} sm={6} md={4} key={i}>
                      <Card sx={{ borderRadius: 2 }}>
                        <Skeleton variant="rectangular" height={150} />
                        <CardContent>
                          <Skeleton variant="text" width="80%" />
                          <Skeleton variant="text" width="60%" />
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <>
                  <Grid container spacing={2}>
                    {filteredLayers.map((layer) => (
                    <Grid item xs={12} sm={6} md={4} key={layer.id}>
                      <Tooltip
                        title={
                          <Box sx={{ p: 1 }}>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                              {layer.name}
                            </Typography>
                            {layer.bounds && (
                              <>
                                <Typography variant="body2">
                                  <strong>Dimensions:</strong> {Math.round(layer.bounds.width)} × {Math.round(layer.bounds.height)}
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Position:</strong> ({Math.round(layer.bounds.x)}, {Math.round(layer.bounds.y)})
                                </Typography>
                              </>
                            )}
                            <Typography variant="body2">
                              <strong>Type:</strong> {layer.type}
                            </Typography>
                            {layer.pageName && (
                              <Typography variant="body2">
                                <strong>Page:</strong> {layer.pageName}
                              </Typography>
                            )}
                            {layer.visible !== undefined && (
                              <Typography variant="body2">
                                <strong>Visible:</strong> {layer.visible ? 'Yes' : 'No'}
                              </Typography>
                            )}
                            {layer.locked && (
                              <Typography variant="body2">
                                <strong>Locked:</strong> Yes
                              </Typography>
                            )}
                          </Box>
                        }
                        placement="top"
                        arrow
                      >
                        <Card 
                          sx={{ 
                            borderRadius: 2,
                            cursor: 'pointer',
                            border: selectedLayer?.id === layer.id ? '2px solid' : '1px solid',
                            borderColor: selectedLayer?.id === layer.id ? 'primary.main' : 'divider',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: 3
                            }
                          }}
                        onClick={() => setSelectedLayer(layer)}
                      >
                      {/* Layer Thumbnail */}
                      <Box sx={{ 
                        height: 150, 
                        bgcolor: 'grey.100',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        {layerThumbnails[layer.id] ? (
                          <img
                            src={layerThumbnails[layer.id]}
                            alt={layer.name}
                            style={{
                              maxWidth: '100%',
                              maxHeight: '100%',
                              objectFit: 'contain'
                            }}
                          />
                        ) : (
                          <Stack alignItems="center" spacing={1}>
                            <Avatar sx={{ bgcolor: 'grey.300', width: 48, height: 48 }}>
                              <Layers />
                            </Avatar>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={(e) => {
                                e.stopPropagation()
                                loadSingleThumbnail(layer.id)
                              }}
                              disabled={loadingThumbnails[layer.id]}
                            >
                              {loadingThumbnails[layer.id] ? <CircularProgress size={16} /> : 'Load Preview'}
                            </Button>
                          </Stack>
                        )}
                        
                        {/* Layer Type Badge */}
                        <Stack
                          direction="row"
                          spacing={0.5}
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8
                          }}
                        >
                          {/* Layer Type */}
                          <Chip
                            label={layer.type}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(255,255,255,0.95)',
                              fontSize: '0.65rem',
                              height: 20,
                              color: layer.type === 'FRAME' ? 'primary.main' : 
                                     layer.type === 'COMPONENT' ? 'success.main' :
                                     layer.type === 'INSTANCE' ? 'warning.main' : 'text.secondary'
                            }}
                          />
                          
                          {/* Child Count Badge */}
                          {layer.hasChildren && layer.childCount && (
                            <Chip
                              label={`${layer.childCount} items`}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(255,255,255,0.95)',
                                fontSize: '0.6rem',
                                height: 20,
                                color: 'info.main'
                              }}
                            />
                          )}
                        </Stack>

                        {/* Selection Indicator */}
                        {selectedLayer?.id === layer.id && (
                          <Box sx={{
                            position: 'absolute',
                            top: 8,
                            left: 8,
                            bgcolor: 'primary.main',
                            color: 'white',
                            borderRadius: '50%',
                            width: 24,
                            height: 24,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            ✓
                          </Box>
                        )}
                      </Box>

                      {/* Layer Info */}
                      <CardContent sx={{ p: 2 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                          <Typography variant="subtitle2" fontWeight="bold" noWrap title={layer.name} sx={{ flex: 1 }}>
                            {layer.name}
                          </Typography>
                          {layer.hasChildren && (
                            <Button
                              size="small"
                              variant="text"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedLayer(layer)
                                loadLayerElements(layer.id)
                                setTabValue(3) // Go to elements tab
                              }}
                              sx={{ minWidth: 'auto', p: 0.5 }}
                            >
                              <Visibility sx={{ fontSize: 16 }} />
                            </Button>
                          )}
                        </Stack>                          {/* Layer Details Grid */}
                          <Box sx={{ mt: 1, mb: 1 }}>
                            <Stack spacing={0.5}>
                              {/* Dimensions */}
                              <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={1}>
                                <Box component="span" sx={{ fontWeight: 'bold', minWidth: '60px' }}>Size:</Box>
                                {Math.round(layer.bounds?.width || 0)} × {Math.round(layer.bounds?.height || 0)}
                              </Typography>
                              
                              {/* Position */}
                              {layer.bounds && (
                                <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={1}>
                                  <Box component="span" sx={{ fontWeight: 'bold', minWidth: '60px' }}>Position:</Box>
                                  x:{Math.round(layer.bounds.x)}, y:{Math.round(layer.bounds.y)}
                                </Typography>
                              )}
                              
                              {/* Layer Type */}
                              <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={1}>
                                <Box component="span" sx={{ fontWeight: 'bold', minWidth: '60px' }}>Type:</Box>
                                {layer.type}
                              </Typography>
                              
                              {/* Page Info */}
                              {layer.pageName && (
                                <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={1}>
                                  <Box component="span" sx={{ fontWeight: 'bold', minWidth: '60px' }}>Page:</Box>
                                  {layer.pageName}
                                </Typography>
                              )}
                              
                              {/* Visible/Hidden Status */}
                              {layer.visible !== undefined && (
                                <Typography variant="caption" color={layer.visible ? "success.main" : "warning.main"} display="flex" alignItems="center" gap={1}>
                                  <Box component="span" sx={{ fontWeight: 'bold', minWidth: '60px' }}>Status:</Box>
                                  {layer.visible ? 'Visible' : 'Hidden'}
                                </Typography>
                              )}
                              
                              {/* Locked Status */}
                              {layer.locked && (
                                <Typography variant="caption" color="warning.main" display="flex" alignItems="center" gap={1}>
                                  <Box component="span" sx={{ fontWeight: 'bold', minWidth: '60px' }}>Lock:</Box>
                                  Locked
                                </Typography>
                              )}
                              
                              {/* Has Children */}
                              {layer.hasChildren && (
                                <Typography variant="caption" color="info.main" display="flex" alignItems="center" gap={1}>
                                  <Box component="span" sx={{ fontWeight: 'bold', minWidth: '60px' }}>Children:</Box>
                                  Has child layers
                                </Typography>
                              )}
                              
                              {/* Background Color (if available) */}
                              {layer.fills && layer.fills.length > 0 && layer.fills[0].color && (
                                <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={1}>
                                  <Box component="span" sx={{ fontWeight: 'bold', minWidth: '60px' }}>Color:</Box>
                                  <Box sx={{ 
                                    width: 12, 
                                    height: 12, 
                                    borderRadius: '50%', 
                                    bgcolor: `rgba(${Math.round(layer.fills[0].color.r * 255)}, ${Math.round(layer.fills[0].color.g * 255)}, ${Math.round(layer.fills[0].color.b * 255)}, ${layer.fills[0].color.a || 1})`,
                                    border: '1px solid #ccc',
                                    mr: 0.5
                                  }} />
                                  rgb({Math.round(layer.fills[0].color.r * 255)}, {Math.round(layer.fills[0].color.g * 255)}, {Math.round(layer.fills[0].color.b * 255)})
                                </Typography>
                              )}
                            </Stack>
                          </Box>
                          
                          {/* Description (if available) - show layer path instead */}
                          {layer.path && (
                            <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                Path: {layer.path.length > 60 ? layer.path.substring(0, 60) + '...' : layer.path}
                              </Typography>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                      </Tooltip>
                    </Grid>
                  ))}
                  
                  {filteredLayers.length === 0 && (
                    <Grid item xs={12}>
                      <Box sx={{ textAlign: 'center', py: 6 }}>
                        <Avatar sx={{ mx: 'auto', mb: 2, bgcolor: 'grey.300', width: 64, height: 64 }}>
                          <Search />
                        </Avatar>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          No layers found
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {searchTerm || layerTypeFilter !== 'all' || showFramesOnly 
                            ? 'Try adjusting your filters or search term'
                            : 'Connect to Figma to browse available layers'
                          }
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
                  <>
                    {/* Load More Indicator for Layers */}
                    {loadingMoreLayers && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                        <Stack alignItems="center" spacing={1}>
                          <CircularProgress size={24} />
                          <Typography variant="caption" color="text.secondary">
                            Loading more layers...
                          </Typography>
                        </Stack>
                      </Box>
                    )}
                    
                    {!layersPagination.hasMore && filteredLayers.length > 0 && (
                      <Box sx={{ textAlign: 'center', mt: 3, py: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          No more layers to load
                        </Typography>
                      </Box>
                    )}
                  </>
                </>
              )}
            </Box>
          )}

          {tabValue === 3 && selectedLayer && (
            <Box 
              sx={{ p: 3, height: 'calc(100vh - 300px)', overflow: 'auto' }}
              onScroll={(e) => handleScroll(e, 'elements')}
            >
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Elements in "{selectedLayer.name}"
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Select individual elements within this layer
                </Typography>
                
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setTabValue(2)}
                    startIcon={<Layers />}
                  >
                    Back to Layers
                  </Button>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => loadLayerElements(selectedLayer.id)}
                    disabled={loadingElements}
                    startIcon={loadingElements ? <CircularProgress size={16} /> : <SyncAlt />}
                  >
                    Refresh Elements
                  </Button>
                </Stack>
              </Box>

              {loadingElements ? (
                <Grid container spacing={2}>
                  {[...Array(6)].map((_, i) => (
                    <Grid item xs={12} sm={6} md={4} key={i}>
                      <Card sx={{ borderRadius: 2 }}>
                        <Skeleton variant="rectangular" height={100} />
                        <CardContent>
                          <Skeleton variant="text" width="80%" />
                          <Skeleton variant="text" width="60%" />
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <>
                  <Grid container spacing={2}>
                    {layerElements.map((element) => (
                    <Grid item xs={12} sm={6} md={4} key={element.id}>
                      <Card 
                        sx={{ 
                          borderRadius: 2,
                          cursor: 'pointer',
                          border: selectedElement?.id === element.id ? '2px solid' : '1px solid',
                          borderColor: selectedElement?.id === element.id ? 'primary.main' : 'divider',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 3
                          }
                        }}
                        onClick={() => setSelectedElement(element)}
                      >
                        {/* Element Preview */}
                        <Box sx={{ 
                          height: 100, 
                          bgcolor: 'grey.50',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden',
                          borderBottom: '1px solid',
                          borderColor: 'divider'
                        }}>
                          <Avatar sx={{ 
                            bgcolor: element.type === 'TEXT' ? 'info.light' :
                                     element.type === 'INSTANCE' ? 'success.light' :
                                     element.type === 'GROUP' ? 'warning.light' :
                                     element.type === 'RECTANGLE' ? 'secondary.light' : 'grey.400',
                            width: 40, 
                            height: 40 
                          }}>
                            {element.type === 'TEXT' ? '🔤' :
                             element.type === 'INSTANCE' ? '🔧' :
                             element.type === 'GROUP' ? '📦' :
                             element.type === 'RECTANGLE' ? '⬛' : '🎨'}
                          </Avatar>
                          
                          {/* Element Type Badge */}
                          <Chip
                            label={element.type}
                            size="small"
                            sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              bgcolor: 'rgba(255,255,255,0.95)',
                              fontSize: '0.65rem',
                              height: 18
                            }}
                          />

                          {/* Selection Indicator */}
                          {selectedElement?.id === element.id && (
                            <Box sx={{
                              position: 'absolute',
                              top: 8,
                              left: 8,
                              bgcolor: 'primary.main',
                              color: 'white',
                              borderRadius: '50%',
                              width: 20,
                              height: 20,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px'
                            }}>
                              ✓
                            </Box>
                          )}
                        </Box>

                        {/* Element Info */}
                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="subtitle2" fontWeight="bold" noWrap title={element.name}>
                            {element.name}
                          </Typography>
                          
                          <Stack spacing={0.5} sx={{ mt: 1 }}>
                            <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={1}>
                              <Box component="span" sx={{ fontWeight: 'bold', minWidth: '50px' }}>Size:</Box>
                              {Math.round(element.bounds?.width || 0)} × {Math.round(element.bounds?.height || 0)}
                            </Typography>
                            
                            <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={1}>
                              <Box component="span" sx={{ fontWeight: 'bold', minWidth: '50px' }}>Pos:</Box>
                              x:{Math.round(element.bounds?.x || 0)}, y:{Math.round(element.bounds?.y || 0)}
                            </Typography>
                            
                            <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={1}>
                              <Box component="span" sx={{ fontWeight: 'bold', minWidth: '50px' }}>Type:</Box>
                              {element.type}
                            </Typography>
                            
                            {element.visible !== undefined && (
                              <Typography variant="caption" color={element.visible ? "success.main" : "warning.main"} display="flex" alignItems="center" gap={1}>
                                <Box component="span" sx={{ fontWeight: 'bold', minWidth: '50px' }}>Status:</Box>
                                {element.visible ? 'Visible' : 'Hidden'}
                              </Typography>
                            )}
                          </Stack>
                          
                          {element.description && (
                            <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                {element.description}
                              </Typography>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                  
                  {layerElements.length === 0 && !loadingElements && (
                    <Grid item xs={12}>
                      <Box sx={{ textAlign: 'center', py: 6 }}>
                        <Avatar sx={{ mx: 'auto', mb: 2, bgcolor: 'grey.300', width: 64, height: 64 }}>
                          <Layers />
                        </Avatar>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          No elements found
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          This layer may not have child elements or they are not accessible
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
                
                {/* Load More Indicator for Elements */}
                {loadingMoreElements && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <Stack alignItems="center" spacing={1}>
                      <CircularProgress size={24} />
                      <Typography variant="caption" color="text.secondary">
                        Loading more elements...
                      </Typography>
                    </Stack>
                  </Box>
                )}
                
                {!elementsPagination.hasMore && layerElements.length > 0 && (
                  <Box sx={{ textAlign: 'center', mt: 3, py: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      No more elements to load
                    </Typography>
                  </Box>
                )}
                </>
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
                await loadFigmaPages()
                setTabValue(1)
              }}
              variant="contained"
              disabled={!figmaToken || !figmaFileKey || loadingPages}
              sx={{
                borderRadius: 2,
                background: 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)'
              }}
            >
              {loadingPages ? 'Connecting...' : 'Connect & Browse Pages'}
            </Button>
          )}
          
          {tabValue === 1 && selectedPage && (
            <Button
              onClick={() => {
                loadFigmaLayers(selectedPage.id)
                setTabValue(2)
              }}
              variant="contained"
              disabled={loadingLayers}
              sx={{
                borderRadius: 2,
                background: 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)'
              }}
            >
              {loadingLayers ? 'Loading...' : 'Browse Layers'}
            </Button>
          )}
          
          {tabValue === 2 && selectedLayer && (
            <Stack direction="row" spacing={2}>
              {selectedLayer.hasChildren && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    loadLayerElements(selectedLayer.id)
                    setTabValue(3)
                  }}
                  disabled={loadingElements}
                  sx={{ borderRadius: 2 }}
                >
                  {loadingElements ? 'Loading...' : 'View Elements'}
                </Button>
              )}
              <Button
                variant="contained"
                onClick={() => selectFigmaLayer(selectedLayer)}
                disabled={!selectedLayer || uploading[currentViewport?.label]}
                startIcon={uploading[currentViewport?.label] ? <CircularProgress size={16} /> : <GetApp />}
                sx={{
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)'
                }}
              >
                {uploading[currentViewport?.label] ? 'Importing...' : 'Import Layer'}
              </Button>
            </Stack>
          )}
          
          {tabValue === 3 && selectedElement && (
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                onClick={() => setTabValue(2)}
                sx={{ borderRadius: 2 }}
              >
                Back to Layer
              </Button>
              <Button
                variant="contained"
                onClick={() => selectFigmaLayer(selectedElement)}
                disabled={!selectedElement || uploading[currentViewport?.label]}
                startIcon={uploading[currentViewport?.label] ? <CircularProgress size={16} /> : <GetApp />}
                sx={{
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)'
                }}
              >
                {uploading[currentViewport?.label] ? 'Importing...' : 'Import Element'}
              </Button>
            </Stack>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default ScreenshotUploader
