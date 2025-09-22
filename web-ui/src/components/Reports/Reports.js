import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
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
  TextField,
  CircularProgress
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Phone as PhoneIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { format, subDays, parseISO } from 'date-fns';

const Reports = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Date range
  const [startDate, setStartDate] = useState(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState(new Date());
  const [period, setPeriod] = useState('day');
  
  // Report data
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    fetchReportData();
  }, [tabValue, startDate, endDate, period]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const reportTypes = ['call-volume', 'call-quality', 'user-activity', 'conference-usage', 'system-performance'];
      const reportType = reportTypes[tabValue];
      
      const params = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        ...(reportType === 'call-volume' && { groupBy: period })
      };
      
      const response = await axios.get(`/api/reports/${reportType}`, { params });
      setReportData(response.data.data);
    } catch (error) {
      setError('Failed to fetch report data');
      console.error('Report error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = (reportType) => {
    const params = new URLSearchParams({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      format: 'csv'
    });
    
    window.open(`/api/reports/export/${reportType}?${params}`, '_blank');
    setSuccess('Report export started');
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const renderTabContent = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (!reportData) {
      return (
        <Box sx={{ textAlign: 'center', p: 4 }}>
          <Typography variant="body1" color="text.secondary">
            No data available
          </Typography>
        </Box>
      );
    }

    switch (tabValue) {
      case 0: // Call Volume
        return (
          <Box>
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <PhoneIcon color="primary" sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="h4">
                          {reportData.summary?.total_calls || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Calls
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <TrendingUpIcon color="success" sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="h4">
                          {reportData.summary?.answer_rate || 0}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Answer Rate
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
            
            {reportData.timeSeries && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Call Volume Over Time
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={reportData.timeSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="period" 
                        tickFormatter={(value) => format(parseISO(value), 'MMM dd')}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="total_calls" 
                        stroke="#8884d8" 
                        fill="#8884d8" 
                        name="Total Calls"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="answered_calls" 
                        stroke="#82ca9d" 
                        fill="#82ca9d" 
                        name="Answered"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </Box>
        );

      case 1: // Call Quality
        return (
          <Box>
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h4">
                      {reportData.summary?.avg_mos_score?.toFixed(2) || 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Average MOS Score
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h4">
                      {reportData.summary?.avg_packet_loss?.toFixed(2) || 0}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avg Packet Loss
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
            
            {reportData.timeSeries && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Call Quality Trends
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={reportData.timeSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="period" 
                        tickFormatter={(value) => format(parseISO(value), 'MMM dd')}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="avg_mos_score" 
                        stroke="#8884d8" 
                        name="MOS Score"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </Box>
        );

      default:
        return (
          <Box sx={{ textAlign: 'center', p: 4 }}>
            <Typography variant="h6" gutterBottom>
              Report data will be displayed here
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Select a date range and click refresh to load data
            </Typography>
          </Box>
        );
    }
  };

  const canViewReports = user?.role === 'admin' || user?.role === 'manager';

  if (!canViewReports) {
    return (
      <Container maxWidth="xl">
        <Alert severity="warning">
          You don't have permission to view reports.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Reports & Analytics
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchReportData}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={() => {
              const reportTypes = ['call-volume', 'call-quality', 'user-activity', 'conference-usage', 'system-performance'];
              handleExportReport(reportTypes[tabValue]);
            }}
          >
            Export
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Date Range Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={setStartDate}
                renderInput={(params) => <TextField {...params} size="small" fullWidth />}
              />
            </LocalizationProvider>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={setEndDate}
                renderInput={(params) => <TextField {...params} size="small" fullWidth />}
              />
            </LocalizationProvider>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl size="small" fullWidth>
              <InputLabel>Group By</InputLabel>
              <Select
                value={period}
                label="Group By"
                onChange={(e) => setPeriod(e.target.value)}
              >
                <MenuItem value="hour">Hour</MenuItem>
                <MenuItem value="day">Day</MenuItem>
                <MenuItem value="week">Week</MenuItem>
                <MenuItem value="month">Month</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Report Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Call Volume" />
          <Tab label="Call Quality" />
          <Tab label="User Activity" />
          <Tab label="Conference Usage" />
          <Tab label="System Performance" />
        </Tabs>
        
        <Box sx={{ p: 3 }}>
          {renderTabContent()}
        </Box>
      </Paper>
    </Container>
  );
};

export default Reports;
