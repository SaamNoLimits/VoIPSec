#!/bin/bash

# Enterprise VoIP Deployment Script
# This script deploys the VoIP system to production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_ENV=${1:-production}
BACKUP_DIR="/opt/voip/backups"
DEPLOY_DIR="/opt/voip"
DOCKER_COMPOSE_FILE="docker-compose.yml"

echo -e "${BLUE}=== Enterprise VoIP Deployment Script ===${NC}"
echo -e "${BLUE}Environment: ${DEPLOY_ENV}${NC}"
echo -e "${BLUE}Deploy Directory: ${DEPLOY_DIR}${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Pre-deployment checks
print_status "Running pre-deployment checks..."

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    print_error "This script should not be run as root for security reasons"
    exit 1
fi

# Check required commands
REQUIRED_COMMANDS=("docker" "docker-compose" "git" "curl")
for cmd in "${REQUIRED_COMMANDS[@]}"; do
    if ! command_exists "$cmd"; then
        print_error "Required command '$cmd' not found. Please install it first."
        exit 1
    fi
done

# Check Docker daemon
if ! docker info >/dev/null 2>&1; then
    print_error "Docker daemon is not running"
    exit 1
fi

print_status "Pre-deployment checks passed"

# Create backup directory
print_status "Creating backup directory..."
sudo mkdir -p "$BACKUP_DIR"
sudo chown $(whoami):$(whoami) "$BACKUP_DIR"

# Backup existing deployment if it exists
if [ -d "$DEPLOY_DIR" ]; then
    print_status "Creating backup of existing deployment..."
    BACKUP_NAME="voip-backup-$(date +%Y%m%d-%H%M%S)"
    sudo cp -r "$DEPLOY_DIR" "$BACKUP_DIR/$BACKUP_NAME"
    print_status "Backup created: $BACKUP_DIR/$BACKUP_NAME"
fi

# Create deployment directory
print_status "Creating deployment directory..."
sudo mkdir -p "$DEPLOY_DIR"
sudo chown $(whoami):$(whoami) "$DEPLOY_DIR"

# Copy application files
print_status "Copying application files..."
rsync -av --exclude='.git' --exclude='node_modules' --exclude='*.log' . "$DEPLOY_DIR/"

# Set up environment file
print_status "Setting up environment configuration..."
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    if [ -f "$DEPLOY_DIR/.env.example" ]; then
        cp "$DEPLOY_DIR/.env.example" "$DEPLOY_DIR/.env"
        print_warning "Created .env from .env.example. Please review and update the configuration."
    else
        print_error ".env file not found and no .env.example available"
        exit 1
    fi
fi

# Create necessary directories
print_status "Creating necessary directories..."
sudo mkdir -p "$DEPLOY_DIR/data/postgres"
sudo mkdir -p "$DEPLOY_DIR/data/redis"
sudo mkdir -p "$DEPLOY_DIR/data/asterisk/spool"
sudo mkdir -p "$DEPLOY_DIR/data/asterisk/logs"
sudo mkdir -p "$DEPLOY_DIR/data/asterisk/recordings"
sudo mkdir -p "$DEPLOY_DIR/data/grafana"
sudo mkdir -p "$DEPLOY_DIR/data/prometheus"
sudo mkdir -p "$DEPLOY_DIR/ssl"
sudo mkdir -p "$DEPLOY_DIR/logs"

# Set permissions
print_status "Setting directory permissions..."
sudo chown -R $(whoami):$(whoami) "$DEPLOY_DIR/data"
sudo chown -R $(whoami):$(whoami) "$DEPLOY_DIR/ssl"
sudo chown -R $(whoami):$(whoami) "$DEPLOY_DIR/logs"

