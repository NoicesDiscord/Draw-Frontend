import { useRef, useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import ChatBox from './ChatBox'

export default function GameRoom({ playerInfo }) {
  const canvasRef = useRef(null)
  const contextRef = useRef(null)
  const socketRef = useRef(null)
  
  const [isDrawing, setIsDrawing] = useState(false)
  const [isSocketReady, setIsSocketReady] = useState(false)
  const [isMyTurn, setIsMyTurn] = useState(false) 
  
  const [gameStatus, setGameStatus] = useState("Waiting for a second player to join...") 
  const [playerList, setPlayerList] = useState([])

  useEffect(() => {
    const canvas = canvasRef.current
    canvas.width = 800
    canvas.height = 600
    const context = canvas.getContext('2d')
    
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

    socketRef.current.emit('join_game', playerInfo.name)

    socketRef.current.on('update_players', (playersArray) => {
      const sortedPlayers = playersArray.sort((a, b) => b.score - a.score)
      setPlayerList(sortedPlayers)
    })

    socketRef.current.on('round_update', (data) => {
      setGameStatus(`✏️ ${data.drawerName} is drawing! Word is ${data.wordLength} letters long.`)
      setIsMyTurn(data.drawerName === playerInfo.name)
    })

    socketRef.current.on('secret_word', (word) => {
      setGameStatus(`🌟 YOUR TURN! The word is: ${word.toUpperCase()}`)
    })

    socketRef.current.on('clear_board', () => {
      clearCanvas()
    })

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

  const getCoordinates = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.nativeEvent.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.nativeEvent.clientY
    
    const rect = canvasRef.current.getBoundingClientRect()
    
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  const startDrawing = (e) => {
    if (!isMyTurn) return 
    if (e.touches && e.cancelable) e.preventDefault() 
    
    const { x, y } = getCoordinates(e)
    contextRef.current.beginPath()
    contextRef.current.moveTo(x, y)
    setIsDrawing(true)
    socketRef.current.emit('start', { x, y })
  }

  const draw = (e) => {
    if (!isDrawing || !isMyTurn) return 
    if (e.touches && e.cancelable) e.preventDefault()

    const { x, y } = getCoordinates(e)
    contextRef.current.lineTo(x, y)
    contextRef.current.stroke()
    socketRef.current.emit('draw', { x, y })
  }

  const stopDrawing = () => {
    if (!isMyTurn) return 
    contextRef.current.closePath()
    setIsDrawing(false)
    socketRef.current.emit('stop')
  }

  return (
    <>
      <style>{`
        body, html {
          margin: 0;
          padding: 0;
          background-color: #121212;
          color: #e0e0e0;
          font-family: sans-serif;
          width: 100vw;
          height: 100vh;
          max-width: 100%;
          overflow: hidden; 
        }
        * {
          box-sizing: border-box;
        }
        .game-layout {
          display: grid;
          grid-template-columns: 200px 1fr 300px;
          grid-template-rows: 100%;
          gap: 20px;
          padding: 20px;
          width: 100%; 
          height: 100dvh; 
          max-width: 1600px;
          margin: 0 auto;
        }
        .sidebar-left, .center-canvas, .sidebar-right {
          display: flex;
          flex-direction: column;
          min-height: 0;
          min-width: 0; 
        }
        .sidebar-left { grid-column: 1; }
        .center-canvas { grid-column: 2; }
        .sidebar-right { grid-column: 3; }
        
        .canvas-wrapper {
          flex-grow: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #1e1e1e;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #333;
          min-height: 0;
          min-width: 0;
          position: relative; /* CRITICAL: Enables floating text overlays inside the canvas box */
        }
        .game-canvas {
          background-color: #ffffff;
          touch-action: none;
          width: 100%;
          height: auto;
          aspect-ratio: 4/3; 
          border-radius: 4px;
          box-shadow: 0px 4px 10px rgba(0,0,0,0.5);
          border: 2px solid #333;
        }
        
        /* Floating Text Overlays */
        .waiting-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #999; /* Grey text so it looks like it's printed on the board */
          font-size: 24px;
          font-weight: bold;
          text-align: center;
          pointer-events: none; /* Clicks pass right through it */
          width: 90%;
        }
        .floating-status {
          position: absolute;
          top: 15px;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(55, 0, 179, 0.85); /* Semi-transparent purple */
          color: white;
          padding: 8px 20px;
          border-radius: 20px;
          font-weight: bold;
          pointer-events: none;
          font-size: 16px;
          white-space: nowrap;
          z-index: 10;
          box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }

        /* MOBILE FULL-SCREEN OPTIMIZATIONS */
        @media (max-width: 900px) {
          .game-layout {
            grid-template-columns: 35fr 65fr;
            grid-template-rows: auto 1fr; 
            /* Premium full-screen feel: tiny 4px gaps and padding pushed tight to the edges */
            gap: 4px;
            padding: 4px;
          }
          .center-canvas {
            grid-column: 1 / span 2; 
            grid-row: 1;
          }
          .sidebar-left {
            grid-column: 1;
            grid-row: 2; 
          }
          .sidebar-right {
            grid-column: 2;
            grid-row: 2; 
          }
          .canvas-wrapper {
            padding: 0 !important;
            background-color: transparent !important;
            border: none !important;
          }
          .game-canvas {
            border-radius: 6px !important;
            border: 1px solid #555 !important;
          }
          .waiting-text {
            font-size: 18px; /* Scale down for mobile */
          }
          .floating-status {
            font-size: 13px;
            padding: 5px 12px;
            top: 5px; /* Push tighter to the top on mobile */
          }
        }
      `}</style>

      <div className="game-layout">
        
        {/* Leaderboard */}
        <div className="sidebar-left">
          <div style={{ backgroundColor: '#1e1e1e', padding: '10px', borderRadius: '8px', border: '1px solid #333', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px', color: '#bb86fc', textAlign: 'center', fontSize: '15px' }}>Scores</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: 'auto', flexGrow: 1 }}>
              {playerList.map((p, index) => (
                <li 
                  key={index} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    borderBottom: '1px solid #333',
                    color: p.name === playerInfo.name ? '#03dac6' : '#e0e0e0',
                    fontWeight: p.name === playerInfo.name ? 'bold' : 'normal',
                    fontSize: '13px'
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '5px' }}>
                    {index + 1}. {p.name}
                  </span>
                  <span>{p.score}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Drawing Board */}
        <div className="center-canvas">
          <div className="canvas-wrapper">
            
            {/* The Floating Overlays directly "on" the canvas */}
            {gameStatus === "Waiting for a second player to join..." ? (
              <div className="waiting-text">
                Waiting for a second player to join...
              </div>
            ) : (
              <div className="floating-status">
                {gameStatus}
              </div>
            )}
            
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="game-canvas"
              style={{ cursor: isMyTurn ? 'crosshair' : 'not-allowed' }}
            />
          </div>
        </div>

        {/* Chat Box */}
        <div className="sidebar-right">
          {isSocketReady && (
            <ChatBox socket={socketRef.current} playerInfo={playerInfo} />
          )}
        </div>

      </div>
    </>
  )
}