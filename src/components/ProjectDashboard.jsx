import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Tabs,
  Tab,
  Button,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  SettingsOutlined,
  PlayArrowOutlined,
  UploadFileOutlined,
  ViewListOutlined,
  DashboardOutlined,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import axios from 'axios';

// Import existing components
import ConfigEditor from './ConfigEditor';
import ScenarioManager from './ScenarioManager';
import ScreenshotUploader from './ScreenshotUploader';
import TestRunner from './TestRunner';
import Dashboard from './Dashboard';

const API_BASE = 'http://localhost:5000/api';

function ProjectContent({ project, onBack }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [projectConfig, setProjectConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (project) {
      loadProjectConfig();
    }
  }, [project]);

  const loadProjectConfig = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get(`${API_BASE}/projects/${project.id}/config`);
      setProjectConfig(response.data);
    } catch (err) {
      console.error('Error loading project config:', err);
      setError('Failed to load project configuration: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const getActiveTab = () => {
    switch (location.pathname) {
      case '/dashboard': return 0;
      case '/config': return 1;
      case '/scenarios': return 2;
      case '/upload': return 3;
      case '/test': return 4;
      default: return 0;
    }
  };

  const handleTabChange = (event, newValue) => {
    const routes = ['/dashboard', '/config', '/scenarios', '/upload', '/test'];
    navigate(routes[newValue]);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Project Header */}
      <AppBar position="static" sx={{ bgcolor: 'primary.main' }}>
        <Toolbar>
          <Button
            startIcon={<ArrowBackIcon />}
            color="inherit"
            onClick={onBack}
            sx={{ mr: 2 }}
          >
            Back to Projects
          </Button>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {project.name}
          </Typography>
          <Chip
            label={project.id}
            size="small"
            variant="outlined"
            sx={{ color: 'white', borderColor: 'white' }}
          />
        </Toolbar>
      </AppBar>

      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* Navigation Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Tabs
          value={getActiveTab()}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{ minHeight: 64 }}
        >
          <Tab
            icon={<DashboardOutlined />}
            label="Dashboard"
            iconPosition="start"
            sx={{ minHeight: 64, textTransform: 'none' }}
          />
          <Tab
            icon={<SettingsOutlined />}
            label="Configuration"
            iconPosition="start"
            sx={{ minHeight: 64, textTransform: 'none' }}
          />
          <Tab
            icon={<ViewListOutlined />}
            label="Scenarios"
            iconPosition="start"
            sx={{ minHeight: 64, textTransform: 'none' }}
          />
          <Tab
            icon={<UploadFileOutlined />}
            label="Screenshots"
            iconPosition="start"
            sx={{ minHeight: 64, textTransform: 'none' }}
          />
          <Tab
            icon={<PlayArrowOutlined />}
            label="Run Tests"
            iconPosition="start"
            sx={{ minHeight: 64, textTransform: 'none' }}
          />
        </Tabs>
      </Box>

      {/* Content Area */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: 'background.default' }}>
        <Routes>
          <Route 
            path="/dashboard" 
            element={<Dashboard project={project} config={projectConfig} />} 
          />
          <Route 
            path="/config" 
            element={
              <ConfigEditor 
                project={project} 
                onConfigUpdate={loadProjectConfig}
              />
            } 
          />
          <Route 
            path="/scenarios" 
            element={
              <ScenarioManager 
                project={project}
                config={projectConfig}
                onConfigUpdate={loadProjectConfig}
              />
            } 
          />
          <Route 
            path="/upload" 
            element={
              <ScreenshotUploader 
                project={project}
                config={projectConfig}
              />
            } 
          />
          <Route 
            path="/test" 
            element={
              <TestRunner 
                project={project}
                config={projectConfig}
              />
            } 
          />
          <Route 
            path="*" 
            element={<Dashboard project={project} config={projectConfig} />} 
          />
        </Routes>
      </Box>
    </Box>
  );
}

const ProjectDashboard = ({ project, onBack }) => {
  return (
    <Router>
      <ProjectContent project={project} onBack={onBack} />
    </Router>
  );
};

export default ProjectDashboard;
