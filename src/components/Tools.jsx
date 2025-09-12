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
  CleaningServices as CleanIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const Tools = ({ project }) => {
  const [loading, setLoading] = useState(false);
  const [urlCloneDialog, setUrlCloneDialog] = useState(false);
  const [cloneResults, setCloneResults] = useState(null);
  const [targetUrl, setTargetUrl] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [cssSelectors, setCssSelectors] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Helper function to ensure URL has protocol
  const ensureProtocol = (url) => {
    if (!url) return url;
    const trimmedUrl = url.trim();
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      return trimmedUrl;
    }
    return `https://${trimmedUrl}`;
  };

  // URL Clone Tool
  const handleUrlClone = async () => {
    if (!targetUrl) {
      setError('Please enter a target URL to clone');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Ensure URLs have proper protocol
      const normalizedTargetUrl = ensureProtocol(targetUrl);
      const normalizedReferenceUrl = referenceUrl ? ensureProtocol(referenceUrl) : null;

      const response = await axios.post(`${API_BASE}/clone-urls`, {
        targetUrl: normalizedTargetUrl,
        referenceUrl: normalizedReferenceUrl,
        cssSelectors: cssSelectors.trim() || null,
        projectId: project.id
      });

      setCloneResults(response.data);
      setSuccess(`Successfully cloned ${response.data.urlCount} URLs from ${normalizedTargetUrl}`);
      setUrlCloneDialog(false);
      setTargetUrl('');
      setReferenceUrl('');
      setCssSelectors('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clone URLs from website');
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
                    label={`${cloneResults.urlCount} target URLs`} 
                    color="primary" 
                    sx={{ mr: 1 }}
                  />
                  {cloneResults.referenceUrlCount > 0 && (
                    <Chip 
                      label={`${cloneResults.referenceUrlCount} reference URLs`} 
                      color="secondary" 
                      sx={{ mr: 1 }}
                    />
                  )}
                  <Chip 
                    label={`${cloneResults.scenarios} BackstopJS scenarios`} 
                    color="success" 
                    sx={{ mr: 1 }}
                  />
                  {cloneResults.csvGenerated && (
                    <Chip 
                      label={`${cloneResults.totalScenariosInCsv} scenarios in CSV`} 
                      color="info" 
                      sx={{ mr: 1 }}
                    />
                  )}
                  {cloneResults.referenceUrl && (
                    <Chip 
                      label="Target vs Reference comparison" 
                      color="warning" 
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
                      {Object.entries(cloneResults.mapping || {}).slice(0, 10).map(([normalized, originals], index) => {
                        // Show the actual target URL that will be used in CSV
                        const targetOrigin = new URL(cloneResults.targetUrl).origin;
                        const targetPath = new URL(normalized).pathname;
                        const csvTargetUrl = targetOrigin + targetPath;
                        
                        return (
                          <React.Fragment key={normalized}>
                            <ListItem>
                              <ListItemIcon>
                                <CheckCircleIcon color="success" fontSize="small" />
                              </ListItemIcon>
                              <ListItemText
                                primary={
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 500, color: 'primary.main' }}>
                                      CSV URL: {csvTargetUrl}
                                    </Typography>
                                    {cloneResults.referenceUrl && (
                                      <Typography variant="caption" color="text.secondary">
                                        → Reference: {normalized.replace(new URL(cloneResults.targetUrl).origin, new URL(cloneResults.referenceUrl).origin)}
                                      </Typography>
                                    )}
                                  </Box>
                                }
                                secondary={`Discovered from: ${originals.slice(0, 3).join(', ')}${originals.length > 3 ? '...' : ''}`}
                                primaryTypographyProps={{ component: 'div' }}
                                secondaryTypographyProps={{ fontSize: '0.75rem' }}
                              />
                            </ListItem>
                            {index < Math.min(Object.entries(cloneResults.mapping).length - 1, 9) && <Divider />}
                          </React.Fragment>
                        );
                      })}
                      {Object.entries(cloneResults.mapping || {}).length > 10 && (
                        <ListItem>
                          <ListItemText
                            primary={`... and ${Object.entries(cloneResults.mapping).length - 10} more URLs for ${new URL(cloneResults.targetUrl).origin}`}
                            primaryTypographyProps={{ 
                              fontSize: '0.875rem', 
                              fontStyle: 'italic',
                              color: 'text.secondary'
                            }}
                          />
                        </ListItem>
                      )}
                    </List>
                  </Paper>              {/* Download CSV Button */}
              {cloneResults.csvGenerated && (
                <Box sx={{ mt: 2 }}>
                  {/* CSV Information */}
                  <Paper sx={{ p: 2, mb: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      📄 Comprehensive CSV Export Ready
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {cloneResults.totalScenariosInCsv} scenarios ready for manual verification and upload
                    </Typography>
                    {cloneResults.csvInfo && (
                      <Box>
                        {cloneResults.referenceUrl ? (
                          <Typography variant="body2">
                            • {cloneResults.csvInfo.categories.common} common paths (both environments)
                            <br />
                            • {cloneResults.csvInfo.categories.targetOnly} target-only paths
                            <br />
                            • {cloneResults.csvInfo.categories.referenceOnly} reference-only paths
                          </Typography>
                        ) : (
                          <Typography variant="body2">
                            • {cloneResults.csvInfo.categories.baseline} baseline scenarios for target environment
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Paper>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                      {loading ? 'Downloading...' : 'Download Comprehensive CSV'}
                    </Button>
                  </Box>
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
            Extract URLs from websites and generate comprehensive CSV exports for visual regression testing. 
            Perfect for creating test scenarios that can be manually verified before execution.
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              required
              label="Target URL"
              placeholder="staging.example.com or https://staging.example.com"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              sx={{ mb: 2 }}
              helperText={
                targetUrl && !targetUrl.trim().startsWith('http') 
                  ? `Will use: https://${targetUrl.trim()}` 
                  : "The website you want to test (e.g., staging environment)"
              }
            />
            
            <TextField
              fullWidth
              label="Reference URL (Optional)"
              placeholder="production.example.com or https://production.example.com"
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              sx={{ mb: 2 }}
              helperText={
                referenceUrl && !referenceUrl.trim().startsWith('http')
                  ? `Will use: https://${referenceUrl.trim()}`
                  : "The baseline website to compare against (e.g., production environment)"
              }
            />
            
            <TextField
              fullWidth
              label="CSS Selectors (Optional)"
              placeholder="header, footer, nav, .main-content"
              value={cssSelectors}
              onChange={(e) => setCssSelectors(e.target.value)}
              helperText="Extract links only from specific page sections. Leave empty to scan entire page. Use comma-separated CSS selectors."
            />
          </Box>
          
          <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Enhanced CSV Export Features:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              <li>Discovers all navigation links from both target and reference pages</li>
              <li>Optional CSS selector targeting for specific page sections (header, footer, nav, etc.)</li>
              <li>Creates comprehensive URL mapping with status indicators</li>
              <li>Exports CSV with categories: common, target-only, reference-only paths</li>
              <li>When comparing environments, only creates scenarios for URLs that exist in both</li>
              <li>Skips target-only URLs to ensure proper reference comparison</li>
              <li>Ready for manual verification and selective testing</li>
              <li>Includes all necessary BackstopJS configuration fields</li>
            </Box>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setUrlCloneDialog(false);
            setTargetUrl('');
            setReferenceUrl('');
            setCssSelectors('');
            setError('');
          }}>
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
    </Box>
  );
};

export default Tools;
