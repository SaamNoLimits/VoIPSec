const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const DatabaseService = require('../services/database');
const { requireAdmin, requireManager } = require('../middleware/auth');
const winston = require('winston');

const router = express.Router();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'user-routes' }
});

// Validation middleware
const createUserValidation = [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('role').isIn(['admin', 'manager', 'user']).withMessage('Invalid role'),
];

const updateUserValidation = [
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('role').optional().isIn(['admin', 'manager', 'user']).withMessage('Invalid role'),
];

// Get all users (Admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, username, email, first_name, last_name, role, department, 
             is_active, last_login, created_at, updated_at
      FROM users
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) FROM users WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    // Add search filter
    if (search) {
      const searchCondition = ` AND (username ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex})`;
      query += searchCondition;
      countQuery += searchCondition;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Add role filter
    if (role) {
      const roleCondition = ` AND role = $${paramIndex}`;
      query += roleCondition;
      countQuery += roleCondition;
      params.push(role);
      paramIndex++;
    }

    // Add pagination
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const [users, totalCount] = await Promise.all([
      DatabaseService.query(query, params),
      DatabaseService.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      success: true,
      data: {
        users: users.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(totalCount.rows[0].count),
          pages: Math.ceil(totalCount.rows[0].count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user by ID
router.get('/:id', requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await DatabaseService.query(
      `SELECT id, username, email, first_name, last_name, role, department, 
              is_active, last_login, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.rows[0]
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new user (Admin only)
router.post('/', requireAdmin, createUserValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, email, password, firstName, lastName, role, department, phoneNumber } = req.body;

    // Check if username or email already exists
    const existingUser = await DatabaseService.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUser = await DatabaseService.query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, role, department, phone_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, username, email, first_name, last_name, role, department, is_active, created_at`,
      [username, email, passwordHash, firstName, lastName, role, department, phoneNumber]
    );

    // Log user creation
    await DatabaseService.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.id, 'CREATE_USER', 'USER', newUser.rows[0].id, JSON.stringify(newUser.rows[0]), req.ip, req.get('User-Agent')]
    );

    logger.info('User created', { userId: newUser.rows[0].id, createdBy: req.user.id });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: newUser.rows[0]
    });
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update user (Admin only)
router.put('/:id', requireAdmin, updateUserValidation, async (req, res) => {
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
    const { email, firstName, lastName, role, department, phoneNumber, isActive } = req.body;

    // Get current user data
    const currentUser = await DatabaseService.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    if (currentUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if email is being changed and if it already exists
    if (email && email !== currentUser.rows[0].email) {
      const existingEmail = await DatabaseService.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );

      if (existingEmail.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Build update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      values.push(email);
      paramIndex++;
    }
    if (firstName !== undefined) {
      updates.push(`first_name = $${paramIndex}`);
      values.push(firstName);
      paramIndex++;
    }
    if (lastName !== undefined) {
      updates.push(`last_name = $${paramIndex}`);
      values.push(lastName);
      paramIndex++;
    }
    if (role !== undefined) {
      updates.push(`role = $${paramIndex}`);
      values.push(role);
      paramIndex++;
    }
    if (department !== undefined) {
      updates.push(`department = $${paramIndex}`);
      values.push(department);
      paramIndex++;
    }
    if (phoneNumber !== undefined) {
      updates.push(`phone_number = $${paramIndex}`);
      values.push(phoneNumber);
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
      UPDATE users 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING id, username, email, first_name, last_name, role, department, phone_number, is_active, updated_at
    `;

    const updatedUser = await DatabaseService.query(query, values);

    // Log user update
    await DatabaseService.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [req.user.id, 'UPDATE_USER', 'USER', id, JSON.stringify(currentUser.rows[0]), JSON.stringify(updatedUser.rows[0]), req.ip, req.get('User-Agent')]
    );

    logger.info('User updated', { userId: id, updatedBy: req.user.id });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser.rows[0]
    });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete user (Admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Get user data before deletion
    const user = await DatabaseService.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Soft delete by deactivating the user instead of hard delete
    await DatabaseService.query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    // Log user deletion
    await DatabaseService.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.id, 'DELETE_USER', 'USER', id, JSON.stringify(user.rows[0]), req.ip, req.get('User-Agent')]
    );

    logger.info('User deactivated', { userId: id, deactivatedBy: req.user.id });

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get current user profile
router.get('/profile/me', async (req, res) => {
  try {
    const user = await DatabaseService.query(
      `SELECT id, username, email, first_name, last_name, role, department, 
              phone_number, is_active, last_login, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.rows[0]
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update current user profile
router.put('/profile/me', updateUserValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, firstName, lastName, department, phoneNumber } = req.body;

    // Get current user data
    const currentUser = await DatabaseService.query(
      'SELECT * FROM users WHERE id = $1',
      [req.user.id]
    );

    // Check if email is being changed and if it already exists
    if (email && email !== currentUser.rows[0].email) {
      const existingEmail = await DatabaseService.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, req.user.id]
      );

      if (existingEmail.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Build update query (exclude role - users can't change their own role)
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      values.push(email);
      paramIndex++;
    }
    if (firstName !== undefined) {
      updates.push(`first_name = $${paramIndex}`);
      values.push(firstName);
      paramIndex++;
    }
    if (lastName !== undefined) {
      updates.push(`last_name = $${paramIndex}`);
      values.push(lastName);
      paramIndex++;
    }
    if (department !== undefined) {
      updates.push(`department = $${paramIndex}`);
      values.push(department);
      paramIndex++;
    }
    if (phoneNumber !== undefined) {
      updates.push(`phone_number = $${paramIndex}`);
      values.push(phoneNumber);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.user.id);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING id, username, email, first_name, last_name, role, department, phone_number, updated_at
    `;

    const updatedUser = await DatabaseService.query(query, values);

    logger.info('Profile updated', { userId: req.user.id });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser.rows[0]
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
