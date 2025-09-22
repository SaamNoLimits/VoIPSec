import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Alert,
  Tabs,
  Tab,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  Phone as PhoneIcon,
  CallEnd as CallEndIcon,
  PlayArrow as PlayIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';
import { format, parseISO } from 'date-fns';

const Calls = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [tabValue, setTabValue] = useState(0);
  const [activeCalls, setActiveCalls] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dispositionFilter, setDispositionFilter] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  
  // Dialogs
  const [originateDialogOpen, setOriginateDialogOpen] = useState(false);
  const [callDetailDialogOpen, setCallDetailDialogOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  
  // Originate call form
  const [originateForm, setOriginateForm] = useState({
    channel: '',
    context: 'internal',
    exten: '',
    priority: 1,
    callerid: ''
  });

  useEffect(() => {
    if (tabValue === 0) {
      fetchActiveCalls();
    } else {
      fetchCallHistory();
    }
  }, [tabValue, page, rowsPerPage, searchTerm, dispositionFilter, startDate, endDate]);

  useEffect(() => {
    if (socket) {
      socket.on('callStateChange', handleCallStateChange);
      socket.on('newCall', handleNewCall);
      socket.on('callEnded', handleCallEnded);
      
      return () => {
        socket.off('callStateChange', handleCallStateChange);
        socket.off('newCall', handleNewCall);
        socket.off('callEnded', handleCallEnded);
      };
    }
  }, [socket]);

  const fetchActiveCalls = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/calls/active');
      setActiveCalls(response.data.data.activeCalls || []);
    } catch (error) {
      setError('Failed to fetch active calls');
      console.error('Fetch active calls error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCallHistory = async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        ...(searchTerm && { callerIdNum: searchTerm }),
        ...(dispositionFilter && { disposition: dispositionFilter }),
        ...(startDate && { startDate: startDate.toISOString() }),
        ...(endDate && { endDate: endDate.toISOString() })
      };
      
      const response = await axios.get('/api/calls/history', { params });
      setCallHistory(response.data.data.calls);
      setTotalCount(response.data.data.pagination.total);
    } catch (error) {
      setError('Failed to fetch call history');
      console.error('Fetch call history error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCallStateChange = (data) => {
    setActiveCalls(prev => prev.map(call => 
      call.uniqueid === data.uniqueid ? { ...call, ...data } : call
    ));
  };

  const handleNewCall = (data) => {
    setActiveCalls(prev => [...prev, data]);
  };

  const handleCallEnded = (data) => {
    setActiveCalls(prev => prev.filter(call => call.uniqueid !== data.uniqueid));
    // Refresh call history if we're on that tab
    if (tabValue === 1) {
      fetchCallHistory();
    }
  };

  const handleOriginateCall = async () => {
    try {
      setLoading(true);
      setError('');
      
      await axios.post('/api/calls/originate', originateForm);
      setSuccess('Call originated successfully');
      setOriginateDialogOpen(false);
      setOriginateForm({
        channel: '',
        context: 'internal',
        exten: '',
        priority: 1,
        callerid: ''
      });
      
      // Refresh active calls
      if (tabValue === 0) {
        fetchActiveCalls();
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to originate call');
    } finally {
      setLoading(false);
    }
  };

  const handleHangupCall = async (channel) => {
    try {
      await axios.post('/api/calls/hangup', { channel });
      setSuccess('Call hung up successfully');
      fetchActiveCalls();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to hangup call');
    }
  };

  const handleViewCallDetail = async (call) => {
    try {
      const response = await axios.get(`/api/calls/${call.id}`);
      setSelectedCall(response.data.data);
      setCallDetailDialogOpen(true);
    } catch (error) {
      setError('Failed to fetch call details');
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getDispositionChip = (disposition) => {
    const colors = {
      'ANSWERED': 'success',
      'NO ANSWER': 'warning',
      'BUSY': 'info',
      'FAILED': 'error',
      'CANCELLED': 'default'
    };
    
    return (
      <Chip 
        label={disposition} 
        color={colors[disposition] || 'default'} 
        size="small" 
      />
    );
  };

  const canManageCalls = user?.role === 'admin' || user?.role === 'manager';

  const ActiveCallsTab = () => (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          Active Calls ({activeCalls.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchActiveCalls}
          >
            Refresh
          </Button>
          {canManageCalls && (
            <Button
              variant="contained"
              startIcon={<PhoneIcon />}
              onClick={() => setOriginateDialogOpen(true)}
            >
              Originate Call
            </Button>
          )}
        </Box>
      </Box>

      {activeCalls.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No active calls
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {activeCalls.map((call, index) => (
            <Grid item xs={12} md={6} lg={4} key={index}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" component="div">
                      {call.calleridnum || 'Unknown'}
                    </Typography>
                    <Chip 
                      label={call.state || 'Active'} 
                      color="success" 
                      size="small" 
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    To: {call.exten || call.destination || 'Unknown'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Channel: {call.channel}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Duration: {formatDuration(call.duration || 0)}
                  </Typography>
                  {canManageCalls && (
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<CallEndIcon />}
                        onClick={() => handleHangupCall(call.channel)}
                      >
                        Hangup
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );

  const CallHistoryTab = () => (
    <Box>
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Search caller..."
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />
              }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Disposition</InputLabel>
              <Select
                value={dispositionFilter}
                label="Disposition"
                onChange={(e) => setDispositionFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="ANSWERED">Answered</MenuItem>
                <MenuItem value="NO ANSWER">No Answer</MenuItem>
                <MenuItem value="BUSY">Busy</MenuItem>
                <MenuItem value="FAILED">Failed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={setStartDate}
                renderInput={(params) => <TextField {...params} size="small" fullWidth />}
              />
            </LocalizationProvider>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={setEndDate}
                renderInput={(params) => <TextField {...params} size="small" fullWidth />}
              />
            </LocalizationProvider>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchCallHistory}
              >
                Refresh
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => window.open('/api/calls/export/csv', '_blank')}
              >
                Export
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Call History Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Caller</TableCell>
              <TableCell>Destination</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Disposition</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : callHistory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No call records found
                </TableCell>
              </TableRow>
            ) : (
              callHistory.map((call) => (
                <TableRow key={call.id}>
                  <TableCell>
                    <Typography variant="body2">
                      {format(parseISO(call.start_time), 'MMM dd, yyyy HH:mm')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {call.caller_id_name || call.caller_id_num || 'Unknown'}
                    </Typography>
                    {call.caller_id_name && call.caller_id_num && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {call.caller_id_num}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{call.destination}</TableCell>
                  <TableCell>{formatDuration(call.duration)}</TableCell>
                  <TableCell>{getDispositionChip(call.disposition)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => handleViewCallDetail(call)}
                        >
                          <SearchIcon />
                        </IconButton>
                      </Tooltip>
                      {call.recording_file && (
                        <Tooltip title="Play Recording">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => window.open(`/api/calls/${call.id}/recording`, '_blank')}
                          >
                            <PlayIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>
    </Box>
  );

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Calls
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Active Calls" />
          <Tab label="Call History" />
        </Tabs>
        
        <Box sx={{ p: 3 }}>
          {tabValue === 0 && <ActiveCallsTab />}
          {tabValue === 1 && <CallHistoryTab />}
        </Box>
      </Paper>

      {/* Originate Call Dialog */}
      <Dialog open={originateDialogOpen} onClose={() => setOriginateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Originate Call</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Channel (e.g., SIP/1001)"
              value={originateForm.channel}
              onChange={(e) => setOriginateForm(prev => ({ ...prev, channel: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Extension/Number"
              value={originateForm.exten}
              onChange={(e) => setOriginateForm(prev => ({ ...prev, exten: e.target.value }))}
              required
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Context</InputLabel>
              <Select
                value={originateForm.context}
                label="Context"
                onChange={(e) => setOriginateForm(prev => ({ ...prev, context: e.target.value }))}
              >
                <MenuItem value="internal">Internal</MenuItem>
                <MenuItem value="from-trunk">From Trunk</MenuItem>
                <MenuItem value="emergency">Emergency</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Priority"
              type="number"
              value={originateForm.priority}
              onChange={(e) => setOriginateForm(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
              fullWidth
            />
            <TextField
              label="Caller ID (optional)"
              value={originateForm.callerid}
              onChange={(e) => setOriginateForm(prev => ({ ...prev, callerid: e.target.value }))}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOriginateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleOriginateCall} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Originate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Call Detail Dialog */}
      <Dialog open={callDetailDialogOpen} onClose={() => setCallDetailDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Call Details</DialogTitle>
        <DialogContent>
          {selectedCall && (
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Unique ID:</Typography>
                  <Typography variant="body2" gutterBottom>{selectedCall.uniqueid}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Disposition:</Typography>
                  <Box sx={{ mb: 2 }}>{getDispositionChip(selectedCall.disposition)}</Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Caller:</Typography>
                  <Typography variant="body2" gutterBottom>
                    {selectedCall.caller_id_name || selectedCall.caller_id_num || 'Unknown'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Destination:</Typography>
                  <Typography variant="body2" gutterBottom>{selectedCall.destination}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Start Time:</Typography>
                  <Typography variant="body2" gutterBottom>
                    {format(parseISO(selectedCall.start_time), 'MMM dd, yyyy HH:mm:ss')}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Duration:</Typography>
                  <Typography variant="body2" gutterBottom>{formatDuration(selectedCall.duration)}</Typography>
                </Grid>
                {selectedCall.mos_score && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2">Call Quality (MOS):</Typography>
                      <Typography variant="body2" gutterBottom>{selectedCall.mos_score.toFixed(2)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2">Packet Loss:</Typography>
                      <Typography variant="body2" gutterBottom>{selectedCall.packet_loss}%</Typography>
                    </Grid>
                  </>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCallDetailDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Calls;
