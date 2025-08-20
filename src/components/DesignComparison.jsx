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
  Checkbox,
  Snackbar,
  Tabs,
  Tab,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Tooltip
} from '@mui/material';
import EnhancedDesignInsights from './EnhancedDesignInsights';
import {
  PlayArrow as PlayIcon,
  Settings as SettingsIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon
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
  
  const [tempConfig, setTempConfig] = useState({
    figmaToken: '',
    figmaFileKey: '',
    baseUrl: 'http://localhost:3000',
    viewport: 'desktop'
  });
  
  const [reports, setReports] = useState([]);
  const [layers, setLayers] = useState([]);
  const [layerThumbnails, setLayerThumbnails] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [layersDialogOpen, setLayersDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarios, setSelectedScenarios] = useState([]);
  const [selectedComparisonLayers, setSelectedComparisonLayers] = useState([]);
  
  // Enhanced Design Insights state
  const [activeTab, setActiveTab] = useState(0);
  const [enhancedAnalysisResults, setEnhancedAnalysisResults] = useState(null);
  const [isRunningEnhancedAnalysis, setIsRunningEnhancedAnalysis] = useState(false);

  useEffect(() => {
    loadConfig();
    loadReports();
    loadScenarios();
    loadLocalStorageConfig();
  }, []);

  // Load access token from localStorage
  const loadLocalStorageConfig = () => {
    try {
      const savedToken = localStorage.getItem('figmaAccessToken');
      if (savedToken) {
        setConfig(prev => ({ ...prev, figmaAccessToken: savedToken }));
        setTempConfig(prev => ({ ...prev, figmaToken: savedToken }));
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
        setTempConfig(prev => ({
          ...prev,
          figmaFileKey: response.data.config.figmaFileKey
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

  const loadScenarios = async () => {
    try {
      const response = await axios.get(`${API_BASE}/scenarios`);
      setScenarios(response.data.scenarios || []);
    } catch (error) {
      console.error('Error loading scenarios:', error);
    }
  };

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
          fileId: config.figmaFileKey
        },
        headers: {
          'X-Figma-Token': config.figmaAccessToken
        }
      });

      const layersData = response.data.layers || response.data;
      setLayers(layersData);
      
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
      const response = await axios.post(`${API_BASE}/design-comparison/layer-thumbnails`, {
        layerIds: layerIds,
        size: 'medium'
      }, {
        headers: {
          'X-Figma-Token': config.figmaAccessToken
        }
      });
      
      const thumbnailUrls = {};
      Object.entries(response.data.thumbnails || {}).forEach(([layerId, thumbnailData]) => {
        if (thumbnailData && thumbnailData.url) {
          thumbnailUrls[layerId] = thumbnailData.url;
        }
      });
      
      setLayerThumbnails(prev => ({
        ...prev,
        ...thumbnailUrls
      }));
      
    } catch (error) {
      console.error('Failed to load layer thumbnails:', error);
    }
  };

  const saveConfiguration = async () => {
    try {
      setLoading(true);
      setError('');
      
      await axios.post(`${API_BASE}/design-comparison/config`, {
        figmaAccessToken: tempConfig.figmaToken,
        figmaFileKey: tempConfig.figmaFileKey,
        tolerance: config.tolerance
      });
      
      // Save access token to localStorage for future use
      saveLocalStorageConfig(tempConfig.figmaToken);
      
      setSuccess('Design comparison configuration saved successfully!');
      setConfig(prev => ({ 
        ...prev, 
        configured: true,
        figmaAccessToken: tempConfig.figmaToken,
        figmaFileKey: tempConfig.figmaFileKey
      }));
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

  // Enhanced Analysis Functions
  const runEnhancedAnalysis = async () => {
    try {
      setIsRunningEnhancedAnalysis(true);
      setError('');
      
      if (!config.configured) {
        setError('Please configure Figma integration first');
        return;
      }

      if (selectedScenarios.length === 0) {
        setError('Please select at least one scenario to analyze');
        return;
      }

      const scenarioConfig = {
        ...selectedScenarios[0], // For now, use the first selected scenario
        enableDesignComparison: true,
        figmaFileKey: config.figmaFileKey,
        selectedLayers: selectedComparisonLayers
      };
      
      console.log('🚀 Running enhanced design analysis...', scenarioConfig);
      
      const response = await axios.post(`${API_BASE}/design-comparison/enhanced-run`, {
        scenarioConfig: scenarioConfig
      });
      
      if (response.data.success) {
        setEnhancedAnalysisResults(response.data.results);
        setSuccess(`Enhanced analysis completed! Found ${response.data.results.detailedInsights?.prioritizedIssues?.length || 0} prioritized issues.`);
        
        // Switch to Enhanced Insights tab
        setActiveTab(2);
      } else {
        setError('Enhanced analysis failed: ' + (response.data.error || 'Unknown error'));
      }
      
    } catch (error) {
      console.error('Enhanced analysis error:', error);
      setError(error.response?.data?.error || 'Error running enhanced analysis');
    } finally {
      setIsRunningEnhancedAnalysis(false);
    }
  };

  const exportLayer = async (layerId) => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE}/design-comparison/export-layers`, {
        fileId: config.figmaFileKey,
        layerIds: [layerId],
        format: 'jpg',
        scale: 1
      }, {
        headers: {
          'X-Figma-Token': config.figmaAccessToken
        }
      });
      
      // Handle download
      const exportedLayers = response.data.exportedLayers || [];
      if (exportedLayers.length > 0 && exportedLayers[0].dataUrl) {
        const link = document.createElement('a');
        link.href = exportedLayers[0].dataUrl;
        link.download = exportedLayers[0].filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      setSnackbar({
        open: true,
        message: 'Layer exported successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Failed to export layer:', error);
      setSnackbar({
        open: true,
        message: 'Failed to export layer',
        severity: 'error'
      });
    } finally {
      setLoading(false);
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

      {/* Main Tabs Interface */}
      <Card sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(event, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Basic Comparison" />
          <Tab label="Layer Management" />
          <Tab label="🎨 Enhanced Insights" />
          <Tab label="Reports & History" />
        </Tabs>

        {/* Tab Content */}
        <Box sx={{ p: 3 }}>
          {/* Tab 0: Basic Comparison */}
          {activeTab === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>Basic Design Comparison</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Run standard design-to-code comparisons with BackstopJS integration.
              </Typography>
              
              {/* Scenarios Selection for Basic Comparison */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>Select Scenarios to Compare</Typography>
                <Box sx={{ maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                  {scenarios.map((scenario) => (
                    <FormControlLabel
                      key={scenario.label}
                      control={
                        <Checkbox
                          checked={selectedScenarios.includes(scenario)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedScenarios([...selectedScenarios, scenario]);
                            } else {
                              setSelectedScenarios(selectedScenarios.filter(s => s !== scenario));
                            }
                          }}
                        />
                      }
                      label={`${scenario.label} (${scenario.url})`}
                    />
                  ))}
                </Box>
              </Box>

              <Button
                variant="contained"
                startIcon={<PlayIcon />}
                onClick={() => selectedScenarios.length > 0 && runComparison(selectedScenarios[0])}
                disabled={loading || !config.configured || selectedScenarios.length === 0}
                sx={{ mr: 2 }}
              >
                {loading ? <CircularProgress size={20} /> : 'Run Basic Comparison'}
              </Button>
            </Box>
          )}

          {/* Tab 1: Layer Management */}
          {activeTab === 1 && config.configured && (
            <Box>
              <Typography variant="h6" gutterBottom>Figma Layer Management</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select specific Figma layers to compare with your implementation.
              </Typography>
              
              <Button
                variant="outlined"
                onClick={() => setLayersDialogOpen(true)}
                startIcon={<ViewIcon />}
                sx={{ mb: 2 }}
              >
                Browse & Select Layers ({selectedComparisonLayers.length} selected)
              </Button>

              {selectedComparisonLayers.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Selected Layers:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {selectedComparisonLayers.map((layerId) => (
                      <Chip 
                        key={layerId}
                        label={layerId}
                        size="small"
                        onDelete={() => {
                          setSelectedComparisonLayers(prev => prev.filter(id => id !== layerId));
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* Tab 2: Enhanced Insights */}
          {activeTab === 2 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                  <Typography variant="h6" gutterBottom>🎨 Enhanced Design Insights</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Advanced analysis with detailed mismatch insights, visual analysis, and actionable recommendations.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  onClick={runEnhancedAnalysis}
                  disabled={isRunningEnhancedAnalysis || !config.configured || selectedScenarios.length === 0}
                  startIcon={isRunningEnhancedAnalysis ? <CircularProgress size={20} /> : <PlayIcon />}
                  sx={{ 
                    background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #5a6fd8 30%, #6a4190 90%)',
                    }
                  }}
                >
                  {isRunningEnhancedAnalysis ? 'Analyzing...' : 'Run Enhanced Analysis'}
                </Button>
              </Box>

              {!config.configured && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Please configure Figma integration first to use enhanced analysis.
                </Alert>
              )}

              {config.configured && selectedScenarios.length === 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Please select at least one scenario from the Basic Comparison tab to analyze.
                </Alert>
              )}

              <EnhancedDesignInsights 
                analysisResults={enhancedAnalysisResults}
                onRunEnhancedAnalysis={runEnhancedAnalysis}
              />
            </Box>
          )}

          {/* Tab 3: Reports & History */}
          {activeTab === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom>Reports & History</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                View and manage your design comparison reports.
              </Typography>
              
              <Button
                variant="outlined"
                onClick={loadReports}
                disabled={loading}
                sx={{ mb: 2 }}
              >
                {loading ? <CircularProgress size={20} /> : 'Refresh Reports'}
              </Button>

              {/* Reports List */}
              {reports.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Recent Reports</Typography>
                  <List>
                    {reports.slice(0, 5).map((report, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={report.name || `Report ${index + 1}`}
                          secondary={report.timestamp ? new Date(report.timestamp).toLocaleString() : 'Unknown date'}
                        />
                        <ListItemSecondaryAction>
                          <IconButton onClick={() => setSelectedReport(report)}>
                            <ViewIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Card>

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

      {/* Configuration Dialog */}
      <Dialog 
        open={configDialogOpen} 
        onClose={() => setConfigDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Configure Design Comparison</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Set up your Figma integration and comparison settings.
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Figma Personal Access Token"
                type="password"
                value={tempConfig.figmaToken}
                onChange={(e) => setTempConfig({...tempConfig, figmaToken: e.target.value})}
                helperText="Get your token from Figma Settings > Account > Personal access tokens"
                sx={{ mt: 2 }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Figma File Key"
                value={tempConfig.figmaFileKey}
                onChange={(e) => setTempConfig({...tempConfig, figmaFileKey: e.target.value})}
                helperText="From your Figma file URL: figma.com/file/FILE_KEY/..."
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Base URL"
                value={tempConfig.baseUrl}
                onChange={(e) => setTempConfig({...tempConfig, baseUrl: e.target.value})}
                helperText="Your application's base URL"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Viewport</InputLabel>
                <Select
                  value={tempConfig.viewport}
                  onChange={(e) => setTempConfig({...tempConfig, viewport: e.target.value})}
                >
                  <MenuItem value="phone">Phone (375×667)</MenuItem>
                  <MenuItem value="tablet">Tablet (768×1024)</MenuItem>
                  <MenuItem value="desktop">Desktop (1200×800)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={saveConfiguration}
            disabled={!tempConfig.figmaToken || !tempConfig.figmaFileKey}
          >
            Save Configuration
          </Button>
        </DialogActions>
      </Dialog>

      {/* Layers Dialog */}
      <Dialog 
        open={layersDialogOpen} 
        onClose={() => setLayersDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Figma Layers
            <IconButton onClick={() => setLayersDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              onClick={loadLayers}
              disabled={loading}
              startIcon={<RefreshIcon />}
              sx={{ mr: 2 }}
            >
              {loading ? 'Loading...' : 'Refresh Layers'}
            </Button>
            
            {layers.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Found {layers.length} layers in your Figma file
              </Typography>
            )}
          </Box>

          {layers.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No layers loaded. Click "Refresh Layers" to load from Figma.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedComparisonLayers.length > 0 && selectedComparisonLayers.length < layers.length}
                        checked={layers.length > 0 && selectedComparisonLayers.length === layers.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedComparisonLayers(layers.map(l => l.id));
                          } else {
                            setSelectedComparisonLayers([]);
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {layers.map((layer) => (
                    <TableRow key={layer.id}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedComparisonLayers.includes(layer.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedComparisonLayers(prev => [...prev, layer.id]);
                            } else {
                              setSelectedComparisonLayers(prev => prev.filter(id => id !== layer.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {layer.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={layer.type} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {layer.absoluteBoundingBox ? 
                            `${Math.round(layer.absoluteBoundingBox.width)}×${Math.round(layer.absoluteBoundingBox.height)}` 
                            : 'N/A'
                          }
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Export this layer">
                          <IconButton
                            size="small"
                            onClick={() => exportLayer(layer.id)}
                            disabled={loading}
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLayersDialogOpen(false)}>
            Close
          </Button>
          <Button 
            variant="contained" 
            onClick={() => setLayersDialogOpen(false)}
            disabled={selectedComparisonLayers.length === 0}
          >
            Use Selected Layers ({selectedComparisonLayers.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* Report Details Dialog */}
      {selectedReport && (
        <Dialog
          open={Boolean(selectedReport)}
          onClose={() => setSelectedReport(null)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {selectedReport.name || 'Comparison Report'}
              <IconButton onClick={() => setSelectedReport(null)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            {selectedReport.htmlContent ? (
              <iframe
                src={`data:text/html;charset=utf-8,${encodeURIComponent(selectedReport.htmlContent)}`}
                style={{ width: '100%', height: '600px', border: 'none' }}
                title="Report Content"
              />
            ) : selectedReport.reportUrl ? (
              <iframe
                src={selectedReport.reportUrl}
                style={{ width: '100%', height: '600px', border: 'none' }}
                title="Report Content"
              />
            ) : (
              <Typography>No report content available.</Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedReport(null)}>
              Close
            </Button>
            {selectedReport.reportUrl && (
              <Button
                variant="contained"
                href={selectedReport.reportUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in New Tab
              </Button>
            )}
          </DialogActions>
        </Dialog>
      )}

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
