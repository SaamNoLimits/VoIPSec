-- Seed data for Enterprise VoIP System

-- Insert default admin user (password: admin123)
INSERT INTO users (id, username, email, password_hash, first_name, last_name, role, department, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'admin', 'admin@voipenterprise.com', '$2b$10$rQZ1vK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5x', 'System', 'Administrator', 'admin', 'IT', true),
('550e8400-e29b-41d4-a716-446655440001', 'manager', 'manager@voipenterprise.com', '$2b$10$rQZ1vK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5x', 'John', 'Manager', 'manager', 'Operations', true),
('550e8400-e29b-41d4-a716-446655440002', 'john.doe', 'john.doe@voipenterprise.com', '$2b$10$rQZ1vK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5x', 'John', 'Doe', 'user', 'Sales', true),
('550e8400-e29b-41d4-a716-446655440003', 'jane.smith', 'jane.smith@voipenterprise.com', '$2b$10$rQZ1vK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5x', 'Jane', 'Smith', 'user', 'Support', true),
('550e8400-e29b-41d4-a716-446655440004', 'bob.johnson', 'bob.johnson@voipenterprise.com', '$2b$10$rQZ1vK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5xK5x', 'Bob', 'Johnson', 'user', 'Engineering', true);

-- Insert extensions
INSERT INTO extensions (id, extension_number, user_id, display_name, secret, mailbox, is_active) VALUES
('650e8400-e29b-41d4-a716-446655440000', '1001', '550e8400-e29b-41d4-a716-446655440002', 'John Doe', 'SecurePass123!', '1001', true),
('650e8400-e29b-41d4-a716-446655440001', '1002', '550e8400-e29b-41d4-a716-446655440003', 'Jane Smith', 'SecurePass124!', '1002', true),
('650e8400-e29b-41d4-a716-446655440002', '1003', '550e8400-e29b-41d4-a716-446655440004', 'Bob Johnson', 'SecurePass125!', '1003', true),
('650e8400-e29b-41d4-a716-446655440003', '1100', '550e8400-e29b-41d4-a716-446655440000', 'Admin Extension', 'AdminPass123!', '1100', true),
('650e8400-e29b-41d4-a716-446655440004', '1200', '550e8400-e29b-41d4-a716-446655440001', 'Manager Extension', 'ManagerPass123!', '1200', true);

-- Insert department extensions (ring groups)
INSERT INTO extensions (id, extension_number, display_name, secret, context, is_active) VALUES
('650e8400-e29b-41d4-a716-446655440005', '2001', 'Sales Department', 'SalesPass123!', 'internal', true),
('650e8400-e29b-41d4-a716-446655440006', '2002', 'Support Department', 'SupportPass123!', 'internal', true),
('650e8400-e29b-41d4-a716-446655440007', '2003', 'Billing Department', 'BillingPass123!', 'internal', true);

-- Insert conference rooms
INSERT INTO conference_rooms (id, room_number, name, description, pin, admin_pin, max_members, record_conference, created_by, is_active) VALUES
('750e8400-e29b-41d4-a716-446655440000', '8000', 'General Conference', 'Main conference room for general meetings', NULL, '123456', 50, true, '550e8400-e29b-41d4-a716-446655440000', true),
('750e8400-e29b-41d4-a716-446655440001', '8001', 'Executive Meeting', 'Executive team meetings', '654321', '123456', 25, true, '550e8400-e29b-41d4-a716-446655440000', true),
('750e8400-e29b-41d4-a716-446655440002', '8002', 'Training Room', 'Training and presentations', NULL, '123456', 100, true, '550e8400-e29b-41d4-a716-446655440001', true);

-- Insert SIP trunk (example configuration)
INSERT INTO sip_trunks (id, name, host, username, secret, from_user, from_domain, is_active) VALUES
('850e8400-e29b-41d4-a716-446655440000', 'Primary SIP Trunk', 'sip.provider.com', 'your_username', 'your_password', 'your_username', 'sip.provider.com', false);

-- Insert system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('company_name', 'VoIP Enterprise', 'string', 'Company name displayed in the system'),
('timezone', 'America/New_York', 'string', 'Default system timezone'),
('call_recording_enabled', 'true', 'boolean', 'Enable call recording by default'),
('max_call_duration', '7200', 'number', 'Maximum call duration in seconds (2 hours)'),
('voicemail_email_enabled', 'true', 'boolean', 'Send voicemail notifications via email'),
('smtp_server', 'smtp.company.com', 'string', 'SMTP server for email notifications'),
('smtp_port', '587', 'number', 'SMTP server port'),
('smtp_username', 'voicemail@company.com', 'string', 'SMTP username'),
('smtp_password', 'encrypted_password', 'string', 'SMTP password (encrypted)', true),
('sip_port', '5060', 'number', 'SIP listening port'),
('rtp_start', '10000', 'number', 'RTP port range start'),
('rtp_end', '10100', 'number', 'RTP port range end'),
('max_concurrent_calls', '100', 'number', 'Maximum concurrent calls'),
('call_timeout', '30', 'number', 'Call timeout in seconds'),
('registration_timeout', '120', 'number', 'SIP registration timeout in seconds'),
('enable_encryption', 'true', 'boolean', 'Enable SIP/RTP encryption'),
('log_level', 'info', 'string', 'System log level'),
('backup_retention_days', '30', 'number', 'Number of days to retain backups'),
('cdr_retention_days', '365', 'number', 'Number of days to retain call records');

