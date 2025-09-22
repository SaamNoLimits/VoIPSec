-- Enterprise VoIP Seed Data
-- This file contains sample data for testing and development

-- Insert sample users (passwords are hashed versions of 'password123')
INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'admin@company.com', '$2b$10$rOzJJjkzjkzjkzjkzjkzjOzJJjkzjkzjkzjkzjkzjkzjkzjkzjkzjk', 'System', 'Administrator', 'admin', true),
('550e8400-e29b-41d4-a716-446655440002', 'manager@company.com', '$2b$10$rOzJJjkzjkzjkzjkzjkzjOzJJjkzjkzjkzjkzjkzjkzjkzjkzjkzjk', 'John', 'Manager', 'manager', true),
('550e8400-e29b-41d4-a716-446655440003', 'alice@company.com', '$2b$10$rOzJJjkzjkzjkzjkzjkzjOzJJjkzjkzjkzjkzjkzjkzjkzjkzjkzjk', 'Alice', 'Johnson', 'user', true),
('550e8400-e29b-41d4-a716-446655440004', 'bob@company.com', '$2b$10$rOzJJjkzjkzjkzjkzjkzjOzJJjkzjkzjkzjkzjkzjkzjkzjkzjkzjk', 'Bob', 'Smith', 'user', true),
('550e8400-e29b-41d4-a716-446655440005', 'carol@company.com', '$2b$10$rOzJJjkzjkzjkzjkzjkzjOzJJjkzjkzjkzjkzjkzjkzjkzjkzjkzjk', 'Carol', 'Davis', 'user', true),
('550e8400-e29b-41d4-a716-446655440006', 'david@company.com', '$2b$10$rOzJJjkzjkzjkzjkzjkzjOzJJjkzjkzjkzjkzjkzjkzjkzjkzjkzjk', 'David', 'Wilson', 'user', true),
('550e8400-e29b-41d4-a716-446655440007', 'eve@company.com', '$2b$10$rOzJJjkzjkzjkzjkzjkzjOzJJjkzjkzjkzjkzjkzjkzjkzjkzjkzjk', 'Eve', 'Brown', 'user', true),
('550e8400-e29b-41d4-a716-446655440008', 'frank@company.com', '$2b$10$rOzJJjkzjkzjkzjkzjkzjOzJJjkzjkzjkzjkzjkzjkzjkzjkzjkzjk', 'Frank', 'Miller', 'user', true);

-- Insert sample extensions
INSERT INTO extensions (id, extension_number, display_name, user_id, secret, context, mailbox, voicemail_enabled, is_active) VALUES
('650e8400-e29b-41d4-a716-446655440001', '1000', 'System Admin', '550e8400-e29b-41d4-a716-446655440001', 'SecureSecret123!', 'internal', '1000', true, true),
('650e8400-e29b-41d4-a716-446655440002', '1001', 'John Manager', '550e8400-e29b-41d4-a716-446655440002', 'SecureSecret124!', 'internal', '1001', true, true),
('650e8400-e29b-41d4-a716-446655440003', '1002', 'Alice Johnson', '550e8400-e29b-41d4-a716-446655440003', 'SecureSecret125!', 'internal', '1002', true, true),
('650e8400-e29b-41d4-a716-446655440004', '1003', 'Bob Smith', '550e8400-e29b-41d4-a716-446655440004', 'SecureSecret126!', 'internal', '1003', true, true),
('650e8400-e29b-41d4-a716-446655440005', '1004', 'Carol Davis', '550e8400-e29b-41d4-a716-446655440005', 'SecureSecret127!', 'internal', '1004', true, true),
('650e8400-e29b-41d4-a716-446655440006', '1005', 'David Wilson', '550e8400-e29b-41d4-a716-446655440006', 'SecureSecret128!', 'internal', '1005', true, true),
('650e8400-e29b-41d4-a716-446655440007', '1006', 'Eve Brown', '550e8400-e29b-41d4-a716-446655440007', 'SecureSecret129!', 'internal', '1006', true, true),
('650e8400-e29b-41d4-a716-446655440008', '1007', 'Frank Miller', '550e8400-e29b-41d4-a716-446655440008', 'SecureSecret130!', 'internal', '1007', true, true),
('650e8400-e29b-41d4-a716-446655440009', '2000', 'Reception', NULL, 'ReceptionSecret!', 'internal', '2000', true, true),
('650e8400-e29b-41d4-a716-446655440010', '2001', 'Conference Room A', NULL, 'ConferenceSecret!', 'internal', NULL, false, true);

