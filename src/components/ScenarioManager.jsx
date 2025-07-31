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
  AccordionDetails
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

function ScenarioManager() {
  const [scenarios, setScenarios] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [message, setMessage] = useState('')

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
      selectors: ['document'],
      delay: 0,
      misMatchThreshold: 0.1,
      requireSameDimensions: true,
      removeSelectors: []
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
                borderRadius: '12px 12px 0 0',
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
                  </Stack>
                  
                  {/* Action Buttons */}
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
    </Box>
  )
}

export default ScenarioManager
