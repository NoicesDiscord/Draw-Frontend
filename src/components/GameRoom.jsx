import { useRef, useState, useEffect } from 'react'
import { io } from 'socket.io-client'

export default function GameRoom({ playerInfo }) {
  const canvasRef = useRef(null)
  const contextRef = useRef(null)
  const socketRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)

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

   // To this (make sure to use https://):
    socketRef.current = io('https://skribbl-backend-dgot.onrender.com')

    // 2. Listen for specific drawing events from other players
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

    // Cleanup on disconnect
    return () => socketRef.current.disconnect()
  }, [])

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent
    contextRef.current.beginPath()
    contextRef.current.moveTo(offsetX, offsetY)
    setIsDrawing(true)
    
    // Emit start event
    socketRef.current.emit('start', { x: offsetX, y: offsetY })
  }

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return
    const { offsetX, offsetY } = nativeEvent
    contextRef.current.lineTo(offsetX, offsetY)
    contextRef.current.stroke()
    
    // Emit draw event
    socketRef.current.emit('draw', { x: offsetX, y: offsetY })
  }

  const stopDrawing = () => {
    contextRef.current.closePath()
    setIsDrawing(false)
    
    // Emit stop event
    socketRef.current.emit('stop')
  }

  return (
    <div style={{ display: 'flex', gap: '20px', maxWidth: '1000px', margin: '40px auto' }}>
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
    </div>
  )
}