-- Insert call filters (security)
INSERT INTO call_filters (filter_type, number_pattern, description, created_by, is_active) VALUES
('blacklist', '1900%', 'Block premium rate numbers', '550e8400-e29b-41d4-a716-446655440000', true),
('blacklist', '976%', 'Block adult entertainment numbers', '550e8400-e29b-41d4-a716-446655440000', true),
('blacklist', '900%', 'Block premium services', '550e8400-e29b-41d4-a716-446655440000', true),
('whitelist', '911', 'Emergency services', '550e8400-e29b-41d4-a716-446655440000', true),
('whitelist', '1%', 'North American numbers', '550e8400-e29b-41d4-a716-446655440000', true);

-- Insert sample call records (for demonstration)
INSERT INTO call_records (uniqueid, caller_id_num, caller_id_name, destination, context, channel, start_time, answer_time, end_time, duration, billable_seconds, disposition) VALUES
('1234567890.1', '1001', 'John Doe', '1002', 'internal', 'SIP/1001-00000001', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours' + INTERVAL '5 seconds', NOW() - INTERVAL '2 hours' + INTERVAL '5 minutes', 300, 295, 'ANSWERED'),
('1234567890.2', '1002', 'Jane Smith', '18005551234', 'outbound', 'SIP/1002-00000002', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour' + INTERVAL '3 seconds', NOW() - INTERVAL '1 hour' + INTERVAL '10 minutes', 600, 597, 'ANSWERED'),
('1234567890.3', '18005559999', 'External Caller', '2001', 'from-trunk', 'SIP/trunk-00000003', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes' + INTERVAL '2 seconds', NOW() - INTERVAL '30 minutes' + INTERVAL '8 minutes', 480, 478, 'ANSWERED');

-- Insert sample call quality metrics
INSERT INTO call_quality_metrics (call_id, channel, jitter_avg, jitter_max, packet_loss, rtt_avg, rtt_max, mos_score, codec) VALUES
((SELECT id FROM call_records WHERE uniqueid = '1234567890.1'), 'SIP/1001-00000001', 2.5, 5.0, 0.1, 25.0, 45.0, 4.2, 'ulaw'),
((SELECT id FROM call_records WHERE uniqueid = '1234567890.2'), 'SIP/1002-00000002', 3.2, 8.0, 0.3, 35.0, 65.0, 3.8, 'g722'),
((SELECT id FROM call_records WHERE uniqueid = '1234567890.3'), 'SIP/trunk-00000003', 1.8, 4.0, 0.0, 20.0, 35.0, 4.5, 'ulaw');

-- Create views for reporting
CREATE VIEW active_extensions AS
SELECT 
    e.extension_number,
    e.display_name,
    u.first_name || ' ' || u.last_name as user_name,
    u.department,
    e.is_active,
    e.created_at
FROM extensions e
LEFT JOIN users u ON e.user_id = u.id
WHERE e.is_active = true;

CREATE VIEW call_summary_today AS
SELECT 
    COUNT(*) as total_calls,
    COUNT(CASE WHEN disposition = 'ANSWERED' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN disposition = 'NO ANSWER' THEN 1 END) as missed_calls,
    COUNT(CASE WHEN disposition = 'BUSY' THEN 1 END) as busy_calls,
    AVG(duration) as avg_duration,
    SUM(duration) as total_duration
FROM call_records 
WHERE DATE(start_time) = CURRENT_DATE;

CREATE VIEW extension_call_stats AS
SELECT 
    e.extension_number,
    e.display_name,
    COUNT(cr.id) as total_calls,
    COUNT(CASE WHEN cr.disposition = 'ANSWERED' THEN 1 END) as answered_calls,
    AVG(cr.duration) as avg_call_duration,
    SUM(cr.duration) as total_call_time
FROM extensions e
LEFT JOIN call_records cr ON (cr.caller_id_num = e.extension_number OR cr.destination = e.extension_number)
WHERE cr.start_time >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY e.id, e.extension_number, e.display_name
ORDER BY total_calls DESC;
