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
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  ListItemButton
} from '@mui/material';
import {
  SettingsOutlined,
  ViewListOutlined,
  ImageOutlined,
  CheckCircleOutlined,
  ErrorOutlined,
  InfoOutlined,
  DashboardOutlined,
  Archive,
  Download,
  Visibility,
  Delete,
  FolderOpen
} from '@mui/icons-material';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell, Rectangle } from 'recharts';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const Dashboard = ({ project, config }) => {
  // Test summary state
  const [testSummary, setTestSummary] = useState(null);
  const [testSummaryLoading, setTestSummaryLoading] = useState(true);
  const [testSummaryError, setTestSummaryError] = useState('');

  // Backup management state
  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [backupStats, setBackupStats] = useState(null);
  const [showBackupDetails, setShowBackupDetails] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  useEffect(() => {
    if (project?.id) {
      fetchTestSummary();
      loadBackups();
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
      
      // Summarize status counts - simplified to 3 categories
      const passedTests = results.filter(r => r.status === 'pass');
      const networkErrorTests = results.filter(r => r.status === 'fail' && r.networkError);
      const failedTests = results.filter(r => r.status === 'fail' && !r.networkError);
      
      const summary = {
        total: results.length,
        passed: passedTests.length,
        failed: failedTests.length,
        networkError: networkErrorTests.length,
        // Enhanced data from server
        hasNetworkErrors: response.data.hasNetworkErrors || networkErrorTests.length > 0,
        networkErrorCount: response.data.networkErrorCount || networkErrorTests.length
      };
      setTestSummary({ summary, results });
    } catch (err) {
      setTestSummaryError('Failed to load test summary');
    } finally {
      setTestSummaryLoading(false);
    }
  };

  // Backup management functions
  const loadBackups = async () => {
    setBackupsLoading(true);
    try {
      const [backupsResponse, statsResponse] = await Promise.all([
        axios.get(`${API_BASE}/projects/${project.id}/backups`),
        axios.get(`${API_BASE}/projects/${project.id}/backups/stats`)
      ]);
      setBackups(backupsResponse.data);
      setBackupStats(statsResponse.data);
    } catch (error) {
      console.error('Failed to load backups:', error);
      // Set default empty values if API fails
      setBackups([]);
      setBackupStats({
        totalBackups: 0,
        totalTests: 0,
        totalSize: 0,
        averageFailureRate: 0
      });
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleBackupSelect = (backup) => {
    setSelectedBackup(backup);
    setShowBackupDetails(true);
  };

  const handleDownloadCSV = async (backup) => {
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/backups/${backup.id}/csv`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${backup.name}-${backup.id}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download CSV:', error);
      alert('Failed to download CSV report');
    }
  };

  const handleViewReport = (backup) => {
    try {
      // Access HTML report through the /report middleware which serves the backup directory
      const reportUrl = `${API_BASE}/projects/${project.id}/backups/${backup.id}/report/html_report/index.html`;
      window.open(reportUrl, '_blank');
    } catch (error) {
      console.error('Failed to view report:', error);
      alert('Failed to open HTML report');
    }
  };

  const handleDeleteBackup = async (backup) => {
    if (window.confirm(`Are you sure you want to delete backup "${backup.name}"?`)) {
      try {
        await axios.delete(`${API_BASE}/projects/${project.id}/backups/${backup.id}`);
        loadBackups(); // Refresh the list
      } catch (error) {
        console.error('Failed to delete backup:', error);
        alert('Failed to delete backup');
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography 
              variant="h4" 
              sx={{
                color: 'text.primary',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                mb: 0.5
              }}
            >
              Project Dashboard
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'text.secondary'
              }}
            >
              Visual regression testing results and analytics
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip
              icon={<SettingsOutlined />}
              label={config ? `${config.scenarios?.length || 0} scenarios` : 'No config'}
              color={config ? 'primary' : 'warning'}
              variant="outlined"
              size="small"
            />
            {config && (
              <Chip
                icon={<ViewListOutlined />}
                label={`${config.viewports?.length || 0} viewports`}
                color="info"
                variant="outlined"
                size="small"
              />
            )}
          </Box>
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
              <Chip label={`Network Errors: ${testSummary.summary.networkError}`} color="warning" />
              <Button
                variant="contained"
                color="primary"
                onClick={handleExportReport}
                sx={{ ml: 'auto', borderRadius: 2 }}
              >
                Export Report
              </Button>
            </Box>
            {/* Pass/Fail/Network Error Pie Chart */}
            <Box mb={2}>
              <Typography variant="subtitle1" color="textSecondary" gutterBottom>
                Test Results Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={[{
                      name: 'Pass', value: testSummary.summary.passed
                    }, {
                      name: 'Fail', value: testSummary.summary.failed
                    }, {
                      name: 'Network Error', value: testSummary.summary.networkError
                    }]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    fill="#8884d8"
                    labelLine={false}
                    label={({ name, percent, value }) => 
                      value > 0 ? `${name}: ${value} (${(percent * 100).toFixed(0)}%)` : ''
                    }
                  >
                    <Cell key="pass" fill="#4caf50" />
                    <Cell key="fail" fill="#f44336" />
                    <Cell key="networkError" fill="#ff9800" />
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value, name) => [value, name]}
                    labelFormatter={() => ''}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value, entry) => `${value}: ${entry.payload.value}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            {/* Status Breakdown Graph */}
            <Box mb={2}>
              <Typography variant="subtitle1" color="textSecondary" gutterBottom>
                Test Results Breakdown
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={[{
                    status: 'Passed', value: testSummary.summary.passed, fill: '#4caf50'
                  }, {
                    status: 'Failed', value: testSummary.summary.failed, fill: '#f44336'
                  }, {
                    status: 'Network Error', value: testSummary.summary.networkError, fill: '#ff9800'
                  }]}
                  margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="status" 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    tickLine={{ stroke: '#e0e0e0' }}
                  />
                  <YAxis 
                    allowDecimals={false} 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    tickLine={{ stroke: '#e0e0e0' }}
                  />
                  <RechartsTooltip 
                    formatter={(value) => [value, 'Tests']}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{
                      backgroundColor: '#f5f5f5',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[4, 4, 0, 0]}
                    shape={(props) => {
                      const { ...rest } = props;
                      return <Rectangle {...rest} fill={props.payload.fill} />;
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </>
        ) : null}
      </Box>

      {/* Backup Management Section */}
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
          <Archive sx={{ color: 'primary.main' }} />
          Test Result Backups
        </Typography>

        {/* Backup Statistics */}
        {backupStats && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Card sx={{ bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="primary.main" fontWeight="bold">
                    {backupStats.totalBackups}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Backups
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card sx={{ bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="success.main" fontWeight="bold">
                    {backupStats.totalTests}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Tests
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card sx={{ bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200' }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="warning.main" fontWeight="bold">
                    {formatFileSize(backupStats.totalSize)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Storage Used
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card sx={{ bgcolor: 'error.50', border: '1px solid', borderColor: 'error.200' }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="error.main" fontWeight="bold">
                    {(backupStats.averageFailureRate * 100).toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg Failure Rate
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Backup List */}
        {backupsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={30} />
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ borderRadius: '12px' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Backup Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Created</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Tests</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Size</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {backups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No backups found. Run some tests to create backups automatically.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  backups.map((backup) => (
                    <TableRow 
                      key={backup.id} 
                      hover 
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                      onClick={() => handleBackupSelect(backup)}
                    >
                      <TableCell>
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {backup.name}
                          </Typography>
                          {backup.description && (
                            <Typography variant="caption" color="text.secondary">
                              {backup.description}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(backup.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {backup.testCount || 0}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${backup.passedTests || 0} passed, ${backup.failedTests || 0} failed`}
                          color={backup.failedTests > 0 ? 'error' : 'success'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatFileSize(backup.size || 0)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="Download CSV Report">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadCSV(backup);
                              }}
                            >
                              <Download />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="View HTML Report">
                            <IconButton
                              size="small"
                              color="info"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewReport(backup);
                              }}
                            >
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Backup">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBackup(backup);
                              }}
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Backup Details Dialog */}
      <Dialog 
        open={showBackupDetails} 
        onClose={() => setShowBackupDetails(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FolderOpen color="primary" />
            Backup Details: {selectedBackup?.name}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedBackup && (
            <Box sx={{ pt: 1 }}>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Created</Typography>
                  <Typography variant="body1">{formatDate(selectedBackup.createdAt)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">File Size</Typography>
                  <Typography variant="body1">{formatFileSize(selectedBackup.size || 0)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Total Tests</Typography>
                  <Typography variant="body1">{selectedBackup.testCount || 0}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Test Results</Typography>
                  <Typography variant="body1">
                    {selectedBackup.passedTests || 0} passed, {selectedBackup.failedTests || 0} failed
                  </Typography>
                </Grid>
              </Grid>
              
              {selectedBackup.description && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Description</Typography>
                  <Typography variant="body1">{selectedBackup.description}</Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => selectedBackup && handleDownloadCSV(selectedBackup)}
            startIcon={<Download />}
            variant="outlined"
          >
            Download CSV
          </Button>
          <Button 
            onClick={() => selectedBackup && handleViewReport(selectedBackup)}
            startIcon={<Visibility />}
            variant="outlined"
          >
            View Report
          </Button>
          <Button onClick={() => setShowBackupDetails(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


export default Dashboard;
