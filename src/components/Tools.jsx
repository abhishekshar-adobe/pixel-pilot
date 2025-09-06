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
  const [cloneResults, setCloneResults] = useState(null);
  const [cloneUrl, setCloneUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // URL Clone Tool
  const handleUrlClone = async () => {
    if (!cloneUrl) {
      setError('Please enter a URL to clone');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_BASE}/clone-urls`, {
        url: cloneUrl,
        projectId: project.id
      });

      setCloneResults(response.data);
      setSuccess(`Successfully cloned ${response.data.urlCount} URLs from the website`);
      setUrlCloneDialog(false);
      setCloneUrl('');
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
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.name}-config.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccess('Configuration exported successfully');
    } catch {
      setError('Failed to export configuration');
    }
  };

  const tools = [
    {
      id: 'url-clone',
      title: 'URL Clone Tool',
      description: 'Extract all URLs from a website and create test scenarios automatically',
      icon: <LinkIcon />,
      color: 'primary',
      action: () => setUrlCloneDialog(true)
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
              <Box sx={{ mb: 2 }}>
                <Chip 
                  label={`${cloneResults.urlCount} URLs found`} 
                  color="primary" 
                  sx={{ mr: 1 }}
                />
                <Chip 
                  label={`${cloneResults.scenarios} scenarios created`} 
                  color="success" 
                />
              </Box>
              
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                URL Mapping:
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
                          primary={normalized}
                          secondary={`Found in: ${originals.slice(0, 3).join(', ')}${originals.length > 3 ? '...' : ''}`}
                          primaryTypographyProps={{ fontSize: '0.875rem' }}
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
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {/* URL Clone Dialog */}
      <Dialog 
        open={urlCloneDialog} 
        onClose={() => setUrlCloneDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Clone URLs from Website
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enter a website URL to automatically extract all links and create test scenarios.
          </Typography>
          <TextField
            fullWidth
            label="Website URL"
            placeholder="https://example.com"
            value={cloneUrl}
            onChange={(e) => setCloneUrl(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
            This tool will scan the website and create scenarios for all discovered pages.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUrlCloneDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleUrlClone} 
            variant="contained"
            disabled={loading || !cloneUrl}
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
