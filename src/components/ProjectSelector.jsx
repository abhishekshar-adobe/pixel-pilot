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
  PlayArrow as PlayArrowIcon
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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          PixelPilot Projects
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ minWidth: 140 }}
        >
          New Project
        </Button>
      </Box>

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

      {projects.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <FolderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No projects found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create your first BackstopJS project to get started with visual regression testing.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create First Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <List>
          {projects.map((project) => (
            <Card key={project.id} sx={{ mb: 2 }}>
              <ListItem>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="h6">{project.name}</Typography>
                      {project.hasConfig && (
                        <Chip 
                          label={`${project.scenarioCount} scenarios`} 
                          size="small" 
                          color="primary" 
                          variant="outlined" 
                        />
                      )}
                      {!project.hasConfig && (
                        <Chip 
                          label="Not configured" 
                          size="small" 
                          color="warning" 
                          variant="outlined" 
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Created: {new Date(project.createdAt).toLocaleDateString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ID: {project.id}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Box display="flex" gap={1}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<SettingsIcon />}
                      onClick={() => selectProject(project)}
                    >
                      Open
                    </Button>
                    <IconButton
                      edge="end"
                      color="error"
                      onClick={() => deleteProject(project.id, project.name)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            </Card>
          ))}
        </List>
      )}

      {/* Create Project Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            fullWidth
            variant="outlined"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                createProject();
              }
            }}
            sx={{ mt: 2 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This will create a new BackstopJS project with its own configuration, scenarios, and test results.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={createProject} 
            variant="contained"
            disabled={creating || !newProjectName.trim()}
          >
            {creating ? <CircularProgress size={20} /> : 'Create Project'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectSelector;
