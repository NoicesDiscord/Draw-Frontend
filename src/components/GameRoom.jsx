import { useRef, useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import ChatBox from './ChatBox'

export default function GameRoom({ playerInfo }) {
  const canvasRef = useRef(null)
  const contextRef = useRef(null)
  const socketRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isSocketReady, setIsSocketReady] = useState(false)
  
  // Game State
  const [gameStatus, setGameStatus] = useState("Waiting for a second player to join...") 
  const [playerList, setPlayerList] = useState([])

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

    // --- YOUR RENDER URL ---
    socketRef.current = io('https://skribbl-backend-dgot.onrender.com') 
    setIsSocketReady(true)

    // 1. Tell the server we arrived
    socketRef.current.emit('join_game', playerInfo.name)

    // 2. Listen for leaderboard updates
    socketRef.current.on('update_players', (playersArray) => {
      const sortedPlayers = playersArray.sort((a, b) => b.score - a.score)
      setPlayerList(sortedPlayers)
    })

    // 3. Listen for game updates
    socketRef.current.on('round_update', (data) => {
      setGameStatus(`✏️ ${data.drawerName} is drawing! Word is ${data.wordLength} letters long.`)
    })

    socketRef.current.on('secret_word', (word) => {
      setGameStatus(`🌟 YOUR TURN! The word is: ${word.toUpperCase()}`)
    })

    socketRef.current.on('clear_board', () => {
      clearCanvas()
    })

    // 4. Drawing Listeners
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
      
      {/* 1. Leaderboard Sidebar */}
      <div style={{ width: '200px', padding: '20px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
        <h3>Leaderboard</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {playerList.map((p, index) => (
            <li 
              key={index} 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid #ddd',
                color: p.name === playerInfo.name ? '#4CAF50' : '#333',
                fontWeight: p.name === playerInfo.name ? 'bold' : 'normal'
              }}
            >
              <span>{index + 1}. {p.name}</span>
              <span style={{ fontWeight: 'bold' }}>{p.score} pts</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 2. Drawing Board */}
      <div>
        <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Drawing Board</h2>
          
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

      {/* 3. Chat Box */}
      {isSocketReady && (
        <ChatBox socket={socketRef.current} playerInfo={playerInfo} />
      )}

    </div>
  )
}