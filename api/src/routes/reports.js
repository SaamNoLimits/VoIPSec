const express = require('express');
const { query, validationResult } = require('express-validator');
const DatabaseService = require('../services/database');
const { requireManager } = require('../middleware/auth');
const winston = require('winston');

const router = express.Router();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'reports-routes' }
});

// Date range validation
const dateRangeValidation = [
  query('startDate').optional().isISO8601().withMessage('Start date must be in ISO format'),
  query('endDate').optional().isISO8601().withMessage('End date must be in ISO format'),
];

// Call volume report
router.get('/call-volume', requireManager, dateRangeValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate = new Date().toISOString(),
      groupBy = 'day' 
    } = req.query;

    let dateFormat;
    switch (groupBy) {
      case 'hour':
        dateFormat = "DATE_TRUNC('hour', start_time)";
        break;
      case 'day':
        dateFormat = "DATE_TRUNC('day', start_time)";
        break;
      case 'week':
        dateFormat = "DATE_TRUNC('week', start_time)";
        break;
      case 'month':
        dateFormat = "DATE_TRUNC('month', start_time)";
        break;
      default:
        dateFormat = "DATE_TRUNC('day', start_time)";
    }

    const volumeQuery = `
      SELECT 
        ${dateFormat} as period,
        COUNT(*) as total_calls,
        COUNT(CASE WHEN disposition = 'ANSWERED' THEN 1 END) as answered_calls,
        COUNT(CASE WHEN disposition = 'NO ANSWER' THEN 1 END) as missed_calls,
        COUNT(CASE WHEN disposition = 'BUSY' THEN 1 END) as busy_calls,
        COUNT(CASE WHEN disposition = 'FAILED' THEN 1 END) as failed_calls,
        AVG(duration) as avg_duration,
        SUM(duration) as total_duration
      FROM call_records
      WHERE start_time >= $1 AND start_time <= $2
      GROUP BY ${dateFormat}
      ORDER BY period ASC
    `;

    const summaryQuery = `
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN disposition = 'ANSWERED' THEN 1 END) as answered_calls,
        COUNT(CASE WHEN disposition = 'NO ANSWER' THEN 1 END) as missed_calls,
        COUNT(CASE WHEN disposition = 'BUSY' THEN 1 END) as busy_calls,
        COUNT(CASE WHEN disposition = 'FAILED' THEN 1 END) as failed_calls,
        AVG(duration) as avg_duration,
        SUM(duration) as total_duration,
        ROUND((COUNT(CASE WHEN disposition = 'ANSWERED' THEN 1 END)::decimal / COUNT(*) * 100), 2) as answer_rate
      FROM call_records
      WHERE start_time >= $1 AND start_time <= $2
    `;

    const [volumeData, summaryData] = await Promise.all([
      DatabaseService.query(volumeQuery, [startDate, endDate]),
      DatabaseService.query(summaryQuery, [startDate, endDate])
    ]);

    res.json({
      success: true,
      data: {
        summary: summaryData.rows[0],
        timeSeries: volumeData.rows,
        period: { startDate, endDate, groupBy }
      }
    });
  } catch (error) {
    logger.error('Call volume report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Call quality report
router.get('/call-quality', requireManager, dateRangeValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate = new Date().toISOString()
    } = req.query;

    const qualityQuery = `
      SELECT 
        AVG(cqm.mos_score) as avg_mos_score,
        AVG(cqm.packet_loss) as avg_packet_loss,
        AVG(cqm.jitter_avg) as avg_jitter,
        AVG(cqm.rtt_avg) as avg_rtt,
        COUNT(CASE WHEN cqm.mos_score >= 4.0 THEN 1 END) as excellent_calls,
        COUNT(CASE WHEN cqm.mos_score >= 3.0 AND cqm.mos_score < 4.0 THEN 1 END) as good_calls,
        COUNT(CASE WHEN cqm.mos_score >= 2.0 AND cqm.mos_score < 3.0 THEN 1 END) as fair_calls,
        COUNT(CASE WHEN cqm.mos_score < 2.0 THEN 1 END) as poor_calls,
        COUNT(*) as total_calls_with_metrics
      FROM call_records cr
      JOIN call_quality_metrics cqm ON cr.id = cqm.call_id
      WHERE cr.start_time >= $1 AND cr.start_time <= $2
    `;

    const codecQuery = `
      SELECT 
        cqm.codec,
        COUNT(*) as call_count,
        AVG(cqm.mos_score) as avg_mos_score,
        AVG(cqm.packet_loss) as avg_packet_loss
      FROM call_records cr
      JOIN call_quality_metrics cqm ON cr.id = cqm.call_id
      WHERE cr.start_time >= $1 AND cr.start_time <= $2
      GROUP BY cqm.codec
      ORDER BY call_count DESC
    `;

    const timeSeriesQuery = `
      SELECT 
        DATE_TRUNC('day', cr.start_time) as period,
        AVG(cqm.mos_score) as avg_mos_score,
        AVG(cqm.packet_loss) as avg_packet_loss,
        AVG(cqm.jitter_avg) as avg_jitter
      FROM call_records cr
      JOIN call_quality_metrics cqm ON cr.id = cqm.call_id
      WHERE cr.start_time >= $1 AND cr.start_time <= $2
      GROUP BY DATE_TRUNC('day', cr.start_time)
      ORDER BY period ASC
    `;

    const [qualityData, codecData, timeSeriesData] = await Promise.all([
      DatabaseService.query(qualityQuery, [startDate, endDate]),
      DatabaseService.query(codecQuery, [startDate, endDate]),
      DatabaseService.query(timeSeriesQuery, [startDate, endDate])
    ]);

    res.json({
      success: true,
      data: {
        summary: qualityData.rows[0],
        codecBreakdown: codecData.rows,
        timeSeries: timeSeriesData.rows,
        period: { startDate, endDate }
      }
    });
  } catch (error) {
    logger.error('Call quality report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// User activity report
router.get('/user-activity', requireManager, dateRangeValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate = new Date().toISOString(),
      limit = 20
    } = req.query;

    const userActivityQuery = `
      SELECT 
        u.id,
        u.first_name || ' ' || u.last_name as user_name,
        u.email,
        COUNT(cr.id) as total_calls,
        COUNT(CASE WHEN cr.disposition = 'ANSWERED' THEN 1 END) as answered_calls,
        AVG(cr.duration) as avg_call_duration,
        SUM(cr.duration) as total_call_duration,
        MAX(cr.start_time) as last_call_time
      FROM users u
      LEFT JOIN extensions e ON u.id = e.user_id
      LEFT JOIN call_records cr ON (cr.caller_id_num = e.extension_number OR cr.destination = e.extension_number)
        AND cr.start_time >= $1 AND cr.start_time <= $2
      WHERE u.role IN ('user', 'manager')
      GROUP BY u.id, u.first_name, u.last_name, u.email
      ORDER BY total_calls DESC
      LIMIT $3
    `;

    const extensionUsageQuery = `
      SELECT 
        e.extension_number,
        e.display_name,
        u.first_name || ' ' || u.last_name as user_name,
        COUNT(cr.id) as call_count,
        AVG(cr.duration) as avg_duration
      FROM extensions e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN call_records cr ON (cr.caller_id_num = e.extension_number OR cr.destination = e.extension_number)
        AND cr.start_time >= $1 AND cr.start_time <= $2
      GROUP BY e.id, e.extension_number, e.display_name, u.first_name, u.last_name
      ORDER BY call_count DESC
      LIMIT $3
    `;

    const [userActivity, extensionUsage] = await Promise.all([
      DatabaseService.query(userActivityQuery, [startDate, endDate, limit]),
      DatabaseService.query(extensionUsageQuery, [startDate, endDate, limit])
    ]);

    res.json({
      success: true,
      data: {
        userActivity: userActivity.rows,
        extensionUsage: extensionUsage.rows,
        period: { startDate, endDate }
      }
    });
  } catch (error) {
    logger.error('User activity report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Conference usage report
router.get('/conference-usage', requireManager, dateRangeValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate = new Date().toISOString()
    } = req.query;

    const conferenceStatsQuery = `
      SELECT 
        COUNT(DISTINCT cr.id) as total_conferences,
        COUNT(cp.id) as total_participants,
        AVG(EXTRACT(EPOCH FROM (cp.left_at - cp.joined_at))/60) as avg_duration_minutes,
        AVG(participant_count.count) as avg_participants_per_conference
      FROM conference_rooms cr
      LEFT JOIN conference_participants cp ON cr.id = cp.room_id
        AND cp.joined_at >= $1 AND cp.joined_at <= $2
      LEFT JOIN (
        SELECT room_id, COUNT(*) as count
        FROM conference_participants
        WHERE joined_at >= $1 AND joined_at <= $2
        GROUP BY room_id
      ) participant_count ON cr.id = participant_count.room_id
    `;

    const popularRoomsQuery = `
      SELECT 
        cr.room_number,
        cr.name,
        COUNT(cp.id) as total_participants,
        COUNT(DISTINCT DATE(cp.joined_at)) as active_days,
        AVG(EXTRACT(EPOCH FROM (cp.left_at - cp.joined_at))/60) as avg_duration_minutes
      FROM conference_rooms cr
      LEFT JOIN conference_participants cp ON cr.id = cp.room_id
        AND cp.joined_at >= $1 AND cp.joined_at <= $2
      GROUP BY cr.id, cr.room_number, cr.name
      HAVING COUNT(cp.id) > 0
      ORDER BY total_participants DESC
      LIMIT 10
    `;

    const dailyUsageQuery = `
      SELECT 
        DATE(cp.joined_at) as date,
        COUNT(DISTINCT cp.room_id) as active_conferences,
        COUNT(cp.id) as total_participants,
        AVG(EXTRACT(EPOCH FROM (cp.left_at - cp.joined_at))/60) as avg_duration_minutes
      FROM conference_participants cp
      WHERE cp.joined_at >= $1 AND cp.joined_at <= $2
      GROUP BY DATE(cp.joined_at)
      ORDER BY date ASC
    `;

    const [conferenceStats, popularRooms, dailyUsage] = await Promise.all([
      DatabaseService.query(conferenceStatsQuery, [startDate, endDate]),
      DatabaseService.query(popularRoomsQuery, [startDate, endDate]),
      DatabaseService.query(dailyUsageQuery, [startDate, endDate])
    ]);

    res.json({
      success: true,
      data: {
        summary: conferenceStats.rows[0],
        popularRooms: popularRooms.rows,
        dailyUsage: dailyUsage.rows,
        period: { startDate, endDate }
      }
    });
  } catch (error) {
    logger.error('Conference usage report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// System performance report
router.get('/system-performance', requireManager, dateRangeValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      endDate = new Date().toISOString()
    } = req.query;

    // This would typically come from monitoring metrics
    // For now, we'll simulate some basic system metrics
    const systemMetricsQuery = `
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN disposition = 'FAILED' THEN 1 END) as failed_calls,
        ROUND((COUNT(CASE WHEN disposition = 'FAILED' THEN 1 END)::decimal / COUNT(*) * 100), 2) as failure_rate,
        AVG(CASE WHEN disposition = 'ANSWERED' THEN duration END) as avg_call_duration
      FROM call_records
      WHERE start_time >= $1 AND start_time <= $2
    `;

    const hourlyLoadQuery = `
      SELECT 
        EXTRACT(HOUR FROM start_time) as hour,
        COUNT(*) as call_count,
        COUNT(CASE WHEN disposition = 'FAILED' THEN 1 END) as failed_calls
      FROM call_records
      WHERE start_time >= $1 AND start_time <= $2
      GROUP BY EXTRACT(HOUR FROM start_time)
      ORDER BY hour
    `;

    const [systemMetrics, hourlyLoad] = await Promise.all([
      DatabaseService.query(systemMetricsQuery, [startDate, endDate]),
      DatabaseService.query(hourlyLoadQuery, [startDate, endDate])
    ]);

    // Simulate additional system metrics
    const simulatedMetrics = {
      cpuUsage: Math.random() * 30 + 20, // 20-50%
      memoryUsage: Math.random() * 40 + 30, // 30-70%
      diskUsage: Math.random() * 20 + 40, // 40-60%
      networkLatency: Math.random() * 10 + 5, // 5-15ms
      activeChannels: Math.floor(Math.random() * 50 + 10), // 10-60
      registeredExtensions: Math.floor(Math.random() * 100 + 50) // 50-150
    };

    res.json({
      success: true,
      data: {
        callMetrics: systemMetrics.rows[0],
        hourlyLoad: hourlyLoad.rows,
        systemMetrics: simulatedMetrics,
        period: { startDate, endDate }
      }
    });
  } catch (error) {
    logger.error('System performance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Audit log report
router.get('/audit-logs', requireManager, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      userId, 
      action, 
      resourceType,
      startDate,
      endDate
    } = req.query;
    
    const offset = (page - 1) * limit;

    let query = `
      SELECT al.*, u.first_name || ' ' || u.last_name as user_name, u.email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) FROM audit_logs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    // Add filters
    if (userId) {
      const userCondition = ` AND al.user_id = $${paramIndex}`;
      query += userCondition;
      countQuery += userCondition;
      params.push(userId);
      paramIndex++;
    }

    if (action) {
      const actionCondition = ` AND al.action = $${paramIndex}`;
      query += actionCondition;
      countQuery += actionCondition;
      params.push(action);
      paramIndex++;
    }

    if (resourceType) {
      const resourceCondition = ` AND al.resource_type = $${paramIndex}`;
      query += resourceCondition;
      countQuery += resourceCondition;
      params.push(resourceType);
      paramIndex++;
    }

    if (startDate) {
      const startCondition = ` AND al.created_at >= $${paramIndex}`;
      query += startCondition;
      countQuery += startCondition;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      const endCondition = ` AND al.created_at <= $${paramIndex}`;
      query += endCondition;
      countQuery += endCondition;
      params.push(endDate);
      paramIndex++;
    }

    // Add pagination
    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const [logs, totalCount] = await Promise.all([
      DatabaseService.query(query, params),
      DatabaseService.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      success: true,
      data: {
        logs: logs.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(totalCount.rows[0].count),
          pages: Math.ceil(totalCount.rows[0].count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Audit logs report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Export report data
router.get('/export/:reportType', requireManager, async (req, res) => {
  try {
    const { reportType } = req.params;
    const { format = 'csv', startDate, endDate } = req.query;

    let query, filename;
    const params = [];

    switch (reportType) {
      case 'call-volume':
        query = `
          SELECT cr.uniqueid, cr.caller_id_num, cr.caller_id_name, cr.destination,
                 cr.start_time, cr.answer_time, cr.end_time, cr.duration,
                 cr.disposition, cr.account_code
          FROM call_records cr
          WHERE cr.start_time >= $1 AND cr.start_time <= $2
          ORDER BY cr.start_time DESC
        `;
        filename = 'call_volume_report.csv';
        params.push(
          startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate || new Date().toISOString()
        );
        break;

      case 'call-quality':
        query = `
          SELECT cr.uniqueid, cr.caller_id_num, cr.destination, cr.start_time,
                 cqm.mos_score, cqm.packet_loss, cqm.jitter_avg, cqm.rtt_avg, cqm.codec
          FROM call_records cr
          JOIN call_quality_metrics cqm ON cr.id = cqm.call_id
          WHERE cr.start_time >= $1 AND cr.start_time <= $2
          ORDER BY cr.start_time DESC
        `;
        filename = 'call_quality_report.csv';
        params.push(
          startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate || new Date().toISOString()
        );
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type'
        });
    }

    const result = await DatabaseService.query(query, params);

    if (format === 'csv') {
      // Convert to CSV
      const headers = Object.keys(result.rows[0] || {});
      const csvHeader = headers.join(',') + '\n';
      const csvData = result.rows.map(row => 
        headers.map(header => {
          const value = row[header];
          return value !== null && value !== undefined ? `"${value}"` : '';
        }).join(',')
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvHeader + csvData);
    } else {
      res.json({
        success: true,
        data: result.rows
      });
    }

    // Log export
    await DatabaseService.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, new_values, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, 'EXPORT_REPORT', 'REPORT', JSON.stringify({ reportType, format }), req.ip, req.get('User-Agent')]
    );

    logger.info('Report exported', { reportType, format, exportedBy: req.user.id });
  } catch (error) {
    logger.error('Export report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
