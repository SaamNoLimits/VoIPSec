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
  defaultMeta: { service: 'extension-routes' }
});

// Validation middleware
const createExtensionValidation = [
  body('extensionNumber').matches(/^\d{3,4}$/).withMessage('Extension number must be 3-4 digits'),
  body('displayName').notEmpty().withMessage('Display name is required'),
  body('secret').isLength({ min: 8 }).withMessage('Secret must be at least 8 characters'),
  body('userId').optional().isUUID().withMessage('Invalid user ID format'),
];

const updateExtensionValidation = [
  body('displayName').optional().notEmpty().withMessage('Display name cannot be empty'),
  body('secret').optional().isLength({ min: 8 }).withMessage('Secret must be at least 8 characters'),
  body('userId').optional().isUUID().withMessage('Invalid user ID format'),
];

// Get all extensions
router.get('/', requireManager, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT e.id, e.extension_number, e.display_name, e.context, e.mailbox,
             e.call_limit, e.is_active, e.created_at, e.updated_at,
             u.first_name, u.last_name, u.email, u.department
      FROM extensions e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) FROM extensions e WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    // Add search filter
    if (search) {
      const searchCondition = ` AND (e.extension_number ILIKE $${paramIndex} OR e.display_name ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex})`;
      query += searchCondition;
      countQuery += searchCondition.replace('LEFT JOIN users u ON e.user_id = u.id', '');
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Add status filter
    if (status) {
      const statusCondition = ` AND e.is_active = $${paramIndex}`;
      query += statusCondition;
      countQuery += statusCondition;
      params.push(status === 'active');
      paramIndex++;
    }

    // Add pagination
    query += ` ORDER BY e.extension_number ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const [extensions, totalCount] = await Promise.all([
      DatabaseService.query(query, params),
      DatabaseService.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      success: true,
      data: {
        extensions: extensions.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(totalCount.rows[0].count),
          pages: Math.ceil(totalCount.rows[0].count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get extensions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get extension by ID
router.get('/:id', requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    const extension = await DatabaseService.query(
      `SELECT e.*, u.first_name, u.last_name, u.email, u.department
       FROM extensions e
       LEFT JOIN users u ON e.user_id = u.id
       WHERE e.id = $1`,
      [id]
    );

    if (extension.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Extension not found'
      });
    }

    res.json({
      success: true,
      data: extension.rows[0]
    });
  } catch (error) {
    logger.error('Get extension error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new extension
router.post('/', requireManager, createExtensionValidation, async (req, res) => {
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
      extensionNumber,
      displayName,
      secret,
      userId,
      context = 'internal',
      callLimit = 5,
      codecAllow = 'ulaw,alaw,g722',
      codecDisallow = 'all'
    } = req.body;

    // Check if extension number already exists
    const existingExtension = await DatabaseService.query(
      'SELECT id FROM extensions WHERE extension_number = $1',
      [extensionNumber]
    );

    if (existingExtension.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Extension number already exists'
      });
    }

    // If userId is provided, check if user exists
    if (userId) {
      const user = await DatabaseService.query(
        'SELECT id FROM users WHERE id = $1 AND is_active = true',
        [userId]
      );

      if (user.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User not found or inactive'
        });
      }
    }

    // Create extension
    const newExtension = await DatabaseService.query(
      `INSERT INTO extensions (extension_number, display_name, secret, user_id, context, 
                              mailbox, call_limit, codec_allow, codec_disallow)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [extensionNumber, displayName, secret, userId, context, extensionNumber, 
       callLimit, codecAllow, codecDisallow]
    );

    // Log extension creation
    await DatabaseService.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.id, 'CREATE_EXTENSION', 'EXTENSION', newExtension.rows[0].id, JSON.stringify(newExtension.rows[0]), req.ip, req.get('User-Agent')]
    );

    // Reload Asterisk SIP configuration
    try {
      if (AsteriskManager.isConnected()) {
        await AsteriskManager.reloadModule('chan_sip.so');
      }
    } catch (asteriskError) {
      logger.warn('Failed to reload Asterisk SIP module:', asteriskError);
    }

    logger.info('Extension created', { extensionId: newExtension.rows[0].id, createdBy: req.user.id });

    res.status(201).json({
      success: true,
      message: 'Extension created successfully',
      data: newExtension.rows[0]
    });
  } catch (error) {
    logger.error('Create extension error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update extension
router.put('/:id', requireManager, updateExtensionValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { displayName, secret, userId, callLimit, codecAllow, codecDisallow, isActive } = req.body;

    // Get current extension data
    const currentExtension = await DatabaseService.query(
      'SELECT * FROM extensions WHERE id = $1',
      [id]
    );

    if (currentExtension.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Extension not found'
      });
    }

    // If userId is provided, check if user exists
    if (userId) {
      const user = await DatabaseService.query(
        'SELECT id FROM users WHERE id = $1 AND is_active = true',
        [userId]
      );

      if (user.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User not found or inactive'
        });
      }
    }

    // Build update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (displayName !== undefined) {
      updates.push(`display_name = $${paramIndex}`);
      values.push(displayName);
      paramIndex++;
    }
    if (secret !== undefined) {
      updates.push(`secret = $${paramIndex}`);
      values.push(secret);
      paramIndex++;
    }
    if (userId !== undefined) {
      updates.push(`user_id = $${paramIndex}`);
      values.push(userId);
      paramIndex++;
    }
    if (callLimit !== undefined) {
      updates.push(`call_limit = $${paramIndex}`);
      values.push(callLimit);
      paramIndex++;
    }
    if (codecAllow !== undefined) {
      updates.push(`codec_allow = $${paramIndex}`);
      values.push(codecAllow);
      paramIndex++;
    }
    if (codecDisallow !== undefined) {
      updates.push(`codec_disallow = $${paramIndex}`);
      values.push(codecDisallow);
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
      UPDATE extensions 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const updatedExtension = await DatabaseService.query(query, values);

    // Log extension update
    await DatabaseService.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [req.user.id, 'UPDATE_EXTENSION', 'EXTENSION', id, JSON.stringify(currentExtension.rows[0]), JSON.stringify(updatedExtension.rows[0]), req.ip, req.get('User-Agent')]
    );

    // Reload Asterisk SIP configuration
    try {
      if (AsteriskManager.isConnected()) {
        await AsteriskManager.reloadModule('chan_sip.so');
      }
    } catch (asteriskError) {
      logger.warn('Failed to reload Asterisk SIP module:', asteriskError);
    }

    logger.info('Extension updated', { extensionId: id, updatedBy: req.user.id });

    res.json({
      success: true,
      message: 'Extension updated successfully',
      data: updatedExtension.rows[0]
    });
  } catch (error) {
    logger.error('Update extension error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete extension
router.delete('/:id', requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    // Get extension data before deletion
    const extension = await DatabaseService.query(
      'SELECT * FROM extensions WHERE id = $1',
      [id]
    );

    if (extension.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Extension not found'
      });
    }

    // Soft delete by deactivating the extension
    await DatabaseService.query(
      'UPDATE extensions SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    // Log extension deletion
    await DatabaseService.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.id, 'DELETE_EXTENSION', 'EXTENSION', id, JSON.stringify(extension.rows[0]), req.ip, req.get('User-Agent')]
    );

    // Reload Asterisk SIP configuration
    try {
      if (AsteriskManager.isConnected()) {
        await AsteriskManager.reloadModule('chan_sip.so');
      }
    } catch (asteriskError) {
      logger.warn('Failed to reload Asterisk SIP module:', asteriskError);
    }

    logger.info('Extension deactivated', { extensionId: id, deactivatedBy: req.user.id });

    res.json({
      success: true,
      message: 'Extension deactivated successfully'
    });
  } catch (error) {
    logger.error('Delete extension error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get extension status from Asterisk
router.get('/:extensionNumber/status', requireManager, async (req, res) => {
  try {
    const { extensionNumber } = req.params;

    if (!AsteriskManager.isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Asterisk not connected'
      });
    }

    const peers = await AsteriskManager.getPeers();
    const peer = peers.find(p => p.objectname === extensionNumber);

    res.json({
      success: true,
      data: {
        extension: extensionNumber,
        status: peer ? peer.status : 'Unknown',
        ipAddress: peer ? peer.ipaddress : null,
        port: peer ? peer.port : null,
        lastContact: peer ? peer.regseconds : null
      }
    });
  } catch (error) {
    logger.error('Get extension status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
