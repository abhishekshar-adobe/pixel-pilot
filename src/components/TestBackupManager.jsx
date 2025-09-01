import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Stack,
  Grid,
  Paper,
  Alert,
  CircularProgress,
  Tooltip,
  Menu,
  MenuItem,
  Divider
} from '@mui/material'
import {
  Archive,
  Download,
  Visibility,
  Delete,
  Add,
  FileDownload,
  Assessment,
  Schedule,
  Storage,
  CheckCircle,
  Error,
  MoreVert,
  Refresh,
  CloudDownload,
  FolderOpen,
  Timeline
} from '@mui/icons-material'

const API_BASE = 'http://localhost:5000/api'

function TestBackupManager({ project, onClose }) {
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newBackupName, setNewBackupName] = useState('')
  const [newBackupDescription, setNewBackupDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState(null)
  const [selectedBackup, setSelectedBackup] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadBackups()
  }, [project.id])

  const loadBackups = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${API_BASE}/projects/${project.id}/backups`)
      setBackups(response.data)
    } catch (error) {
      console.error('Error loading backups:', error)
      setMessage('Failed to load backups')
    } finally {
      setLoading(false)
    }
  }

  const createBackup = async () => {
    try {
      setCreating(true)
      const response = await axios.post(`${API_BASE}/projects/${project.id}/backup`, {
        backupName: newBackupName,
        description: newBackupDescription
      })
      
      setMessage(`Backup created successfully: ${response.data.backup.name}`)
      setCreateDialogOpen(false)
      setNewBackupName('')
      setNewBackupDescription('')
      await loadBackups()
    } catch (error) {
      console.error('Error creating backup:', error)
      setMessage(error.response?.data?.error || 'Failed to create backup')
    } finally {
      setCreating(false)
    }
  }

  const downloadCSV = async (backupId) => {
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/backups/${backupId}/csv`, {
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `backstop-results-${backupId}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      setMessage('CSV downloaded successfully')
    } catch (error) {
      console.error('Error downloading CSV:', error)
      setMessage('Failed to download CSV')
    }
  }

  const openReport = (backupId) => {
    const reportUrl = `${API_BASE}/projects/${project.id}/backups/${backupId}/report/index.html`
    window.open(reportUrl, '_blank')
  }

  const deleteBackup = async (backupId) => {
    try {
      await axios.delete(`${API_BASE}/projects/${project.id}/backups/${backupId}`)
      setMessage('Backup deleted successfully')
      await loadBackups()
    } catch (error) {
      console.error('Error deleting backup:', error)
      setMessage('Failed to delete backup')
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleMenuClick = (event, backup) => {
    setMenuAnchor(event.currentTarget)
    setSelectedBackup(backup)
  }

  const handleMenuClose = () => {
    setMenuAnchor(null)
    setSelectedBackup(null)
  }

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { borderRadius: '16px', maxHeight: '90vh' }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Archive sx={{ color: 'primary.main', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Test Result Backups
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Manage historical BackstopJS test results for {project.name}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {message && (
          <Alert 
            severity={message.includes('Failed') || message.includes('Error') ? 'error' : 'success'}
            sx={{ mb: 3, borderRadius: '8px' }}
            onClose={() => setMessage('')}
          >
            {message}
          </Alert>
        )}

        {/* Summary Statistics */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center', borderRadius: '12px' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {backups.length}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Total Backups
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center', borderRadius: '12px' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                {backups.reduce((acc, b) => acc + b.testSummary.totalTests, 0)}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Total Tests
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center', borderRadius: '12px' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main' }}>
                {formatFileSize(backups.reduce((acc, b) => acc + (b.size || 0), 0))}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Total Size
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center', borderRadius: '12px' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
                {backups.length > 0 ? Math.round(
                  backups.reduce((acc, b) => acc + b.testSummary.failedTests, 0) / 
                  backups.reduce((acc, b) => acc + b.testSummary.totalTests, 0) * 100
                ) : 0}%
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Avg Failure Rate
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Action Buttons */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ borderRadius: '8px' }}
          >
            Create Backup
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadBackups}
            sx={{ borderRadius: '8px' }}
          >
            Refresh
          </Button>
        </Stack>

        {/* Backups Table */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : backups.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: '12px' }}>
            <Archive sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1, color: 'text.secondary' }}>
              No backups found
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
              Create your first backup to preserve test results
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create First Backup
            </Button>
          </Paper>
        ) : (
          <TableContainer component={Paper} sx={{ borderRadius: '12px' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Backup Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Date Created</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Test Summary</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Size</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {backup.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {backup.description}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography variant="body2">
                          {new Date(backup.timestamp).toLocaleDateString()}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {new Date(backup.timestamp).toLocaleTimeString()}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip
                          size="small"
                          icon={<Assessment />}
                          label={`${backup.testSummary.totalTests} tests`}
                          sx={{ borderRadius: '6px' }}
                        />
                        <Chip
                          size="small"
                          icon={<CheckCircle />}
                          label={`${backup.testSummary.passedTests} passed`}
                          color="success"
                          sx={{ borderRadius: '6px' }}
                        />
                        {backup.testSummary.failedTests > 0 && (
                          <Chip
                            size="small"
                            icon={<Error />}
                            label={`${backup.testSummary.failedTests} failed`}
                            color="error"
                            sx={{ borderRadius: '6px' }}
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatFileSize(backup.size || 0)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Download CSV Report">
                          <IconButton
                            size="small"
                            onClick={() => downloadCSV(backup.id)}
                            sx={{ color: 'primary.main' }}
                          >
                            <FileDownload />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Open HTML Report">
                          <IconButton
                            size="small"
                            onClick={() => openReport(backup.id)}
                            sx={{ color: 'success.main' }}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="More Actions">
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuClick(e, backup)}
                          >
                            <MoreVert />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} sx={{ borderRadius: '8px' }}>
          Close
        </Button>
      </DialogActions>

      {/* Create Backup Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Backup</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Backup Name"
              value={newBackupName}
              onChange={(e) => setNewBackupName(e.target.value)}
              placeholder="e.g., Sprint 23 Release Tests"
            />
            <TextField
              fullWidth
              label="Description (Optional)"
              value={newBackupDescription}
              onChange={(e) => setNewBackupDescription(e.target.value)}
              placeholder="Describe what this backup contains..."
              multiline
              rows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={createBackup}
            disabled={creating || !newBackupName.trim()}
            startIcon={creating ? <CircularProgress size={16} /> : <Archive />}
          >
            {creating ? 'Creating...' : 'Create Backup'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          downloadCSV(selectedBackup?.id)
          handleMenuClose()
        }}>
          <FileDownload sx={{ mr: 1 }} />
          Download CSV
        </MenuItem>
        <MenuItem onClick={() => {
          openReport(selectedBackup?.id)
          handleMenuClose()
        }}>
          <Visibility sx={{ mr: 1 }} />
          View Report
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => {
            deleteBackup(selectedBackup?.id)
            handleMenuClose()
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} />
          Delete Backup
        </MenuItem>
      </Menu>
    </Dialog>
  )
}

export default TestBackupManager
