import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import pixelPilotLogo from '../assets/pixelpilot-logo.svg'
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Switch,
  FormControlLabel,
  Grid,
  Paper,
  IconButton,
  Divider,
  Stack,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Avatar,
  Badge,
  Chip,
  MenuItem,
  Tooltip,
  LinearProgress,
  Fade,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction
} from '@mui/material'
import {
  Save,
  Add,
  Delete,
  Settings,
  Devices,
  Code,
  ExpandMore,
  Tune,
  MonitorOutlined,
  PhoneAndroidOutlined,
  TabletAndroidOutlined,
  LaptopOutlined,
  DesktopWindowsOutlined,
  EditOutlined,
  CheckCircleOutlined,
  InfoOutlined,
  SecurityOutlined,
  SpeedOutlined,
  BugReportOutlined,
  AutoAwesomeOutlined,
  RestoreOutlined,
  PreviewOutlined,
  WarningAmberOutlined
} from '@mui/icons-material'

const API_BASE = 'http://localhost:5000/api'

function ConfigEditor({ project, onConfigUpdate }) {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [expandedAdvanced, setExpandedAdvanced] = useState(false)
  const [presetDialogOpen, setPresetDialogOpen] = useState(false)

  const commonViewports = [
    { label: 'Mobile Portrait', width: 375, height: 667, icon: PhoneAndroidOutlined },
    { label: 'Mobile Landscape', width: 667, height: 375, icon: PhoneAndroidOutlined },
    { label: 'Tablet Portrait', width: 768, height: 1024, icon: TabletAndroidOutlined },
    { label: 'Tablet Landscape', width: 1024, height: 768, icon: TabletAndroidOutlined },
    { label: 'Laptop', width: 1366, height: 768, icon: LaptopOutlined },
    { label: 'Desktop', width: 1920, height: 1080, icon: DesktopWindowsOutlined }
  ]

  useEffect(() => {
    if (project) {
      loadConfig()
    }
  }, [project])

  const loadConfig = async () => {
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/config`)
      const loadedConfig = response.data || {}
      
      // Ensure viewports array exists
      if (!loadedConfig.viewports) {
        loadedConfig.viewports = []
      }
      
      setConfig(loadedConfig)
      setLoading(false)
    } catch (error) {
      setMessage(`Error loading config: ${error.message}`)
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      await axios.post(`${API_BASE}/projects/${project.id}/config`, config)
      setMessage('✅ Configuration saved successfully!')
      setTimeout(() => setMessage(''), 4000)
      if (onConfigUpdate) {
        onConfigUpdate()
      }
    } catch (error) {
      setMessage(`❌ Error saving config: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = useCallback((field, value) => {
    // Update immediately for smooth typing experience
    setConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }, [])

  const addViewport = useCallback(() => {
    if (!config || !config.viewports) return
    
    const newViewport = {
      label: `viewport-${config.viewports.length + 1}`,
      width: 1024,
      height: 768
    }
    setConfig(prev => ({
      ...prev,
      viewports: [...(prev.viewports || []), newViewport]
    }))
  }, [config])

  const addPresetViewport = useCallback((preset) => {
    setConfig(prev => ({
      ...prev,
      viewports: [...(prev.viewports || []), { ...preset }]
    }))
    setPresetDialogOpen(false)
  }, [])

  const updateViewport = useCallback((index, field, value) => {
    // Update immediately for smooth typing experience
    setConfig(prev => {
      if (!prev.viewports) return prev
      
      const newViewports = [...prev.viewports]
      newViewports[index] = {
        ...newViewports[index],
        [field]: value
      }
      return {
        ...prev,
        viewports: newViewports
      }
    })
  }, [])

  const removeViewport = useCallback((index) => {
    setConfig(prev => ({
      ...prev,
      viewports: (prev.viewports || []).filter((_, i) => i !== index)
    }))
  }, [])

  if (loading) {
    return (
      <Box sx={{ width: '100%', py: 4 }}>
        <Stack alignItems="center" spacing={3}>
          <CircularProgress size={60} thickness={4} />
          <Typography variant="h6" color="text.secondary">
            Loading BackstopJS Configuration...
          </Typography>
        </Stack>
      </Box>
    )
  }

  if (!config) {
    return (
      <Box sx={{ width: '100%', py: 4 }}>
        <Alert 
          severity="error" 
          sx={{ borderRadius: 3, p: 3 }}
          icon={<WarningAmberOutlined sx={{ fontSize: 32 }} />}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Configuration Load Failed
          </Typography>
          <Typography>
            Unable to load BackstopJS configuration. Please check your connection and try again.
          </Typography>
        </Alert>
      </Box>
    )
  }

  // Ensure config has all required properties
  const safeConfig = {
    id: '',
    engine: 'puppeteer',
    debug: false,
    viewports: [],
    similarityThreshold: 0.1,
    delay: 500,
    ...config
  }

  const getEngineIcon = (engine) => {
    switch (engine) {
      case 'playwright': return '🎭'
      case 'puppeteer': return '🎪'
      default: return '⚙️'
    }
  }

  const getViewportIcon = (width) => {
    if (width <= 480) return PhoneAndroidOutlined
    if (width <= 768) return TabletAndroidOutlined
    if (width <= 1366) return LaptopOutlined
    return DesktopWindowsOutlined
  }

  return (
    <Box sx={{ 
      width: '100%', 
      p: 3
    }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Box
            component="img"
            src={pixelPilotLogo}
            alt="PixelPilot Logo"
            sx={{
              width: 56,
              height: 56,
              flexShrink: 0
            }}
          />
          <Box>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: 'text.primary' }}>
              BackstopJS Configuration
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400 }}>
              Configure visual regression testing parameters and viewports
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
                <Settings sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {safeConfig.id || 'Default'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Project ID
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
                <MonitorOutlined sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {safeConfig.viewports?.length || 0}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Viewports Configured
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
                <Typography variant="h4" sx={{ mb: 1 }}>
                  {getEngineIcon(safeConfig.engine)}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {safeConfig.engine || 'Puppeteer'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Testing Engine
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: safeConfig.debug 
                ? 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
                : 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
              color: safeConfig.debug ? 'white' : '#8B4513',
              height: '100%'
            }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                {safeConfig.debug ? (
                  <BugReportOutlined sx={{ fontSize: 32, mb: 1 }} />
                ) : (
                  <SpeedOutlined sx={{ fontSize: 32, mb: 1 }} />
                )}
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {safeConfig.debug ? 'Debug' : 'Production'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Execution Mode
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Message Alert */}
        {message && (
          <Fade in={Boolean(message)}>
            <Alert 
              severity={message.includes('❌') ? 'error' : 'success'}
              sx={{ 
                mb: 3,
                borderRadius: 2,
                '& .MuiAlert-icon': { fontSize: 24 },
                '& .MuiAlert-message': { fontSize: '1rem' }
              }}
              action={
                <IconButton color="inherit" size="small" onClick={() => setMessage('')}>
                  <Delete />
                </IconButton>
              }
            >
              {message}
            </Alert>
          </Fade>
        )}
      </Box>

      {/* Main Content */}
      <Box sx={{ display: 'flex', gap: 4, width: '100%' }}>
        {/* Left Panel - Basic Configuration */}
        <Box sx={{ 
          width: '20%', 
          minWidth: '300px',
          bgcolor: 'rgba(25, 118, 210, 0.04)', 
          border: '1px dashed rgba(25, 118, 210, 0.3)',
          borderRadius: 2,
          p: 2
        }}>
          <Stack spacing={3}>
            {/* Project Settings Card */}
            <Card sx={{ 
              borderRadius: 3,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              border: '1px solid',
              borderColor: 'divider'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <Settings />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      Project Settings
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Basic BackstopJS configuration parameters
                    </Typography>
                  </Box>
                </Stack>

                <Divider sx={{ mb: 3 }} />
                
                <Stack spacing={3}>
                  <TextField
                    label="Project Identifier"
                    value={safeConfig.id || ''}
                    onChange={(e) => updateConfig('id', e.target.value)}
                    fullWidth
                    variant="outlined"
                    helperText="Unique identifier for this BackstopJS project"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                  
                  <TextField
                    label="Testing Engine"
                    select
                    value={safeConfig.engine || 'puppeteer'}
                    onChange={(e) => updateConfig('engine', e.target.value)}
                    fullWidth
                    variant="outlined"
                    helperText="Browser automation engine for screenshot capture"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  >
                    <MenuItem value="puppeteer">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography>🎪</Typography>
                        <Typography>Puppeteer (Chrome/Chromium)</Typography>
                      </Stack>
                    </MenuItem>
                    <MenuItem value="playwright">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography>🎭</Typography>
                        <Typography>Playwright (Multi-browser)</Typography>
                      </Stack>
                    </MenuItem>
                  </TextField>
                  
                  <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.50' }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={safeConfig.debug || false}
                          onChange={(e) => updateConfig('debug', e.target.checked)}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body1" fontWeight={500}>
                            Debug Mode
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Enable verbose logging and detailed error reporting
                          </Typography>
                        </Box>
                      }
                    />
                  </Paper>
                </Stack>
              </CardContent>
            </Card>

            {/* Performance Settings Card */}
            <Card sx={{ 
              borderRadius: 3,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              border: '1px solid',
              borderColor: 'divider'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <SpeedOutlined />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      Performance & Quality
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Optimize screenshot quality and performance
                    </Typography>
                  </Box>
                </Stack>

                <Divider sx={{ mb: 3 }} />

                <Stack spacing={3}>
                  <TextField
                    label="Similarity Threshold"
                    type="number"
                    value={safeConfig.similarityThreshold || 0.1}
                    onChange={(e) => updateConfig('similarityThreshold', parseFloat(e.target.value))}
                    fullWidth
                    inputProps={{ min: 0, max: 1, step: 0.01 }}
                    helperText="Threshold for detecting visual differences (0.0 = exact match, 1.0 = any difference)"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />

                  <TextField
                    label="Delay (ms)"
                    type="number"
                    value={safeConfig.delay || 500}
                    onChange={(e) => updateConfig('delay', parseInt(e.target.value))}
                    fullWidth
                    inputProps={{ min: 0, step: 100 }}
                    helperText="Wait time before taking screenshots"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />

                  <TextField
                    label="Async Capture Limit"
                    type="number"
                    value={safeConfig.asyncCaptureLimit || 5}
                    onChange={(e) => updateConfig('asyncCaptureLimit', parseInt(e.target.value))}
                    fullWidth
                    inputProps={{ min: 1, step: 1 }}
                    helperText="Maximum number of screenshots captured in parallel. Default: 5."
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />

                  <TextField
                    label="Async Compare Limit"
                    type="number"
                    value={safeConfig.asyncCompareLimit || 50}
                    onChange={(e) => updateConfig('asyncCompareLimit', parseInt(e.target.value))}
                    fullWidth
                    inputProps={{ min: 1, step: 1 }}
                    helperText="Maximum number of screenshot comparisons in parallel. Default: 50."
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Box>

        {/* Right Panel - Viewport Configuration */}
        <Box sx={{ 
          width: '80%', 
          bgcolor: 'rgba(46, 125, 50, 0.04)', 
          border: '1px dashed rgba(46, 125, 50, 0.3)',
          borderRadius: 2,
          p: 2
        }}>
          <Card sx={{ 
            borderRadius: 3,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            border: '1px solid',
            borderColor: 'divider'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <Avatar sx={{ bgcolor: 'secondary.main' }}>
                  <MonitorOutlined />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Viewport Configuration
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Define screen sizes for responsive testing
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Add Common Viewport">
                    <Button
                      startIcon={<AutoAwesomeOutlined />}
                      onClick={() => setPresetDialogOpen(true)}
                      variant="outlined"
                      size="small"
                      sx={{ borderRadius: 2 }}
                    >
                      Presets
                    </Button>
                  </Tooltip>
                  <Tooltip title="Add Custom Viewport">
                    <Button
                      startIcon={<Add />}
                      onClick={addViewport}
                      variant="contained"
                      size="small"
                      sx={{ borderRadius: 2 }}
                    >
                      Add
                    </Button>
                  </Tooltip>
                </Stack>
              </Stack>

              <Divider sx={{ mb: 3 }} />
              
              <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
                <Grid container spacing={2}>
                  {safeConfig.viewports?.map((viewport, index) => {
                    const ViewportIcon = getViewportIcon(viewport.width)
                    return (
                      <Grid item xs={12} sm={6} md={4} lg={3} key={`viewport-${index}`}>
                        <Paper 
                          sx={{ 
                            p: 2, 
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            height: '100%',
                            minWidth: '280px',
                            maxWidth: '400px',
                            '&:hover': {
                              borderColor: 'primary.main',
                              boxShadow: 1
                            }
                          }}
                        >
                          <Stack spacing={2} sx={{ height: '100%' }}>
                            <Stack direction="row" alignItems="center" spacing={2}>
                              <Avatar sx={{ bgcolor: 'info.main', width: 32, height: 32 }}>
                                <ViewportIcon sx={{ fontSize: 18 }} />
                              </Avatar>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" fontWeight={600} noWrap>
                                  Viewport {index + 1}
                                </Typography>
                              </Box>
                              <Tooltip title="Remove Viewport">
                                <IconButton
                                  onClick={() => removeViewport(index)}
                                  color="error"
                                  size="small"
                                >
                                  <Delete sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                            
                            <TextField
                              label="Label"
                              value={viewport.label || ''}
                              onChange={(e) => updateViewport(index, 'label', e.target.value)}
                              size="small"
                              fullWidth
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                            />
                            
                            <Stack direction="row" spacing={1}>
                              <TextField
                                label="Width"
                                type="number"
                                value={viewport.width || ''}
                                onChange={(e) => updateViewport(index, 'width', parseInt(e.target.value))}
                                size="small"
                                inputProps={{ min: 320, max: 3840 }}
                                sx={{ 
                                  flex: 1,
                                  '& .MuiOutlinedInput-root': { borderRadius: 2 } 
                                }}
                              />
                              <TextField
                                label="Height"
                                type="number"
                                value={viewport.height || ''}
                                onChange={(e) => updateViewport(index, 'height', parseInt(e.target.value))}
                                size="small"
                                inputProps={{ min: 200, max: 2160 }}
                                sx={{ 
                                  flex: 1,
                                  '& .MuiOutlinedInput-root': { borderRadius: 2 } 
                                }}
                              />
                            </Stack>
                            
                            <Stack direction="row" spacing={1} sx={{ mt: 'auto' }}>
                              <Chip 
                                label={`${viewport.width} × ${viewport.height}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ flex: 1, fontSize: '0.7rem' }}
                              />
                              <Chip 
                                label={viewport.width <= 480 ? 'Mobile' : 
                                       viewport.width <= 768 ? 'Tablet' : 
                                       viewport.width <= 1366 ? 'Laptop' : 'Desktop'}
                                size="small"
                                color="secondary"
                                sx={{ fontSize: '0.7rem' }}
                              />
                            </Stack>
                          </Stack>
                        </Paper>
                      </Grid>
                    )
                  })}
                  
                  {(!safeConfig.viewports || safeConfig.viewports.length === 0) && (
                    <Grid item xs={12}>
                      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, bgcolor: 'grey.50' }}>
                        <MonitorOutlined sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                          No Viewports Configured
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Add viewports to test your application across different screen sizes
                        </Typography>
                        <Button
                          startIcon={<Add />}
                          onClick={addViewport}
                          variant="contained"
                          sx={{ borderRadius: 2 }}
                        >
                          Add Your First Viewport
                        </Button>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Actions Section */}
      <Box sx={{ mt: 4, mb: 3 }}>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <Save />}
            onClick={saveConfig}
            size="large"
            disabled={saving}
            sx={{ 
              py: 2,
              px: 4,
              borderRadius: 3,
              fontSize: '1.1rem',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
              }
            }}
          >
            {saving ? 'Saving Configuration...' : 'Save Configuration'}
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<RestoreOutlined />}
            onClick={loadConfig}
            size="large"
            sx={{ 
              py: 2,
              px: 4,
              borderRadius: 3,
              fontSize: '1.1rem',
              fontWeight: 600
            }}
          >
            Reset Changes
          </Button>
        </Stack>
      </Box>

      {/* Advanced Configuration */}
      <Card sx={{ 
        mt: 3,
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <Accordion 
          expanded={expandedAdvanced}
          onChange={() => setExpandedAdvanced(!expandedAdvanced)}
          sx={{ borderRadius: 3, '&:before': { display: 'none' } }}
        >
          <AccordionSummary 
            expandIcon={<ExpandMore />}
            sx={{ borderRadius: 3, minHeight: 70 }}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar sx={{ bgcolor: 'warning.main' }}>
                <Code />
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Advanced Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Direct JSON editing for advanced users
                </Typography>
              </Box>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 3 }}>
            <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
              <Typography variant="body2">
                <strong>⚠️ Advanced Mode:</strong> Direct JSON editing. Invalid syntax may break the configuration.
              </Typography>
            </Alert>
            <TextField
              multiline
              rows={20}
              value={JSON.stringify(config, null, 2)}
              onChange={(e) => {
                try {
                  setConfig(JSON.parse(e.target.value))
                } catch {
                  // Invalid JSON, ignore for now
                }
              }}
              fullWidth
              variant="outlined"
              sx={{ 
                fontFamily: 'monospace',
                '& .MuiOutlinedInput-root': { 
                  borderRadius: 2,
                  fontSize: '0.875rem'
                }
              }}
              helperText="Raw BackstopJS configuration in JSON format"
            />
          </AccordionDetails>
        </Accordion>
      </Card>

      {/* Preset Viewports Dialog */}
      <Dialog 
        open={presetDialogOpen} 
        onClose={() => setPresetDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <AutoAwesomeOutlined />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Common Viewport Presets
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Quick setup for popular device sizes
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <List>
            {commonViewports.map((preset, index) => {
              const IconComponent = preset.icon
              return (
                <ListItem
                  key={index}
                  button
                  onClick={() => addPresetViewport(preset)}
                  sx={{ 
                    borderRadius: 2, 
                    mb: 1,
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <ListItemIcon>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                      <IconComponent />
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body1" fontWeight={500}>
                        {preset.label}
                      </Typography>
                    }
                    secondary={`${preset.width} × ${preset.height} pixels`}
                  />
                  <ListItemSecondaryAction>
                    <Chip 
                      label="Add" 
                      color="primary" 
                      size="small"
                      onClick={() => addPresetViewport(preset)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              )
            })}
          </List>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => setPresetDialogOpen(false)}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default ConfigEditor
