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
  Divider,
  Stack,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip
} from '@mui/material'
import { 
  Add, 
  Delete, 
  Save,
  Settings, 
  ExpandMore as ExpandMoreIcon,
  Web as WebIcon,
  Code as CodeIcon
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
      const scenariosWithIds = scenariosResponse.data.map((scenario, index) => ({
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
        // Revert the deletion on error
        setScenarios(scenarios)
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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
        Scenario Management
      </Typography>
      
      {message && (
        <Alert 
          severity={message.includes('Error') ? 'error' : 'success'}
          sx={{ mb: 3 }}
          onClose={() => setMessage('')}
        >
          {message}
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={addScenario}
        >
          Add New Scenario
        </Button>
        
        {hasUnsavedChanges && (
          <Button
            variant="contained"
            color="success"
            startIcon={saving ? <CircularProgress size={20} /> : <Save />}
            onClick={saveScenarios}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </Stack>

      <Grid container spacing={3}>
        {scenarios.map((scenario, index) => (
          <Grid item xs={12} key={scenario.id || `scenario-${index}`}>
            <Accordion 
              defaultExpanded={scenarios.length === 1}
              sx={{ 
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: 1,
                '&:before': { display: 'none' }
              }}
            >
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon />}
                sx={{ 
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  '& .MuiAccordionSummary-content': {
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WebIcon />
                  <Typography variant="h6">
                    {scenario.label || `Scenario ${index + 1}`}
                  </Typography>
                  <Chip 
                    label={scenario.url || 'No URL'} 
                    size="small" 
                    variant="outlined"
                    sx={{ 
                      color: 'inherit',
                      borderColor: 'currentColor'
                    }}
                  />
                </Box>
                
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation()
                    console.log('Delete button clicked for index:', index)
                    removeScenario(index)
                  }}
                  size="small"
                  disabled={saving}
                  sx={{ 
                    color: 'error.main',
                    bgcolor: 'rgba(255,255,255,0.1)',
                    '&:hover': {
                      bgcolor: 'rgba(255,0,0,0.1)',
                      transform: 'scale(1.1)'
                    },
                    '&:disabled': {
                      color: 'grey.500'
                    },
                    transition: 'all 0.2s'
                  }}
                >
                  <Delete />
                </IconButton>
              </AccordionSummary>

              <AccordionDetails sx={{ pt: 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Label"
                      value={scenario.label || ''}
                      onChange={(e) => updateScenario(index, 'label', e.target.value)}
                      fullWidth
                      variant="outlined"
                      helperText="Descriptive name for this scenario"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="URL"
                      type="url"
                      value={scenario.url || ''}
                      onChange={(e) => updateScenario(index, 'url', e.target.value)}
                      fullWidth
                      variant="outlined"
                      helperText="Target URL to test"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      🎯 Capture Settings
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Selectors (comma separated)"
                      value={Array.isArray(scenario.selectors) ? scenario.selectors.join(', ') : scenario.selectors || ''}
                      onChange={(e) => updateScenario(index, 'selectors', e.target.value.split(', ').filter(s => s.trim()))}
                      fullWidth
                      variant="outlined"
                      helperText="CSS selectors to capture"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Delay (ms)"
                      type="number"
                      value={scenario.delay || 0}
                      onChange={(e) => updateScenario(index, 'delay', parseInt(e.target.value) || 0)}
                      fullWidth
                      variant="outlined"
                      helperText="Wait time before capture"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mb: 1, mt: 2, fontWeight: 600 }}>
                      🔧 Comparison Settings
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Mismatch Threshold"
                      type="number"
                      slotProps={{ htmlInput: { step: 0.01, min: 0, max: 1 } }}
                      value={scenario.misMatchThreshold || 0.1}
                      onChange={(e) => updateScenario(index, 'misMatchThreshold', parseFloat(e.target.value) || 0.1)}
                      fullWidth
                      variant="outlined"
                      helperText="Tolerance for differences (0-1)"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ pt: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={scenario.requireSameDimensions || false}
                            onChange={(e) => updateScenario(index, 'requireSameDimensions', e.target.checked)}
                          />
                        }
                        label="Require Same Dimensions"
                      />
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mb: 1, mt: 2, fontWeight: 600 }}>
                      🎭 Element Manipulation
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Hide Selectors (comma separated)"
                      value={Array.isArray(scenario.hideSelectors) ? scenario.hideSelectors.join(', ') : scenario.hideSelectors || ''}
                      onChange={(e) => updateScenario(index, 'hideSelectors', e.target.value.split(', ').filter(s => s.trim()))}
                      fullWidth
                      variant="outlined"
                      helperText="Elements to hide (visibility: hidden)"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Remove Selectors (comma separated)"
                      value={Array.isArray(scenario.removeSelectors) ? scenario.removeSelectors.join(', ') : scenario.removeSelectors || ''}
                      onChange={(e) => updateScenario(index, 'removeSelectors', e.target.value.split(', ').filter(s => s.trim()))}
                      fullWidth
                      variant="outlined"
                      helperText="Elements to remove completely from DOM"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mb: 1, mt: 2, fontWeight: 600 }}>
                      🖱️ Interaction Settings
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Click Selector"
                      value={scenario.clickSelector || ''}
                      onChange={(e) => updateScenario(index, 'clickSelector', e.target.value)}
                      fullWidth
                      variant="outlined"
                      helperText="Element to click before capture"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Hover Selector"
                      value={scenario.hoverSelector || ''}
                      onChange={(e) => updateScenario(index, 'hoverSelector', e.target.value)}
                      fullWidth
                      variant="outlined"
                      helperText="Element to hover before capture"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mb: 1, mt: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CodeIcon fontSize="small" />
                      📝 Custom Script (onReadyScript)
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      label="Custom JavaScript Code"
                      value={scenario.customScript || ''}
                      onChange={(e) => updateScenario(index, 'customScript', e.target.value)}
                      fullWidth
                      multiline
                      rows={6}
                      variant="outlined"
                      helperText="JavaScript code executed before screenshot (e.g., await page.waitForSelector('.loading', {state: 'hidden'}))"
                      sx={{
                        '& .MuiInputBase-input': {
                          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
                          fontSize: '0.875rem',
                          lineHeight: 1.4
                        }
                      }}
                      placeholder={`// Example custom ready script:
// Browser Context (runs in page):
document.getElementById('sidebar').style.display = 'none';
window.scrollTo(0, 0);
sessionStorage.clear();

// Node.js Context (Puppeteer commands):
await page.waitForSelector('.main-content', {visible: true});
await page.hover('.hover-trigger');
await page.keyboard.press('Escape');`}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mb: 1, mt: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CodeIcon fontSize="small" />
                      🔧 Custom Before Script (onBeforeScript)
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      label="Custom Before JavaScript Code"
                      value={scenario.customBeforeScript || ''}
                      onChange={(e) => updateScenario(index, 'customBeforeScript', e.target.value)}
                      fullWidth
                      multiline
                      rows={6}
                      variant="outlined"
                      helperText="JavaScript code executed before page load and setup (e.g., authentication, cookies, localStorage)"
                      sx={{
                        '& .MuiInputBase-input': {
                          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
                          fontSize: '0.875rem',
                          lineHeight: 1.4
                        }
                      }}
                      placeholder={`// Example custom before script:
// Browser Context (runs in page):
sessionStorage.setItem('authToken', 'test-token');
localStorage.setItem('userPrefs', '{"theme":"dark"}');
document.body.style.display = 'block';

// Node.js Context (Puppeteer commands):
await page.context().addCookies([{
  name: 'session', value: 'abc123', domain: 'localhost'
}]);
await page.setExtraHTTPHeaders({'Authorization': 'Bearer token'});`}
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>
        ))}
      </Grid>

      {scenarios.length === 0 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          No scenarios configured. Click "Add New Scenario" to get started.
        </Alert>
      )}
    </Box>
  )
}

export default ScenarioManager
