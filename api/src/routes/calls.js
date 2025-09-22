const express = require('express');
const { body, validationResult } = require('express-validator');
const DatabaseService = require('../services/database');
const AsteriskManager = require('../services/asteriskManager');
const { requireManager } = require('../middleware/auth');
const winston = require('winston');

const router = express.Router();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'call-routes' }
});

// Get active calls
router.get('/active', requireManager, async (req, res) => {
  try {
    if (!AsteriskManager.isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Asterisk not connected'
      });
    }

    const channels = await AsteriskManager.getChannels();
    
    res.json({
      success: true,
      data: {
        activeCalls: channels.events || [],
        count: channels.events ? channels.events.length : 0
      }
    });
  } catch (error) {
    logger.error('Get active calls error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get call history/CDR
router.get('/history', requireManager, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      startDate, 
      endDate, 
      callerIdNum, 
      destination,
      disposition 
    } = req.query;
    
    const offset = (page - 1) * limit;

    let query = `
      SELECT cr.*, cqm.mos_score, cqm.packet_loss, cqm.jitter_avg
      FROM call_records cr
      LEFT JOIN call_quality_metrics cqm ON cr.id = cqm.call_id
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) FROM call_records WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    // Add date range filter
    if (startDate) {
      const dateCondition = ` AND cr.start_time >= $${paramIndex}`;
      query += dateCondition;
      countQuery += dateCondition;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      const dateCondition = ` AND cr.start_time <= $${paramIndex}`;
      query += dateCondition;
      countQuery += dateCondition;
      params.push(endDate);
      paramIndex++;
    }

    // Add caller ID filter
    if (callerIdNum) {
      const callerCondition = ` AND cr.caller_id_num ILIKE $${paramIndex}`;
      query += callerCondition;
      countQuery += callerCondition;
      params.push(`%${callerIdNum}%`);
      paramIndex++;
    }

    // Add destination filter
    if (destination) {
      const destCondition = ` AND cr.destination ILIKE $${paramIndex}`;
      query += destCondition;
      countQuery += destCondition;
      params.push(`%${destination}%`);
      paramIndex++;
    }

    // Add disposition filter
    if (disposition) {
      const dispCondition = ` AND cr.disposition = $${paramIndex}`;
      query += dispCondition;
      countQuery += dispCondition;
      params.push(disposition);
      paramIndex++;
    }

    // Add pagination
    query += ` ORDER BY cr.start_time DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const [calls, totalCount] = await Promise.all([
      DatabaseService.query(query, params),
      DatabaseService.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      success: true,
      data: {
        calls: calls.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(totalCount.rows[0].count),
          pages: Math.ceil(totalCount.rows[0].count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get call history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get call statistics
router.get('/statistics', requireManager, async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    let dateCondition = '';
    switch (period) {
      case 'today':
        dateCondition = "WHERE DATE(start_time) = CURRENT_DATE";
        break;
      case 'week':
        dateCondition = "WHERE start_time >= CURRENT_DATE - INTERVAL '7 days'";
        break;
      case 'month':
        dateCondition = "WHERE start_time >= CURRENT_DATE - INTERVAL '30 days'";
        break;
      default:
        dateCondition = "WHERE DATE(start_time) = CURRENT_DATE";
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN disposition = 'ANSWERED' THEN 1 END) as answered_calls,
        COUNT(CASE WHEN disposition = 'NO ANSWER' THEN 1 END) as missed_calls,
        COUNT(CASE WHEN disposition = 'BUSY' THEN 1 END) as busy_calls,
        COUNT(CASE WHEN disposition = 'FAILED' THEN 1 END) as failed_calls,
        AVG(duration) as avg_duration,
        SUM(duration) as total_duration,
        AVG(CASE WHEN disposition = 'ANSWERED' THEN duration END) as avg_answered_duration
      FROM call_records 
      ${dateCondition}
    `;

    const hourlyQuery = `
      SELECT 
        EXTRACT(HOUR FROM start_time) as hour,
        COUNT(*) as call_count
      FROM call_records 
      ${dateCondition}
      GROUP BY EXTRACT(HOUR FROM start_time)
      ORDER BY hour
    `;

    const topCallersQuery = `
      SELECT 
        caller_id_num,
        caller_id_name,
        COUNT(*) as call_count,
        AVG(duration) as avg_duration
      FROM call_records 
      ${dateCondition}
      GROUP BY caller_id_num, caller_id_name
      ORDER BY call_count DESC
      LIMIT 10
    `;

    const [stats, hourlyStats, topCallers] = await Promise.all([
      DatabaseService.query(statsQuery),
      DatabaseService.query(hourlyQuery),
      DatabaseService.query(topCallersQuery)
    ]);

    res.json({
      success: true,
      data: {
        overview: stats.rows[0],
        hourlyDistribution: hourlyStats.rows,
        topCallers: topCallers.rows
      }
    });
  } catch (error) {
    logger.error('Get call statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Originate a new call
router.post('/originate', requireManager, [
  body('channel').notEmpty().withMessage('Channel is required'),
  body('context').notEmpty().withMessage('Context is required'),
  body('exten').notEmpty().withMessage('Extension is required'),
  body('priority').isInt({ min: 1 }).withMessage('Priority must be a positive integer'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (!AsteriskManager.isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Asterisk not connected'
      });
    }

    const { channel, context, exten, priority, callerid } = req.body;

    const result = await AsteriskManager.originateCall(
      channel,
      context,
      exten,
      priority,
      callerid
    );

    // Log call origination
    await DatabaseService.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, new_values, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, 'ORIGINATE_CALL', 'CALL', JSON.stringify({ channel, context, exten, priority, callerid }), req.ip, req.get('User-Agent')]
    );

    logger.info('Call originated', { channel, exten, originatedBy: req.user.id });

    res.json({
      success: true,
      message: 'Call originated successfully',
      data: result
    });
  } catch (error) {
    logger.error('Originate call error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to originate call'
    });
  }
});

// Hangup a call
router.post('/hangup', requireManager, [
  body('channel').notEmpty().withMessage('Channel is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (!AsteriskManager.isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Asterisk not connected'
      });
    }

    const { channel } = req.body;

    const result = await AsteriskManager.hangupCall(channel);

    // Log call hangup
    await DatabaseService.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, new_values, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, 'HANGUP_CALL', 'CALL', JSON.stringify({ channel }), req.ip, req.get('User-Agent')]
    );

    logger.info('Call hung up', { channel, hungUpBy: req.user.id });

    res.json({
      success: true,
      message: 'Call hung up successfully',
      data: result
    });
  } catch (error) {
    logger.error('Hangup call error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to hangup call'
    });
  }
});

// Get call detail by ID
router.get('/:id', requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    const call = await DatabaseService.query(
      `SELECT cr.*, cqm.jitter_avg, cqm.jitter_max, cqm.packet_loss, 
              cqm.rtt_avg, cqm.rtt_max, cqm.mos_score, cqm.codec
       FROM call_records cr
       LEFT JOIN call_quality_metrics cqm ON cr.id = cqm.call_id
       WHERE cr.id = $1`,
      [id]
    );

    if (call.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Call record not found'
      });
    }

    res.json({
      success: true,
      data: call.rows[0]
    });
  } catch (error) {
    logger.error('Get call detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get call recording
router.get('/:id/recording', requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    const call = await DatabaseService.query(
      'SELECT recording_file FROM call_records WHERE id = $1',
      [id]
    );

    if (call.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Call record not found'
      });
    }

    const recordingFile = call.rows[0].recording_file;
    if (!recordingFile) {
      return res.status(404).json({
        success: false,
        message: 'No recording available for this call'
      });
    }

    // In a real implementation, you would serve the actual audio file
    // For now, we'll return the file path
    res.json({
      success: true,
      data: {
        recordingFile: recordingFile,
        downloadUrl: `/api/calls/${id}/recording/download`
      }
    });
  } catch (error) {
    logger.error('Get call recording error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Export call data to CSV
router.get('/export/csv', requireManager, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT cr.uniqueid, cr.caller_id_num, cr.caller_id_name, cr.destination,
             cr.context, cr.start_time, cr.answer_time, cr.end_time,
             cr.duration, cr.billable_seconds, cr.disposition, cr.account_code
      FROM call_records cr
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND cr.start_time >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND cr.start_time <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ' ORDER BY cr.start_time DESC';

    const calls = await DatabaseService.query(query, params);

    // Convert to CSV format
    const csvHeader = 'Unique ID,Caller ID Number,Caller ID Name,Destination,Context,Start Time,Answer Time,End Time,Duration,Billable Seconds,Disposition,Account Code\n';
    const csvData = calls.rows.map(call => 
      `${call.uniqueid},${call.caller_id_num || ''},${call.caller_id_name || ''},${call.destination || ''},${call.context || ''},${call.start_time},${call.answer_time || ''},${call.end_time || ''},${call.duration || 0},${call.billable_seconds || 0},${call.disposition || ''},${call.account_code || ''}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="call_records.csv"');
    res.send(csvHeader + csvData);

    // Log export
    await DatabaseService.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'EXPORT_CALLS', 'CALL', req.ip, req.get('User-Agent')]
    );

    logger.info('Call data exported', { exportedBy: req.user.id, recordCount: calls.rows.length });
  } catch (error) {
    logger.error('Export calls error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
