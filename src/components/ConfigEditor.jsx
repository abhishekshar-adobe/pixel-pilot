import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
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
  AccordionDetails
} from '@mui/material'
import {
  Save,
  Add,
  Delete,
  Settings,
  Devices,
  Code,
  ExpandMore
} from '@mui/icons-material'

const API_BASE = 'http://localhost:5000/api'

function ConfigEditor() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const response = await axios.get(`${API_BASE}/config`)
      setConfig(response.data)
      setLoading(false)
    } catch (error) {
      setMessage(`Error loading config: ${error.message}`)
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    try {
      await axios.post(`${API_BASE}/config`, config)
      setMessage('Configuration saved successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage(`Error saving config: ${error.message}`)
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
    const newViewport = {
      label: 'new-viewport',
      width: 1024,
      height: 768
    }
    setConfig(prev => ({
      ...prev,
      viewports: [...prev.viewports, newViewport]
    }))
  }, [])

  const updateViewport = useCallback((index, field, value) => {
    // Update immediately for smooth typing experience
    setConfig(prev => {
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
      viewports: prev.viewports.filter((_, i) => i !== index)
    }))
  }, [])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    )
  }

  if (!config) {
    return (
      <Alert severity="error">
        Failed to load configuration
      </Alert>
    )
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
        BackstopJS Configuration
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

      <Grid container spacing={3}>
        {/* Basic Configuration */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Settings sx={{ mr: 1 }} />
                Basic Settings
              </Typography>
              
              <Stack spacing={3}>
                <TextField
                  label="Project ID"
                  value={config.id || ''}
                  onChange={(e) => updateConfig('id', e.target.value)}
                  fullWidth
                  variant="outlined"
                />
                
                <TextField
                  label="Engine"
                  select
                  value={config.engine || 'puppeteer'}
                  onChange={(e) => updateConfig('engine', e.target.value)}
                  fullWidth
                  variant="outlined"
                  helperText="BackstopJS engine"
                  slotProps={{
                    select: {
                      native: true,
                    }
                  }}
                >
                  <option value="puppeteer">Puppeteer</option>
                  <option value="playwright">Playwright</option>
                </TextField>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.debug || false}
                      onChange={(e) => updateConfig('debug', e.target.checked)}
                    />
                  }
                  label="Debug Mode"
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Viewports Configuration */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                  <Devices sx={{ mr: 1 }} />
                  Viewports
                </Typography>
                <Button
                  startIcon={<Add />}
                  onClick={addViewport}
                  variant="outlined"
                  size="small"
                >
                  Add Viewport
                </Button>
              </Box>
              
              <Stack spacing={2}>
                {config.viewports?.map((viewport, index) => (
                  <Paper key={`viewport-${index}`} variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        Viewport {index + 1}
                      </Typography>
                      <IconButton
                        onClick={() => removeViewport(index)}
                        size="small"
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                    
                    <Stack spacing={2}>
                      <TextField
                        label="Label"
                        value={viewport.label || ''}
                        onChange={(e) => updateViewport(index, 'label', e.target.value)}
                        size="small"
                        fullWidth
                      />
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <TextField
                            label="Width"
                            type="number"
                            value={viewport.width || ''}
                            onChange={(e) => updateViewport(index, 'width', parseInt(e.target.value))}
                            size="small"
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <TextField
                            label="Height"
                            type="number"
                            value={viewport.height || ''}
                            onChange={(e) => updateViewport(index, 'height', parseInt(e.target.value))}
                            size="small"
                            fullWidth
                          />
                        </Grid>
                      </Grid>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Actions */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={saveConfig}
          size="large"
        >
          Save Configuration
        </Button>
      </Stack>

      {/* Raw JSON Editor */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
            <Code sx={{ mr: 1 }} />
            Advanced Configuration (Raw JSON)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TextField
            multiline
            rows={15}
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
            sx={{ fontFamily: 'monospace' }}
            helperText="Direct JSON editing - be careful with syntax"
          />
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}

export default ConfigEditor
