import { useRef, useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import ChatBox from './ChatBox'

export default function GameRoom({ playerInfo }) {
  const canvasRef = useRef(null)
  const contextRef = useRef(null)
  const socketRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isSocketReady, setIsSocketReady] = useState(false)
  
  // NEW: State to show whose turn it is
  const [gameStatus, setGameStatus] = useState("Waiting for a second player to join...") 

  useEffect(() => {
    const canvas = canvasRef.current
    canvas.width = 800
    canvas.height = 600
    const context = canvas.getContext('2d')
    
    // Helper to wipe the board white
    const clearCanvas = () => {
      context.fillStyle = 'white'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    clearCanvas()
    
    context.lineCap = 'round'
    context.strokeStyle = 'black'
    context.lineWidth = 5
    contextRef.current = context

    // --- PASTE YOUR RENDER URL HERE ---
    socketRef.current = io('https://skribbl-backend-dgot.onrender.com') 
    setIsSocketReady(true)

    // 1. Tell the server we arrived!
    socketRef.current.emit('join_game', playerInfo.name)

    // 2. Listen for game updates
    socketRef.current.on('round_update', (data) => {
      setGameStatus(`✏️ ${data.drawerName} is drawing! Word is ${data.wordLength} letters long.`)
    })

    socketRef.current.on('secret_word', (word) => {
      setGameStatus(`🌟 YOUR TURN! The word is: ${word.toUpperCase()}`)
    })

    socketRef.current.on('clear_board', () => {
      clearCanvas()
    })

    // 3. Drawing Listeners
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
  }, [playerInfo.name])

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
        <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Drawing Board</h2>
          
          {/* NEW: The Game Status Bar */}
          <div style={{ backgroundColor: '#FFD54F', padding: '8px 15px', borderRadius: '20px', fontWeight: 'bold' }}>
            {gameStatus}
          </div>
          
        </div>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{ border: '2px solid #333', borderRadius: '8px', cursor: 'crosshair' }}
        />
      </div>

      {isSocketReady && (
        <ChatBox socket={socketRef.current} playerInfo={playerInfo} />
      )}
    </div>
  )
}