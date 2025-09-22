#!/bin/bash

# Enterprise VoIP Setup Script
# This script sets up the complete VoIP enterprise solution

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root"
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        info "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
        info "Visit: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    # Check if user is in docker group
    if ! groups $USER | grep -q docker; then
        warn "User $USER is not in the docker group. You may need to run Docker commands with sudo."
        info "To add user to docker group: sudo usermod -aG docker $USER"
        info "Then log out and log back in."
    fi
    
    # Check available disk space (minimum 10GB)
    available_space=$(df . | tail -1 | awk '{print $4}')
    required_space=10485760 # 10GB in KB
    
    if [ "$available_space" -lt "$required_space" ]; then
        error "Insufficient disk space. At least 10GB is required."
        exit 1
    fi
    
    # Check available memory (minimum 4GB)
    available_memory=$(free -m | awk 'NR==2{print $2}')
    required_memory=4096 # 4GB in MB
    
    if [ "$available_memory" -lt "$required_memory" ]; then
        warn "Less than 4GB RAM available. Performance may be affected."
    fi
    
    log "System requirements check completed"
}

# Generate secure passwords
generate_passwords() {
    log "Generating secure passwords..."
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        cat > .env << EOF
# Database Configuration
DB_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)

# Asterisk Configuration
ASTERISK_AMI_SECRET=$(openssl rand -base64 32)

# Grafana Configuration
GRAFANA_PASSWORD=admin

# Application URLs
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:8080

# Email Configuration (update with your SMTP settings)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=voip@yourcompany.com

# Company Information
COMPANY_NAME=VoIP Enterprise
COMPANY_DOMAIN=yourcompany.com
EOF
        log "Generated .env file with secure passwords"
    else
        warn ".env file already exists. Skipping password generation."
    fi
}

# Setup SSL certificates
setup_ssl() {
    log "Setting up SSL certificates..."
    
    mkdir -p nginx/ssl
    
    if [ ! -f nginx/ssl/server.crt ]; then
        # Generate self-signed certificate for development
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/server.key \
            -out nginx/ssl/server.crt \
            -subj "/C=US/ST=CA/L=San Francisco/O=VoIP Enterprise/CN=localhost"
        
        log "Generated self-signed SSL certificate"
        warn "For production, replace with a valid SSL certificate"
    else
        info "SSL certificate already exists"
    fi
}

# Setup directories
setup_directories() {
    log "Creating required directories..."
    
    # Create directories with proper permissions
    mkdir -p asterisk/{recordings,voicemail,logs,sounds}
    mkdir -p api/logs
    mkdir -p nginx/logs
    mkdir -p monitoring/{prometheus,grafana/{dashboards,datasources}}
    
    # Set permissions
    chmod 755 asterisk/{recordings,voicemail,logs,sounds}
    chmod 755 api/logs
    chmod 755 nginx/logs
    
    log "Directories created successfully"
}

# Setup monitoring configuration
setup_monitoring() {
    log "Setting up monitoring configuration..."
    
    # Prometheus configuration
    cat > monitoring/prometheus/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'voip-api'
    static_configs:
      - targets: ['api:8080']
    metrics_path: '/metrics'

  - job_name: 'asterisk'
    static_configs:
      - targets: ['asterisk:8088']
    metrics_path: '/metrics'
EOF

    # Grafana datasource configuration
    cat > monitoring/grafana/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
EOF

    log "Monitoring configuration completed"
}

# Build and start services
start_services() {
    log "Building and starting services..."
    
    # Pull latest images
    docker-compose pull
    
    # Build custom images
    docker-compose build --no-cache
    
    # Start services
    docker-compose up -d
    
    log "Services started successfully"
}

# Wait for services to be ready
wait_for_services() {
    log "Waiting for services to be ready..."
    
    # Wait for database
    info "Waiting for database..."
    until docker-compose exec -T database pg_isready -U voip_admin -d voip_enterprise; do
        sleep 2
    done
    
    # Wait for Redis
    info "Waiting for Redis..."
    until docker-compose exec -T redis redis-cli ping; do
        sleep 2
    done
    
    # Wait for API
    info "Waiting for API..."
    until curl -f http://localhost:8080/health > /dev/null 2>&1; do
        sleep 5
    done
    
    # Wait for Web UI
    info "Waiting for Web UI..."
    until curl -f http://localhost:3000 > /dev/null 2>&1; do
        sleep 5
    done
    
    log "All services are ready"
}

# Initialize database
initialize_database() {
    log "Initializing database..."
    
    # Run database migrations
    docker-compose exec api npm run db:migrate
    
    log "Database initialized successfully"
}

# Create admin user
create_admin_user() {
    log "Creating admin user..."
    
    # Create admin user
    docker-compose exec api npm run user:create-admin
    
    log "Admin user created successfully"
}

# Display access information
display_info() {
    log "Setup completed successfully!"
    echo
    info "Access Information:"
    echo "  Web Interface: http://localhost:3000"
    echo "  API Endpoint:  http://localhost:8080"
    echo "  Grafana:       http://localhost:3001 (admin/admin)"
    echo "  Prometheus:    http://localhost:9090"
    echo
    info "Default Login Credentials:"
    echo "  Username: admin"
    echo "  Password: admin123"
    echo
    info "SIP Configuration:"
    echo "  SIP Port:      5060 (UDP/TCP)"
    echo "  SIP TLS Port:  5061 (TCP)"
    echo "  RTP Ports:     10000-10100 (UDP)"
    echo
    warn "Important Security Notes:"
    echo "  1. Change default passwords immediately"
    echo "  2. Configure firewall rules for production"
    echo "  3. Replace self-signed SSL certificates"
    echo "  4. Update SMTP settings in .env file"
    echo
    info "To stop services: docker-compose down"
    info "To view logs: docker-compose logs -f [service_name]"
    echo
}

# Cleanup function
cleanup() {
    if [ $? -ne 0 ]; then
        error "Setup failed. Cleaning up..."
        docker-compose down -v 2>/dev/null || true
    fi
}

# Main setup function
main() {
    echo "========================================"
    echo "    VoIP Enterprise Setup Script"
    echo "========================================"
    echo
    
    trap cleanup EXIT
    
    check_root
    check_requirements
    generate_passwords
    setup_ssl
    setup_directories
    setup_monitoring
    start_services
    wait_for_services
    initialize_database
    create_admin_user
    display_info
    
    trap - EXIT
}

# Run main function
main "$@"
