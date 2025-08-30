import { Server } from 'socket.io'
import { createServer } from 'http'

let io: Server | null = null

export const initializeSocket = (server: any) => {
  if (!io) {
    io = new Server(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000'],
        methods: ['GET', 'POST']
      }
    })

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)
      
      // Join admin room for user management updates
      socket.on('join-admin', () => {
        socket.join('admin-room')
        console.log(`Socket ${socket.id} joined admin room`)
      })

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
      })
    })
  }
  return io
}

export { io }