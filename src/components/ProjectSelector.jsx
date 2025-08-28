import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  Folder as FolderIcon,
  PlayArrow as PlayArrowIcon,
  Info as InfoOutlined
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const ProjectSelector = ({ onProjectSelect }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get(`${API_BASE}/projects`);
      setProjects(response.data);
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Failed to load projects: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setCreating(true);
      setError('');
      const response = await axios.post(`${API_BASE}/projects`, {
        name: newProjectName.trim()
      });
      
      if (response.data) {
        setSuccess('Project created successfully!');
        setNewProjectName('');
        setCreateDialogOpen(false);
        await loadProjects();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Failed to create project: ' + (err.response?.data?.error || err.message));
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (projectId, projectName) => {
    if (!window.confirm(`Are you sure you want to delete "${projectName}"? This will remove all associated data.`)) {
      return;
    }

    try {
      setError('');
      await axios.delete(`${API_BASE}/projects/${projectId}`);
      setSuccess('Project deleted successfully!');
      await loadProjects();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting project:', err);
      setError('Failed to delete project: ' + (err.response?.data?.error || err.message));
    }
  };

  const selectProject = (project) => {
    onProjectSelect(project);
  };

  if (loading) {
    return (
      <Box 
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          gap: 2
        }}
      >
        <CircularProgress 
          size={40} 
          thickness={4}
          sx={{
            color: 'primary.main'
          }}
        />
        <Typography
          variant="body1"
          sx={{
            color: 'text.secondary',
            fontWeight: 500
          }}
        >
          Loading projects...
        </Typography>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        maxWidth: '1000px', 
        mx: 'auto', 
        p: { xs: 2, sm: 3, md: 4 },
        minHeight: '100vh',
        bgcolor: 'background.default'
      }}
    >
      <Box 
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
          mb: 4
        }}
      >
        <Box>
          <Typography 
            variant="h4" 
            component="h1" 
            sx={{
              fontWeight: 700,
              color: 'text.primary',
              letterSpacing: '-0.025em',
              mb: 1
            }}
          >
            PixelPilot Projects
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'text.secondary',
              maxWidth: '600px'
            }}
          >
            Manage your BackstopJS visual regression testing projects
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ 
            minWidth: 140,
            height: '48px',
            borderRadius: '12px',
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 600,
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 4px 8px -2px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06)'
            }
          }}
        >
          New Project
        </Button>
      </Box>

      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError('')}
          sx={{ 
            mb: 3,
            borderRadius: '12px',
            '& .MuiAlert-icon': {
              fontSize: '24px'
            },
            '& .MuiAlert-message': {
              fontSize: '0.875rem',
              fontWeight: 500
            }
          }}
          variant="filled"
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert 
          severity="success" 
          onClose={() => setSuccess('')}
          sx={{ 
            mb: 3,
            borderRadius: '12px',
            '& .MuiAlert-icon': {
              fontSize: '24px'
            },
            '& .MuiAlert-message': {
              fontSize: '0.875rem',
              fontWeight: 500
            }
          }}
          variant="filled"
        >
          {success}
        </Alert>
      )}

      {projects.length === 0 ? (
        <Card
          sx={{
            borderRadius: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06)',
            overflow: 'hidden',
            background: theme => `linear-gradient(145deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`
          }}
        >
          <CardContent sx={{ 
            textAlign: 'center', 
            py: 8,
            px: { xs: 3, sm: 6 }
          }}>
            <FolderIcon sx={{ 
              fontSize: 80, 
              color: 'primary.light',
              mb: 3,
              opacity: 0.8
            }} />
            <Typography 
              variant="h5" 
              sx={{ 
                color: 'text.primary',
                fontWeight: 600,
                mb: 2
              }}
            >
              No projects found
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                color: 'text.secondary',
                mb: 4,
                maxWidth: '400px',
                mx: 'auto'
              }}
            >
              Create your first BackstopJS project to get started with visual regression testing.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              sx={{ 
                borderRadius: '12px',
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 600,
                py: 1.5,
                px: 4,
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: '0 4px 8px -2px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06)'
                }
              }}
            >
              Create First Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Box 
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3
          }}
        >
          {projects.map((project) => (
            <Card 
              key={project.id} 
              sx={{
                borderRadius: '16px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.05)'
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    mb: 2
                  }}>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 600,
                        color: 'text.primary',
                        mb: 1
                      }}
                    >
                      {project.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {project.hasConfig && (
                        <Chip 
                          label={`${project.scenarioCount} scenarios`} 
                          size="small"
                          sx={{
                            borderRadius: '8px',
                            bgcolor: 'primary.main',
                            color: 'white',
                            fontWeight: 500,
                            '& .MuiChip-label': { px: 2 }
                          }}
                        />
                      )}
                      {!project.hasConfig && (
                        <Chip 
                          label="Not configured" 
                          size="small"
                          sx={{
                            borderRadius: '8px',
                            bgcolor: 'warning.light',
                            color: 'warning.dark',
                            fontWeight: 500,
                            '& .MuiChip-label': { px: 2 }
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'text.secondary',
                      mb: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <Box component="span" sx={{ opacity: 0.7 }}>Created:</Box>
                    {new Date(project.createdAt).toLocaleDateString()}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'text.secondary',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <Box component="span" sx={{ opacity: 0.7 }}>ID:</Box>
                    {project.id}
                  </Typography>
                </Box>
                <Box 
                  sx={{ 
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 2,
                    mt: 3
                  }}
                >
                  <Button
                    variant="contained"
                    startIcon={<SettingsIcon />}
                    onClick={() => selectProject(project)}
                    sx={{
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 500,
                      boxShadow: 'none',
                      '&:hover': {
                        boxShadow: '0 4px 8px -2px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06)'
                      }
                    }}
                  >
                    Open Project
                  </Button>
                  <IconButton
                    color="error"
                    onClick={() => deleteProject(project.id, project.name)}
                    sx={{
                      borderRadius: '8px',
                      '&:hover': {
                        bgcolor: 'error.lighter'
                      }
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Create Project Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }
        }}
      >
        <DialogTitle 
          sx={{
            p: 3,
            pb: 0,
            '& .MuiTypography-root': {
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'text.primary',
              letterSpacing: '-0.025em'
            }
          }}
        >
          Create New Project
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <TextField
            autoFocus
            label="Project Name"
            fullWidth
            variant="outlined"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && newProjectName.trim()) {
                createProject();
              }
            }}
            sx={{ 
              mt: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '2px'
                }
              }
            }}
          />
          <Box sx={{ 
            mt: 3,
            p: 2,
            bgcolor: 'primary.lighter',
            borderRadius: '12px',
            border: '1px solid',
            borderColor: 'primary.light'
          }}>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'primary.dark',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <InfoOutlined sx={{ fontSize: 20 }} />
              Project Details
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'primary.dark',
                mt: 1,
                opacity: 0.9
              }}
            >
              This will create a new BackstopJS project with its own configuration, scenarios, and test results.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions 
          sx={{ 
            p: 3,
            pt: 2,
            gap: 2
          }}
        >
          <Button 
            onClick={() => setCreateDialogOpen(false)}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 500,
              color: 'text.primary'
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={createProject} 
            variant="contained"
            disabled={creating || !newProjectName.trim()}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              px: 4,
              boxShadow: 'none',
              '&:hover': {
                boxShadow: '0 4px 8px -2px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06)'
              }
            }}
          >
            {creating ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} thickness={4} sx={{ color: 'inherit' }} />
                Creating...
              </Box>
            ) : (
              'Create Project'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectSelector;
