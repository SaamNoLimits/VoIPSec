import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Phone,
  PhoneInTalk,
  Group,
  TrendingUp,
  Warning,
  CheckCircle,
  Error,
  Refresh,
  CallEnd,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { useSocket } from '../../contexts/SocketContext';
import { useQuery } from 'react-query';
import { dashboardAPI } from '../../services/api';
import moment from 'moment';

const Dashboard = () => {
  const { socket } = useSocket();
  const [realTimeData, setRealTimeData] = useState({
    activeCalls: [],
    systemStatus: {},
    callStats: {}
  });

  // Fetch dashboard data
  const { data: dashboardData, isLoading, refetch } = useQuery(
    'dashboard',
    dashboardAPI.getDashboardData,
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  // Socket event listeners
  useEffect(() => {
    if (socket) {
      socket.emit('subscribe_calls');
      socket.emit('subscribe_system');

      socket.on('call_event', (data) => {
        setRealTimeData(prev => ({
          ...prev,
          activeCalls: updateActiveCalls(prev.activeCalls, data)
        }));
      });

      socket.on('asterisk_status', (data) => {
        setRealTimeData(prev => ({
          ...prev,
          systemStatus: { ...prev.systemStatus, asterisk: data }
        }));
      });

      return () => {
        socket.off('call_event');
        socket.off('asterisk_status');
      };
    }
  }, [socket]);

  const updateActiveCalls = (currentCalls, event) => {
    switch (event.type) {
      case 'new_channel':
        return [...currentCalls, event.data];
      case 'hangup':
        return currentCalls.filter(call => call.uniqueid !== event.data.uniqueid);
      default:
        return currentCalls;
    }
  };

  // Sample data for charts
  const callVolumeData = [
    { time: '00:00', calls: 12 },
    { time: '04:00', calls: 8 },
    { time: '08:00', calls: 45 },
    { time: '12:00', calls: 67 },
    { time: '16:00', calls: 52 },
    { time: '20:00', calls: 23 },
  ];

  const extensionStatusData = [
    { name: 'Online', value: 85, color: '#4caf50' },
    { name: 'Offline', value: 12, color: '#f44336' },
    { name: 'Busy', value: 8, color: '#ff9800' },
  ];

  const StatCard = ({ title, value, icon, color, subtitle, trend }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="h6">
              {title}
            </Typography>
            <Typography variant="h4" component="div" color={color}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary">
                {subtitle}
              </Typography>
            )}
            {trend && (
              <Box display="flex" alignItems="center" mt={1}>
                <TrendingUp color={trend > 0 ? 'success' : 'error'} fontSize="small" />
                <Typography variant="body2" color={trend > 0 ? 'success.main' : 'error.main'}>
                  {trend > 0 ? '+' : ''}{trend}%
                </Typography>
              </Box>
            )}
          </Box>
          <Box color={color}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const SystemStatusCard = () => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="between" mb={2}>
          <Typography variant="h6">System Status</Typography>
          <IconButton onClick={() => refetch()} size="small">
            <Refresh />
          </IconButton>
        </Box>
        
        <List dense>
          <ListItem>
            <ListItemIcon>
              <CheckCircle color="success" />
            </ListItemIcon>
            <ListItemText 
              primary="Asterisk PBX" 
              secondary={realTimeData.systemStatus.asterisk?.connected ? "Connected" : "Disconnected"} 
            />
            <Chip 
              label={realTimeData.systemStatus.asterisk?.connected ? "Online" : "Offline"} 
              color={realTimeData.systemStatus.asterisk?.connected ? "success" : "error"}
              size="small"
            />
          </ListItem>
          
          <ListItem>
            <ListItemIcon>
              <CheckCircle color="success" />
            </ListItemIcon>
            <ListItemText primary="Database" secondary="PostgreSQL 15" />
            <Chip label="Online" color="success" size="small" />
          </ListItem>
          
          <ListItem>
            <ListItemIcon>
              <CheckCircle color="success" />
            </ListItemIcon>
            <ListItemText primary="Redis Cache" secondary="Session storage" />
            <Chip label="Online" color="success" size="small" />
          </ListItem>
          
          <ListItem>
            <ListItemIcon>
              <Warning color="warning" />
            </ListItemIcon>
            <ListItemText primary="SIP Trunk" secondary="Provider connection" />
            <Chip label="Warning" color="warning" size="small" />
          </ListItem>
        </List>
      </CardContent>
    </Card>
  );

  const ActiveCallsCard = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Active Calls ({realTimeData.activeCalls.length})
        </Typography>
        
        {realTimeData.activeCalls.length === 0 ? (
          <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
            No active calls
          </Typography>
        ) : (
          <List dense>
            {realTimeData.activeCalls.slice(0, 5).map((call, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <PhoneInTalk color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={`${call.calleridnum || 'Unknown'} → ${call.exten || 'Unknown'}`}
                  secondary={`Duration: ${moment().diff(moment(call.start), 'seconds')}s`}
                />
                <IconButton size="small" color="error">
                  <CallEnd />
                </IconButton>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Calls"
            value={realTimeData.activeCalls.length}
            icon={<PhoneInTalk sx={{ fontSize: 40 }} />}
            color="primary.main"
            subtitle="Currently in progress"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Extensions"
            value={dashboardData?.extensions?.total || 0}
            icon={<Phone sx={{ fontSize: 40 }} />}
            color="success.main"
            subtitle={`${dashboardData?.extensions?.online || 0} online`}
            trend={5.2}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Conferences"
            value={dashboardData?.conferences?.active || 0}
            icon={<Group sx={{ fontSize: 40 }} />}
            color="warning.main"
            subtitle="Active rooms"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Today's Calls"
            value={dashboardData?.calls?.today || 0}
            icon={<TrendingUp sx={{ fontSize: 40 }} />}
            color="info.main"
            subtitle="Total completed"
            trend={12.5}
          />
        </Grid>
      </Grid>

      {/* Charts and Details */}
      <Grid container spacing={3}>
        {/* Call Volume Chart */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Call Volume (24h)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={callVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <RechartsTooltip />
                  <Line 
                    type="monotone" 
                    dataKey="calls" 
                    stroke="#1976d2" 
                    strokeWidth={2}
                    dot={{ fill: '#1976d2' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Extension Status */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Extension Status
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={extensionStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {extensionStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
              <Box mt={2}>
                {extensionStatusData.map((item, index) => (
                  <Box key={index} display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Box display="flex" alignItems="center">
                      <Box
                        width={12}
                        height={12}
                        bgcolor={item.color}
                        borderRadius="50%"
                        mr={1}
                      />
                      <Typography variant="body2">{item.name}</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight="bold">
                      {item.value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* System Status */}
        <Grid item xs={12} md={6}>
          <SystemStatusCard />
        </Grid>

        {/* Active Calls */}
        <Grid item xs={12} md={6}>
          <ActiveCallsCard />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
