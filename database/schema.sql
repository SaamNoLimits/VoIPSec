-- Enterprise VoIP Database Schema
-- PostgreSQL 13+

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    password_changed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Extensions table
CREATE TABLE extensions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    extension_number VARCHAR(20) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    secret VARCHAR(255) NOT NULL,
    context VARCHAR(50) DEFAULT 'internal',
    mailbox VARCHAR(20),
    voicemail_enabled BOOLEAN DEFAULT true,
    call_forwarding_enabled BOOLEAN DEFAULT false,
    call_forwarding_number VARCHAR(20),
    do_not_disturb BOOLEAN DEFAULT false,
    call_waiting BOOLEAN DEFAULT true,
    caller_id_name VARCHAR(100),
    caller_id_number VARCHAR(20),
    max_contacts INTEGER DEFAULT 1,
    qualify VARCHAR(10) DEFAULT 'yes',
    nat VARCHAR(20) DEFAULT 'force_rport,comedia',
    encryption VARCHAR(20) DEFAULT 'yes',
    transport VARCHAR(20) DEFAULT 'tls',
    dtmf_mode VARCHAR(20) DEFAULT 'rfc2833',
    codecs TEXT DEFAULT 'ulaw,alaw,gsm,g729,g722',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- SIP trunks table
CREATE TABLE sip_trunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER DEFAULT 5060,
    username VARCHAR(100),
    secret VARCHAR(255),
    context VARCHAR(50) DEFAULT 'from-trunk',
    qualify VARCHAR(10) DEFAULT 'yes',
    nat VARCHAR(20) DEFAULT 'force_rport,comedia',
    encryption VARCHAR(20) DEFAULT 'no',
    transport VARCHAR(20) DEFAULT 'udp',
    dtmf_mode VARCHAR(20) DEFAULT 'rfc2833',
    codecs TEXT DEFAULT 'ulaw,alaw,gsm',
    max_channels INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Call records (CDR) table
CREATE TABLE call_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uniqueid VARCHAR(50) UNIQUE NOT NULL,
    caller_id_num VARCHAR(50),
    caller_id_name VARCHAR(100),
    destination VARCHAR(50),
    destination_context VARCHAR(50),
    channel VARCHAR(100),
    destination_channel VARCHAR(100),
    last_application VARCHAR(50),
    last_data VARCHAR(255),
    start_time TIMESTAMP,
    answer_time TIMESTAMP,
    end_time TIMESTAMP,
    duration INTEGER DEFAULT 0,
    billable_seconds INTEGER DEFAULT 0,
    disposition VARCHAR(20),
    ama_flags INTEGER DEFAULT 0,
    account_code VARCHAR(50),
    user_field VARCHAR(255),
    recording_file VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Call quality metrics table
CREATE TABLE call_quality_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID REFERENCES call_records(id) ON DELETE CASCADE,
    jitter_avg DECIMAL(10,3),
    jitter_max DECIMAL(10,3),
    packet_loss DECIMAL(5,2),
    rtt_avg DECIMAL(10,3),
    rtt_max DECIMAL(10,3),
    mos_score DECIMAL(3,2),
    codec VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Conference rooms table
CREATE TABLE conference_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_number VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    pin VARCHAR(20),
    admin_pin VARCHAR(20),
    max_members INTEGER DEFAULT 50,
    record_conference BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Conference participants table
CREATE TABLE conference_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES conference_rooms(id) ON DELETE CASCADE,
    extension_id UUID REFERENCES extensions(id),
    channel VARCHAR(100),
    caller_id_num VARCHAR(50),
    caller_id_name VARCHAR(100),
    is_admin BOOLEAN DEFAULT false,
    is_muted BOOLEAN DEFAULT false,
    joined_at TIMESTAMP DEFAULT NOW(),
    left_at TIMESTAMP
);

-- Voicemail messages table
CREATE TABLE voicemail_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mailbox VARCHAR(20) NOT NULL,
    context VARCHAR(50) DEFAULT 'default',
    message_number INTEGER NOT NULL,
    folder VARCHAR(20) DEFAULT 'INBOX',
    caller_id_num VARCHAR(50),
    caller_id_name VARCHAR(100),
    duration INTEGER,
    flag VARCHAR(20),
    message_date TIMESTAMP DEFAULT NOW(),
    recording_file VARCHAR(500),
    transcription TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Blacklist/Whitelist table
CREATE TABLE call_filters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number_pattern VARCHAR(50) NOT NULL,
    filter_type VARCHAR(10) NOT NULL CHECK (filter_type IN ('blacklist', 'whitelist')),
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- System settings table
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

CREATE INDEX idx_extensions_number ON extensions(extension_number);
CREATE INDEX idx_extensions_user_id ON extensions(user_id);
CREATE INDEX idx_extensions_is_active ON extensions(is_active);

CREATE INDEX idx_sip_trunks_name ON sip_trunks(name);
CREATE INDEX idx_sip_trunks_is_active ON sip_trunks(is_active);

CREATE INDEX idx_call_records_uniqueid ON call_records(uniqueid);
CREATE INDEX idx_call_records_caller_id_num ON call_records(caller_id_num);
CREATE INDEX idx_call_records_destination ON call_records(destination);
CREATE INDEX idx_call_records_start_time ON call_records(start_time);
CREATE INDEX idx_call_records_disposition ON call_records(disposition);

