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
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Paper,
  Divider,
  Tooltip,
  Stack,
  Avatar,
  ListItemAvatar,
  ListItemButton,
  Skeleton,
  Pagination,
  LinearProgress
} from '@mui/material';
import {
  Code as CodeIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Preview as PreviewIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  PlayArrow as PlayIcon,
  Folder as FolderIcon,
  Delete as DeleteIcon,
  FileCopy as FileCopyIcon,
  CheckCircle as CheckCircleIcon,
  Layers as LayersIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Close as CloseIcon,
  GetApp as GetAppIcon
} from '@mui/icons-material';
import axios from 'axios';
// import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

const API_BASE = 'http://localhost:5000/api';

const FigmaHTMLGenerator = () => {
  const [config, setConfig] = useState({
    figmaToken: '',
    figmaFileKey: ''
  });
  
  const [selectedPage, setSelectedPage] = useState('');
  const [selectedFrames, setSelectedFrames] = useState([]);
  
  // Enhanced layer browsing state
  const [figmaPages, setFigmaPages] = useState([]);
  const [figmaLayers, setFigmaLayers] = useState([]);
  const [filteredLayers, setFilteredLayers] = useState([]);
  const [selectedLayers, setSelectedLayers] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadingLayers, setLoadingLayers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [layerTypeFilter, setLayerTypeFilter] = useState('FRAME');
  const [currentPage, setCurrentPage] = useState(1);
  const [layersPerPage] = useState(20);
  const [totalLayers, setTotalLayers] = useState(0);
  const [hasMoreLayers, setHasMoreLayers] = useState(false);
  const [layerThumbnails, setLayerThumbnails] = useState({});
  
  const [generationOptions, setGenerationOptions] = useState({
    generateResponsive: true,
    includeInteractions: false,
    outputFormat: 'separate',
    framework: 'vanilla',
    cssFramework: 'custom'
  });
  
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [generatedResult, setGeneratedResult] = useState(null);
  const [activeCodeTab, setActiveCodeTab] = useState(0);
  const [generatedProjects, setGeneratedProjects] = useState([]);
  
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configTabValue, setConfigTabValue] = useState(0);
  const [_previewDialogOpen, _setPreviewDialogOpen] = useState(false);

  useEffect(() => {
    loadSavedConfig();
    loadGeneratedProjects();
  }, []);

  const loadSavedConfig = () => {
    try {
      const savedToken = localStorage.getItem('figmaAccessToken');
      const savedFileKey = localStorage.getItem('figmaFileKey');
      
      if (savedToken) setConfig(prev => ({ ...prev, figmaToken: savedToken }));
      if (savedFileKey) setConfig(prev => ({ ...prev, figmaFileKey: savedFileKey }));
    } catch (error) {
      console.error('Error loading saved config:', error);
    }
  };

  const loadFigmaStructure = async () => {
    if (!config.figmaToken || !config.figmaFileKey) {
      setError('Please configure Figma token and file key first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE}/figma/get-structure`, {
        figmaToken: config.figmaToken,
        figmaFileKey: config.figmaFileKey
      });

      if (response.data.success) {
        if (response.data.structure.pages.length > 0) {
          setSelectedPage(response.data.structure.pages[0].id);
        }
        setSuccess(`Loaded structure: ${response.data.structure.pages.length} pages found`);
      } else {
        setError(response.data.error || 'Failed to load Figma structure');
      }
    } catch (error) {
      console.error('Error loading Figma structure:', error);
      setError(error.response?.data?.error || 'Error loading Figma structure');
    } finally {
      setLoading(false);
    }
  };

  // Enhanced layer loading functionality
  const loadFigmaPages = async () => {
    if (!config.figmaToken || !config.figmaFileKey) {
      setError('Please configure Figma token and file key first');
      return;
    }

    setLoadingPages(true);
    setError('');

    try {
      const response = await axios.get(`${API_BASE}/design-comparison/pages`, {
        headers: {
          'X-Figma-Token': config.figmaToken
        },
        params: {
          fileId: config.figmaFileKey,
          page: 1,
          limit: 50
        }
      });

      if (response.data.pages) {
        setFigmaPages(response.data.pages);
        // Auto-select first page if none selected
        if (response.data.pages.length > 0 && !selectedPage) {
          setSelectedPage(response.data.pages[0].id);
        }
        setSuccess(`Loaded ${response.data.pages.length} pages from Figma`);
      } else {
        setError('Failed to load Figma pages');
      }
    } catch (error) {
      console.error('Error loading Figma pages:', error);
      setError(error.response?.data?.error || 'Error loading Figma pages');
    } finally {
      setLoadingPages(false);
    }
  };

  const loadFigmaLayers = async (pageNumber = 1, append = false) => {
    if (!config.figmaToken || !config.figmaFileKey || !selectedPage) {
      setError('Please select a page first');
      return;
    }

    setLoadingLayers(true);
    if (!append) {
      setError('');
      setFigmaLayers([]);
      setFilteredLayers([]);
    }

    try {
      const response = await axios.get(`${API_BASE}/design-comparison/layers`, {
        headers: {
          'X-Figma-Token': config.figmaToken
        },
        params: {
          fileId: config.figmaFileKey,
          pageId: selectedPage,
          type: layerTypeFilter === 'all' ? '' : layerTypeFilter,
          search: searchTerm,
          mainOnly: 'true',
          minWidth: '50',
          minHeight: '50',
          includeInvisible: 'false',
          page: pageNumber,
          limit: layersPerPage
        }
      });

      if (response.data.layers) {
        const newLayers = response.data.layers;
        const allLayers = append ? [...figmaLayers, ...newLayers] : newLayers;
        
        setFigmaLayers(allLayers);
        setFilteredLayers(allLayers);
        setTotalLayers(response.data.total || newLayers.length);
        setHasMoreLayers(response.data.hasMore || false);
        setCurrentPage(pageNumber);
        
        if (!append) {
          setSuccess(`Loaded ${response.data.total || newLayers.length} layers from selected page`);
        }
        
        // Load thumbnails for the new layers
        loadLayerThumbnails(newLayers);
        
        // Auto-advance to Browse tab if layers are found
        if (newLayers.length > 0 && configTabValue === 0) {
          setConfigTabValue(1);
        }
      } else {
        setError('Failed to load Figma layers');
      }
    } catch (error) {
      console.error('Error loading Figma layers:', error);
      setError(error.response?.data?.error || 'Error loading Figma layers');
    } finally {
      setLoadingLayers(false);
    }
  };

  const loadMoreLayers = () => {
    if (!loadingLayers && hasMoreLayers) {
      loadFigmaLayers(currentPage + 1, true);
    }
  };

  const loadLayerThumbnails = async (layers) => {
    if (!layers || layers.length === 0) return;

    try {
      const layerIds = layers.map(layer => layer.id).slice(0, 10); // Limit to first 10 for performance
      
      const response = await axios.get(`${API_BASE}/design-comparison/bulk-thumbnails`, {
        headers: {
          'X-Figma-Token': config.figmaToken
        },
        params: {
          fileId: config.figmaFileKey,
          ids: layerIds.join(','),
          scale: 0.3
        }
      });

      if (response.data.thumbnails) {
        setLayerThumbnails(prev => ({
          ...prev,
          ...response.data.thumbnails
        }));
      }
    } catch (error) {
      console.log('Could not load thumbnails:', error.message);
      // Don't show error to user as thumbnails are optional
    }
  };

  // Filter layers based on search and type
  const filterLayers = () => {
    let filtered = [...figmaLayers];

    if (searchTerm) {
      filtered = filtered.filter(layer => 
        layer.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (layerTypeFilter !== 'all') {
      filtered = filtered.filter(layer => layer.type === layerTypeFilter);
    }

    // Sort frames first, then by name
    filtered.sort((a, b) => {
      if (a.type === 'FRAME' && b.type !== 'FRAME') return -1;
      if (a.type !== 'FRAME' && b.type === 'FRAME') return 1;
      return a.name.localeCompare(b.name);
    });

    setFilteredLayers(filtered);
  };

  // Handle layer selection
  const toggleLayerSelection = (layer) => {
    setSelectedLayers(prev => {
      const isSelected = prev.some(l => l.id === layer.id);
      if (isSelected) {
        return prev.filter(l => l.id !== layer.id);
      } else {
        return [...prev, layer];
      }
    });
  };

  // Select layers for generation
  const selectLayersForGeneration = () => {
    if (selectedLayers.length === 0) {
      setError('Please select at least one layer');
      return;
    }

    // Convert selected layers to frames format for generation
    setSelectedFrames(selectedLayers.map(layer => layer.id));
    setConfigDialogOpen(false);
    setSuccess(`Selected ${selectedLayers.length} layers for generation`);
  };

  // Use effect for filtering
  useEffect(() => {
    if (figmaLayers.length > 0) {
      filterLayers();
    }
  }, [searchTerm, layerTypeFilter, figmaLayers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Use effect to load layers when page changes
  useEffect(() => {
    if (selectedPage && config.figmaToken && config.figmaFileKey) {
      loadFigmaLayers(1, false);
    }
  }, [selectedPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateHTMLCSS = async () => {
    if (!config.figmaToken || !config.figmaFileKey) {
      setError('Please configure Figma token and file key first');
      return;
    }

    if (selectedFrames.length === 0) {
      setError('Please select at least one layer/frame for generation');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE}/figma/generate-html-css`, {
        figmaToken: config.figmaToken,
        figmaFileKey: config.figmaFileKey,
        pageId: selectedPage,
        frameIds: selectedFrames,
        options: generationOptions
      });

      if (response.data.success) {
        setGeneratedResult(response.data.result);
        setSuccess(`HTML/CSS generated successfully! ${selectedFrames.length} layer${selectedFrames.length !== 1 ? 's' : ''} processed`);
        loadGeneratedProjects(); // Refresh the projects list
      } else {
        setError(response.data.error || 'Failed to generate HTML/CSS');
      }
    } catch (error) {
      console.error('Error generating HTML/CSS:', error);
      setError(error.response?.data?.error || 'Error generating HTML/CSS');
    } finally {
      setGenerating(false);
    }
  };

  const loadGeneratedProjects = async () => {
    try {
      const response = await axios.get(`${API_BASE}/figma/generated-projects`);
      if (response.data.success) {
        setGeneratedProjects(response.data.projects);
      }
    } catch (error) {
      console.error('Error loading generated projects:', error);
      // Silently fail as this is not critical
    }
  };

  const deleteProject = async (projectId) => {
    try {
      const response = await axios.delete(`${API_BASE}/figma/generated-projects/${projectId}`);
      if (response.data.success) {
        setSuccess('Project deleted successfully');
        loadGeneratedProjects();
      }
    } catch (error) {
      setError('Error deleting project');
    }
  };

  const downloadProject = (projectId) => {
    window.open(`${API_BASE}/figma/download/${projectId}`, '_blank');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Code copied to clipboard!');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'primary.main' }}>
        🎨 Figma to HTML/CSS Generator
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Convert your Figma designs into clean, responsive HTML and CSS code automatically.
      </Typography>

      {/* Configuration Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6">Configuration</Typography>
              <Typography variant="body2" color="text.secondary">
                {config.figmaToken && config.figmaFileKey
                  ? (
                    <Box>
                      <Box sx={{ mb: 1 }}>
                        📁 File: {config.figmaFileKey.substring(0, 20)}...
                      </Box>
                      {selectedFrames.length > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip 
                            label={`${selectedFrames.length} layer${selectedFrames.length !== 1 ? 's' : ''} selected`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          <Typography variant="caption" color="text.secondary">
                            Ready to generate
                          </Typography>
                        </Box>
                      )}
                      {selectedFrames.length === 0 && (
                        <Typography variant="caption" color="warning.main">
                          No layers selected - use Configure to select layers
                        </Typography>
                      )}
                    </Box>
                  )
                  : 'Configure Figma API credentials to get started'
                }
              </Typography>
            </Box>
            <Box>
              <Button
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={() => setConfigDialogOpen(true)}
                sx={{ mr: 2 }}
              >
                {selectedFrames.length > 0 ? 'Change Selection' : 'Configure & Select'}
              </Button>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={loadFigmaStructure}
                disabled={loading || !config.figmaToken || !config.figmaFileKey}
              >
                {loading ? <CircularProgress size={20} /> : 'Reload Structure'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Left Column - Selection & Options */}
        <Grid item xs={12} md={6}>
          {/* Layer Selection Summary */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>🎯 Selected Layers</Typography>
              
              {selectedFrames.length > 0 ? (
                <Box>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    {selectedFrames.length} layer{selectedFrames.length !== 1 ? 's' : ''} selected for generation
                  </Alert>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Selected layers will be converted to HTML/CSS code. Use the "Configure & Select" button above to modify your selection.
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setSelectedFrames([]);
                        setSelectedLayers([]);
                        setSuccess('Layer selection cleared');
                      }}
                      startIcon={<CloseIcon />}
                    >
                      Clear Selection
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setConfigDialogOpen(true)}
                      startIcon={<LayersIcon />}
                    >
                      Change Selection
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No layers selected yet
                  </Alert>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Use the "Configure & Select" button above to browse and select Figma layers for HTML/CSS generation.
                  </Typography>
                  
                  <Button
                    variant="contained"
                    onClick={() => setConfigDialogOpen(true)}
                    startIcon={<LayersIcon />}
                    sx={{ mt: 2 }}
                  >
                    Select Layers
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Generation Options */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>⚙️ Generation Options</Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Framework</InputLabel>
                    <Select
                      value={generationOptions.framework}
                      onChange={(e) => setGenerationOptions({
                        ...generationOptions,
                        framework: e.target.value
                      })}
                    >
                      <MenuItem value="vanilla">Vanilla HTML/CSS</MenuItem>
                      <MenuItem value="react">React Components</MenuItem>
                      <MenuItem value="vue">Vue Components</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>CSS Framework</InputLabel>
                    <Select
                      value={generationOptions.cssFramework}
                      onChange={(e) => setGenerationOptions({
                        ...generationOptions,
                        cssFramework: e.target.value
                      })}
                    >
                      <MenuItem value="custom">Custom CSS</MenuItem>
                      <MenuItem value="tailwind">Tailwind CSS</MenuItem>
                      <MenuItem value="bootstrap">Bootstrap</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={generationOptions.generateResponsive}
                          onChange={(e) => setGenerationOptions({
                            ...generationOptions,
                            generateResponsive: e.target.checked
                          })}
                        />
                      }
                      label="Generate Responsive CSS"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={generationOptions.includeInteractions}
                          onChange={(e) => setGenerationOptions({
                            ...generationOptions,
                            includeInteractions: e.target.checked
                          })}
                        />
                      }
                      label="Include Basic Interactions"
                    />
                  </FormGroup>
                </Grid>
              </Grid>

              <Button
                variant="contained"
                size="large"
                fullWidth
                startIcon={generating ? <CircularProgress size={20} /> : <CodeIcon />}
                onClick={generateHTMLCSS}
                disabled={generating || selectedFrames.length === 0 || !config.figmaToken || !config.figmaFileKey}
                sx={{ 
                  mt: 2,
                  background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #1976D2 30%, #1CB5E0 90%)',
                  }
                }}
              >
                {generating ? 'Generating...' : `Generate HTML/CSS${selectedFrames.length > 0 ? ` (${selectedFrames.length} layer${selectedFrames.length !== 1 ? 's' : ''})` : ''}`}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Results & Projects */}
        <Grid item xs={12} md={6}>
          {/* Generated Code */}
          {generatedResult && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">📝 Generated Code</Typography>
                  <Box>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<PreviewIcon />}
                      onClick={() => window.open(generatedResult.previewUrl || `http://localhost:5000/api/figma/preview/${generatedResult.metadata.figmaFileKey}`, '_blank')}
                      sx={{ mr: 1 }}
                    >
                      Preview
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={() => window.open(generatedResult.downloadUrl, '_blank')}
                    >
                      Download
                    </Button>
                  </Box>
                </Box>

                <Tabs 
                  value={activeCodeTab} 
                  onChange={(event, newValue) => setActiveCodeTab(newValue)}
                  sx={{ mb: 2 }}
                >
                  <Tab label="HTML" />
                  <Tab label="CSS" />
                  <Tab label="Tokens" />
                </Tabs>

                <Box sx={{ position: 'relative' }}>
                  {activeCodeTab === 0 && (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                        <IconButton 
                          size="small" 
                          onClick={() => copyToClipboard(
                            typeof generatedResult.html === 'string' 
                              ? generatedResult.html 
                              : Object.values(generatedResult.html)[0]
                          )}
                        >
                          <FileCopyIcon />
                        </IconButton>
                      </Box>
                      <Box sx={{ 
                        maxHeight: '400px', 
                        overflow: 'auto',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 2,
                        backgroundColor: '#1e1e1e',
                        fontFamily: 'Monaco, Courier, monospace',
                        fontSize: '12px',
                        color: '#d4d4d4'
                      }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                          {typeof generatedResult.html === 'string' 
                            ? generatedResult.html.substring(0, 2000) + '...'
                            : Object.values(generatedResult.html)[0]?.substring(0, 2000) + '...'
                          }
                        </pre>
                      </Box>
                    </Box>
                  )}

                  {activeCodeTab === 1 && (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                        <IconButton 
                          size="small" 
                          onClick={() => copyToClipboard(generatedResult.css)}
                        >
                          <FileCopyIcon />
                        </IconButton>
                      </Box>
                      <Box sx={{ 
                        maxHeight: '400px', 
                        overflow: 'auto',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 2,
                        backgroundColor: '#1e1e1e',
                        fontFamily: 'Monaco, Courier, monospace',
                        fontSize: '12px',
                        color: '#d4d4d4'
                      }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                          {generatedResult.css.substring(0, 2000) + '...'}
                        </pre>
                      </Box>
                    </Box>
                  )}

                  {activeCodeTab === 2 && (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                        <IconButton 
                          size="small" 
                          onClick={() => copyToClipboard(JSON.stringify(generatedResult.designTokens, null, 2))}
                        >
                          <FileCopyIcon />
                        </IconButton>
                      </Box>
                      <Box sx={{ 
                        maxHeight: '400px', 
                        overflow: 'auto',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 2,
                        backgroundColor: '#1e1e1e',
                        fontFamily: 'Monaco, Courier, monospace',
                        fontSize: '12px',
                        color: '#d4d4d4'
                      }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(generatedResult.designTokens, null, 2).substring(0, 2000) + '...'}
                        </pre>
                      </Box>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Generated Projects History */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>📁 Generated Projects</Typography>
              
              {generatedProjects.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No projects generated yet. Create your first HTML/CSS generation!
                </Typography>
              ) : (
                <List>
                  {generatedProjects.slice(0, 5).map((project) => (
                    <ListItem key={project.id}>
                      <ListItemText
                        primary={project.name}
                        secondary={
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(project.createdAt).toLocaleString()}
                            </Typography>
                            <br />
                            <Typography variant="caption" color="text.secondary">
                              Framework: {project.metadata?.framework || 'Unknown'} • 
                              Size: {formatFileSize(project.size)}
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="Preview">
                          <IconButton 
                            onClick={() => window.open(`http://localhost:5000/api/figma/preview/${project.id}`, '_blank')}
                            size="small"
                            sx={{ mr: 1 }}
                          >
                            <PreviewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download">
                          <IconButton 
                            onClick={() => downloadProject(project.id)}
                            size="small"
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton 
                            onClick={() => deleteProject(project.id)}
                            size="small"
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Configuration Dialog */}
      {/* Enhanced Configuration Dialog with Layer Browsing */}
      <Dialog 
        open={configDialogOpen} 
        onClose={() => setConfigDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: 3,
            boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
            height: '80vh'
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
                Figma Configuration & Layer Selection
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Configure Figma API and select layers for HTML/CSS generation
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0 }}>
          <Tabs 
            value={configTabValue} 
            onChange={(e, newValue) => setConfigTabValue(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Connect" />
            <Tab label="Browse Layers" disabled={!config.figmaToken || !config.figmaFileKey || figmaPages.length === 0} />
          </Tabs>
          
          {configTabValue === 0 && (
            <Box sx={{ p: 3 }}>
              <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                Connect your Figma account, select a page, and choose specific layers/frames for HTML/CSS generation.
              </Alert>
              
              <Stack spacing={3}>
                <TextField
                  label="Figma Access Token"
                  type="password"
                  value={config.figmaToken}
                  onChange={(e) => setConfig({...config, figmaToken: e.target.value})}
                  fullWidth
                  helperText="Get your token from Figma Settings > Account > Personal access tokens"
                />
                
                <TextField
                  label="Figma File Key"
                  value={config.figmaFileKey}
                  onChange={(e) => setConfig({...config, figmaFileKey: e.target.value})}
                  fullWidth
                  helperText="Extract from your Figma file URL"
                />

                {figmaPages.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                      📄 Select Page
                    </Typography>
                    {loadingPages ? (
                      <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
                    ) : (
                      <FormControl fullWidth>
                        <InputLabel>Choose Page</InputLabel>
                        <Select
                          value={selectedPage}
                          onChange={(e) => {
                            setSelectedPage(e.target.value);
                            setFigmaLayers([]);
                            setSelectedLayers([]);
                            setCurrentPage(1);
                          }}
                          label="Choose Page"
                        >
                          {figmaPages.map((page) => (
                            <MenuItem key={page.id} value={page.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                <Typography sx={{ flex: 1 }}>{page.name}</Typography>
                                <Chip
                                  label={`${page.children || 0} elements`}
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                />
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  </Box>
                )}

                {selectedPage && figmaLayers.length > 0 && (
                  <Alert severity="success" sx={{ borderRadius: 2 }}>
                    <Typography variant="body2">
                      Page loaded with {figmaLayers.length} layers! Switch to "Browse Layers" tab to select specific elements.
                    </Typography>
                  </Alert>
                )}
              </Stack>
            </Box>
          )}
          
          {configTabValue === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Search and Filter Controls */}
              <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search layers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      InputProps={{
                        startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      }}
                      sx={{ bgcolor: 'white', borderRadius: 1 }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Layer Type</InputLabel>
                      <Select
                        value={layerTypeFilter}
                        onChange={(e) => setLayerTypeFilter(e.target.value)}
                        label="Layer Type"
                        startAdornment={<FilterIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                        sx={{ bgcolor: 'white', borderRadius: 1 }}
                      >
                        <MenuItem value="FRAME">Frames</MenuItem>
                        <MenuItem value="COMPONENT">Components</MenuItem>
                        <MenuItem value="INSTANCE">Instances</MenuItem>
                        <MenuItem value="all">All Types</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={loadFigmaLayers}
                      disabled={loadingLayers || !selectedPage}
                      startIcon={loadingLayers ? <CircularProgress size={16} /> : <RefreshIcon />}
                      fullWidth
                      sx={{ borderRadius: 1 }}
                    >
                      {loadingLayers ? 'Loading...' : 'Refresh'}
                    </Button>
                  </Grid>
                </Grid>

                {selectedLayers.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Selected: {selectedLayers.length} layer{selectedLayers.length !== 1 ? 's' : ''}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      {selectedLayers.map((layer) => (
                        <Chip
                          key={layer.id}
                          label={layer.name}
                          size="small"
                          onDelete={() => toggleLayerSelection(layer)}
                          color="primary"
                          variant="filled"
                          sx={{ borderRadius: 1 }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Layer List */}
              <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                {!selectedPage ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <LayersIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      Select a Page First
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Please select a page from the "Connect" tab to browse its layers.
                    </Typography>
                  </Box>
                ) : loadingLayers && figmaLayers.length === 0 ? (
                  <Stack spacing={2}>
                    {[...Array(5)].map((_, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
                        <Skeleton variant="rectangular" width={56} height={56} sx={{ borderRadius: 1 }} />
                        <Box sx={{ flex: 1 }}>
                          <Skeleton variant="text" width="60%" height={24} />
                          <Skeleton variant="text" width="40%" height={16} />
                        </Box>
                        <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 1 }} />
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Box>
                    <List sx={{ p: 0 }}>
                      {filteredLayers.map((layer) => (
                        <ListItem key={layer.id} disablePadding sx={{ mb: 1 }}>
                          <ListItemButton
                            onClick={() => toggleLayerSelection(layer)}
                            selected={selectedLayers.some(l => l.id === layer.id)}
                            sx={{ 
                              borderRadius: 2, 
                              p: 2,
                              border: selectedLayers.some(l => l.id === layer.id) ? '2px solid' : '1px solid',
                              borderColor: selectedLayers.some(l => l.id === layer.id) ? 'primary.main' : 'grey.300',
                              bgcolor: selectedLayers.some(l => l.id === layer.id) ? 'primary.50' : 'transparent',
                              '&:hover': {
                                bgcolor: selectedLayers.some(l => l.id === layer.id) ? 'primary.100' : 'grey.50',
                                borderColor: 'primary.main'
                              }
                            }}
                          >
                            <ListItemAvatar>
                              {layerThumbnails[layer.id] ? (
                                <Avatar 
                                  variant="rounded" 
                                  sx={{ width: 56, height: 56, border: 1, borderColor: 'grey.300' }}
                                  src={layerThumbnails[layer.id]}
                                />
                              ) : (
                                <Avatar variant="rounded" sx={{ bgcolor: 'grey.200', width: 56, height: 56 }}>
                                  <LayersIcon sx={{ color: 'grey.600' }} />
                                </Avatar>
                              )}
                            </ListItemAvatar>
                            <ListItemText
                              sx={{ ml: 2 }}
                              primary={
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                  {layer.name}
                                </Typography>
                              }
                              secondary={
                                <Box>
                                  <Typography variant="body2" component="span" color="text.secondary">
                                    {layer.type} • {Math.round(layer.absoluteBoundingBox?.width || 0)}×{Math.round(layer.absoluteBoundingBox?.height || 0)}px
                                  </Typography>
                                  {layer.pageName && (
                                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                                      📄 {layer.pageName}
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                              <Chip
                                label={layer.type}
                                size="small"
                                variant={selectedLayers.some(l => l.id === layer.id) ? 'filled' : 'outlined'}
                                color={selectedLayers.some(l => l.id === layer.id) ? 'primary' : 'default'}
                                sx={{ borderRadius: 1 }}
                              />
                              {selectedLayers.some(l => l.id === layer.id) && (
                                <CheckCircleIcon color="primary" fontSize="small" />
                              )}
                            </Box>
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                    
                    {/* Load More Button */}
                    {hasMoreLayers && (
                      <Box sx={{ textAlign: 'center', py: 3 }}>
                        <Button
                          variant="outlined"
                          onClick={loadMoreLayers}
                          disabled={loadingLayers}
                          startIcon={loadingLayers ? <CircularProgress size={16} /> : <RefreshIcon />}
                          sx={{ borderRadius: 2, px: 4 }}
                        >
                          {loadingLayers ? 'Loading...' : `Load More (${totalLayers - figmaLayers.length} remaining)`}
                        </Button>
                      </Box>
                    )}
                    
                    {filteredLayers.length === 0 && !loadingLayers && selectedPage && (
                      <Box sx={{ textAlign: 'center', py: 6 }}>
                        <SearchIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          No Layers Found
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          No layers found for the selected filters. Try changing the layer type or search term.
                        </Typography>
                      </Box>
                    )}
                    
                    {/* Layer Statistics */}
                    {figmaLayers.length > 0 && (
                      <Box sx={{ mt: 3, p: 3, bgcolor: 'grey.50', borderRadius: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', fontWeight: 500 }}>
                          📊 Showing {figmaLayers.length} of {totalLayers} layers
                          {selectedLayers.length > 0 && ` • ${selectedLayers.length} selected for generation`}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
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
            onClick={() => setConfigDialogOpen(false)}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          
          {configTabValue === 0 && (
            <Button
              onClick={async () => {
                try {
                  localStorage.setItem('figmaAccessToken', config.figmaToken);
                  localStorage.setItem('figmaFileKey', config.figmaFileKey);
                  await loadFigmaStructure();
                  await loadFigmaPages();
                  setSuccess('Configuration saved and pages loaded!');
                } catch (error) {
                  setError('Failed to load Figma data: ' + error.message);
                }
              }}
              variant="contained"
              disabled={!config.figmaToken || !config.figmaFileKey || loading || loadingPages}
              sx={{
                borderRadius: 2,
                background: 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)'
              }}
            >
              {loading || loadingPages ? 'Connecting...' : 'Connect & Load Pages'}
            </Button>
          )}
          
          {configTabValue === 1 && (
            <Button
              variant="contained"
              onClick={selectLayersForGeneration}
              disabled={selectedLayers.length === 0}
              startIcon={<GetAppIcon />}
              sx={{
                borderRadius: 2,
                background: 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)'
              }}
            >
              Use Selected Layers ({selectedLayers.length})
            </Button>
          )}
        </DialogActions>
      </Dialog>

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
    </Box>
  );
};

export default FigmaHTMLGenerator;
