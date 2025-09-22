import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useSnackbar } from 'notistack';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [callEvents, setCallEvents] = useState([]);
  const [systemStatus, setSystemStatus] = useState({});
  const { user, token } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (user && token) {
      // Initialize socket connection
      const newSocket = io(process.env.REACT_APP_WS_URL || 'ws://localhost:8080', {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling']
      });

      // Connection event handlers
      newSocket.on('connect', () => {
        console.log('Socket connected');
        setConnected(true);
        enqueueSnackbar('Connected to server', { variant: 'success' });
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setConnected(false);
        enqueueSnackbar('Disconnected from server', { variant: 'warning' });
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setConnected(false);
        enqueueSnackbar('Connection error', { variant: 'error' });
      });

      // Call event handlers
      newSocket.on('call_event', (data) => {
        console.log('Call event received:', data);
        setCallEvents(prev => [...prev.slice(-49), { ...data, timestamp: new Date() }]);
        
        // Show notifications for important call events
        switch (data.type) {
          case 'new_channel':
            if (user.role === 'admin' || user.role === 'manager') {
              enqueueSnackbar(`New call: ${data.data.calleridnum || 'Unknown'}`, { 
                variant: 'info',
                autoHideDuration: 3000
              });
            }
            break;
          case 'hangup':
            // Only show for failed calls or if user is admin
            if (data.data.cause !== 'Normal Clearing' && (user.role === 'admin' || user.role === 'manager')) {
              enqueueSnackbar(`Call ended: ${data.data.cause}`, { 
                variant: 'warning',
                autoHideDuration: 3000
              });
            }
            break;
          default:
            break;
        }
      });

      // System status handlers
      newSocket.on('asterisk_status', (data) => {
        console.log('Asterisk status:', data);
        setSystemStatus(prev => ({
          ...prev,
          asterisk: data
        }));

        if (data.connected === false) {
          enqueueSnackbar('Asterisk PBX disconnected', { variant: 'error' });
        } else if (data.connected === true) {
          enqueueSnackbar('Asterisk PBX connected', { variant: 'success' });
        }
      });

      newSocket.on('peer_status', (data) => {
        console.log('Peer status:', data);
        
        if (data.type === 'status_change') {
          const { peer, peerstatus } = data.data;
          if (peerstatus === 'Unreachable') {
            enqueueSnackbar(`Extension ${peer} is offline`, { 
              variant: 'warning',
              autoHideDuration: 5000
            });
          } else if (peerstatus === 'Reachable') {
            enqueueSnackbar(`Extension ${peer} is online`, { 
              variant: 'success',
              autoHideDuration: 3000
            });
          }
        }
      });

      // Conference event handlers
      newSocket.on('conference_event', (data) => {
        console.log('Conference event:', data);
        
        switch (data.type) {
          case 'started':
            enqueueSnackbar(`Conference ${data.data.conference} started`, { 
              variant: 'info',
              autoHideDuration: 3000
            });
            break;
          case 'ended':
            enqueueSnackbar(`Conference ${data.data.conference} ended`, { 
              variant: 'info',
              autoHideDuration: 3000
            });
            break;
          case 'join':
            if (user.role === 'admin' || user.role === 'manager') {
              enqueueSnackbar(`${data.data.calleridname || data.data.calleridnum} joined conference`, { 
                variant: 'info',
                autoHideDuration: 2000
              });
            }
            break;
          case 'leave':
            if (user.role === 'admin' || user.role === 'manager') {
              enqueueSnackbar(`${data.data.calleridname || data.data.calleridnum} left conference`, { 
                variant: 'info',
                autoHideDuration: 2000
              });
            }
            break;
          default:
            break;
        }
      });

      // Security event handlers
      newSocket.on('security_event', (data) => {
        console.log('Security event:', data);
        
        if (user.role === 'admin') {
          enqueueSnackbar(`Security alert: ${data.message}`, { 
            variant: 'error',
            autoHideDuration: 10000
          });
        }
      });

      setSocket(newSocket);

      // Cleanup on unmount
      return () => {
        newSocket.close();
        setSocket(null);
        setConnected(false);
      };
    }
  }, [user, token, enqueueSnackbar]);

  // Socket utility functions
  const subscribeToCallEvents = () => {
    if (socket) {
      socket.emit('subscribe_calls');
    }
  };

  const subscribeToSystemEvents = () => {
    if (socket && (user?.role === 'admin' || user?.role === 'manager')) {
      socket.emit('subscribe_system');
    }
  };

  const unsubscribeFromCallEvents = () => {
    if (socket) {
      socket.emit('unsubscribe_calls');
    }
  };

  const unsubscribeFromSystemEvents = () => {
    if (socket) {
      socket.emit('unsubscribe_system');
    }
  };

  const emitCallAction = (action, data) => {
    if (socket && connected) {
      socket.emit('call_action', { action, data });
    }
  };

  const clearCallEvents = () => {
    setCallEvents([]);
  };

  const value = {
    socket,
    connected,
    callEvents,
    systemStatus,
    subscribeToCallEvents,
    subscribeToSystemEvents,
    unsubscribeFromCallEvents,
    unsubscribeFromSystemEvents,
    emitCallAction,
    clearCallEvents
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
