-- Enterprise VoIP Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    department VARCHAR(100),
    phone_number VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extensions table
CREATE TABLE extensions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    extension_number VARCHAR(10) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    display_name VARCHAR(100) NOT NULL,
    secret VARCHAR(255) NOT NULL,
    context VARCHAR(50) DEFAULT 'internal',
    mailbox VARCHAR(20),
    call_limit INTEGER DEFAULT 5,
    codec_allow TEXT DEFAULT 'ulaw,alaw,g722',
    codec_disallow TEXT DEFAULT 'all',
    nat VARCHAR(20) DEFAULT 'force_rport,comedia',
    qualify BOOLEAN DEFAULT true,
    encryption BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SIP trunks table
CREATE TABLE sip_trunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    host VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    secret VARCHAR(255),
    from_user VARCHAR(100),
    from_domain VARCHAR(255),
    context VARCHAR(50) DEFAULT 'from-trunk',
    insecure VARCHAR(50) DEFAULT 'port,invite',
    qualify BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Call detail records (CDR)
CREATE TABLE call_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uniqueid VARCHAR(50) NOT NULL,
    caller_id_num VARCHAR(50),
    caller_id_name VARCHAR(100),
    destination VARCHAR(50),
    context VARCHAR(50),
    channel VARCHAR(100),
    destination_channel VARCHAR(100),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    answer_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- in seconds
    billable_seconds INTEGER,
    disposition VARCHAR(20), -- ANSWERED, NO ANSWER, BUSY, FAILED, etc.
    account_code VARCHAR(50),
    recording_file VARCHAR(255),
    cost DECIMAL(10,4) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conference rooms
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conference participants (active sessions)
CREATE TABLE conference_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES conference_rooms(id) ON DELETE CASCADE,
    extension_id UUID REFERENCES extensions(id),
    channel VARCHAR(100),
    caller_id_num VARCHAR(50),
    caller_id_name VARCHAR(100),
    is_admin BOOLEAN DEFAULT false,
    is_muted BOOLEAN DEFAULT false,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE
);

-- System settings
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string', -- string, number, boolean, json
    description TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Call quality metrics
CREATE TABLE call_quality_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID REFERENCES call_records(id),
    channel VARCHAR(100),
    jitter_avg DECIMAL(8,3),
    jitter_max DECIMAL(8,3),
    packet_loss DECIMAL(5,2),
    rtt_avg DECIMAL(8,3),
    rtt_max DECIMAL(8,3),
    mos_score DECIMAL(3,2), -- Mean Opinion Score
    codec VARCHAR(20),
    sample_rate INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Voicemail messages
CREATE TABLE voicemail_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mailbox VARCHAR(20) NOT NULL,
    message_number INTEGER NOT NULL,
    caller_id_num VARCHAR(50),
    caller_id_name VARCHAR(100),
    duration INTEGER,
    file_path VARCHAR(255),
    is_read BOOLEAN DEFAULT false,
    is_urgent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(mailbox, message_number)
);

-- Blacklist/Whitelist for security
CREATE TABLE call_filters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filter_type VARCHAR(10) CHECK (filter_type IN ('blacklist', 'whitelist')),
    number_pattern VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_call_records_start_time ON call_records(start_time);
CREATE INDEX idx_call_records_caller_id ON call_records(caller_id_num);
CREATE INDEX idx_call_records_destination ON call_records(destination);
CREATE INDEX idx_call_records_uniqueid ON call_records(uniqueid);
CREATE INDEX idx_extensions_number ON extensions(extension_number);
CREATE INDEX idx_extensions_user_id ON extensions(user_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_conference_participants_room_id ON conference_participants(room_id);

-- Triggers for updated_at timestamps
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

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
