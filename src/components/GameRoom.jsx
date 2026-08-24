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

    // --- YOUR LIVE RENDER URL ---
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

  // Helper function to get exact coordinates, factoring in screen resize scaling
  const getCoordinates = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.nativeEvent.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.nativeEvent.clientY
    
    const rect = canvasRef.current.getBoundingClientRect()
    
    // Scale ensures drawing is accurate even when canvas is shrunk on mobile
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  const startDrawing = (e) => {
    // Prevent scrolling while drawing on mobile
    if (e.touches && e.cancelable) e.preventDefault() 
    
    const { x, y } = getCoordinates(e)

    contextRef.current.beginPath()
    contextRef.current.moveTo(x, y)
    setIsDrawing(true)
    socketRef.current.emit('start', { x, y })
  }

  const draw = (e) => {
    if (!isDrawing) return
    if (e.touches && e.cancelable) e.preventDefault()

    const { x, y } = getCoordinates(e)

    contextRef.current.lineTo(x, y)
    contextRef.current.stroke()
    socketRef.current.emit('draw', { x, y })
  }

  const stopDrawing = () => {
    contextRef.current.closePath()
    setIsDrawing(false)
    socketRef.current.emit('stop')
  }

  return (
    // Dark Mode Background Container
    <div style={{ backgroundColor: '#121212', color: '#e0e0e0', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* Responsive Flex Container */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        gap: '20px', 
        maxWidth: '1200px', 
        margin: '0 auto',
        justifyContent: 'center'
      }}>
        
        {/* Leaderboard Sidebar */}
        <div style={{ 
          width: '100%', 
          maxWidth: '250px', 
          padding: '20px', 
          backgroundColor: '#1e1e1e', 
          borderRadius: '8px',
          border: '1px solid #333'
        }}>
          <h3 style={{ marginTop: 0, color: '#bb86fc' }}>Leaderboard</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {playerList.map((p, index) => (
              <li 
                key={index} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid #333',
                  color: p.name === playerInfo.name ? '#03dac6' : '#e0e0e0',
                  fontWeight: p.name === playerInfo.name ? 'bold' : 'normal'
                }}
              >
                <span>{index + 1}. {p.name}</span>
                <span style={{ fontWeight: 'bold' }}>{p.score} pts</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Drawing Board Area */}
        <div style={{ flex: '1 1 500px', minWidth: '0' }}> 
          <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2 style={{ margin: 0 }}>Drawing Board</h2>
            
            <div style={{ backgroundColor: '#3700b3', color: '#fff', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', textAlign: 'center' }}>
              {gameStatus}
            </div>
            
          </div>
          
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ 
              border: '2px solid #333', 
              borderRadius: '8px', 
              cursor: 'crosshair', 
              backgroundColor: '#ffffff',
              touchAction: 'none', 
              width: '100%', 
              height: 'auto',
              aspectRatio: '4/3' 
            }}
          />
        </div>

        {/* Chat Box */}
        <div style={{ width: '100%', maxWidth: '300px' }}>
          {isSocketReady && (
            <ChatBox socket={socketRef.current} playerInfo={playerInfo} />
          )}
        </div>

      </div>
    </div>
  )
}