import { useRef, useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import ChatBox from './ChatBox' // <-- 1. We imported the ChatBox here at the top

export default function GameRoom({ playerInfo }) {
  const canvasRef = useRef(null)
  const contextRef = useRef(null)
  const socketRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isSocketReady, setIsSocketReady] = useState(false) // <-- 1. Add this new state

  useEffect(() => {
    const canvas = canvasRef.current
    canvas.width = 800
    canvas.height = 600
    const context = canvas.getContext('2d')
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.lineCap = 'round'
    context.strokeStyle = 'black'
    context.lineWidth = 5
    contextRef.current = context

    // --- PASTE YOUR RENDER URL HERE ---
    socketRef.current = io('https://skribbl-backend-dgot.onrender.com') 
    setIsSocketReady(true) // <-- 2. Add this right below the connection

    socketRef.current.on('start', (data) => {
      contextRef.current.beginPath()
      contextRef.current.moveTo(data.x, data.y)
    })

    socketRef.current.on('draw', (data) => {
      contextRef.current.lineTo(data.x, data.y)
      contextRef.current.stroke()
    })

    socketRef.current.on('stop', () => {
      contextRef.current.closePath()
    })

    return () => socketRef.current.disconnect()
  }, [])

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent
    contextRef.current.beginPath()
    contextRef.current.moveTo(offsetX, offsetY)
    setIsDrawing(true)
    socketRef.current.emit('start', { x: offsetX, y: offsetY })
  }

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return
    const { offsetX, offsetY } = nativeEvent
    contextRef.current.lineTo(offsetX, offsetY)
    contextRef.current.stroke()
    socketRef.current.emit('draw', { x: offsetX, y: offsetY })
  }

  const stopDrawing = () => {
    contextRef.current.closePath()
    setIsDrawing(false)
    socketRef.current.emit('stop')
  }

  return (
    <div style={{ display: 'flex', gap: '20px', maxWidth: '1200px', margin: '40px auto' }}>
      
      <div style={{ width: '200px', padding: '20px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
        <h3>Players</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ fontWeight: 'bold', color: '#4CAF50' }}>{playerInfo.name}</li>
        </ul>
      </div>

      <div>
        <h2 style={{ marginBottom: '10px' }}>Drawing Board</h2>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{ border: '2px solid #333', borderRadius: '8px', cursor: 'crosshair' }}
        />
      </div>

      {/* 3. Only render the ChatBox if the socket is actually ready! */}
      {isSocketReady && (
        <ChatBox socket={socketRef.current} playerInfo={playerInfo} />
      )}

    </div>
  )
}