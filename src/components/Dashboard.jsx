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
  InfoOutlined,
  DashboardOutlined
} from '@mui/icons-material';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const Dashboard = ({ project, config }) => {
  // Test summary state
  const [testSummary, setTestSummary] = useState(null);
  const [testSummaryLoading, setTestSummaryLoading] = useState(true);
  const [testSummaryError, setTestSummaryError] = useState('');

  useEffect(() => {
    if (project?.id) {
      fetchTestSummary();
    }
  }, [project]);

  const fetchTestSummary = async () => {
    setTestSummaryLoading(true);
    setTestSummaryError('');
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/test-results`);
      const results = Array.isArray(response.data.results)
        ? response.data.results
        : Array.isArray(response.data.tests)
          ? response.data.tests
          : Array.isArray(response.data)
            ? response.data
            : [];
      // Summarize status counts
      const summary = {
        total: results.length,
        passed: results.filter(r => r.status === 'pass').length,
        failed: results.filter(r => r.status === 'fail').length,
        new: results.filter(r => r.status === 'new').length,
        referenceMissing: results.filter(r => r.status === 'referenceMissing').length,
        other: results.filter(r => !['pass','fail','new','referenceMissing'].includes(r.status)).length
      };
      setTestSummary({ summary, results });
    } catch (err) {
      setTestSummaryError('Failed to load test summary');
    } finally {
      setTestSummaryLoading(false);
    }
  };
  const handleExportReport = async () => {
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/test-results`);
      const results = Array.isArray(response.data.results)
        ? response.data.results
        : Array.isArray(response.data.tests)
          ? response.data.tests
          : Array.isArray(response.data)
            ? response.data
            : [];
      if (results.length === 0) {
        alert('No test results found for this project.');
        return;
      }
      // Flatten results so each pair property and status is a column
      const flatResults = results.map(r => ({
        ...r.pair,
        ...(r.pair.diff || {}),
        status: r.status
      }));
      const csv = Papa.unparse(flatResults);
      // Trigger download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project_${project.id}_test_results.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export report.');
      console.error('Export error:', err);
    }
  };
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
      {/* Project Info Header - top */}
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

      {/* Stats Cards - moved before Test Summary */}
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

      {/* Test Summary Section */}
      <Box mb={4}>
        <Typography variant="h6" color="primary" gutterBottom>
          Test Summary
        </Typography>
        {testSummaryLoading ? (
          <CircularProgress size={24} />
        ) : testSummaryError ? (
          <Alert severity="error">{testSummaryError}</Alert>
        ) : testSummary ? (
          <>
            <Box display="flex" gap={2} mb={2}>
              <Chip label={`Total: ${testSummary.summary.total}`} color="info" />
              <Chip label={`Passed: ${testSummary.summary.passed}`} color="success" />
              <Chip label={`Failed: ${testSummary.summary.failed}`} color="error" />
              <Chip label={`New: ${testSummary.summary.new}`} color="warning" />
              <Chip label={`Missing Ref: ${testSummary.summary.referenceMissing}`} color="default" />
            </Box>
            {/* Pass/Fail/Other Pie Chart */}
            <Box mb={2}>
              <Typography variant="subtitle1" color="textSecondary" gutterBottom>
                Pass vs Fail Ratio
              </Typography>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={[{
                      name: 'Pass', value: testSummary.summary.passed
                    }, {
                      name: 'Fail', value: testSummary.summary.failed
                    }, {
                      name: 'Error', value: testSummary.summary.other
                    }]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    fill="#8884d8"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    <Cell key="pass" fill="#4caf50" />
                    <Cell key="fail" fill="#f44336" />
                    <Cell key="error" fill="#ff9800" />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            {/* Status Breakdown Graph */}
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={[{
                  status: 'Passed', value: testSummary.summary.passed
                }, {
                  status: 'Failed', value: testSummary.summary.failed
                }, {
                  status: 'New', value: testSummary.summary.new
                }, {
                  status: 'Missing Ref', value: testSummary.summary.referenceMissing
                }]}
                margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#1976d2" />
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : null}
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
  </Box>
  );
}


export default Dashboard;
