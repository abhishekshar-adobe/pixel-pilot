import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  CircularProgress,
  Divider,
  Button
} from '@mui/material';
import {
  SettingsOutlined,
  ViewListOutlined,
  ImageOutlined,
  CheckCircleOutlined,
  ErrorOutlined,
  InfoOutlined
} from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const Dashboard = ({ project, config }) => {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (project) {
      loadScenarios();
    }
  }, [project]);

  const loadScenarios = async () => {
    try {
      setLoading(true);
      setError('');
  const response = await axios.get(`${API_BASE}/projects/${project.id}/scenarios`);
  setScenarios(response.data.scenarios || []);
    } catch (err) {
      console.error('Error loading scenarios:', err);
      setError('Failed to load scenarios');
    } finally {
      setLoading(false);
    }
  };

  const getViewportCount = () => {
    if (!config?.viewports) return 0;
    return config.viewports.length;
  };

  const getTotalTests = () => {
    return scenarios.length * getViewportCount();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Scenarios per Viewport Bar Chart */}
      {config?.viewports && scenarios.length > 0 && (
        <Box mb={4}>
          <Typography variant="h6" gutterBottom color="primary">
            Scenarios per Viewport
          </Typography>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={config.viewports.map((vp, idx) => ({
                viewport: vp.label,
                scenarios: scenarios.length // Each scenario is tested on each viewport
              }))}
              margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="viewport" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="scenarios" fill="#1976d2" name="Scenarios" />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
      {/* Project Info Header */}
      <Box mb={4}>
        <Typography variant="h4" gutterBottom color="primary">
          Project Dashboard
        </Typography>
        <Typography variant="body1" color="textSecondary" paragraph>
          {project.description || 'BackstopJS visual regression testing project'}
        </Typography>
        
        <Box display="flex" gap={1} mt={2}>
          <Chip
            icon={<InfoOutlined />}
            label={`Created: ${new Date(project.created).toLocaleDateString()}`}
            variant="outlined"
            size="small"
          />
          <Chip
            icon={<SettingsOutlined />}
            label={config ? 'Config Available' : 'No Config'}
            color={config ? 'success' : 'warning'}
            variant="outlined"
            size="small"
          />
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <ViewListOutlined color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="primary">
                {scenarios.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Test Scenarios
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <ImageOutlined color="secondary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="secondary">
                {getViewportCount()}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Viewports
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircleOutlined color="success" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="success.main">
                {getTotalTests()}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Total Tests
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <SettingsOutlined color="info" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="info.main">
                {config?.id ? '✓' : '✗'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Configuration
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary">
                Test Scenarios
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              {scenarios.length === 0 ? (
                <Typography variant="body2" color="textSecondary" textAlign="center" py={4}>
                  No scenarios configured yet. Add scenarios to start testing.
                </Typography>
              ) : (
                <List dense>
                  {scenarios.slice(0, 5).map((scenario, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckCircleOutlined color="success" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={scenario.label}
                        secondary={scenario.url}
                      />
                    </ListItem>
                  ))}
                  {scenarios.length > 5 && (
                    <ListItem>
                      <ListItemText
                        primary={`... and ${scenarios.length - 5} more scenarios`}
                        sx={{ fontStyle: 'italic', color: 'textSecondary' }}
                      />
                    </ListItem>
                  )}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary">
                Quick Actions
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box display="flex" flexDirection="column" gap={2}>
                {!config && (
                  <Button 
                    variant="outlined" 
                    color="warning"
                    startIcon={<SettingsOutlined />}
                    fullWidth
                  >
                    Configure Project
                  </Button>
                )}
                
                <Button 
                  variant="outlined" 
                  startIcon={<ViewListOutlined />}
                  fullWidth
                  disabled={!config}
                >
                  Manage Scenarios
                </Button>
                
                <Button 
                  variant="contained" 
                  color="primary"
                  startIcon={<CheckCircleOutlined />}
                  fullWidth
                  disabled={!config || scenarios.length === 0}
                >
                  Run All Tests
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
