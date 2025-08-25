import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  Box,
  Typography,
  Button,
  Alert,
  TextField,
  Switch,
  FormControlLabel,
  Grid,
  IconButton,
  Stack,
  CircularProgress,
  Card,
  CardContent,
  Avatar,
  Chip,
  Tooltip,
  Fade,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material'
import { 
  Add, 
  Delete, 
  Save,
  Settings, 
  Web as WebIcon,
  Code as CodeIcon,
  Timeline,
  Visibility,
  TouchApp,
  Camera,
  Edit,
  FileCopy,
  AccessTime,
  CompareArrows,
  ExpandMore
} from '@mui/icons-material'

const API_BASE = 'http://localhost:5000/api'

import CSVScenarioUploader from './CSVScenarioUploader';

function ScenarioManager() {
  const [scenarios, setScenarios] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [message, setMessage] = useState('')
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewScenarioData, setPreviewScenarioData] = useState(null)
  const [previewImage, setPreviewImage] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [scenariosResponse, configResponse] = await Promise.all([
        axios.get(`${API_BASE}/scenarios`),
        axios.get(`${API_BASE}/config`)
      ])
      // Add unique IDs to existing scenarios if they don't have them
      const scenariosData = scenariosResponse.data.scenarios || scenariosResponse.data || [];
      const scenariosWithIds = scenariosData.map((scenario, index) => ({
        ...scenario,
        id: scenario.id || `existing-${index}-${Date.now()}`
      }))
      setScenarios(scenariosWithIds)
      setConfig(configResponse.data)
      setLoading(false)
    } catch (error) {
      setMessage(`Error loading data: ${error.message}`)
      setLoading(false)
    }
  }

  const addScenario = () => {
      const newScenario = {
      id: Date.now(), // Add unique ID for stable React keys
      label: 'New Scenario',
      url: 'https://example.com',
      referenceUrl: '', // URL for reference screenshot (if different from test URL)
      selectors: ['document'],
      delay: 0,
      misMatchThreshold: 0.1,
      requireSameDimensions: true,
      removeSelectors: [],
      selectorExpansion: true
    }
    const updatedScenarios = [...scenarios, newScenario]
    setScenarios(updatedScenarios)
    setHasUnsavedChanges(true)
  }

  const updateScenario = useCallback((index, field, value) => {
    // Update immediately for smooth typing experience
    setScenarios(prevScenarios => {
      const updatedScenarios = prevScenarios.map((scenario, i) => 
        i === index ? { ...scenario, [field]: value } : scenario
      )
      return updatedScenarios
    })
    setHasUnsavedChanges(true)
  }, [])

  const removeScenario = useCallback(async (index) => {
    console.log('Removing scenario at index:', index, 'Current scenarios count:', scenarios.length)
    
    const newScenarios = scenarios.filter((_, i) => i !== index)
    console.log('New scenarios count:', newScenarios.length)
    
    setScenarios(newScenarios)
    
    // Auto-save immediately after deletion
    if (config) {
      setSaving(true)
      try {
        const updatedConfig = {
          ...config,
          scenarios: newScenarios
        }
        await axios.post(`${API_BASE}/config`, updatedConfig)
        setMessage('Scenario deleted successfully!')
        
        // Clear success message after 3 seconds
        setTimeout(() => setMessage(''), 3000)
      } catch (error) {
        setMessage(`Error deleting scenario: ${error.message}`)
        console.error('Error deleting scenario:', error)
        // Revert the deletion on error - reload from server
        try {
          const response = await axios.get(`${API_BASE}/scenarios`)
          const scenariosData = response.data.scenarios || response.data || []
          const scenariosWithIds = scenariosData.map((scenario, idx) => ({
            ...scenario,
            id: scenario.id || `existing-${idx}-${Date.now()}`
          }))
          setScenarios(scenariosWithIds)
        } catch (reloadError) {
          console.error('Error reloading scenarios:', reloadError)
        }
      } finally {
        setSaving(false)
      }
    }
  }, [scenarios, config])

  const saveScenarios = async () => {
    if (!config) return
    
    setSaving(true)
    setMessage('')
    
    try {
      const updatedConfig = {
        ...config,
        scenarios: scenarios
      }
      await axios.post(`${API_BASE}/config`, updatedConfig)
      setConfig(updatedConfig)
      setHasUnsavedChanges(false)
      setMessage('Scenarios saved successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage(`Error saving scenarios: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const previewScenario = async (scenario) => {
    if (!scenario.url) {
      setMessage('No URL configured for this scenario')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    // Check if reference image exists first
    try {
      // Check for all viewports
      const checkResponse = await axios.get(`${API_BASE}/check-reference/${encodeURIComponent(scenario.label)}?viewport=all`);
      
      if (!checkResponse.data.exists) {
        setMessage('Creating reference screenshots...');
        await axios.post(`${API_BASE}/reference`, {
          config: {
            scenarios: [scenario],
            viewports: config?.viewports || [{ label: 'phone', width: 320, height: 480 }]
          },
          scenarioIndex: 0,
          viewportIndex: 0
        })
        setMessage('Reference screenshot created successfully!')
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (error) {
      console.error('Error checking/creating reference:', error)
      setMessage(`Error: ${error.message}`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    // Validate URL before proceeding
    try {
      new URL(scenario.url);
    } catch (e) {
      setMessage(`Invalid URL format: ${scenario.url}`);
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Set scenario data for preview dialog
    setPreviewScenarioData(scenario)
    setPreviewDialogOpen(true)
    setLoadingPreview(true)
    setPreviewImage(null)

    try {
      // Create a temporary preview configuration
      const previewConfig = {
        scenarios: [scenario],
        viewports: config?.viewports || [{ label: 'preview', width: 1200, height: 800 }]
      }

      // Request a preview screenshot from the backend
      const response = await axios.post(`${API_BASE}/preview-scenario`, {
        config: previewConfig,
        scenarioIndex: 0,
        viewportIndex: 0
      })

      if (response.data.success && response.data.imageUrl) {
        setPreviewImage(response.data.imageUrl)
      } else {
        setMessage('Failed to generate preview image')
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (error) {
      console.error('Error generating preview:', error)
      setMessage(`Error generating preview: ${error.message}`)
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setLoadingPreview(false)
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={60} />
          <Typography variant="h6" color="text.secondary">
            Loading scenarios...
          </Typography>
        </Stack>
      </Box>
    )
  }

  return (
    <Box sx={{ 
      width: '100%', 
      p: 3
    }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Avatar sx={{ bgcolor: 'secondary.main', width: 56, height: 56 }}>
            <Timeline />
          </Avatar>
          <Box>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: 'text.primary' }}>
              Scenario Management
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400 }}>
              Create and manage visual testing scenarios for your application
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
                <Timeline sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {scenarios.length}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Total Scenarios
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
                <Settings sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {scenarios.filter(s => s.customScript || s.customBeforeScript).length}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  With Custom Scripts
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
                <TouchApp sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {scenarios.filter(s => s.clickSelector || s.hoverSelector).length}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Interactive Scenarios
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: hasUnsavedChanges 
                ? 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
                : 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
              color: hasUnsavedChanges ? 'white' : '#8B4513',
              height: '100%'
            }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                {hasUnsavedChanges ? (
                  <Edit sx={{ fontSize: 32, mb: 1 }} />
                ) : (
                  <Save sx={{ fontSize: 32, mb: 1 }} />
                )}
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {hasUnsavedChanges ? 'Unsaved' : 'Saved'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Changes Status
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Message Alert */}
        {message && (
          <Fade in={Boolean(message)}>
            <Alert 
              severity={message.includes('Error') ? 'error' : 'success'}
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

        {/* Action Buttons */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={addScenario}
            sx={{
              borderRadius: 2,
              px: 3,
              py: 1.5,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
              }
            }}
          >
            Add New Scenario
          </Button>
          
          {/* Render CSV Uploader */}
          <CSVScenarioUploader 
            onScenariosCreated={(newScenarios) => {
              setScenarios([...scenarios, ...newScenarios]);
              setHasUnsavedChanges(true);
              setMessage(`Successfully imported ${newScenarios.length} scenarios from CSV`);
              setTimeout(() => setMessage(''), 3000);
            }} 
          />
          
          {hasUnsavedChanges && (
            <Button
              variant="contained"
              color="success"
              startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <Save />}
              onClick={saveScenarios}
              disabled={saving}
              sx={{
                borderRadius: 2,
                px: 3,
                py: 1.5,
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(46, 125, 50, 0.3)'
                }
              }}
            >
              {saving ? 'Saving...' : 'Save All Changes'}
            </Button>
          )}
        </Stack>
      </Box>

      {/* Scenarios Accordion List */}
      <Stack spacing={2}>
        {scenarios.map((scenario, index) => (
          <Accordion 
            key={scenario.id || `scenario-${index}`}
            defaultExpanded={scenarios.length === 1}
            sx={{ 
              borderRadius: 3,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              border: '1px solid',
              borderColor: 'divider',
              '&:before': { display: 'none' },
              '&.Mui-expanded': {
                transform: 'translateY(-1px)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                borderColor: 'primary.main'
              },
              transition: 'all 0.3s ease'
            }}
          >
            <AccordionSummary 
              expandIcon={<ExpandMore />}
              sx={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                minHeight: 72,
                '&.Mui-expanded': {
                  minHeight: 72
                },
                '& .MuiAccordionSummary-content': {
                  alignItems: 'center',
                  my: 2
                },
                '& .MuiAccordionSummary-expandIconWrapper': {
                  color: 'white'
                }
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%', pr: 2 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <WebIcon sx={{ fontSize: 28 }} />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                      {scenario.label || `Scenario ${index + 1}`}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.875rem' }}>
                      {scenario.url || 'No URL configured'}
                    </Typography>
                  </Box>
                </Stack>
                
                <Stack direction="row" spacing={1} alignItems="center">
                  {/* Status Chips */}
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mr: 2 }}>
                    <Chip
                      icon={<AccessTime />}
                      label={`${scenario.delay || 0}ms`}
                      size="small"
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.15)',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.3)',
                        fontSize: '0.7rem',
                        height: 20
                      }}
                    />
                    <Chip
                      icon={<CompareArrows />}
                      label={`${Math.round((scenario.misMatchThreshold || 0.1) * 100)}%`}
                      size="small"
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.15)',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.3)',
                        fontSize: '0.7rem',
                        height: 20
                      }}
                    />
                    {(scenario.clickSelector || scenario.hoverSelector) && (
                      <Chip
                        icon={<TouchApp />}
                        label="Interactive"
                        size="small"
                        sx={{ 
                          bgcolor: 'rgba(255,255,255,0.15)',
                          color: 'white',
                          border: '1px solid rgba(255,255,255,0.3)',
                          fontSize: '0.7rem',
                          height: 20
                        }}
                      />
                    )}
                    {(scenario.customScript || scenario.customBeforeScript) && (
                      <Chip
                        icon={<CodeIcon />}
                        label="Custom Script"
                        size="small"
                        sx={{ 
                          bgcolor: 'rgba(255,255,255,0.15)',
                          color: 'white',
                          border: '1px solid rgba(255,255,255,0.3)',
                          fontSize: '0.7rem',
                          height: 20
                        }}
                      />
                    )}
                    {scenario.selectorExpansion === false && (
                      <Chip
                        label="No Expansion"
                        size="small"
                        sx={{ 
                          bgcolor: 'rgba(255,193,7,0.8)',
                          color: 'rgba(0,0,0,0.87)',
                          border: '1px solid rgba(255,193,7,1)',
                          fontSize: '0.7rem',
                          height: 20
                        }}
                      />
                    )}
                  </Stack>
                  
                  {/* Action Buttons */}
                  <Tooltip title="Preview Scenario">
                    <IconButton 
                      size="small" 
                      sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
                      onClick={(e) => {
                        e.stopPropagation()
                        previewScenario(scenario)
                      }}
                    >
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Duplicate Scenario">
                    <IconButton 
                      size="small" 
                      sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
                      onClick={(e) => {
                        e.stopPropagation()
                        const duplicateScenario = { ...scenario, id: Date.now(), label: `${scenario.label} (Copy)` }
                        setScenarios([...scenarios, duplicateScenario])
                        setHasUnsavedChanges(true)
                      }}
                    >
                      <FileCopy fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Scenario">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeScenario(index)
                      }}
                      disabled={saving}
                      sx={{ 
                        color: 'rgba(255,255,255,0.8)',
                        '&:hover': { 
                          color: 'white',
                          bgcolor: 'rgba(255,0,0,0.2)'
                        }
                      }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </AccordionSummary>

            <AccordionDetails sx={{ p: 3, bgcolor: 'grey.50' }}>
              <Grid container spacing={3}>
                {/* Basic Configuration */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ p: 2, height: 'fit-content', borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                      <Settings sx={{ mr: 1, fontSize: 20 }} />
                      Basic Configuration
                    </Typography>
                    
                    <Stack spacing={2}>
                      <TextField
                        label="Scenario Label"
                        value={scenario.label || ''}
                        onChange={(e) => updateScenario(index, 'label', e.target.value)}
                        fullWidth
                        size="small"
                        variant="outlined"
                      />
                      
                      <TextField
                        label="Target URL"
                        value={scenario.url || ''}
                        onChange={(e) => updateScenario(index, 'url', e.target.value)}
                        fullWidth
                        size="small"
                        variant="outlined"
                      />

                      <TextField
                        label="Reference URL (Optional)"
                        value={scenario.referenceUrl || ''}
                        onChange={(e) => updateScenario(index, 'referenceUrl', e.target.value)}
                        fullWidth
                        size="small"
                        variant="outlined"
                        helperText="URL for reference screenshot (leave empty to use same as test URL)"
                      />
                      
                      <TextField
                        label="CSS Selectors"
                        value={Array.isArray(scenario.selectors) ? scenario.selectors.join(', ') : scenario.selectors || ''}
                        onChange={(e) => updateScenario(index, 'selectors', e.target.value.split(', ').filter(s => s.trim()))}
                        fullWidth
                        size="small"
                        variant="outlined"
                        helperText="Elements to capture (comma separated)"
                      />
                      
                      <Stack direction="row" spacing={2}>
                        <TextField
                          label="Delay (ms)"
                          type="number"
                          value={scenario.delay || 0}
                          onChange={(e) => updateScenario(index, 'delay', parseInt(e.target.value) || 0)}
                          size="small"
                          variant="outlined"
                          sx={{ width: '50%' }}
                        />
                        <TextField
                          label="Mismatch %"
                          type="number"
                          value={(scenario.misMatchThreshold || 0.1) * 100}
                          onChange={(e) => updateScenario(index, 'misMatchThreshold', (parseFloat(e.target.value) || 10) / 100)}
                          size="small"
                          variant="outlined"
                          sx={{ width: '50%' }}
                        />
                      </Stack>
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={scenario.requireSameDimensions || false}
                            onChange={(e) => updateScenario(index, 'requireSameDimensions', e.target.checked)}
                            size="small"
                          />
                        }
                        label="Require Same Dimensions"
                      />
                      
                      {/* Preview Button */}
                      <Button
                        variant="outlined"
                        startIcon={<Visibility />}
                        onClick={() => previewScenario(scenario)}
                        fullWidth
                        size="small"
                        sx={{ 
                          mt: 1,
                          borderColor: 'primary.main',
                          color: 'primary.main',
                          '&:hover': {
                            backgroundColor: 'primary.main',
                            color: 'white'
                          }
                        }}
                      >
                        Preview Scenario
                      </Button>
                    </Stack>
                  </Card>
                </Grid>

                {/* Element Control */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ p: 2, height: 'fit-content', borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                      <Visibility sx={{ mr: 1, fontSize: 20 }} />
                      Element Control
                    </Typography>
                    
                    <Stack spacing={2}>
                      <TextField
                        label="Hide Selectors"
                        value={Array.isArray(scenario.hideSelectors) ? scenario.hideSelectors.join(', ') : scenario.hideSelectors || ''}
                        onChange={(e) => updateScenario(index, 'hideSelectors', e.target.value.split(', ').filter(s => s.trim()))}
                        fullWidth
                        size="small"
                        variant="outlined"
                        helperText="Elements to hide (comma separated)"
                      />
                      
                      <TextField
                        label="Remove Selectors"
                        value={Array.isArray(scenario.removeSelectors) ? scenario.removeSelectors.join(', ') : scenario.removeSelectors || ''}
                        onChange={(e) => updateScenario(index, 'removeSelectors', e.target.value.split(', ').filter(s => s.trim()))}
                        fullWidth
                        size="small"
                        variant="outlined"
                        helperText="Elements to remove from DOM (comma separated)"
                      />
                      
                      <TextField
                        label="Click Selector"
                        value={scenario.clickSelector || ''}
                        onChange={(e) => updateScenario(index, 'clickSelector', e.target.value)}
                        fullWidth
                        size="small"
                        variant="outlined"
                        helperText="Element to click before capture"
                      />
                      
                      <TextField
                        label="Hover Selector"
                        value={scenario.hoverSelector || ''}
                        onChange={(e) => updateScenario(index, 'hoverSelector', e.target.value)}
                        fullWidth
                        size="small"
                        variant="outlined"
                        helperText="Element to hover before capture"
                      />
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={scenario.selectorExpansion !== false}
                            onChange={(e) => updateScenario(index, 'selectorExpansion', e.target.checked)}
                            size="small"
                          />
                        }
                        label="Selector Expansion"
                        sx={{ mt: 1 }}
                      />
                      <Typography 
                        variant="caption" 
                        color="text.secondary" 
                        sx={{ display: 'block', mt: -1, ml: 4 }}
                      >
                        Expand selectors to include child elements (default: true)
                      </Typography>
                    </Stack>
                  </Card>
                </Grid>

                {/* Custom Scripts */}
                <Grid item xs={12}>
                  <Card sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                      <CodeIcon sx={{ mr: 1, fontSize: 20 }} />
                      Custom Scripts
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Ready Script (onReady)"
                          value={scenario.customScript || ''}
                          onChange={(e) => updateScenario(index, 'customScript', e.target.value)}
                          fullWidth
                          multiline
                          rows={4}
                          size="small"
                          variant="outlined"
                          helperText="JavaScript executed before screenshot"
                          sx={{
                            '& .MuiInputBase-input': {
                              fontFamily: 'Monaco, monospace',
                              fontSize: '0.75rem'
                            }
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Before Script (onBefore)"
                          value={scenario.customBeforeScript || ''}
                          onChange={(e) => updateScenario(index, 'customBeforeScript', e.target.value)}
                          fullWidth
                          multiline
                          rows={4}
                          size="small"
                          variant="outlined"
                          helperText="JavaScript executed before page load"
                          sx={{
                            '& .MuiInputBase-input': {
                              fontFamily: 'Monaco, monospace',
                              fontSize: '0.75rem'
                            }
                          }}
                        />
                      </Grid>
                    </Grid>
                  </Card>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>

      {/* Empty State */}
      {scenarios.length === 0 && (
        <Card sx={{ 
          p: 6, 
          textAlign: 'center',
          borderRadius: 3,
          border: '2px dashed',
          borderColor: 'divider',
          bgcolor: 'grey.50'
        }}>
          <Avatar sx={{ 
            width: 80, 
            height: 80, 
            mx: 'auto', 
            mb: 3,
            bgcolor: 'primary.light',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          }}>
            <Timeline sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
            No Scenarios Yet
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
            Create your first visual testing scenario to start capturing and comparing screenshots of your application.
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={addScenario}
            size="large"
            sx={{
              borderRadius: 2,
              px: 4,
              py: 1.5,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 20px rgba(102, 126, 234, 0.3)'
              }
            }}
          >
            Create First Scenario
          </Button>
        </Card>
      )}
      
      {/* Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <Visibility />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Scenario Preview
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {previewScenarioData?.label || 'Preview Configuration'}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        
        <DialogContent>
          {previewScenarioData && (
            <Stack spacing={3}>
              {/* URL Section */}
              <Card sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  URLs to Compare
                </Typography>
                <Stack spacing={1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Target URL:
                    </Typography>
                    <Typography variant="body1" sx={{ wordBreak: 'break-all' }}>
                      {previewScenarioData.url}
                    </Typography>
                  </Box>
                  {previewScenarioData.referenceUrl && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Reference URL:
                      </Typography>
                      <Typography variant="body1" sx={{ wordBreak: 'break-all' }}>
                        {previewScenarioData.referenceUrl}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Card>

              {/* Preview Image Section */}
              <Card sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Selected Area Preview
                </Typography>
                {loadingPreview ? (
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center',
                    minHeight: 200,
                    bgcolor: 'grey.50',
                    borderRadius: 1
                  }}>
                    <CircularProgress size={40} sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      Generating preview of selected elements...
                    </Typography>
                  </Box>
                ) : previewImage ? (
                  <Box sx={{ 
                    border: '2px solid',
                    borderColor: 'grey.200',
                    borderRadius: 2,
                    overflow: 'hidden',
                    maxHeight: '400px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'grey.50'
                  }}>
                    <img
                      src={previewImage}
                      alt="Scenario Preview"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '400px',
                        width: 'auto',
                        height: 'auto',
                        display: 'block',
                        objectFit: 'contain'
                      }}
                    />
                  </Box>
                ) : (
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center',
                    minHeight: 150,
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    border: '2px dashed',
                    borderColor: 'grey.300'
                  }}>
                    <Camera sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Preview image will be generated when available
                    </Typography>
                  </Box>
                )}
                
                {/* Selector Information */}
                <Box sx={{ mt: 2, p: 1, bgcolor: 'info.light', borderRadius: 1 }}>
                  <Typography variant="caption" color="info.dark">
                    <strong>Capturing:</strong> {
                      Array.isArray(previewScenarioData.selectors) 
                        ? previewScenarioData.selectors.join(', ') || 'document'
                        : previewScenarioData.selectors || 'document'
                    }
                  </Typography>
                </Box>
              </Card>

              {/* Capture Configuration */}
              <Card sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Capture Configuration
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <Camera />
                    </ListItemIcon>
                    <ListItemText
                      primary="Elements to Capture"
                      secondary={
                        Array.isArray(previewScenarioData.selectors) 
                          ? previewScenarioData.selectors.join(', ') || 'document'
                          : previewScenarioData.selectors || 'document'
                      }
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemIcon>
                      <AccessTime />
                    </ListItemIcon>
                    <ListItemText
                      primary="Delay"
                      secondary={`${previewScenarioData.delay || 0}ms before capture`}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemIcon>
                      <CompareArrows />
                    </ListItemIcon>
                    <ListItemText
                      primary="Mismatch Threshold"
                      secondary={`${Math.round((previewScenarioData.misMatchThreshold || 0.1) * 100)}% tolerance`}
                    />
                  </ListItem>
                  
                  {previewScenarioData.requireSameDimensions && (
                    <ListItem>
                      <ListItemIcon>
                        <Settings />
                      </ListItemIcon>
                      <ListItemText
                        primary="Dimension Check"
                        secondary="Requires same dimensions for comparison"
                      />
                    </ListItem>
                  )}
                </List>
              </Card>

              {/* Interactive Elements */}
              {(previewScenarioData.clickSelector || previewScenarioData.hoverSelector) && (
                <Card sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Interactive Elements
                  </Typography>
                  <List dense>
                    {previewScenarioData.clickSelector && (
                      <ListItem>
                        <ListItemIcon>
                          <TouchApp />
                        </ListItemIcon>
                        <ListItemText
                          primary="Click Element"
                          secondary={previewScenarioData.clickSelector}
                        />
                      </ListItem>
                    )}
                    
                    {previewScenarioData.hoverSelector && (
                      <ListItem>
                        <ListItemIcon>
                          <TouchApp />
                        </ListItemIcon>
                        <ListItemText
                          primary="Hover Element"
                          secondary={previewScenarioData.hoverSelector}
                        />
                      </ListItem>
                    )}
                  </List>
                </Card>
              )}

              {/* Element Control */}
              {(previewScenarioData.hideSelectors?.length > 0 || previewScenarioData.removeSelectors?.length > 0) && (
                <Card sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Element Control
                  </Typography>
                  <List dense>
                    {previewScenarioData.hideSelectors?.length > 0 && (
                      <ListItem>
                        <ListItemIcon>
                          <Visibility />
                        </ListItemIcon>
                        <ListItemText
                          primary="Hidden Elements"
                          secondary={Array.isArray(previewScenarioData.hideSelectors) 
                            ? previewScenarioData.hideSelectors.join(', ')
                            : previewScenarioData.hideSelectors}
                        />
                      </ListItem>
                    )}
                    
                    {previewScenarioData.removeSelectors?.length > 0 && (
                      <ListItem>
                        <ListItemIcon>
                          <Delete />
                        </ListItemIcon>
                        <ListItemText
                          primary="Removed Elements"
                          secondary={Array.isArray(previewScenarioData.removeSelectors)
                            ? previewScenarioData.removeSelectors.join(', ')
                            : previewScenarioData.removeSelectors}
                        />
                      </ListItem>
                    )}
                  </List>
                </Card>
              )}

              {/* Custom Scripts */}
              {(previewScenarioData.customScript || previewScenarioData.customBeforeScript) && (
                <Card sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Custom Scripts
                  </Typography>
                  <List dense>
                    {previewScenarioData.customBeforeScript && (
                      <ListItem>
                        <ListItemIcon>
                          <CodeIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="Before Script (onBefore)"
                          secondary="Custom JavaScript will execute before page load"
                        />
                      </ListItem>
                    )}
                    
                    {previewScenarioData.customScript && (
                      <ListItem>
                        <ListItemIcon>
                          <CodeIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="Ready Script (onReady)"
                          secondary="Custom JavaScript will execute before screenshot"
                        />
                      </ListItem>
                    )}
                  </List>
                </Card>
              )}
            </Stack>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={() => {
              setPreviewDialogOpen(false)
              setPreviewImage(null)
            }}
            variant="outlined"
          >
            Close
          </Button>
          <Button
            onClick={() => previewScenario(previewScenarioData)}
            variant="outlined"
            startIcon={loadingPreview ? <CircularProgress size={16} /> : <Camera />}
            disabled={loadingPreview}
            sx={{ mr: 'auto' }}
          >
            {loadingPreview ? 'Generating...' : 'Refresh Preview'}
          </Button>
          <Stack direction="row" spacing={1}>
            <Button
              onClick={() => {
                if (previewScenarioData?.url) {
                  window.open(previewScenarioData.url, '_blank')
                  setMessage(`Opening target URL for "${previewScenarioData.label}"`)
                  setTimeout(() => setMessage(''), 2000)
                }
              }}
              variant="contained"
              startIcon={<WebIcon />}
            >
              Open Target URL
            </Button>
            {previewScenarioData?.referenceUrl && (
              <Button
                onClick={() => {
                  window.open(previewScenarioData.referenceUrl, '_blank')
                  setMessage(`Opening reference URL for "${previewScenarioData.label}"`)
                  setTimeout(() => setMessage(''), 2000)
                }}
                variant="outlined"
                startIcon={<CompareArrows />}
              >
                Open Reference URL
              </Button>
            )}
          </Stack>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default ScenarioManager
