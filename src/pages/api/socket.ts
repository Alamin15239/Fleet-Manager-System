import { NextApiRequest } from 'next'
import { Server as ServerIO } from 'socket.io'
import { Server as NetServer } from 'http'
import { NextApiResponseServerIO } from '../../../lib/socket'

export default function SocketHandler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (res.socket.server.io) {
    console.log('Socket is already running')
  } else {
    console.log('Socket is initializing')
    const io = new ServerIO(res.socket.server)
    res.socket.server.io = io

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
      })
    })
  }
  res.end()
}