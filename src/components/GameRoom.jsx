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
          /* FIX: Changed 100vw to 100% to prevent right-side bleeding */
          width: 100%; 
          height: 100dvh; 
          max-width: 1600px;
          margin: 0 auto;
        }
        .sidebar-left {
          grid-column: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .center-canvas {
          grid-column: 2;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .sidebar-right {
          grid-column: 3;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        
        @media (max-width: 900px) {
          .game-layout {
            /* FIX: Switched from % to fr units so it subtracts the 10px gap perfectly */
            grid-template-columns: 35fr 65fr;
            grid-template-rows: 55fr 45fr; 
            gap: 10px;
            padding: 10px;
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
          .status-bar {
            padding: 6px 10px !important;
            font-size: 14px !important;
            margin-bottom: 5px !important;
          }
        }
      `}</style>

      <div className="game-layout">
        
        {/* Leaderboard */}
        <div className="sidebar-left">
          <div style={{ backgroundColor: '#1e1e1e', padding: '10px', borderRadius: '8px', border: '1px solid #333', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginTop: 0, marginBottom: '10px', color: '#bb86fc', textAlign: 'center', fontSize: '16px' }}>Scores</h3>
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
          <div className="status-bar" style={{ backgroundColor: '#3700b3', color: '#fff', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', textAlign: 'center', width: '100%', fontSize: '18px', marginBottom: '10px', flexShrink: 0 }}>
            {gameStatus}
          </div>
          
          <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e1e1e', padding: '10px', borderRadius: '8px', border: '1px solid #333', minHeight: 0 }}>
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
                cursor: isMyTurn ? 'crosshair' : 'not-allowed', 
                backgroundColor: '#ffffff',
                touchAction: 'none', 
                maxWidth: '100%', 
                maxHeight: '100%',
                aspectRatio: '4/3', 
                borderRadius: '4px',
                boxShadow: '0px 4px 10px rgba(0,0,0,0.5)'
              }}
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