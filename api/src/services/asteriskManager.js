const AsteriskManager = require('asterisk-manager');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'asterisk-manager' }
});

class AsteriskManagerService {
  constructor() {
    this.ami = null;
    this.io = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
  }

  async initialize(io) {
    this.io = io;
    
    this.ami = new AsteriskManager({
      port: 5038,
      host: process.env.ASTERISK_HOST || 'asterisk',
      username: process.env.ASTERISK_AMI_USER || 'admin',
      password: process.env.ASTERISK_AMI_SECRET || 'AMI_Secret_2024!',
      events: 'on'
    });

    this.setupEventHandlers();
    await this.connect();
  }

  setupEventHandlers() {
    this.ami.on('connect', () => {
      logger.info('Connected to Asterisk Manager Interface');
      this.connected = true;
      this.reconnectAttempts = 0;
      
      // Emit connection status to web clients
      this.io.to('system').emit('asterisk_status', { connected: true });
    });

    this.ami.on('disconnect', () => {
      logger.warn('Disconnected from Asterisk Manager Interface');
      this.connected = false;
      
      this.io.to('system').emit('asterisk_status', { connected: false });
      
      // Attempt reconnection
      this.attemptReconnect();
    });

    this.ami.on('error', (error) => {
      logger.error('Asterisk Manager Interface error:', error);
      this.connected = false;
    });

    // Call events
    this.ami.on('newchannel', (event) => {
      logger.info('New channel created:', event);
      this.io.to('calls').emit('call_event', {
        type: 'new_channel',
        data: event
      });
    });

    this.ami.on('newstate', (event) => {
      this.io.to('calls').emit('call_event', {
        type: 'state_change',
        data: event
      });
    });

    this.ami.on('dial', (event) => {
      logger.info('Dial event:', event);
      this.io.to('calls').emit('call_event', {
        type: 'dial',
        data: event
      });
    });

    this.ami.on('bridge', (event) => {
      logger.info('Bridge event:', event);
      this.io.to('calls').emit('call_event', {
        type: 'bridge',
        data: event
      });
    });

    this.ami.on('hangup', (event) => {
      logger.info('Hangup event:', event);
      this.io.to('calls').emit('call_event', {
        type: 'hangup',
        data: event
      });
    });

    // Registration events
    this.ami.on('peerentry', (event) => {
      this.io.to('system').emit('peer_status', {
        type: 'peer_entry',
        data: event
      });
    });

    this.ami.on('peerstatus', (event) => {
      logger.info('Peer status change:', event);
      this.io.to('system').emit('peer_status', {
        type: 'status_change',
        data: event
      });
    });

    // Conference events
    this.ami.on('confbridgestart', (event) => {
      logger.info('Conference started:', event);
      this.io.to('calls').emit('conference_event', {
        type: 'started',
        data: event
      });
    });

    this.ami.on('confbridgeend', (event) => {
      logger.info('Conference ended:', event);
      this.io.to('calls').emit('conference_event', {
        type: 'ended',
        data: event
      });
    });

    this.ami.on('confbridgejoin', (event) => {
      logger.info('Conference join:', event);
      this.io.to('calls').emit('conference_event', {
        type: 'join',
        data: event
      });
    });

    this.ami.on('confbridgeleave', (event) => {
      logger.info('Conference leave:', event);
      this.io.to('calls').emit('conference_event', {
        type: 'leave',
        data: event
      });
    });
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ami.connect((error) => {
        if (error) {
          logger.error('Failed to connect to Asterisk AMI:', error);
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    logger.info(`Attempting to reconnect to Asterisk AMI (attempt ${this.reconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        logger.error('Reconnection failed:', error);
        this.attemptReconnect();
      }
    }, this.reconnectDelay);
  }

  // API methods
  async getChannels() {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to Asterisk AMI'));
        return;
      }

      this.ami.action('CoreShowChannels', {}, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async getPeers() {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to Asterisk AMI'));
        return;
      }

      this.ami.action('SIPpeers', {}, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async originateCall(channel, context, exten, priority, callerid) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to Asterisk AMI'));
        return;
      }

      this.ami.action('Originate', {
        Channel: channel,
        Context: context,
        Exten: exten,
        Priority: priority,
        CallerID: callerid,
        Timeout: 30000
      }, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async hangupCall(channel) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to Asterisk AMI'));
        return;
      }

      this.ami.action('Hangup', {
        Channel: channel
      }, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async getStatus() {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to Asterisk AMI'));
        return;
      }

      this.ami.action('CoreStatus', {}, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async reloadModule(module) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to Asterisk AMI'));
        return;
      }

      this.ami.action('ModuleReload', {
        Module: module
      }, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to Asterisk AMI'));
        return;
      }

      this.ami.action('Command', {
        Command: command
      }, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  isConnected() {
    return this.connected;
  }
}

module.exports = new AsteriskManagerService();