# Generate SSL certificates if they don't exist
print_status "Checking SSL certificates..."
if [ ! -f "$DEPLOY_DIR/ssl/cert.pem" ] || [ ! -f "$DEPLOY_DIR/ssl/key.pem" ]; then
    print_status "Generating self-signed SSL certificates..."
    openssl req -x509 -newkey rsa:4096 -keyout "$DEPLOY_DIR/ssl/key.pem" -out "$DEPLOY_DIR/ssl/cert.pem" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    print_warning "Self-signed certificates generated. Consider using proper certificates for production."
fi

# Pull latest Docker images
print_status "Pulling Docker images..."
cd "$DEPLOY_DIR"
docker-compose pull

# Stop existing services
if docker-compose ps | grep -q "Up"; then
    print_status "Stopping existing services..."
    docker-compose down
fi

# Build and start services
print_status "Building and starting services..."
docker-compose up -d --build

# Wait for services to be ready
print_status "Waiting for services to start..."
sleep 30

# Check service health
print_status "Checking service health..."
SERVICES=("postgres" "redis" "api" "web-ui" "nginx" "prometheus" "grafana")
FAILED_SERVICES=()

for service in "${SERVICES[@]}"; do
    if docker-compose ps "$service" | grep -q "Up"; then
        print_status "✓ $service is running"
    else
        print_error "✗ $service failed to start"
        FAILED_SERVICES+=("$service")
    fi
done

# Show service logs for failed services
if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
    print_error "Some services failed to start:"
    for service in "${FAILED_SERVICES[@]}"; do
        echo -e "${RED}=== $service logs ===${NC}"
        docker-compose logs --tail=20 "$service"
        echo ""
    done
    exit 1
fi

# Initialize database if needed
print_status "Checking database initialization..."
if docker-compose exec -T postgres psql -U postgres -d voip -c "SELECT 1 FROM users LIMIT 1;" >/dev/null 2>&1; then
    print_status "Database already initialized"
else
    print_status "Initializing database..."
    docker-compose exec -T postgres psql -U postgres -d voip -f /docker-entrypoint-initdb.d/schema.sql
    docker-compose exec -T postgres psql -U postgres -d voip -f /docker-entrypoint-initdb.d/seed.sql
    print_status "Database initialized successfully"
fi

# Test API endpoints
print_status "Testing API endpoints..."
API_URL="http://localhost:3000/api"

# Test health endpoint
if curl -s "$API_URL/health" >/dev/null; then
    print_status "✓ API health check passed"
else
    print_error "✗ API health check failed"
fi

# Show deployment summary
echo ""
echo -e "${GREEN}=== Deployment Summary ===${NC}"
echo -e "${GREEN}✓ Deployment completed successfully${NC}"
echo -e "${BLUE}Web Interface: http://localhost:3000${NC}"
echo -e "${BLUE}API Endpoint: http://localhost:3000/api${NC}"
echo -e "${BLUE}Grafana Dashboard: http://localhost:3001${NC}"
echo -e "${BLUE}Prometheus: http://localhost:9090${NC}"
echo ""
echo -e "${YELLOW}Default Credentials:${NC}"
echo -e "${YELLOW}  Admin: admin@company.com / admin123${NC}"
echo -e "${YELLOW}  Grafana: admin / admin${NC}"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo -e "${BLUE}  View logs: docker-compose logs -f [service]${NC}"
echo -e "${BLUE}  Restart service: docker-compose restart [service]${NC}"
echo -e "${BLUE}  Stop all: docker-compose down${NC}"
echo -e "${BLUE}  Update: git pull && docker-compose up -d --build${NC}"
echo ""

# Create systemd service for auto-start
if command_exists systemctl; then
    print_status "Creating systemd service..."
    sudo tee /etc/systemd/system/voip-system.service > /dev/null <<EOF
[Unit]
Description=Enterprise VoIP System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$DEPLOY_DIR
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable voip-system.service
    print_status "Systemd service created and enabled"
fi

print_status "Deployment completed successfully!"
echo -e "${GREEN}🎉 Your Enterprise VoIP system is now running!${NC}"