CREATE INDEX idx_call_quality_call_id ON call_quality_metrics(call_id);
CREATE INDEX idx_call_quality_mos_score ON call_quality_metrics(mos_score);

CREATE INDEX idx_conference_rooms_number ON conference_rooms(room_number);
CREATE INDEX idx_conference_rooms_is_active ON conference_rooms(is_active);

CREATE INDEX idx_conference_participants_room_id ON conference_participants(room_id);
CREATE INDEX idx_conference_participants_joined_at ON conference_participants(joined_at);

CREATE INDEX idx_voicemail_mailbox ON voicemail_messages(mailbox);
CREATE INDEX idx_voicemail_folder ON voicemail_messages(folder);
CREATE INDEX idx_voicemail_date ON voicemail_messages(message_date);

CREATE INDEX idx_call_filters_pattern ON call_filters(number_pattern);
CREATE INDEX idx_call_filters_type ON call_filters(filter_type);
CREATE INDEX idx_call_filters_is_active ON call_filters(is_active);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX idx_system_settings_key ON system_settings(setting_key);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_extensions_updated_at BEFORE UPDATE ON extensions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sip_trunks_updated_at BEFORE UPDATE ON sip_trunks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conference_rooms_updated_at BEFORE UPDATE ON conference_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_filters_updated_at BEFORE UPDATE ON call_filters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE VIEW active_extensions AS
SELECT 
    e.*,
    u.first_name || ' ' || u.last_name as user_name,
    u.email as user_email
FROM extensions e
LEFT JOIN users u ON e.user_id = u.id
WHERE e.is_active = true;

CREATE VIEW call_statistics AS
SELECT 
    DATE(start_time) as call_date,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN disposition = 'ANSWERED' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN disposition = 'NO ANSWER' THEN 1 END) as missed_calls,
    COUNT(CASE WHEN disposition = 'BUSY' THEN 1 END) as busy_calls,
    COUNT(CASE WHEN disposition = 'FAILED' THEN 1 END) as failed_calls,
    AVG(duration) as avg_duration,
    SUM(duration) as total_duration
FROM call_records
GROUP BY DATE(start_time)
ORDER BY call_date DESC;

CREATE VIEW conference_activity AS
SELECT 
    cr.room_number,
    cr.name as room_name,
    COUNT(cp.id) as total_participants,
    COUNT(DISTINCT DATE(cp.joined_at)) as active_days,
    AVG(EXTRACT(EPOCH FROM (cp.left_at - cp.joined_at))/60) as avg_duration_minutes
FROM conference_rooms cr
LEFT JOIN conference_participants cp ON cr.id = cp.room_id
WHERE cr.is_active = true
GROUP BY cr.id, cr.room_number, cr.name;

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('company_name', 'Enterprise VoIP', 'Company name displayed in the system'),
('max_call_duration', '7200', 'Maximum call duration in seconds'),
('call_recording_enabled', 'true', 'Enable call recording by default'),
('voicemail_max_duration', '300', 'Maximum voicemail duration in seconds'),
('conference_max_participants', '100', 'Maximum participants per conference'),
('password_min_length', '8', 'Minimum password length'),
('session_timeout', '3600', 'Session timeout in seconds'),
('failed_login_lockout', '5', 'Number of failed attempts before lockout'),
('lockout_duration', '900', 'Account lockout duration in seconds');

-- Create function to generate extension numbers
CREATE OR REPLACE FUNCTION generate_extension_number()
RETURNS VARCHAR(20) AS $$
DECLARE
    new_number VARCHAR(20);
    counter INTEGER := 1000;
BEGIN
    LOOP
        new_number := counter::VARCHAR;
        
        -- Check if this number already exists
        IF NOT EXISTS (SELECT 1 FROM extensions WHERE extension_number = new_number) THEN
            RETURN new_number;
        END IF;
        
        counter := counter + 1;
        
        -- Prevent infinite loop
        IF counter > 9999 THEN
            RAISE EXCEPTION 'No available extension numbers';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old audit logs
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - INTERVAL '1 year';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get call statistics
CREATE OR REPLACE FUNCTION get_call_stats(start_date DATE, end_date DATE)
RETURNS TABLE(
    total_calls BIGINT,
    answered_calls BIGINT,
    missed_calls BIGINT,
    busy_calls BIGINT,
    failed_calls BIGINT,
    avg_duration NUMERIC,
    total_duration BIGINT,
    answer_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN cr.disposition = 'ANSWERED' THEN 1 END) as answered_calls,
        COUNT(CASE WHEN cr.disposition = 'NO ANSWER' THEN 1 END) as missed_calls,
        COUNT(CASE WHEN cr.disposition = 'BUSY' THEN 1 END) as busy_calls,
        COUNT(CASE WHEN cr.disposition = 'FAILED' THEN 1 END) as failed_calls,
        AVG(cr.duration) as avg_duration,
        SUM(cr.duration) as total_duration,
        ROUND((COUNT(CASE WHEN cr.disposition = 'ANSWERED' THEN 1 END)::NUMERIC / COUNT(*) * 100), 2) as answer_rate
    FROM call_records cr
    WHERE DATE(cr.start_time) BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO voip_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO voip_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO voip_user;
