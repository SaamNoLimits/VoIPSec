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
  FormControlLabel,
  Switch,
  Box,
  Alert,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Tooltip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  People as PeopleIcon,
  MicOff as MicOffIcon,
  Mic as MicIcon,
  PersonRemove as KickIcon,
  VideoCall as VideoCallIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';
import { format, parseISO } from 'date-fns';

const Conferences = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [conferences, setConferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [editingConference, setEditingConference] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conferenceToDelete, setConferenceToDelete] = useState(null);
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
  const [selectedConference, setSelectedConference] = useState(null);
  const [participants, setParticipants] = useState([]);
  
  // Form state
  const [formData, setFormData] = useState({
    roomNumber: '',
    name: '',
    description: '',
    pin: '',
    adminPin: '',
    maxMembers: 50,
    recordConference: false
  });

  useEffect(() => {
    fetchConferences();
  }, [page, rowsPerPage, searchTerm, statusFilter]);

  useEffect(() => {
    if (socket) {
      socket.on('conferenceJoined', handleConferenceJoined);
      socket.on('conferenceLeft', handleConferenceLeft);
      socket.on('participantMuted', handleParticipantMuted);
      socket.on('participantUnmuted', handleParticipantUnmuted);
      
      return () => {
        socket.off('conferenceJoined', handleConferenceJoined);
        socket.off('conferenceLeft', handleConferenceLeft);
        socket.off('participantMuted', handleParticipantMuted);
        socket.off('participantUnmuted', handleParticipantUnmuted);
      };
    }
  }, [socket]);

  const fetchConferences = async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter })
      };
      
      const response = await axios.get('/api/conferences', { params });
      setConferences(response.data.data.conferences);
      setTotalCount(response.data.data.pagination.total);
    } catch (error) {
      setError('Failed to fetch conferences');
      console.error('Fetch conferences error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async (conferenceId) => {
    try {
      const response = await axios.get(`/api/conferences/${conferenceId}/participants`);
      setParticipants(response.data.data);
    } catch (error) {
      setError('Failed to fetch participants');
    }
  };

  const handleConferenceJoined = (data) => {
    setConferences(prev => prev.map(conf => 
      conf.id === data.roomId ? 
        { ...conf, active_participants: (conf.active_participants || 0) + 1 } : 
        conf
    ));
    
    if (selectedConference && selectedConference.id === data.roomId) {
      fetchParticipants(data.roomId);
    }
  };

  const handleConferenceLeft = (data) => {
    setConferences(prev => prev.map(conf => 
      conf.id === data.roomId ? 
        { ...conf, active_participants: Math.max((conf.active_participants || 0) - 1, 0) } : 
        conf
    ));
    
    if (selectedConference && selectedConference.id === data.roomId) {
      fetchParticipants(data.roomId);
    }
  };

  const handleParticipantMuted = (data) => {
    setParticipants(prev => prev.map(p => 
      p.id === data.participantId ? { ...p, is_muted: true } : p
    ));
  };

  const handleParticipantUnmuted = (data) => {
    setParticipants(prev => prev.map(p => 
      p.id === data.participantId ? { ...p, is_muted: false } : p
    ));
  };

  const handleOpenDialog = (conference = null) => {
    if (conference) {
      setEditingConference(conference);
      setFormData({
        roomNumber: conference.room_number,
        name: conference.name,
        description: conference.description || '',
        pin: conference.pin || '',
        adminPin: conference.admin_pin || '',
        maxMembers: conference.max_members,
        recordConference: conference.record_conference
      });
    } else {
      setEditingConference(null);
      setFormData({
        roomNumber: '',
        name: '',
        description: '',
        pin: '',
        adminPin: '',
        maxMembers: 50,
        recordConference: false
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingConference(null);
    setError('');
    setSuccess('');
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');
      
      const payload = {
        roomNumber: formData.roomNumber,
        name: formData.name,
        description: formData.description,
        pin: formData.pin,
        adminPin: formData.adminPin,
        maxMembers: formData.maxMembers,
        recordConference: formData.recordConference
      };

      if (editingConference) {
        await axios.put(`/api/conferences/${editingConference.id}`, payload);
        setSuccess('Conference updated successfully');
      } else {
        await axios.post('/api/conferences', payload);
        setSuccess('Conference created successfully');
      }
      
      handleCloseDialog();
      fetchConferences();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to save conference');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (conference) => {
    setConferenceToDelete(conference);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setLoading(true);
      await axios.delete(`/api/conferences/${conferenceToDelete.id}`);
      setSuccess('Conference deleted successfully');
      setDeleteDialogOpen(false);
      setConferenceToDelete(null);
      fetchConferences();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to delete conference');
    } finally {
      setLoading(false);
    }
  };

  const handleViewParticipants = async (conference) => {
    setSelectedConference(conference);
    await fetchParticipants(conference.id);
    setParticipantsDialogOpen(true);
  };

  const handleKickParticipant = async (participantId) => {
    try {
      await axios.post(`/api/conferences/${selectedConference.id}/kick/${participantId}`);
      setSuccess('Participant kicked successfully');
      fetchParticipants(selectedConference.id);
    } catch (error) {
      setError('Failed to kick participant');
    }
  };

  const handleMuteParticipant = async (participantId, mute = true) => {
    try {
      await axios.post(`/api/conferences/${selectedConference.id}/mute/${participantId}`, { mute });
      setSuccess(`Participant ${mute ? 'muted' : 'unmuted'} successfully`);
      fetchParticipants(selectedConference.id);
    } catch (error) {
      setError(`Failed to ${mute ? 'mute' : 'unmute'} participant`);
    }
  };

  const canManageConferences = user?.role === 'admin' || user?.role === 'manager';

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Conference Rooms
        </Typography>
        {canManageConferences && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Conference Room
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            label="Search conferences..."
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />
            }}
            sx={{ minWidth: 250 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchConferences}
          >
            Refresh
          </Button>
        </Box>
      </Paper>

      {/* Conferences Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Room Number</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Participants</TableCell>
              <TableCell>Max Members</TableCell>
              <TableCell>Recording</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : conferences.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No conference rooms found
                </TableCell>
              </TableRow>
            ) : (
              conferences.map((conference) => (
                <TableRow key={conference.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {conference.room_number}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {conference.name}
                    </Typography>
                    {conference.description && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {conference.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PeopleIcon fontSize="small" />
                      <Typography variant="body2">
                        {conference.active_participants || 0}
                      </Typography>
                      {conference.active_participants > 0 && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleViewParticipants(conference)}
                        >
                          View
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{conference.max_members}</TableCell>
                  <TableCell>
                    {conference.record_conference ? (
                      <Chip label="Enabled" color="success" size="small" />
                    ) : (
                      <Chip label="Disabled" color="default" size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    {conference.is_active ? (
                      <Chip label="Active" color="success" size="small" />
                    ) : (
                      <Chip label="Inactive" color="default" size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {format(parseISO(conference.created_at), 'MMM dd, yyyy')}
                    </Typography>
                    {conference.created_by_name && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        by {conference.created_by_name}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="View Participants">
                        <IconButton
                          size="small"
                          onClick={() => handleViewParticipants(conference)}
                        >
                          <PeopleIcon />
                        </IconButton>
                      </Tooltip>
                      {canManageConferences && (
                        <>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog(conference)}
                              color="primary"
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteClick(conference)}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </>
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

      {/* Conference Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingConference ? 'Edit Conference Room' : 'Add Conference Room'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <TextField
              label="Room Number"
              value={formData.roomNumber}
              onChange={(e) => handleFormChange('roomNumber', e.target.value)}
              required
              disabled={!!editingConference}
              helperText="4-digit room number"
            />
            <TextField
              label="Room Name"
              value={formData.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
              required
            />
            <TextField
              label="PIN"
              value={formData.pin}
              onChange={(e) => handleFormChange('pin', e.target.value)}
              helperText="Optional PIN for participants"
            />
            <TextField
              label="Admin PIN"
              value={formData.adminPin}
              onChange={(e) => handleFormChange('adminPin', e.target.value)}
              helperText="Optional PIN for administrators"
            />
            <TextField
              label="Max Members"
              type="number"
              value={formData.maxMembers}
              onChange={(e) => handleFormChange('maxMembers', parseInt(e.target.value))}
              inputProps={{ min: 1, max: 100 }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', pt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.recordConference}
                    onChange={(e) => handleFormChange('recordConference', e.target.checked)}
                  />
                }
                label="Record Conference"
              />
            </Box>
          </Box>
          
          <TextField
            label="Description"
            value={formData.description}
            onChange={(e) => handleFormChange('description', e.target.value)}
            multiline
            rows={3}
            fullWidth
            sx={{ mt: 2 }}
            helperText="Optional description of the conference room"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : (editingConference ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Conference Room</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete conference room {conferenceToDelete?.room_number}?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Participants Dialog */}
      <Dialog 
        open={participantsDialogOpen} 
        onClose={() => setParticipantsDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Conference Participants - {selectedConference?.name}
        </DialogTitle>
        <DialogContent>
          {participants.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No active participants
              </Typography>
            </Box>
          ) : (
            <List>
              {participants.map((participant) => (
                <ListItem key={participant.id}>
                  <Avatar sx={{ mr: 2 }}>
                    {participant.caller_id_name ? participant.caller_id_name.charAt(0) : 'U'}
                  </Avatar>
                  <ListItemText
                    primary={participant.caller_id_name || participant.caller_id_num || 'Unknown'}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Extension: {participant.extension_number || 'N/A'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Joined: {format(parseISO(participant.joined_at), 'HH:mm:ss')}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                          {participant.is_admin && (
                            <Chip label="Admin" color="primary" size="small" />
                          )}
                          {participant.is_muted && (
                            <Chip label="Muted" color="warning" size="small" />
                          )}
                        </Box>
                      </Box>
                    }
                  />
                  {canManageConferences && (
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title={participant.is_muted ? "Unmute" : "Mute"}>
                          <IconButton
                            size="small"
                            onClick={() => handleMuteParticipant(participant.id, !participant.is_muted)}
                            color={participant.is_muted ? "primary" : "default"}
                          >
                            {participant.is_muted ? <MicIcon /> : <MicOffIcon />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Kick Participant">
                          <IconButton
                            size="small"
                            onClick={() => handleKickParticipant(participant.id)}
                            color="error"
                          >
                            <KickIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setParticipantsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Conferences;