-- Insert sample SIP trunks
INSERT INTO sip_trunks (id, name, host, port, username, secret, context, max_channels, is_active) VALUES
('750e8400-e29b-41d4-a716-446655440001', 'Primary SIP Trunk', 'sip.provider1.com', 5060, 'trunk_user1', 'TrunkSecret123!', 'from-trunk', 30, true),
('750e8400-e29b-41d4-a716-446655440002', 'Backup SIP Trunk', 'sip.provider2.com', 5060, 'trunk_user2', 'TrunkSecret124!', 'from-trunk', 20, true),
('750e8400-e29b-41d4-a716-446655440003', 'Emergency Trunk', 'emergency.provider.com', 5061, 'emergency_user', 'EmergencySecret!', 'emergency', 5, true);

-- Insert sample conference rooms
INSERT INTO conference_rooms (id, room_number, name, description, pin, admin_pin, max_members, record_conference, created_by, is_active) VALUES
('850e8400-e29b-41d4-a716-446655440001', '8000', 'Main Conference Room', 'Primary conference room for company meetings', '1234', '9999', 50, true, '550e8400-e29b-41d4-a716-446655440001', true),
('850e8400-e29b-41d4-a716-446655440002', '8001', 'Sales Team Meeting', 'Weekly sales team conference', '2345', '8888', 20, false, '550e8400-e29b-41d4-a716-446655440002', true),
('850e8400-e29b-41d4-a716-446655440003', '8002', 'Development Standup', 'Daily development team standup', '3456', '7777', 15, false, '550e8400-e29b-41d4-a716-446655440002', true),
('850e8400-e29b-41d4-a716-446655440004', '8003', 'Board Meeting', 'Monthly board meeting room', '4567', '6666', 10, true, '550e8400-e29b-41d4-a716-446655440001', true),
('850e8400-e29b-41d4-a716-446655440005', '8004', 'Training Room', 'Employee training sessions', '5678', '5555', 30, true, '550e8400-e29b-41d4-a716-446655440002', true);

