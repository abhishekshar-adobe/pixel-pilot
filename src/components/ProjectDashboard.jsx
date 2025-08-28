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
      <Box 
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          gap: 2,
          bgcolor: 'background.default'
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
          variant="body2"
          sx={{
            color: 'text.secondary',
            fontWeight: 500
          }}
        >
          Loading project...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Project Header */}
      <AppBar 
        position="static" 
        elevation={0}
        sx={{ 
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: '64px', sm: '70px' } }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
            sx={{ 
              mr: 2,
              color: 'text.primary',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.04)',
              },
              fontWeight: 500
            }}
          >
            Back to Projects
          </Button>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              flexGrow: 1,
              color: 'text.primary',
              fontWeight: 600,
              letterSpacing: '-0.025em'
            }}
          >
            {project.name}
          </Typography>
          <Chip
            label={project.id}
            size="small"
            sx={{ 
              bgcolor: 'primary.main',
              color: 'white',
              fontWeight: 500,
              '& .MuiChip-label': {
                px: 2
              },
              borderRadius: '6px'
            }}
          />
        </Toolbar>
      </AppBar>

      {error && (
        <Box sx={{ p: 2 }}>
          <Alert 
            severity="error" 
            sx={{ 
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
        </Box>
      )}

      {/* Navigation Tabs */}
      <Box 
        sx={{ 
          borderBottom: 1, 
          borderColor: 'divider', 
          bgcolor: 'background.paper',
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          backdropFilter: 'blur(20px)',
          backgroundColor: 'rgba(255, 255, 255, 0.9)'
        }}
      >
        <Tabs
          value={getActiveTab()}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            minHeight: 64,
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0'
            }
          }}
        >
          <Tab
            icon={<DashboardOutlined />}
            label="Dashboard"
            iconPosition="start"
            sx={theme => ({
              minHeight: 64,
              textTransform: 'none',
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'primary.main',
                fontWeight: 600
              },
              '& .MuiSvgIcon-root': {
                fontSize: '1.25rem',
                marginRight: 1,
                transition: 'color 0.2s'
              }
            })}
          />
          <Tab
            icon={<SettingsOutlined />}
            label="Configuration"
            iconPosition="start"
            sx={theme => ({
              minHeight: 64,
              textTransform: 'none',
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'primary.main',
                fontWeight: 600
              },
              '& .MuiSvgIcon-root': {
                fontSize: '1.25rem',
                marginRight: 1,
                transition: 'color 0.2s'
              }
            })}
          />
          <Tab
            icon={<ViewListOutlined />}
            label="Scenarios"
            iconPosition="start"
            sx={theme => ({
              minHeight: 64,
              textTransform: 'none',
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'primary.main',
                fontWeight: 600
              },
              '& .MuiSvgIcon-root': {
                fontSize: '1.25rem',
                marginRight: 1,
                transition: 'color 0.2s'
              }
            })}
          />
          <Tab
            icon={<UploadFileOutlined />}
            label="Screenshots"
            iconPosition="start"
            sx={theme => ({
              minHeight: 64,
              textTransform: 'none',
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'primary.main',
                fontWeight: 600
              },
              '& .MuiSvgIcon-root': {
                fontSize: '1.25rem',
                marginRight: 1,
                transition: 'color 0.2s'
              }
            })}
          />
          <Tab
            icon={<PlayArrowOutlined />}
            label="Run Tests"
            iconPosition="start"
            sx={theme => ({
              minHeight: 64,
              textTransform: 'none',
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'primary.main',
                fontWeight: 600
              },
              '& .MuiSvgIcon-root': {
                fontSize: '1.25rem',
                marginRight: 1,
                transition: 'color 0.2s'
              }
            })}
          />
        </Tabs>
      </Box>

      {/* Content Area */}
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          bgcolor: 'background.default',
          minHeight: 'calc(100vh - 134px)', // 70px header + 64px tabs
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Box 
          sx={{ 
            maxWidth: '1600px', 
            width: '100%', 
            mx: 'auto',
            flexGrow: 1
          }}
        >
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
