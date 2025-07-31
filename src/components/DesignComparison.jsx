import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemIcon,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Divider,
  Snackbar,
  Stack
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Close
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const DesignComparison = () => {
  const [config, setConfig] = useState({
    configured: false,
    figmaAccessToken: '',
    figmaFileKey: '',
    tolerance: {
      fontSize: 2,
      spacing: 4,
      color: 10
    }
  });
  
  const [reports, setReports] = useState([]);
  const [layers, setLayers] = useState([]);
  const [layerTypes, setLayerTypes] = useState([]);
  const [selectedLayers, setSelectedLayers] = useState([]);
  const [layerThumbnails, setLayerThumbnails] = useState({});
  const [layerSearch, setLayerSearch] = useState('');
  const [selectedLayerType, setSelectedLayerType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [layerFilterSummary, setLayerFilterSummary] = useState(null);
  
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [layersDialogOpen, setLayersDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('jpg');
  const [exportScale, setExportScale] = useState(1);
  const [selectedReport, setSelectedReport] = useState(null);
  
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarios, setSelectedScenarios] = useState([]);
  const [selectedComparisonLayers, setSelectedComparisonLayers] = useState([]);

  useEffect(() => {
    loadConfig();
    loadReports();
    loadScenarios();
    loadLocalStorageConfig();
  }, []);

  // Load access token from localStorage (for security, we store this client-side only)
  const loadLocalStorageConfig = () => {
    try {
      const savedToken = localStorage.getItem('figmaAccessToken');
      if (savedToken) {
        setConfig(prev => ({ ...prev, figmaAccessToken: savedToken }));
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  };

  // Save access token to localStorage
  const saveLocalStorageConfig = (accessToken) => {
    try {
      if (accessToken) {
        localStorage.setItem('figmaAccessToken', accessToken);
      } else {
        localStorage.removeItem('figmaAccessToken');
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  const loadConfig = async () => {
    try {
      const response = await axios.get(`${API_BASE}/design-comparison/config`);
      if (response.data.configured && response.data.config) {
        setConfig(prev => ({ 
          ...prev, 
          configured: response.data.configured,
          figmaFileKey: response.data.config.figmaFileKey,
          tolerance: response.data.config.tolerance || prev.tolerance,
          lastUpdated: response.data.config.lastUpdated
        }));
      } else {
        setConfig(prev => ({ ...prev, configured: false }));
      }
    } catch (error) {
      console.error('Error loading config:', error);
      setConfig(prev => ({ ...prev, configured: false }));
    }
  };

  const loadReports = async () => {
    try {
      const response = await axios.get(`${API_BASE}/design-comparison/reports`);
      setReports(response.data.reports || []);
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  };

  // Layer management functions
  const loadLayers = async () => {
    if (!config.figmaAccessToken || !config.figmaFileKey) {
      setSnackbar({
        open: true,
        message: 'Please configure Figma API key and file ID first',
        severity: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/design-comparison/layers`, {
        params: {
          fileId: config.figmaFileKey,
          type: selectedLayerType || undefined,
          search: layerSearch || undefined,
          mainOnly: 'true', // Use refined filtering strategy
          minWidth: '100',
          minHeight: '100',
          includeInvisible: 'false'
        },
        headers: {
          'X-Figma-Token': config.figmaAccessToken
        }
      });

      // Handle new API response structure
      const layersData = response.data.layers || response.data;
      const summary = response.data.summary;

      console.log('Loaded Figma layers:', {
        totalLayers: layersData.length,
        filterStrategy: summary?.filterStrategy,
        appliedFilters: summary?.appliedFilters
      });

      setLayers(layersData);
      setLayerFilterSummary(summary); // Store summary for UI display
      
      // Load thumbnails for the layers
      if (layersData && layersData.length > 0) {
        await loadLayerThumbnails(layersData.map(layer => layer.id));
      }
    } catch (error) {
      console.error('Failed to load layers:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load Figma layers',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadLayerThumbnails = async (layerIds) => {
    if (!layerIds || layerIds.length === 0) return;
    
    try {
      // Filter to get frames first (they usually need better thumbnails)
      const frameIds = layers
        .filter(layer => layer.type === 'FRAME' && layerIds.includes(layer.id))
        .map(layer => layer.id);
      
      const otherLayerIds = layerIds.filter(id => !frameIds.includes(id));
      
      // Load frame thumbnails with better quality
      if (frameIds.length > 0) {
        const frameResponse = await axios.post(`${API_BASE}/design-comparison/layer-thumbnails`, {
          layerIds: frameIds,
          size: 'medium' // Better quality for frames
        }, {
          headers: {
            'X-Figma-Token': config.figmaAccessToken
          }
        });
        
        // Handle the new response format where each thumbnail is an object with url property
        const frameThumbnailUrls = {}
        Object.entries(frameResponse.data.thumbnails || {}).forEach(([layerId, thumbnailData]) => {
          if (thumbnailData && thumbnailData.url) {
            frameThumbnailUrls[layerId] = thumbnailData.url
          }
        })
        
        setLayerThumbnails(prev => ({
          ...prev,
          ...frameThumbnailUrls
        }));
      }
      
      // Load other layer thumbnails with standard quality
      if (otherLayerIds.length > 0) {
        const otherResponse = await axios.post(`${API_BASE}/design-comparison/layer-thumbnails`, {
          layerIds: otherLayerIds,
          size: 'small'
        }, {
          headers: {
            'X-Figma-Token': config.figmaAccessToken
          }
        });
        
        // Handle the new response format where each thumbnail is an object with url property
        const otherThumbnailUrls = {}
        Object.entries(otherResponse.data.thumbnails || {}).forEach(([layerId, thumbnailData]) => {
          if (thumbnailData && thumbnailData.url) {
            otherThumbnailUrls[layerId] = thumbnailData.url
          }
        })
        
        setLayerThumbnails(prev => ({
          ...prev,
          ...otherThumbnailUrls
        }));
      }
      
    } catch (error) {
      console.error('Failed to load layer thumbnails:', error);
      // Don't show error to user for thumbnails - they're optional
    }
  };

  const handleLayerSelection = (layerId) => {
    setSelectedLayers(prev => 
      prev.includes(layerId) 
        ? prev.filter(id => id !== layerId)
        : [...prev, layerId]
    );
  };

  const exportSelectedLayers = async (format = 'jpg', scale = 1) => {
    if (selectedLayers.length === 0) {
      setSnackbar({
        open: true,
        message: 'Please select layers to export',
        severity: 'warning'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/design-comparison/export-layers`, {
        fileId: config.figmaFileKey,
        layerIds: selectedLayers,
        format,
        scale
      }, {
        headers: {
          'X-Figma-Token': config.figmaAccessToken
        }
      });

      // Download each exported layer
      const exportedLayers = response.data.exportedLayers || [];
      let downloadedCount = 0;

      for (const layer of exportedLayers) {
        if (layer.dataUrl && layer.filename) {
          try {
            // Create download link for base64 data
            const link = document.createElement('a');
            link.href = layer.dataUrl;
            link.download = layer.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            downloadedCount++;
          } catch (downloadError) {
            console.error(`Error downloading ${layer.filename}:`, downloadError);
          }
        } else if (layer.imageUrl && layer.layerId) {
          try {
            // Fallback: open image URL in new tab if base64 not available
            const link = document.createElement('a');
            link.href = layer.imageUrl;
            link.target = '_blank';
            link.download = `layer-${layer.layerId}.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            downloadedCount++;
          } catch (downloadError) {
            console.error(`Error opening image URL for layer ${layer.layerId}:`, downloadError);
          }
        }
      }

      setSnackbar({
        open: true,
        message: downloadedCount > 0 
          ? `Downloaded ${downloadedCount} of ${selectedLayers.length} layers successfully`
          : 'Export completed - check browser downloads or opened tabs',
        severity: downloadedCount > 0 ? 'success' : 'info'
      });

    } catch (error) {
      console.error('Failed to export layers:', error);
      setSnackbar({
        open: true,
        message: 'Failed to export layers',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadScenarios = async () => {
    try {
      const response = await axios.get(`${API_BASE}/scenarios`);
      setScenarios(response.data.scenarios || []);
    } catch (error) {
      console.error('Error loading scenarios:', error);
    }
  };

  const saveConfig = async () => {
    try {
      setLoading(true);
      setError('');
      
      await axios.post(`${API_BASE}/design-comparison/config`, {
        figmaAccessToken: config.figmaAccessToken,
        figmaFileKey: config.figmaFileKey,
        tolerance: config.tolerance
      });
      
      // Save access token to localStorage for future use
      saveLocalStorageConfig(config.figmaAccessToken);
      
      setSuccess('Design comparison configuration saved successfully!');
      setConfig(prev => ({ ...prev, configured: true }));
      setConfigDialogOpen(false);
      
      // Reload config to get the saved data
      await loadConfig();
      
    } catch (error) {
      setError(error.response?.data?.error || 'Error saving configuration');
    } finally {
      setLoading(false);
    }
  };

  const runComparison = async (scenario) => {
    try {
      setLoading(true);
      setError('');
      
      const scenarioConfig = {
        ...scenario,
        enableDesignComparison: true,
        figmaFileKey: config.figmaFileKey
      };
      
      const response = await axios.post(`${API_BASE}/design-comparison/run`, {
        scenario: scenarioConfig
      });
      
      setSuccess(`Design comparison completed! Found ${response.data.result.totalMismatches} mismatches.`);
      loadReports();
      
    } catch (error) {
      setError(error.response?.data?.error || 'Error running design comparison');
    } finally {
      setLoading(false);
    }
  };

  const runBatchComparison = async () => {
    try {
      setLoading(true);
      setError('');
      
      const scenarioConfigs = selectedScenarios.map(scenario => ({
        ...scenario,
        enableDesignComparison: true,
        figmaFileKey: config.figmaFileKey,
        selectedLayers: selectedComparisonLayers // Include selected layers for comparison
      }));
      
      const response = await axios.post(`${API_BASE}/design-comparison/batch`, {
        scenarios: scenarioConfigs
      });
      
      setSuccess(`Batch comparison completed! ${response.data.summary.completedScenarios}/${response.data.summary.totalScenarios} scenarios processed.`);
      loadReports();
      
    } catch (error) {
      setError(error.response?.data?.error || 'Error running batch comparison');
    } finally {
      setLoading(false);
    }
  };

  const viewReport = async (report) => {
    try {
      const response = await axios.get(`${API_BASE}/design-comparison/reports/${report.filename}`);
      setSelectedReport(response.data);
      setReportDialogOpen(true);
    } catch (error) {
      setError('Error loading report');
    }
  };

  const deleteReport = async (filename) => {
    try {
      await axios.delete(`${API_BASE}/design-comparison/reports/${filename}`);
      setSuccess('Report deleted successfully');
      loadReports();
    } catch (error) {
      setError('Error deleting report');
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'major': return 'error';
      case 'moderate': return 'warning';
      case 'minor': return 'info';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'major': return <ErrorIcon />;
      case 'moderate': return <WarningIcon />;
      case 'minor': return <CheckCircleIcon />;
      default: return null;
    }
  };

  return (
    <Box sx={{ 
      width: '100%', 
      p: 3
    }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'primary.main' }}>
        Design-to-Code Comparison
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Compare your live implementation with Figma designs to identify visual inconsistencies.
      </Typography>

      {/* Configuration Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6">Configuration</Typography>
              <Typography variant="body2" color="text.secondary">
                {config.configured 
                  ? `Connected to Figma file: ${config.figmaFileKey?.substring(0, 20)}...`
                  : 'Not configured - Figma credentials required'
                }
              </Typography>
              {config.configured && config.lastUpdated && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Last saved: {new Date(config.lastUpdated).toLocaleString()}
                </Typography>
              )}
            </Box>
            <Button
              variant={config.configured ? "outlined" : "contained"}
              startIcon={<SettingsIcon />}
              onClick={() => setConfigDialogOpen(true)}
            >
              {config.configured ? 'Reconfigure' : 'Configure'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Layer Management */}
      {config.configured && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Figma Layer Management</Typography>
              <Button
                variant="outlined"
                onClick={() => setLayersDialogOpen(true)}
                startIcon={<ViewIcon />}
              >
                Manage Layers
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Browse and export Figma layers from your design file
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Scenario Selection and Batch Run */}
      {config.configured && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Run Design Comparison</Typography>
            
            <Grid container spacing={3}>
              {/* Scenario Selection */}
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select scenarios to run design comparison:
                </Typography>
                
                <Box sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, p: 1 }}>
                  {scenarios.map((scenario) => (
                    <FormControlLabel
                      key={scenario.label}
                      control={
                        <Switch
                          checked={selectedScenarios.some(s => s.label === scenario.label)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedScenarios(prev => [...prev, scenario]);
                            } else {
                              setSelectedScenarios(prev => prev.filter(s => s.label !== scenario.label));
                            }
                          }}
                        />
                      }
                      label={`${scenario.label} (${scenario.url})`}
                      sx={{ display: 'block', mb: 1 }}
                    />
                  ))}
                </Box>
                
                <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    onClick={() => setSelectedScenarios(scenarios)}
                    disabled={scenarios.length === 0}
                  >
                    Select All
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setSelectedScenarios([])}
                    disabled={selectedScenarios.length === 0}
                  >
                    Clear All
                  </Button>
                </Box>
              </Grid>
              
              {/* Figma Layer Selection */}
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select Figma layers to compare against:
                </Typography>
                
                <Box sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, p: 1 }}>
                  {layers.length === 0 ? (
                    <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                      <Typography variant="body2">
                        No Figma layers loaded. Click "Manage Layers" to load layers.
                      </Typography>
                    </Box>
                  ) : (
                    layers
                      .sort((a, b) => {
                        // Sort frames first, then by name
                        if (a.type === 'FRAME' && b.type !== 'FRAME') return -1;
                        if (a.type !== 'FRAME' && b.type === 'FRAME') return 1;
                        return a.name.localeCompare(b.name);
                      })
                      .map((layer) => (
                      <Box key={layer.id} sx={{ display: 'flex', alignItems: 'center', mb: 1, p: 0.5 }}>
                        {/* Layer Thumbnail */}
                        <Box sx={{ mr: 1, flexShrink: 0 }}>
                          {layerThumbnails[layer.id] ? (
                            <Box
                              component="img"
                              src={layerThumbnails[layer.id]}
                              alt={`${layer.name} thumbnail`}
                              sx={{
                                width: layer.type === 'FRAME' ? 48 : 32,
                                height: layer.type === 'FRAME' ? 48 : 32,
                                borderRadius: 1,
                                objectFit: 'cover',
                                border: layer.type === 'FRAME' ? '2px solid #1976d2' : '1px solid #e0e0e0',
                                backgroundColor: '#f5f5f5'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <Box
                              sx={{
                                width: layer.type === 'FRAME' ? 48 : 32,
                                height: layer.type === 'FRAME' ? 48 : 32,
                                borderRadius: 1,
                                backgroundColor: layer.type === 'FRAME' ? '#e3f2fd' : '#f5f5f5',
                                border: layer.type === 'FRAME' ? '2px solid #1976d2' : '1px solid #e0e0e0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Typography 
                                variant="caption" 
                                color={layer.type === 'FRAME' ? 'primary' : 'text.secondary'} 
                                sx={{ 
                                  fontSize: layer.type === 'FRAME' ? '12px' : '10px',
                                  fontWeight: layer.type === 'FRAME' ? 'bold' : 'normal'
                                }}
                              >
                                {layer.type === 'FRAME' ? '🖼️' : layer.type.charAt(0)}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                        
                        <FormControlLabel
                          control={
                            <Switch
                              checked={selectedComparisonLayers.includes(layer.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedComparisonLayers(prev => [...prev, layer.id]);
                                } else {
                                  setSelectedComparisonLayers(prev => prev.filter(id => id !== layer.id));
                                }
                              }}
                            />
                          }
                          label={`${layer.name} (${layer.type})`}
                          sx={{ flex: 1, margin: 0 }}
                        />
                      </Box>
                    ))
                  )}
                </Box>
                
                <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    onClick={() => setSelectedComparisonLayers(layers.map(layer => layer.id))}
                    disabled={layers.length === 0}
                  >
                    Select All
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setSelectedComparisonLayers([])}
                    disabled={selectedComparisonLayers.length === 0}
                  >
                    Clear All
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setLayersDialogOpen(true)}
                  >
                    Manage Layers
                  </Button>
                </Box>
              </Grid>
              
              {/* Run Button */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={loading ? <CircularProgress size={20} /> : <PlayIcon />}
                    onClick={runBatchComparison}
                    disabled={loading || selectedScenarios.length === 0 || selectedComparisonLayers.length === 0}
                    sx={{ minWidth: 300 }}
                  >
                    Run Design Comparison 
                    {selectedScenarios.length > 0 && selectedComparisonLayers.length > 0 && 
                      ` (${selectedScenarios.length} scenarios × ${selectedComparisonLayers.length} layers)`
                    }
                  </Button>
                </Box>
                
                {(selectedScenarios.length === 0 || selectedComparisonLayers.length === 0) && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 1 }}>
                    {selectedScenarios.length === 0 && selectedComparisonLayers.length === 0 
                      ? "Please select both scenarios and Figma layers to run comparison"
                      : selectedScenarios.length === 0 
                        ? "Please select at least one scenario" 
                        : "Please select at least one Figma layer"
                    }
                  </Typography>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Reports List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Comparison Reports</Typography>
          
          {reports.length === 0 ? (
            <Typography color="text.secondary">
              No comparison reports yet. Configure Figma settings and run your first comparison.
            </Typography>
          ) : (
            <List>
              {reports.map((report) => (
                <ListItem key={report.filename} divider>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1">
                          {report.scenario}
                        </Typography>
                        <Chip
                          label={`${report.totalMismatches} mismatches`}
                          color={report.totalMismatches === 0 ? 'success' : report.totalMismatches > 10 ? 'error' : 'warning'}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {report.url}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(report.timestamp).toLocaleString()}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="View Report">
                        <IconButton onClick={() => viewReport(report)} size="small">
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View HTML Report">
                        <IconButton 
                          onClick={() => window.open(`${API_BASE}/design-comparison/reports/${report.filename}/html`, '_blank')}
                          size="small"
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Report">
                        <IconButton onClick={() => deleteReport(report.filename)} size="small" color="error">
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Configure Design Comparison</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Figma Access Token"
              type="password"
              value={config.figmaAccessToken}
              onChange={(e) => setConfig(prev => ({ ...prev, figmaAccessToken: e.target.value }))}
              margin="normal"
              helperText="Get your token from Figma Settings > Account > Personal access tokens"
            />
            
            <TextField
              fullWidth
              label="Figma File Key"
              value={config.figmaFileKey}
              onChange={(e) => setConfig(prev => ({ ...prev, figmaFileKey: e.target.value }))}
              margin="normal"
              helperText="File key from your Figma URL: figma.com/file/{FILE_KEY}/..."
            />
            
            <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>Tolerance Settings</Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="Font Size (px)"
                  type="number"
                  value={config.tolerance.fontSize}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    tolerance: { ...prev.tolerance, fontSize: parseInt(e.target.value) || 0 }
                  }))}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="Spacing (px)"
                  type="number"
                  value={config.tolerance.spacing}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    tolerance: { ...prev.tolerance, spacing: parseInt(e.target.value) || 0 }
                  }))}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="Color Diff"
                  type="number"
                  value={config.tolerance.color}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    tolerance: { ...prev.tolerance, color: parseInt(e.target.value) || 0 }
                  }))}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={saveConfig} 
            variant="contained" 
            disabled={!config.figmaAccessToken || !config.figmaFileKey}
          >
            Save Configuration
          </Button>
        </DialogActions>
      </Dialog>

      {/* Report Details Dialog */}
      <Dialog open={reportDialogOpen} onClose={() => setReportDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Design Comparison Report - {selectedReport?.metadata?.scenario}
        </DialogTitle>
        <DialogContent>
          {selectedReport && (
            <Box sx={{ pt: 2 }}>
              {/* Statistics */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {selectedReport.statistics.totalMismatches}
                    </Typography>
                    <Typography variant="body2">Total Mismatches</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="error">
                      {selectedReport.statistics.bySeverity.major}
                    </Typography>
                    <Typography variant="body2">Major Issues</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main">
                      {selectedReport.statistics.bySeverity.moderate}
                    </Typography>
                    <Typography variant="body2">Moderate Issues</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="info.main">
                      {selectedReport.statistics.bySeverity.minor}
                    </Typography>
                    <Typography variant="body2">Minor Issues</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Mismatches Table */}
              {selectedReport.mismatches && selectedReport.mismatches.length > 0 && (
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Element</TableCell>
                        <TableCell>Property</TableCell>
                        <TableCell>DOM Value</TableCell>
                        <TableCell>Figma Value</TableCell>
                        <TableCell>Severity</TableCell>
                        <TableCell>Difference</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedReport.mismatches.map((mismatch, index) => 
                        mismatch.mismatches.map((issue, issueIndex) => (
                          <TableRow key={`${index}-${issueIndex}`}>
                            <TableCell>{mismatch.selector}</TableCell>
                            <TableCell>{issue.property}</TableCell>
                            <TableCell>{issue.domValue}</TableCell>
                            <TableCell>{issue.figmaValue}</TableCell>
                            <TableCell>
                              <Chip
                                icon={getSeverityIcon(issue.severity)}
                                label={issue.severity}
                                color={getSeverityColor(issue.severity)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>{issue.difference}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialogOpen(false)}>Close</Button>
          {selectedReport && (
            <Button
              onClick={() => window.open(`${API_BASE}/design-comparison/reports/${selectedReport.metadata.scenario.replace(/[^a-zA-Z0-9]/g, '-')}.html`, '_blank')}
              variant="contained"
            >
              View Full HTML Report
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Layer Management Dialog */}
      <Dialog 
        open={layersDialogOpen} 
        onClose={() => setLayersDialogOpen(false)}
        maxWidth={false}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: '#f8f9fa',
            display: 'flex',
            flexDirection: 'column'
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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                🎨 Figma Layer Management
              </Typography>
              <Chip 
                label={`${layers.length} layers`}
                color="primary"
                variant="outlined"
                size="small"
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={loadLayers}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} /> : <ViewIcon />}
                size="large"
              >
                {loading ? 'Loading...' : 'Load Layers'}
              </Button>
              <Button
                onClick={() => setLayersDialogOpen(false)}
                size="large"
                sx={{ minWidth: 'auto', p: 1.5 }}
              >
                <Close />
              </Button>
            </Box>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ 
          flex: 1, 
          p: 3, 
          bgcolor: '#f8f9fa',
          overflow: 'auto'
        }}>
          {/* Search and Filter Controls */}
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
                  label="Search layers"
                  value={layerSearch}
                  onChange={(e) => setLayerSearch(e.target.value)}
                  placeholder="Type to search layers..."
                  size="large"
                  InputProps={{
                    startAdornment: (
                      <Box sx={{ mr: 1, color: 'text.secondary' }}>
                        🔍
                      </Box>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="large">
                  <InputLabel>Layer Type</InputLabel>
                  <Select
                    value={selectedLayerType}
                    onChange={(e) => setSelectedLayerType(e.target.value)}
                    label="Layer Type"
                  >
                    <MenuItem value="">All Types</MenuItem>
                    <MenuItem value="FRAME">🖼️ Frame</MenuItem>
                    <MenuItem value="TEXT">📝 Text</MenuItem>
                    <MenuItem value="RECTANGLE">▭ Rectangle</MenuItem>
                    <MenuItem value="ELLIPSE">⭕ Ellipse</MenuItem>
                    <MenuItem value="VECTOR">📐 Vector</MenuItem>
                    <MenuItem value="COMPONENT">🧩 Component</MenuItem>
                    <MenuItem value="INSTANCE">📋 Instance</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
                  <Button
                    variant="outlined"
                    onClick={() => setSelectedLayers(layers.map(layer => layer.id))}
                    disabled={layers.length === 0}
                    size="large"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setSelectedLayers([])}
                    disabled={selectedLayers.length === 0}
                    size="large"
                  >
                    Clear All
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>

          {/* Layer Grid */}
          {layers.length > 0 ? (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Found {layers.length} layers ({layers.filter(l => l.type === 'FRAME').length} frames)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedLayers.length} selected
                </Typography>
              </Box>

              <Grid container spacing={3}>
                {layers
                  .sort((a, b) => {
                    // Sort frames first, then by name
                    if (a.type === 'FRAME' && b.type !== 'FRAME') return -1;
                    if (a.type !== 'FRAME' && b.type === 'FRAME') return 1;
                    return a.name.localeCompare(b.name);
                  })
                  .map((layer) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={layer.id}>
                      <Card
                        sx={{
                          height: '100%',
                          cursor: 'pointer',
                          border: selectedLayers.includes(layer.id) ? '3px solid #1976d2' : '1px solid #e0e0e0',
                          borderRadius: 2,
                          transition: 'all 0.3s ease',
                          bgcolor: selectedLayers.includes(layer.id) ? '#e3f2fd' : '#fff',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                            borderColor: '#1976d2'
                          },
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                        onClick={() => handleLayerSelection(layer.id)}
                      >
                        {/* Selection Checkbox */}
                        <Box sx={{ 
                          position: 'absolute', 
                          top: 8, 
                          left: 8, 
                          zIndex: 2,
                          bgcolor: 'rgba(255,255,255,0.9)',
                          borderRadius: '50%',
                          p: 0.5
                        }}>
                          <Checkbox
                            checked={selectedLayers.includes(layer.id)}
                            onChange={() => handleLayerSelection(layer.id)}
                            size="small"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Box>

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
                          height: 180, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          bgcolor: '#f5f5f5',
                          position: 'relative',
                          overflow: 'hidden'
                        }}>
                          {layerThumbnails[layer.id] ? (
                            <Box
                              component="img"
                              src={layerThumbnails[layer.id]}
                              alt={`${layer.name} thumbnail`}
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
                                width: 80,
                                height: 80,
                                borderRadius: 2,
                                backgroundColor: layer.type === 'FRAME' ? '#e3f2fd' : '#f5f5f5',
                                border: layer.type === 'FRAME' ? '2px solid #1976d2' : '2px solid #e0e0e0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Typography 
                                variant="h4"
                                color={layer.type === 'FRAME' ? 'primary' : 'text.secondary'}
                                sx={{ 
                                  fontWeight: layer.type === 'FRAME' ? 'bold' : 'normal'
                                }}
                              >
                                {layer.type === 'FRAME' ? '🖼️' : 
                                 layer.type === 'TEXT' ? '📝' :
                                 layer.type === 'COMPONENT' ? '🧩' :
                                 layer.type === 'INSTANCE' ? '📋' :
                                 layer.type === 'RECTANGLE' ? '▭' :
                                 layer.type === 'ELLIPSE' ? '⭕' :
                                 layer.type === 'VECTOR' ? '📐' : '📄'}
                              </Typography>
                            </Box>
                          )}
                        </Box>

                        {/* Layer Info */}
                        <CardContent sx={{ p: 2 }}>
                          <Typography 
                            variant="h6" 
                            noWrap 
                            sx={{ 
                              fontWeight: 'bold',
                              mb: 1,
                              fontSize: '1rem'
                            }}
                            title={layer.name}
                          >
                            {layer.name}
                          </Typography>
                          
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            {layer.width && layer.height && (
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
                            )}
                            
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
                          
                          {/* Additional metadata */}
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {layer.path && `Path: ${layer.path}`}
                          </Typography>
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
              <Typography variant="h5" color="text.secondary" sx={{ mb: 2 }}>
                🎨 No layers loaded
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Click "Load Layers" to fetch layers from your Figma file
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={loadLayers}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <ViewIcon />}
                size="large"
              >
                {loading ? 'Loading...' : 'Load Layers'}
              </Button>
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
              {selectedLayers.length > 0 && `${selectedLayers.length} layers selected`}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button 
                onClick={() => setLayersDialogOpen(false)}
                size="large"
                variant="outlined"
              >
                Close
              </Button>
              <Button
                variant="contained"
                onClick={() => setExportDialogOpen(true)}
                disabled={selectedLayers.length === 0}
                size="large"
                startIcon={<Box sx={{ fontSize: '1.2rem' }}>📤</Box>}
              >
                Export Selected ({selectedLayers.length})
              </Button>
            </Box>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Export Dialog */}
      <Dialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Export Layers</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Export {selectedLayers.length} selected layers
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Format</InputLabel>
                <Select 
                  value={exportFormat} 
                  onChange={(e) => setExportFormat(e.target.value)}
                  label="Format"
                >
                  <MenuItem value="png">PNG</MenuItem>
                  <MenuItem value="jpg">JPG</MenuItem>
                  <MenuItem value="svg">SVG</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Scale</InputLabel>
                <Select 
                  value={exportScale} 
                  onChange={(e) => setExportScale(e.target.value)}
                  label="Scale"
                >
                  <MenuItem value={1}>1x</MenuItem>
                  <MenuItem value={2}>2x</MenuItem>
                  <MenuItem value={3}>3x</MenuItem>
                  <MenuItem value={4}>4x</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              exportSelectedLayers(exportFormat, exportScale);
              setExportDialogOpen(false);
            }}
            disabled={loading}
          >
            {loading ? 'Exporting...' : 'Export'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DesignComparison;
