# Enterprise Secure VoIP Solution

A comprehensive, secure VoIP solution built with Asterisk, featuring advanced security, QoS, and modern web management interface.

## 🚀 Features

### Core Telephony
- **Asterisk PBX** - Industry-standard telephony system
- **SIP Protocol** - Secure SIP communications
- **Multi-codec Support** - G.711, G.722, G.729, Opus
- **Call Routing** - Advanced dialplan configuration
- **Voicemail** - Integrated voicemail system
- **Conference Calling** - Multi-party conferencing
- **Call Recording** - Compliance and quality assurance

### Security Features
- **TLS/SRTP Encryption** - End-to-end call encryption
- **SIP Authentication** - Digest authentication
- **Firewall Integration** - Fail2ban protection
- **Network Segmentation** - VLAN configuration
- **Certificate Management** - SSL/TLS certificates
- **Access Control** - Role-based permissions

### Quality of Service (QoS)
- **Traffic Shaping** - Bandwidth management
- **Packet Prioritization** - DSCP marking
- **Jitter Buffer** - Adaptive jitter control
- **Call Quality Monitoring** - Real-time metrics
- **Network Optimization** - Automatic tuning

### Management Interface
- **Modern Web UI** - React-based admin panel
- **Real-time Dashboard** - Live system monitoring
- **User Management** - Extension provisioning
- **Call Analytics** - Detailed reporting
- **System Configuration** - Web-based setup

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web UI        │    │   API Gateway   │    │   Asterisk PBX  │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (Core)        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Database      │    │   Redis Cache   │    │   File Storage  │
│   (PostgreSQL)  │    │   (Session)     │    │   (Recordings)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📦 Installation

### Prerequisites
- Docker & Docker Compose
- Linux server (Ubuntu 20.04+ recommended)
- Minimum 4GB RAM, 2 CPU cores
- Network access for SIP traffic

### Quick Start
```bash
git clone <repository>
cd VoIP
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### Manual Installation
```bash
# 1. Build and start services
docker-compose up -d

# 2. Initialize database
docker-compose exec api npm run db:migrate

# 3. Create admin user
docker-compose exec api npm run user:create-admin

# 4. Access web interface
open http://localhost:3000
```

## 🔧 Configuration

### Network Configuration
- **SIP Port**: 5060 (UDP/TCP)
- **RTP Ports**: 10000-20000 (UDP)
- **Web Interface**: 3000 (HTTP), 3443 (HTTPS)
- **API**: 8080 (HTTP), 8443 (HTTPS)

### Security Configuration
- Enable TLS for SIP signaling
- Configure SRTP for media encryption
- Set up firewall rules
- Configure fail2ban for intrusion prevention

### QoS Configuration
- DSCP marking for SIP (AF31) and RTP (EF)
- Traffic shaping policies
- Bandwidth allocation
- Jitter buffer optimization

## 📊 Monitoring

### Real-time Metrics
- Active calls
- System resources
- Network quality
- Call quality scores

### Reporting
- Call detail records (CDR)
- Quality metrics
- Usage statistics
- Security events

## 🔒 Security Best Practices

1. **Network Security**
   - Use VLANs for voice traffic
   - Implement firewall rules
   - Enable intrusion detection

2. **Authentication**
   - Strong SIP passwords
   - Certificate-based auth
   - Multi-factor authentication

3. **Encryption**
   - TLS for signaling
   - SRTP for media
   - Database encryption

4. **Monitoring**
   - Security event logging
   - Anomaly detection
   - Regular security audits

## 🛠️ Development

### Project Structure
```
VoIP/
├── asterisk/          # Asterisk configuration
├── web-ui/           # React frontend
├── api/              # Node.js backend
├── database/         # Database schemas
├── docker/           # Docker configurations
├── scripts/          # Deployment scripts
├── monitoring/       # Monitoring configs
└── docs/            # Documentation
```

### Technologies Used
- **Asterisk 20+** - PBX core
- **React 18** - Frontend framework
- **Node.js** - Backend API
- **PostgreSQL** - Database
- **Redis** - Caching & sessions
- **Docker** - Containerization
- **Nginx** - Reverse proxy
- **Prometheus** - Monitoring
- **Grafana** - Dashboards

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Support

For support and documentation, please refer to the docs/ directory or contact the development team.
