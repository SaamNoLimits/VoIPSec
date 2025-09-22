#!/bin/bash

# Wait for database to be ready
echo "Waiting for database to be ready..."
while ! nc -z database 5432; do
  sleep 1
done
echo "Database is ready!"

# Set proper permissions
sudo chown -R asterisk:asterisk /var/lib/asterisk
sudo chown -R asterisk:asterisk /var/spool/asterisk
sudo chown -R asterisk:asterisk /var/log/asterisk
sudo chown -R asterisk:asterisk /etc/asterisk

# Generate certificates if they don't exist
if [ ! -f /etc/asterisk/keys/asterisk.pem ]; then
    echo "Generating SSL certificates..."
    mkdir -p /etc/asterisk/keys
    openssl req -new -x509 -days 365 -nodes -out /etc/asterisk/keys/asterisk.pem -keyout /etc/asterisk/keys/asterisk.key -subj "/C=US/ST=CA/L=San Francisco/O=VoIP Enterprise/CN=asterisk"
    chown asterisk:asterisk /etc/asterisk/keys/*
fi

# Start Asterisk
echo "Starting Asterisk..."
exec "$@"
