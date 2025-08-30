import { Server } from 'socket.io';

interface UserUpdateEvent {
  event: 'created' | 'updated' | 'deleted';
  data: any;
  timestamp: string;
}

export const setupSocket = (io: Server) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Join admin room for user management updates
    socket.on('join-admin', () => {
      socket.join('admin-room');
      console.log(`Socket ${socket.id} joined admin room`);
    });

    // Handle messages
    socket.on('message', (msg: { text: string; senderId: string }) => {
      // Echo: broadcast message only the client who send the message
      socket.emit('message', {
        text: `Echo: ${msg.text}`,
        senderId: 'system',
        timestamp: new Date().toISOString(),
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });

    // Send welcome message
    socket.emit('message', {
      text: 'Welcome to WebSocket Echo Server!',
      senderId: 'system',
      timestamp: new Date().toISOString(),
    });
  });
};

// Helper function to broadcast user updates
export const broadcastUserUpdate = (io: Server, event: string, data: any) => {
  io.to('admin-room').emit('user-update', {
    event,
    data,
    timestamp: new Date().toISOString()
  });
};