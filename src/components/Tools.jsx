import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  TextField,
  Paper,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Build as BuildIcon,
  Link as LinkIcon,
  Analytics as AnalyticsIcon,
  CleaningServices as CleanIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Compare as CompareIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const Tools = ({ project }) => {
  const [loading, setLoading] = useState(false);
  const [urlCloneDialog, setUrlCloneDialog] = useState(false);
  const [linkCompareDialog, setLinkCompareDialog] = useState(false);
  const [cloneResults, setCloneResults] = useState(null);
  const [compareResults, setCompareResults] = useState(null);
  const [targetUrl, setTargetUrl] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [stageUrl, setStageUrl] = useState('');
  const [qaUrl, setQaUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // URL Clone Tool
  const handleUrlClone = async () => {
    if (!targetUrl) {
      setError('Please enter a target URL to clone');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_BASE}/clone-urls`, {
        targetUrl: targetUrl,
        referenceUrl: referenceUrl || null,
        projectId: project.id
      });

      setCloneResults(response.data);
      setSuccess(`Successfully cloned ${response.data.urlCount} URLs from the website`);
      setUrlCloneDialog(false);
      setTargetUrl('');
      setReferenceUrl('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clone URLs from website');
    } finally {
      setLoading(false);
    }
  };

  // Link Comparison Tool
  const handleLinkComparison = async () => {
    setLoading(true);
    setError('');
    setCompareResults(null);
    
    try {
      const response = await axios.post(`${API_BASE}/compare-links`, {
        stageUrl,
        qaUrl
      });
      
      setCompareResults(response.data);
      setSuccess(`Link comparison completed: ${response.data.stats.total} paths analyzed`);
      setLinkCompareDialog(false);
      setStageUrl('');
      setQaUrl('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to compare links between environments');
    } finally {
      setLoading(false);
    }
  };

  // Clean Project Tool
  const handleCleanProject = async () => {
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API_BASE}/projects/${project.id}/clean`);
      setSuccess('Project cleaned successfully - removed test results and temporary files');
    } catch {
      setError('Failed to clean project');
    } finally {
      setLoading(false);
    }
  };

  // Export Config Tool
  const handleExportConfig = async () => {
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/export`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.id}-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setSuccess('Configuration exported successfully');
    } catch {
      setError('Failed to export configuration');
    }
  };

  // Download Scenarios CSV Tool
  const handleDownloadCsv = async () => {
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/scenarios-csv`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.id}-scenarios-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setSuccess('Scenarios CSV downloaded successfully');
    } catch {
      setError('Failed to download CSV. Please clone URLs first to generate scenarios.');
    }
  };

  // Download CSV from clone results
  const handleDownloadCloneResultsCsv = async () => {
    if (!cloneResults?.files?.csvExport) {
      setError('No CSV file available. Please try cloning URLs again.');
      return;
    }

    try {
      setLoading(true);
      
      // Use projectId from clone results, fallback to hostname-based naming
      const projectFolder = cloneResults.projectId || 
        (cloneResults.targetUrl 
          ? new URL(cloneResults.targetUrl).hostname.replace(/\./g, '_')
          : 'url-clone');
      
      const response = await axios.get(`${API_BASE}/download-csv/${projectFolder}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectFolder}-scenarios-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setSuccess('Clone results CSV downloaded successfully');
    } catch (error) {
      console.error('CSV download error:', error);
      setError(`Failed to download CSV from clone results: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const tools = [
    {
      id: 'url-clone',
      title: 'URL Clone Tool',
      description: 'Extract URLs from websites and create test scenarios with target vs reference comparison',
      icon: <LinkIcon />,
      color: 'primary',
      action: () => setUrlCloneDialog(true)
    },
    {
      id: 'link-compare',
      title: 'Link Comparison',
      description: 'Compare links between STAGE and QA environments with detailed analysis',
      icon: <CompareIcon />,
      color: 'secondary',
      action: () => setLinkCompareDialog(true)
    },
    {
      id: 'analytics',
      title: 'Test Analytics',
      description: 'Analyze test results and generate detailed reports',
      icon: <AnalyticsIcon />,
      color: 'info',
      action: () => console.log('Analytics tool')
    },
    {
      id: 'clean',
      title: 'Clean Project',
      description: 'Remove test results, temporary files, and reset project state',
      icon: <CleanIcon />,
      color: 'warning',
      action: handleCleanProject
    },
    {
      id: 'export',
      title: 'Export Configuration',
      description: 'Download your project configuration as a JSON file',
      icon: <DownloadIcon />,
      color: 'success',
      action: handleExportConfig
    },
    {
      id: 'download-csv',
      title: 'Download Scenarios CSV',
      description: 'Download scenarios as CSV file for import/export or external processing',
      icon: <UploadIcon />,
      color: 'info',
      action: handleDownloadCsv
    }
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
        Project Tools
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Powerful tools to enhance your visual regression testing workflow
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {tools.map((tool) => (
          <Grid item xs={12} md={6} key={tool.id}>
            <Card 
              sx={{ 
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 4
                }
              }}
              onClick={tool.action}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box 
                    sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: `${tool.color}.light`,
                      color: `${tool.color}.main`,
                      mr: 2
                    }}
                  >
                    {tool.icon}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {tool.title}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {tool.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Show clone results if available */}
      {cloneResults && (
        <Box sx={{ mt: 4 }}>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">URL Clone Results</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ mb: 3 }}>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      Target URL:
                    </Typography>
                    <Chip 
                      label={cloneResults.targetUrl} 
                      color="primary" 
                      size="small"
                      sx={{ maxWidth: '100%', fontSize: '0.75rem' }}
                    />
                  </Grid>
                  {cloneResults.referenceUrl && (
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        Reference URL:
                      </Typography>
                      <Chip 
                        label={cloneResults.referenceUrl} 
                        color="secondary" 
                        size="small"
                        sx={{ maxWidth: '100%', fontSize: '0.75rem' }}
                      />
                    </Grid>
                  )}
                </Grid>
                
                <Box sx={{ mb: 2 }}>
                  <Chip 
                    label={`${cloneResults.urlCount} URLs found`} 
                    color="primary" 
                    sx={{ mr: 1 }}
                  />
                  <Chip 
                    label={`${cloneResults.scenarios} scenarios created`} 
                    color="success" 
                    sx={{ mr: 1 }}
                  />
                  {cloneResults.csvGenerated && (
                    <Chip 
                      label="CSV generated" 
                      color="info" 
                      sx={{ mr: 1 }}
                    />
                  )}
                  {cloneResults.referenceUrl && (
                    <Chip 
                      label="Target vs Reference comparison" 
                      color="info" 
                      sx={{ mr: 1 }}
                    />
                  )}
                </Box>

                {/* Enhanced URL Mapping Display */}
                {cloneResults.urlMapping && (
                  <>
                    <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                      URL Analysis:
                    </Typography>
                    
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                          <Typography variant="h6">Target</Typography>
                          <Typography variant="body2">{cloneResults.urlMapping.target?.count || 0} pages found</Typography>
                          <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                            {cloneResults.urlMapping.target?.baseUrl}
                          </Typography>
                        </Paper>
                      </Grid>
                      
                      {cloneResults.urlMapping.reference && (
                        <Grid item xs={12} md={6}>
                          <Paper sx={{ p: 2, bgcolor: 'secondary.light', color: 'secondary.contrastText' }}>
                            <Typography variant="h6">Reference</Typography>
                            <Typography variant="body2">{cloneResults.urlMapping.reference?.count || 0} pages found</Typography>
                            <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                              {cloneResults.urlMapping.reference?.baseUrl}
                            </Typography>
                          </Paper>
                        </Grid>
                      )}
                    </Grid>

                    {cloneResults.urlMapping.comparison && (
                      <Accordion sx={{ mb: 2 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle1">Path Comparison Analysis</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Grid container spacing={2}>
                            <Grid item xs={12} md={4}>
                              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
                                <Typography variant="h4" color="success.contrastText">
                                  {cloneResults.urlMapping.comparison.commonPaths?.length || 0}
                                </Typography>
                                <Typography variant="body2" color="success.contrastText">Common Paths</Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light' }}>
                                <Typography variant="h4" color="warning.contrastText">
                                  {cloneResults.urlMapping.comparison.targetOnlyPaths?.length || 0}
                                </Typography>
                                <Typography variant="body2" color="warning.contrastText">Target Only</Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.light' }}>
                                <Typography variant="h4" color="error.contrastText">
                                  {cloneResults.urlMapping.comparison.referenceOnlyPaths?.length || 0}
                                </Typography>
                                <Typography variant="body2" color="error.contrastText">Reference Only</Typography>
                              </Paper>
                            </Grid>
                          </Grid>
                        </AccordionDetails>
                      </Accordion>
                    )}
                  </>
                )}
              </Box>
              
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Generated Scenarios:
              </Typography>
              
              <Paper 
                sx={{ 
                  maxHeight: 300, 
                  overflow: 'auto', 
                  bgcolor: 'grey.50',
                  border: '1px solid',
                  borderColor: 'grey.200'
                }}
              >
                <List dense>
                  {Object.entries(cloneResults.mapping || {}).slice(0, 10).map(([normalized, originals], index) => (
                    <React.Fragment key={normalized}>
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircleIcon color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {normalized}
                              </Typography>
                              {cloneResults.referenceUrl && (
                                <Typography variant="caption" color="text.secondary">
                                  → {normalized.replace(new URL(cloneResults.targetUrl).origin, new URL(cloneResults.referenceUrl).origin)}
                                </Typography>
                              )}
                            </Box>
                          }
                          secondary={`Found in: ${originals.slice(0, 3).join(', ')}${originals.length > 3 ? '...' : ''}`}
                          primaryTypographyProps={{ component: 'div' }}
                          secondaryTypographyProps={{ fontSize: '0.75rem' }}
                        />
                      </ListItem>
                      {index < Math.min(Object.entries(cloneResults.mapping).length - 1, 9) && <Divider />}
                    </React.Fragment>
                  ))}
                  {Object.entries(cloneResults.mapping || {}).length > 10 && (
                    <ListItem>
                      <ListItemText
                        primary={`... and ${Object.entries(cloneResults.mapping).length - 10} more URLs`}
                        primaryTypographyProps={{ 
                          fontSize: '0.875rem', 
                          fontStyle: 'italic',
                          color: 'text.secondary'
                        }}
                      />
                    </ListItem>
                  )}
                </List>
              </Paper>
              
              {/* Download CSV Button */}
              {cloneResults.csvGenerated && (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadCloneResultsCsv}
                    disabled={loading}
                    size="small"
                    sx={{ 
                      bgcolor: 'success.main',
                      '&:hover': { bgcolor: 'success.dark' }
                    }}
                  >
                    {loading ? 'Downloading...' : 'Download Scenarios CSV'}
                  </Button>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {/* URL Clone Dialog */}
      <Dialog 
        open={urlCloneDialog} 
        onClose={() => setUrlCloneDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Clone URLs from Website
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enter website URLs to automatically extract all links and create test scenarios for visual regression testing.
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              required
              label="Target URL"
              placeholder="https://staging.example.com"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              sx={{ mb: 2 }}
              helperText="The website you want to test (e.g., staging environment)"
            />
            
            <TextField
              fullWidth
              label="Reference URL (Optional)"
              placeholder="https://production.example.com"
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              helperText="The baseline website to compare against (e.g., production environment)"
            />
          </Box>
          
          <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              How it works:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              <li>Scans the target URL and discovers all linked pages</li>
              <li>Creates test scenarios for each discovered page</li>
              <li>If reference URL is provided, scenarios will compare target vs reference</li>
              <li>If no reference URL is provided, screenshots will be taken for baseline creation</li>
            </Box>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUrlCloneDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleUrlClone} 
            variant="contained"
            disabled={loading || !targetUrl}
            startIcon={loading ? <CircularProgress size={16} /> : <LinkIcon />}
          >
            {loading ? 'Cloning...' : 'Clone URLs'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link Comparison Dialog */}
      <Dialog 
        open={linkCompareDialog} 
        onClose={() => setLinkCompareDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Compare Links Between Environments
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Compare all internal links between STAGE and QA environments to identify differences in navigation structure.
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              required
              label="STAGE URL"
              placeholder="https://staging.example.com"
              value={stageUrl}
              onChange={(e) => setStageUrl(e.target.value)}
              sx={{ mb: 2 }}
              helperText="The staging environment URL"
            />
            
            <TextField
              fullWidth
              required
              label="QA URL"
              placeholder="https://qa.example.com"
              value={qaUrl}
              onChange={(e) => setQaUrl(e.target.value)}
              helperText="The QA environment URL"
            />
          </Box>
          
          <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Analysis includes:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              <li>Extracts all internal navigation links from both environments</li>
              <li>Compares link paths to identify missing or extra links</li>
              <li>Provides a detailed comparison table with ✅/❌ status</li>
              <li>Filters out static assets and focuses on navigation paths</li>
            </Box>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkCompareDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleLinkComparison} 
            variant="contained"
            disabled={loading || !stageUrl || !qaUrl}
            startIcon={loading ? <CircularProgress size={16} /> : <CompareIcon />}
          >
            {loading ? 'Comparing...' : 'Compare Links'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link Comparison Results */}
      {compareResults && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CompareIcon color="primary" />
            Link Comparison Results
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Comparison between {compareResults.stageUrl} and {compareResults.qaUrl}
          </Typography>

          {/* Statistics */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
                <Typography variant="h4">{compareResults.stats.onBoth}</Typography>
                <Typography variant="body2">On Both</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                <Typography variant="h4">{compareResults.stats.stageOnly}</Typography>
                <Typography variant="body2">STAGE Only</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.light', color: 'error.contrastText' }}>
                <Typography variant="h4">{compareResults.stats.qaOnly}</Typography>
                <Typography variant="body2">QA Only</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light', color: 'info.contrastText' }}>
                <Typography variant="h4">{compareResults.stats.total}</Typography>
                <Typography variant="body2">Total Paths</Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Detailed Comparison Table */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Detailed Path Comparison ({compareResults.comparison.length} paths)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                {compareResults.comparison.map((item, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemIcon>
                        {item.status === 'both' && <CheckCircleIcon color="success" />}
                        {item.status === 'stage-only' && <WarningIcon color="warning" />}
                        {item.status === 'qa-only' && <ErrorIcon color="error" />}
                      </ListItemIcon>
                      <ListItemText 
                        primary={item.path}
                        secondary={
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            <Chip 
                              label={item.onStage ? '✅ STAGE' : '❌ STAGE'} 
                              size="small" 
                              color={item.onStage ? 'success' : 'default'}
                              variant={item.onStage ? 'filled' : 'outlined'}
                            />
                            <Chip 
                              label={item.onQA ? '✅ QA' : '❌ QA'} 
                              size="small" 
                              color={item.onQA ? 'success' : 'default'}
                              variant={item.onQA ? 'filled' : 'outlined'}
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < compareResults.comparison.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        </Paper>
      )}
    </Box>
  );
};

export default Tools;
