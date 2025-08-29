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
      <Box 
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
          width: '100%',
          bgcolor: 'background.default',
          borderRadius: '1rem',
          p: 3
        }}
      >
        <CircularProgress size={40} thickness={4} />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      bgcolor: 'background.default',
      py: { xs: 3, md: 4 },
      px: { xs: 2, sm: 3, md: 4 }
    }}>
      {/* Project Info Header - top */}
      <Box
        sx={{
          mb: 4,
          p: { xs: 3, md: 4 },
          borderRadius: '1rem',
          bgcolor: 'background.paper',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        }}
      >
        <Typography 
          variant="h4" 
          gutterBottom 
          sx={{
            color: 'text.primary',
            fontWeight: 700,
            letterSpacing: '-0.025em'
          }}
        >
          Project Dashboard
        </Typography>
        <Typography 
          variant="body1" 
          sx={{ 
            color: 'text.secondary',
            mb: 3
          }}
        >
          {project.description || 'BackstopJS visual regression testing project'}
        </Typography>
        <Box 
          sx={{
            display: 'flex',
            gap: 2,
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
          <Chip
            icon={<InfoOutlined />}
            label={`Created: ${new Date(project.created).toLocaleDateString()}`}
            variant="outlined"
            size="small"
            sx={{ bgcolor: 'background.paper' }}
          />
          <Chip
            icon={<SettingsOutlined />}
            label={config ? 'Config Available' : 'No Config'}
            color={config ? 'success' : 'warning'}
            variant="outlined"
            size="small"
            sx={{ bgcolor: 'background.paper' }}
          />
        </Box>
      </Box>

      {/* Test Summary Section */}
      <Box
        sx={{
          mb: 4,
          p: { xs: 2, md: 3 },
          borderRadius: '1rem',
          bgcolor: 'background.paper',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        }}
      >
        <Typography
          variant="h5"
          sx={{
            mb: 3,
            fontWeight: 600,
            color: 'text.primary',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <DashboardOutlined sx={{ color: 'primary.main' }} />
          Test Summary
        </Typography>
        {testSummaryLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={30} />
          </Box>
        ) : testSummaryError ? (
          <Alert 
            severity="error"
            sx={{ 
              borderRadius: '0.75rem',
              '& .MuiAlert-icon': {
                fontSize: '24px'
              }
            }}
          >
            {testSummaryError}
          </Alert>
        ) : testSummary ? (
          <>
            <Box display="flex" gap={2} mb={2}>
              <Chip label={`Total: ${testSummary.summary.total}`} color="info" />
              <Chip label={`Passed: ${testSummary.summary.passed}`} color="success" />
              <Chip label={`Failed: ${testSummary.summary.failed}`} color="error" />
              <Chip label={`New: ${testSummary.summary.new}`} color="warning" />
              <Chip label={`Missing Ref: ${testSummary.summary.referenceMissing}`} color="default" />
              <Button
                variant="contained"
                color="primary"
                onClick={handleExportReport}
                sx={{ ml: 'auto', borderRadius: 2 }}
              >
                Export Report
              </Button>
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

  </Box>
  );
}


export default Dashboard;
