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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Box,
  Alert,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Phone as PhoneIcon,
  PhoneDisabled as PhoneDisabledIcon,
  Voicemail as VoicemailIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';

const Extensions = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [extensions, setExtensions] = useState([]);
  const [users, setUsers] = useState([]);
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
  const [editingExtension, setEditingExtension] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [extensionToDelete, setExtensionToDelete] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    extensionNumber: '',
    displayName: '',
    userId: '',
    secret: '',
    context: 'internal',
    mailbox: '',
    voicemailEnabled: true,
    callForwardingEnabled: false,
    callForwardingNumber: '',
    doNotDisturb: false,
    callWaiting: true,
    callerIdName: '',
    callerIdNumber: '',
    maxContacts: 1,
    qualify: 'yes',
    nat: 'force_rport,comedia',
    encryption: 'yes',
    transport: 'tls',
    dtmfMode: 'rfc2833',
    codecs: 'ulaw,alaw,gsm,g729,g722'
  });

  useEffect(() => {
    fetchExtensions();
    fetchUsers();
  }, [page, rowsPerPage, searchTerm, statusFilter]);

  useEffect(() => {
    if (socket) {
      socket.on('extensionStatusChanged', handleExtensionStatusChange);
      socket.on('extensionUpdated', handleExtensionUpdate);
      
      return () => {
        socket.off('extensionStatusChanged', handleExtensionStatusChange);
        socket.off('extensionUpdated', handleExtensionUpdate);
      };
    }
  }, [socket]);

  const fetchExtensions = async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter })
      };
      
      const response = await axios.get('/api/extensions', { params });
      setExtensions(response.data.data.extensions);
      setTotalCount(response.data.data.pagination.total);
    } catch (error) {
      setError('Failed to fetch extensions');
      console.error('Fetch extensions error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users?limit=100');
      setUsers(response.data.data.users);
    } catch (error) {
      console.error('Fetch users error:', error);
    }
  };

  const handleExtensionStatusChange = (data) => {
    setExtensions(prev => prev.map(ext => 
      ext.extension_number === data.extension ? 
        { ...ext, registrationStatus: data.status } : 
        ext
    ));
  };

  const handleExtensionUpdate = (data) => {
    setExtensions(prev => prev.map(ext => 
      ext.id === data.id ? { ...ext, ...data } : ext
    ));
  };

  const handleOpenDialog = (extension = null) => {
    if (extension) {
      setEditingExtension(extension);
      setFormData({
        extensionNumber: extension.extension_number,
        displayName: extension.display_name,
        userId: extension.user_id || '',
        secret: '', // Don't populate secret for security
        context: extension.context,
        mailbox: extension.mailbox || '',
        voicemailEnabled: extension.voicemail_enabled,
        callForwardingEnabled: extension.call_forwarding_enabled,
        callForwardingNumber: extension.call_forwarding_number || '',
        doNotDisturb: extension.do_not_disturb,
        callWaiting: extension.call_waiting,
        callerIdName: extension.caller_id_name || '',
        callerIdNumber: extension.caller_id_number || '',
        maxContacts: extension.max_contacts,
        qualify: extension.qualify,
        nat: extension.nat,
        encryption: extension.encryption,
        transport: extension.transport,
        dtmfMode: extension.dtmf_mode,
        codecs: extension.codecs
      });
    } else {
      setEditingExtension(null);
      setFormData({
        extensionNumber: '',
        displayName: '',
        userId: '',
        secret: '',
        context: 'internal',
        mailbox: '',
        voicemailEnabled: true,
        callForwardingEnabled: false,
        callForwardingNumber: '',
        doNotDisturb: false,
        callWaiting: true,
        callerIdName: '',
        callerIdNumber: '',
        maxContacts: 1,
        qualify: 'yes',
        nat: 'force_rport,comedia',
        encryption: 'yes',
        transport: 'tls',
        dtmfMode: 'rfc2833',
        codecs: 'ulaw,alaw,gsm,g729,g722'
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingExtension(null);
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
        extension_number: formData.extensionNumber,
        display_name: formData.displayName,
        user_id: formData.userId || null,
        context: formData.context,
        mailbox: formData.mailbox || null,
        voicemail_enabled: formData.voicemailEnabled,
        call_forwarding_enabled: formData.callForwardingEnabled,
        call_forwarding_number: formData.callForwardingNumber || null,
        do_not_disturb: formData.doNotDisturb,
        call_waiting: formData.callWaiting,
        caller_id_name: formData.callerIdName || null,
        caller_id_number: formData.callerIdNumber || null,
        max_contacts: formData.maxContacts,
        qualify: formData.qualify,
        nat: formData.nat,
        encryption: formData.encryption,
        transport: formData.transport,
        dtmf_mode: formData.dtmfMode,
        codecs: formData.codecs
      };

      // Only include secret if it's provided
      if (formData.secret) {
        payload.secret = formData.secret;
      }

      if (editingExtension) {
        await axios.put(`/api/extensions/${editingExtension.id}`, payload);
        setSuccess('Extension updated successfully');
      } else {
        await axios.post('/api/extensions', payload);
        setSuccess('Extension created successfully');
      }
      
      handleCloseDialog();
      fetchExtensions();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to save extension');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (extension) => {
    setExtensionToDelete(extension);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setLoading(true);
      await axios.delete(`/api/extensions/${extensionToDelete.id}`);
      setSuccess('Extension deleted successfully');
      setDeleteDialogOpen(false);
      setExtensionToDelete(null);
      fetchExtensions();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to delete extension');
    } finally {
      setLoading(false);
    }
  };

  const getStatusChip = (extension) => {
    const isActive = extension.is_active;
    const registrationStatus = extension.registrationStatus || 'unknown';
    
    if (!isActive) {
      return <Chip label="Inactive" color="default" size="small" />;
    }
    
    switch (registrationStatus) {
      case 'registered':
        return <Chip label="Online" color="success" size="small" />;
      case 'unregistered':
        return <Chip label="Offline" color="error" size="small" />;
      case 'lagged':
        return <Chip label="Lagged" color="warning" size="small" />;
      default:
        return <Chip label="Unknown" color="default" size="small" />;
    }
  };

  const canManageExtensions = user?.role === 'admin' || user?.role === 'manager';

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Extensions
        </Typography>
        {canManageExtensions && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Extension
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            label="Search extensions..."
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
        </Box>
      </Paper>

      {/* Extensions Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Extension</TableCell>
              <TableCell>Display Name</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Context</TableCell>
              <TableCell>Features</TableCell>
              <TableCell>Transport</TableCell>
              {canManageExtensions && <TableCell>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={canManageExtensions ? 8 : 7} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : extensions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManageExtensions ? 8 : 7} align="center">
                  No extensions found
                </TableCell>
              </TableRow>
            ) : (
              extensions.map((extension) => (
                <TableRow key={extension.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {extension.extension_number}
                    </Typography>
                  </TableCell>
                  <TableCell>{extension.display_name}</TableCell>
                  <TableCell>
                    {extension.user_name ? (
                      <Typography variant="body2">
                        {extension.user_name}
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          {extension.user_email}
                        </Typography>
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Unassigned
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{getStatusChip(extension)}</TableCell>
                  <TableCell>{extension.context}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {extension.voicemail_enabled && (
                        <Tooltip title="Voicemail Enabled">
                          <VoicemailIcon fontSize="small" color="primary" />
                        </Tooltip>
                      )}
                      {extension.call_forwarding_enabled && (
                        <Tooltip title="Call Forwarding Enabled">
                          <PhoneIcon fontSize="small" color="secondary" />
                        </Tooltip>
                      )}
                      {extension.do_not_disturb && (
                        <Tooltip title="Do Not Disturb">
                          <PhoneDisabledIcon fontSize="small" color="error" />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={extension.transport.toUpperCase()} 
                      size="small" 
                      color={extension.transport === 'tls' ? 'success' : 'default'}
                    />
                  </TableCell>
                  {canManageExtensions && (
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(extension)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClick(extension)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </TableCell>
                  )}
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

      {/* Extension Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingExtension ? 'Edit Extension' : 'Add Extension'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <TextField
              label="Extension Number"
              value={formData.extensionNumber}
              onChange={(e) => handleFormChange('extensionNumber', e.target.value)}
              required
              disabled={!!editingExtension}
            />
            <TextField
              label="Display Name"
              value={formData.displayName}
              onChange={(e) => handleFormChange('displayName', e.target.value)}
              required
            />
            <FormControl>
              <InputLabel>Assigned User</InputLabel>
              <Select
                value={formData.userId}
                label="Assigned User"
                onChange={(e) => handleFormChange('userId', e.target.value)}
              >
                <MenuItem value="">Unassigned</MenuItem>
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Secret"
              type="password"
              value={formData.secret}
              onChange={(e) => handleFormChange('secret', e.target.value)}
              required={!editingExtension}
              helperText={editingExtension ? "Leave empty to keep current secret" : ""}
            />
            <TextField
              label="Context"
              value={formData.context}
              onChange={(e) => handleFormChange('context', e.target.value)}
            />
            <TextField
              label="Mailbox"
              value={formData.mailbox}
              onChange={(e) => handleFormChange('mailbox', e.target.value)}
            />
            <TextField
              label="Caller ID Name"
              value={formData.callerIdName}
              onChange={(e) => handleFormChange('callerIdName', e.target.value)}
            />
            <TextField
              label="Caller ID Number"
              value={formData.callerIdNumber}
              onChange={(e) => handleFormChange('callerIdNumber', e.target.value)}
            />
            <FormControl>
              <InputLabel>Transport</InputLabel>
              <Select
                value={formData.transport}
                label="Transport"
                onChange={(e) => handleFormChange('transport', e.target.value)}
              >
                <MenuItem value="tls">TLS (Secure)</MenuItem>
                <MenuItem value="tcp">TCP</MenuItem>
                <MenuItem value="udp">UDP</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Max Contacts"
              type="number"
              value={formData.maxContacts}
              onChange={(e) => handleFormChange('maxContacts', parseInt(e.target.value))}
            />
          </Box>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Features</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.voicemailEnabled}
                    onChange={(e) => handleFormChange('voicemailEnabled', e.target.checked)}
                  />
                }
                label="Voicemail"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.callForwardingEnabled}
                    onChange={(e) => handleFormChange('callForwardingEnabled', e.target.checked)}
                  />
                }
                label="Call Forwarding"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.doNotDisturb}
                    onChange={(e) => handleFormChange('doNotDisturb', e.target.checked)}
                  />
                }
                label="Do Not Disturb"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.callWaiting}
                    onChange={(e) => handleFormChange('callWaiting', e.target.checked)}
                  />
                }
                label="Call Waiting"
              />
            </Box>
          </Box>

          {formData.callForwardingEnabled && (
            <TextField
              label="Call Forwarding Number"
              value={formData.callForwardingNumber}
              onChange={(e) => handleFormChange('callForwardingNumber', e.target.value)}
              fullWidth
              sx={{ mt: 2 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : (editingExtension ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Extension</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete extension {extensionToDelete?.extension_number}?
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
    </Container>
  );
};

export default Extensions;