-- Insert sample call records (CDR) for the last 30 days
INSERT INTO call_records (id, uniqueid, caller_id_num, caller_id_name, destination, destination_context, channel, start_time, answer_time, end_time, duration, billable_seconds, disposition) VALUES
('950e8400-e29b-41d4-a716-446655440001', '1640995200.001', '1002', 'Alice Johnson', '1003', 'internal', 'SIP/1002-00000001', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '5 seconds', NOW() - INTERVAL '1 day' + INTERVAL '125 seconds', 125, 120, 'ANSWERED'),
('950e8400-e29b-41d4-a716-446655440002', '1640995300.002', '1003', 'Bob Smith', '1004', 'internal', 'SIP/1003-00000002', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '3 seconds', NOW() - INTERVAL '1 day' + INTERVAL '78 seconds', 78, 75, 'ANSWERED'),
('950e8400-e29b-41d4-a716-446655440003', '1640995400.003', '1004', 'Carol Davis', '1005', 'internal', 'SIP/1004-00000003', NOW() - INTERVAL '2 days', NULL, NOW() - INTERVAL '2 days' + INTERVAL '30 seconds', 30, 0, 'NO ANSWER'),
('950e8400-e29b-41d4-a716-446655440004', '1640995500.004', '1005', 'David Wilson', '1002', 'internal', 'SIP/1005-00000004', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '2 seconds', NOW() - INTERVAL '2 days' + INTERVAL '245 seconds', 245, 243, 'ANSWERED'),
('950e8400-e29b-41d4-a716-446655440005', '1640995600.005', '1006', 'Eve Brown', '1007', 'internal', 'SIP/1006-00000005', NOW() - INTERVAL '3 days', NULL, NOW() - INTERVAL '3 days' + INTERVAL '20 seconds', 20, 0, 'BUSY'),
('950e8400-e29b-41d4-a716-446655440006', '1640995700.006', '1007', 'Frank Miller', '1001', 'internal', 'SIP/1007-00000006', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '4 seconds', NOW() - INTERVAL '3 days' + INTERVAL '156 seconds', 156, 152, 'ANSWERED'),
('950e8400-e29b-41d4-a716-446655440007', '1640995800.007', '1001', 'John Manager', '2000', 'internal', 'SIP/1001-00000007', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days' + INTERVAL '1 second', NOW() - INTERVAL '4 days' + INTERVAL '89 seconds', 89, 88, 'ANSWERED'),
('950e8400-e29b-41d4-a716-446655440008', '1640995900.008', '1002', 'Alice Johnson', '18005551234', 'from-trunk', 'SIP/1002-00000008', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '6 seconds', NOW() - INTERVAL '5 days' + INTERVAL '312 seconds', 312, 306, 'ANSWERED'),
('950e8400-e29b-41d4-a716-446655440009', '1641000000.009', '1003', 'Bob Smith', '911', 'emergency', 'SIP/1003-00000009', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days' + INTERVAL '2 seconds', NOW() - INTERVAL '6 days' + INTERVAL '45 seconds', 45, 43, 'ANSWERED'),
('950e8400-e29b-41d4-a716-446655440010', '1641000100.010', '1004', 'Carol Davis', '1006', 'internal', 'SIP/1004-00000010', NOW() - INTERVAL '7 days', NULL, NOW() - INTERVAL '7 days' + INTERVAL '25 seconds', 25, 0, 'NO ANSWER');

-- Insert sample call quality metrics
INSERT INTO call_quality_metrics (id, call_id, jitter_avg, jitter_max, packet_loss, rtt_avg, rtt_max, mos_score, codec) VALUES
('a50e8400-e29b-41d4-a716-446655440001', '950e8400-e29b-41d4-a716-446655440001', 2.5, 8.2, 0.1, 45.2, 89.5, 4.2, 'ulaw'),
('a50e8400-e29b-41d4-a716-446655440002', '950e8400-e29b-41d4-a716-446655440002', 1.8, 5.4, 0.0, 38.7, 72.1, 4.4, 'ulaw'),
('a50e8400-e29b-41d4-a716-446655440003', '950e8400-e29b-41d4-a716-446655440004', 3.2, 12.1, 0.3, 52.8, 105.6, 3.8, 'alaw'),
('a50e8400-e29b-41d4-a716-446655440004', '950e8400-e29b-41d4-a716-446655440006', 2.1, 7.8, 0.1, 41.5, 83.2, 4.1, 'ulaw'),
('a50e8400-e29b-41d4-a716-446655440005', '950e8400-e29b-41d4-a716-446655440007', 1.5, 4.9, 0.0, 35.2, 68.7, 4.5, 'g722'),
('a50e8400-e29b-41d4-a716-446655440006', '950e8400-e29b-41d4-a716-446655440008', 4.1, 15.3, 0.5, 68.4, 142.8, 3.5, 'gsm'),
('a50e8400-e29b-41d4-a716-446655440007', '950e8400-e29b-41d4-a716-446655440009', 2.8, 9.6, 0.2, 48.9, 95.4, 3.9, 'ulaw');

-- Insert sample conference participants
INSERT INTO conference_participants (id, room_id, extension_id, channel, caller_id_num, caller_id_name, is_admin, joined_at, left_at) VALUES
('b50e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'SIP/1000-00000020', '1000', 'System Admin', true, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour'),
('b50e8400-e29b-41d4-a716-446655440002', '850e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440002', 'SIP/1001-00000021', '1001', 'John Manager', false, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour'),
('b50e8400-e29b-41d4-a716-446655440003', '850e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440003', 'SIP/1002-00000022', '1002', 'Alice Johnson', false, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour'),
('b50e8400-e29b-41d4-a716-446655440004', '850e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440004', 'SIP/1003-00000023', '1003', 'Bob Smith', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours'),
('b50e8400-e29b-41d4-a716-446655440005', '850e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440005', 'SIP/1004-00000024', '1004', 'Carol Davis', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours');

-- Insert sample voicemail messages
INSERT INTO voicemail_messages (id, mailbox, context, message_number, folder, caller_id_num, caller_id_name, duration, flag, message_date, recording_file) VALUES
('c50e8400-e29b-41d4-a716-446655440001', '1002', 'default', 1, 'INBOX', '1003', 'Bob Smith', 45, '', NOW() - INTERVAL '1 day', '/var/spool/asterisk/voicemail/default/1002/INBOX/msg0001.wav'),
('c50e8400-e29b-41d4-a716-446655440002', '1004', 'default', 1, 'INBOX', '1005', 'David Wilson', 62, '', NOW() - INTERVAL '2 days', '/var/spool/asterisk/voicemail/default/1004/INBOX/msg0001.wav'),
('c50e8400-e29b-41d4-a716-446655440003', '1006', 'default', 1, 'INBOX', '1007', 'Frank Miller', 38, 'URGENT', NOW() - INTERVAL '3 days', '/var/spool/asterisk/voicemail/default/1006/INBOX/msg0001.wav'),
('c50e8400-e29b-41d4-a716-446655440004', '1001', 'default', 1, 'INBOX', '18005551234', 'External Caller', 89, '', NOW() - INTERVAL '4 days', '/var/spool/asterisk/voicemail/default/1001/INBOX/msg0001.wav'),
('c50e8400-e29b-41d4-a716-446655440005', '1003', 'default', 1, 'INBOX', '1002', 'Alice Johnson', 52, '', NOW() - INTERVAL '5 days', '/var/spool/asterisk/voicemail/default/1003/INBOX/msg0001.wav');

-- Insert sample call filters
INSERT INTO call_filters (id, number_pattern, filter_type, description, created_by, is_active) VALUES
('d50e8400-e29b-41d4-a716-446655440001', '1800%', 'whitelist', 'Allow all toll-free numbers', '550e8400-e29b-41d4-a716-446655440001', true),
('d50e8400-e29b-41d4-a716-446655440002', '1900%', 'blacklist', 'Block premium rate numbers', '550e8400-e29b-41d4-a716-446655440001', true),
('d50e8400-e29b-41d4-a716-446655440003', '555123%', 'blacklist', 'Block known spam numbers', '550e8400-e29b-41d4-a716-446655440001', true),
('d50e8400-e29b-41d4-a716-446655440004', '911', 'whitelist', 'Always allow emergency calls', '550e8400-e29b-41d4-a716-446655440001', true),
('d50e8400-e29b-41d4-a716-446655440005', '411', 'whitelist', 'Allow directory assistance', '550e8400-e29b-41d4-a716-446655440001', true);

-- Insert sample audit logs
INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, new_values, ip_address, user_agent) VALUES
('e50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'LOGIN', 'USER', '550e8400-e29b-41d4-a716-446655440001', '{"login_time": "2024-01-01T10:00:00Z"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
('e50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'CREATE_EXTENSION', 'EXTENSION', '650e8400-e29b-41d4-a716-446655440009', '{"extension_number": "2000", "display_name": "Reception"}', '192.168.1.101', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'),
('e50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'UPDATE_USER', 'USER', '550e8400-e29b-41d4-a716-446655440003', '{"role": "user", "is_active": true}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
('e50e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 'CREATE_CONFERENCE', 'CONFERENCE', '850e8400-e29b-41d4-a716-446655440002', '{"room_number": "8001", "name": "Sales Team Meeting"}', '192.168.1.102', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'),
('e50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001', 'DELETE_CALL_FILTER', 'CALL_FILTER', 'd50e8400-e29b-41d4-a716-446655440006', '{"number_pattern": "1976%", "filter_type": "blacklist"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

-- Update system settings with sample values
UPDATE system_settings SET setting_value = 'Enterprise VoIP Solutions Inc.' WHERE setting_key = 'company_name';
UPDATE system_settings SET setting_value = '3600' WHERE setting_key = 'max_call_duration';
UPDATE system_settings SET setting_value = 'true' WHERE setting_key = 'call_recording_enabled';

-- Create some additional sample data for testing reports
-- Generate more call records for better statistics
DO $$
DECLARE
    i INTEGER;
    caller_ext VARCHAR(10);
    dest_ext VARCHAR(10);
    extensions VARCHAR(10)[] := ARRAY['1000','1001','1002','1003','1004','1005','1006','1007'];
    dispositions VARCHAR(20)[] := ARRAY['ANSWERED','NO ANSWER','BUSY','FAILED'];
    random_disposition VARCHAR(20);
    random_duration INTEGER;
    call_time TIMESTAMP;
BEGIN
    FOR i IN 1..100 LOOP
        caller_ext := extensions[1 + (random() * (array_length(extensions, 1) - 1))::INTEGER];
        dest_ext := extensions[1 + (random() * (array_length(extensions, 1) - 1))::INTEGER];
        
        -- Ensure caller and destination are different
        WHILE dest_ext = caller_ext LOOP
            dest_ext := extensions[1 + (random() * (array_length(extensions, 1) - 1))::INTEGER];
        END LOOP;
        
        random_disposition := dispositions[1 + (random() * (array_length(dispositions, 1) - 1))::INTEGER];
        
        -- Generate random duration based on disposition
        IF random_disposition = 'ANSWERED' THEN
            random_duration := 30 + (random() * 300)::INTEGER; -- 30 seconds to 5 minutes
        ELSE
            random_duration := 5 + (random() * 25)::INTEGER; -- 5 to 30 seconds
        END IF;
        
        call_time := NOW() - (random() * INTERVAL '30 days');
        
        INSERT INTO call_records (
            id, 
            uniqueid, 
            caller_id_num, 
            caller_id_name, 
            destination, 
            destination_context, 
            channel, 
            start_time, 
            answer_time, 
            end_time, 
            duration, 
            billable_seconds, 
            disposition
        ) VALUES (
            uuid_generate_v4(),
            extract(epoch from call_time)::BIGINT || '.' || LPAD(i::TEXT, 3, '0'),
            caller_ext,
            'User ' || caller_ext,
            dest_ext,
            'internal',
            'SIP/' || caller_ext || '-' || LPAD(i::TEXT, 8, '0'),
            call_time,
            CASE WHEN random_disposition = 'ANSWERED' THEN call_time + INTERVAL '3 seconds' ELSE NULL END,
            call_time + (random_duration || ' seconds')::INTERVAL,
            random_duration,
            CASE WHEN random_disposition = 'ANSWERED' THEN random_duration - 3 ELSE 0 END,
            random_disposition
        );
        
        -- Add quality metrics for answered calls
        IF random_disposition = 'ANSWERED' THEN
            INSERT INTO call_quality_metrics (
                id,
                call_id,
                jitter_avg,
                jitter_max,
                packet_loss,
                rtt_avg,
                rtt_max,
                mos_score,
                codec
            ) VALUES (
                uuid_generate_v4(),
                (SELECT id FROM call_records WHERE uniqueid = extract(epoch from call_time)::BIGINT || '.' || LPAD(i::TEXT, 3, '0')),
                1.0 + (random() * 4.0), -- 1-5ms jitter
                5.0 + (random() * 15.0), -- 5-20ms max jitter
                random() * 0.5, -- 0-0.5% packet loss
                20.0 + (random() * 60.0), -- 20-80ms RTT
                50.0 + (random() * 100.0), -- 50-150ms max RTT
                3.0 + (random() * 2.0), -- 3.0-5.0 MOS score
                (ARRAY['ulaw','alaw','g722','gsm'])[1 + (random() * 3)::INTEGER]
            );
        END IF;
    END LOOP;
END $$;

-- Add some conference participants for recent conferences
INSERT INTO conference_participants (room_id, extension_id, channel, caller_id_num, caller_id_name, is_admin, joined_at, left_at) VALUES
('850e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440002', 'SIP/1001-00000030', '1001', 'John Manager', true, NOW() - INTERVAL '30 minutes', NULL),
('850e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440003', 'SIP/1002-00000031', '1002', 'Alice Johnson', false, NOW() - INTERVAL '25 minutes', NULL),
('850e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440004', 'SIP/1003-00000032', '1003', 'Bob Smith', false, NOW() - INTERVAL '20 minutes', NULL);

-- Commit all changes
COMMIT;
