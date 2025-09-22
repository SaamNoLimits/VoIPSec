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
  defaultMeta: { service: 'conference-routes' }
});

// Validation middleware
const createConferenceValidation = [
  body('roomNumber').matches(/^\d{4}$/).withMessage('Room number must be 4 digits'),
  body('name').notEmpty().withMessage('Conference name is required'),
  body('maxMembers').optional().isInt({ min: 1, max: 100 }).withMessage('Max members must be between 1 and 100'),
];

// Get all conference rooms
router.get('/', requireManager, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT cr.id, cr.room_number, cr.name, cr.description, cr.max_members,
             cr.record_conference, cr.is_active, cr.created_at, cr.updated_at,
             u.first_name || ' ' || u.last_name as created_by_name,
             COUNT(cp.id) as active_participants
      FROM conference_rooms cr
      LEFT JOIN users u ON cr.created_by = u.id
      LEFT JOIN conference_participants cp ON cr.id = cp.room_id AND cp.left_at IS NULL
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) FROM conference_rooms WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    // Add search filter
    if (search) {
      const searchCondition = ` AND (cr.room_number ILIKE $${paramIndex} OR cr.name ILIKE $${paramIndex} OR cr.description ILIKE $${paramIndex})`;
      query += searchCondition;
      countQuery += searchCondition;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Add status filter
    if (status) {
      const statusCondition = ` AND cr.is_active = $${paramIndex}`;
      query += statusCondition;
      countQuery += statusCondition;
      params.push(status === 'active');
      paramIndex++;
    }

    // Add grouping and pagination
    query += ` GROUP BY cr.id, u.first_name, u.last_name ORDER BY cr.room_number ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const [conferences, totalCount] = await Promise.all([
      DatabaseService.query(query, params),
      DatabaseService.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      success: true,
      data: {
        conferences: conferences.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(totalCount.rows[0].count),
          pages: Math.ceil(totalCount.rows[0].count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get conferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get conference room by ID
router.get('/:id', requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    const conference = await DatabaseService.query(
      `SELECT cr.*, u.first_name || ' ' || u.last_name as created_by_name
       FROM conference_rooms cr
       LEFT JOIN users u ON cr.created_by = u.id
       WHERE cr.id = $1`,
      [id]
    );

    if (conference.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conference room not found'
      });
    }

    // Get active participants
    const participants = await DatabaseService.query(
      `SELECT cp.*, e.extension_number, e.display_name
       FROM conference_participants cp
       LEFT JOIN extensions e ON cp.extension_id = e.id
       WHERE cp.room_id = $1 AND cp.left_at IS NULL
       ORDER BY cp.joined_at ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...conference.rows[0],
        activeParticipants: participants.rows
      }
    });
  } catch (error) {
    logger.error('Get conference error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new conference room
router.post('/', requireManager, createConferenceValidation, async (req, res) => {
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
      roomNumber,
      name,
      description,
      pin,
      adminPin,
      maxMembers = 50,
      recordConference = false
    } = req.body;

    // Check if room number already exists
    const existingRoom = await DatabaseService.query(
      'SELECT id FROM conference_rooms WHERE room_number = $1',
      [roomNumber]
    );

    if (existingRoom.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Conference room number already exists'
      });
    }

    // Create conference room
    const newConference = await DatabaseService.query(
      `INSERT INTO conference_rooms (room_number, name, description, pin, admin_pin, 
                                   max_members, record_conference, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [roomNumber, name, description, pin, adminPin, maxMembers, recordConference, req.user.id]
    );

    // Log conference creation
    await DatabaseService.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.id, 'CREATE_CONFERENCE', 'CONFERENCE', newConference.rows[0].id, JSON.stringify(newConference.rows[0]), req.ip, req.get('User-Agent')]
    );

    logger.info('Conference room created', { conferenceId: newConference.rows[0].id, createdBy: req.user.id });

    res.status(201).json({
      success: true,
      message: 'Conference room created successfully',
      data: newConference.rows[0]
    });
  } catch (error) {
    logger.error('Create conference error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update conference room
router.put('/:id', requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, pin, adminPin, maxMembers, recordConference, isActive } = req.body;

    // Get current conference data
    const currentConference = await DatabaseService.query(
      'SELECT * FROM conference_rooms WHERE id = $1',
      [id]
    );

    if (currentConference.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conference room not found'
      });
    }

    // Build update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }
    if (pin !== undefined) {
      updates.push(`pin = $${paramIndex}`);
      values.push(pin);
      paramIndex++;
    }
    if (adminPin !== undefined) {
      updates.push(`admin_pin = $${paramIndex}`);
      values.push(adminPin);
      paramIndex++;
    }
    if (maxMembers !== undefined) {
      updates.push(`max_members = $${paramIndex}`);
      values.push(maxMembers);
      paramIndex++;
    }
    if (recordConference !== undefined) {
      updates.push(`record_conference = $${paramIndex}`);
      values.push(recordConference);
      paramIndex++;
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(isActive);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE conference_rooms 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const updatedConference = await DatabaseService.query(query, values);

    // Log conference update
    await DatabaseService.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [req.user.id, 'UPDATE_CONFERENCE', 'CONFERENCE', id, JSON.stringify(currentConference.rows[0]), JSON.stringify(updatedConference.rows[0]), req.ip, req.get('User-Agent')]
    );

    logger.info('Conference room updated', { conferenceId: id, updatedBy: req.user.id });

    res.json({
      success: true,
      message: 'Conference room updated successfully',
      data: updatedConference.rows[0]
    });
  } catch (error) {
    logger.error('Update conference error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete conference room
router.delete('/:id', requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    // Get conference data before deletion
    const conference = await DatabaseService.query(
      'SELECT * FROM conference_rooms WHERE id = $1',
      [id]
    );

    if (conference.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conference room not found'
      });
    }

    // Check if conference has active participants
    const activeParticipants = await DatabaseService.query(
      'SELECT COUNT(*) FROM conference_participants WHERE room_id = $1 AND left_at IS NULL',
      [id]
    );

    if (parseInt(activeParticipants.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete conference room with active participants'
      });
    }

    // Soft delete by deactivating the conference room
    await DatabaseService.query(
      'UPDATE conference_rooms SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    // Log conference deletion
    await DatabaseService.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.id, 'DELETE_CONFERENCE', 'CONFERENCE', id, JSON.stringify(conference.rows[0]), req.ip, req.get('User-Agent')]
    );

    logger.info('Conference room deactivated', { conferenceId: id, deactivatedBy: req.user.id });

    res.json({
      success: true,
      message: 'Conference room deactivated successfully'
    });
  } catch (error) {
    logger.error('Delete conference error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get conference participants
router.get('/:id/participants', requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    const participants = await DatabaseService.query(
      `SELECT cp.*, e.extension_number, e.display_name,
              u.first_name || ' ' || u.last_name as user_name
       FROM conference_participants cp
       LEFT JOIN extensions e ON cp.extension_id = e.id
       LEFT JOIN users u ON e.user_id = u.id
       WHERE cp.room_id = $1
       ORDER BY cp.joined_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: participants.rows
    });
  } catch (error) {
    logger.error('Get conference participants error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Kick participant from conference
router.post('/:id/kick/:participantId', requireManager, async (req, res) => {
  try {
    const { id, participantId } = req.params;

    // Get participant info
    const participant = await DatabaseService.query(
      'SELECT * FROM conference_participants WHERE id = $1 AND room_id = $2 AND left_at IS NULL',
      [participantId, id]
    );

    if (participant.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found or already left'
      });
    }

    // Update participant record
    await DatabaseService.query(
      'UPDATE conference_participants SET left_at = NOW() WHERE id = $1',
      [participantId]
    );

    // If Asterisk is connected, try to kick the participant
    if (AsteriskManager.isConnected()) {
      try {
        await AsteriskManager.executeCommand(`confbridge kick ${id} ${participant.rows[0].channel}`);
      } catch (asteriskError) {
        logger.warn('Failed to kick participant via Asterisk:', asteriskError);
      }
    }

    // Log participant kick
    await DatabaseService.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.id, 'KICK_PARTICIPANT', 'CONFERENCE', id, JSON.stringify({ participantId, channel: participant.rows[0].channel }), req.ip, req.get('User-Agent')]
    );

    logger.info('Participant kicked from conference', { conferenceId: id, participantId, kickedBy: req.user.id });

    res.json({
      success: true,
      message: 'Participant kicked successfully'
    });
  } catch (error) {
    logger.error('Kick participant error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Mute/unmute participant
router.post('/:id/mute/:participantId', requireManager, async (req, res) => {
  try {
    const { id, participantId } = req.params;
    const { mute = true } = req.body;

    // Get participant info
    const participant = await DatabaseService.query(
      'SELECT * FROM conference_participants WHERE id = $1 AND room_id = $2 AND left_at IS NULL',
      [participantId, id]
    );

    if (participant.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found or already left'
      });
    }

    // Update participant mute status
    await DatabaseService.query(
      'UPDATE conference_participants SET is_muted = $1 WHERE id = $2',
      [mute, participantId]
    );

    // If Asterisk is connected, try to mute/unmute the participant
    if (AsteriskManager.isConnected()) {
      try {
        const action = mute ? 'mute' : 'unmute';
        await AsteriskManager.executeCommand(`confbridge ${action} ${id} ${participant.rows[0].channel}`);
      } catch (asteriskError) {
        logger.warn('Failed to mute/unmute participant via Asterisk:', asteriskError);
      }
    }

    // Log participant mute/unmute
    await DatabaseService.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.id, mute ? 'MUTE_PARTICIPANT' : 'UNMUTE_PARTICIPANT', 'CONFERENCE', id, JSON.stringify({ participantId, channel: participant.rows[0].channel }), req.ip, req.get('User-Agent')]
    );

    logger.info(`Participant ${mute ? 'muted' : 'unmuted'}`, { conferenceId: id, participantId, actionBy: req.user.id });

    res.json({
      success: true,
      message: `Participant ${mute ? 'muted' : 'unmuted'} successfully`
    });
  } catch (error) {
    logger.error('Mute participant error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get conference statistics
router.get('/statistics/overview', requireManager, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let dateCondition = '';
    switch (period) {
      case 'today':
        dateCondition = "WHERE DATE(cp.joined_at) = CURRENT_DATE";
        break;
      case 'week':
        dateCondition = "WHERE cp.joined_at >= CURRENT_DATE - INTERVAL '7 days'";
        break;
      case 'month':
        dateCondition = "WHERE cp.joined_at >= CURRENT_DATE - INTERVAL '30 days'";
        break;
      default:
        dateCondition = "WHERE cp.joined_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const statsQuery = `
      SELECT 
        COUNT(DISTINCT cr.id) as total_conferences,
        COUNT(DISTINCT cr.id) FILTER (WHERE cr.is_active = true) as active_conferences,
        COUNT(cp.id) as total_participants,
        AVG(EXTRACT(EPOCH FROM (cp.left_at - cp.joined_at))/60) as avg_duration_minutes
      FROM conference_rooms cr
      LEFT JOIN conference_participants cp ON cr.id = cp.room_id
      ${dateCondition}
    `;

    const popularRoomsQuery = `
      SELECT 
        cr.room_number,
        cr.name,
        COUNT(cp.id) as participant_count,
        AVG(EXTRACT(EPOCH FROM (cp.left_at - cp.joined_at))/60) as avg_duration
      FROM conference_rooms cr
      LEFT JOIN conference_participants cp ON cr.id = cp.room_id
      ${dateCondition}
      GROUP BY cr.id, cr.room_number, cr.name
      ORDER BY participant_count DESC
      LIMIT 10
    `;

    const [stats, popularRooms] = await Promise.all([
      DatabaseService.query(statsQuery),
      DatabaseService.query(popularRoomsQuery)
    ]);

    res.json({
      success: true,
      data: {
        overview: stats.rows[0],
        popularRooms: popularRooms.rows
      }
    });
  } catch (error) {
    logger.error('Get conference statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
