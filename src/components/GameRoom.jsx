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

  // --- NEW: Brush Tools State ---
  const [brushColor, setBrushColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(5)
  const colors = ['#000000', '#f44336', '#4caf50', '#2196f3', '#ffeb3b', '#ff9800', '#9c27b0', '#ffffff']

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

    // --- UPDATED: Apply incoming network colors/sizes before drawing ---
    socketRef.current.on('start', (data) => {
      contextRef.current.strokeStyle = data.color || '#000000'
      contextRef.current.lineWidth = data.size || 5
      contextRef.current.beginPath()
      contextRef.current.moveTo(data.x, data.y)
    })
    socketRef.current.on('draw', (data) => {
      contextRef.current.strokeStyle = data.color || '#000000'
      contextRef.current.lineWidth = data.size || 5
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

  // --- UPDATED: Apply local colors and send them to the server ---
  const startDrawing = (e) => {
    if (!isMyTurn) return 
    if (e.touches && e.cancelable) e.preventDefault() 
    
    const { x, y } = getCoordinates(e)
    
    contextRef.current.strokeStyle = brushColor
    contextRef.current.lineWidth = brushSize
    contextRef.current.beginPath()
    contextRef.current.moveTo(x, y)
    
    setIsDrawing(true)
    socketRef.current.emit('start', { x, y, color: brushColor, size: brushSize })
  }

  const draw = (e) => {
    if (!isDrawing || !isMyTurn) return 
    if (e.touches && e.cancelable) e.preventDefault()

    const { x, y } = getCoordinates(e)
    
    contextRef.current.strokeStyle = brushColor
    contextRef.current.lineWidth = brushSize
    contextRef.current.lineTo(x, y)
    contextRef.current.stroke()
    
    socketRef.current.emit('draw', { x, y, color: brushColor, size: brushSize })
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
          margin: 0; padding: 0; background-color: #121212; color: #e0e0e0; font-family: sans-serif;
          position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; overflow: hidden; touch-action: none; 
        }
        * { box-sizing: border-box; }
        
        .game-layout {
          display: grid; grid-template-columns: 200px 1fr 300px; grid-template-rows: 100%; gap: 20px;
          padding: 20px; width: 100%; height: 100%; max-width: 1600px; margin: 0 auto;
        }
        .sidebar-left, .center-canvas, .sidebar-right {
          display: flex; flex-direction: column; min-height: 0; min-width: 0; 
        }
        .sidebar-left { grid-column: 1; }
        .center-canvas { grid-column: 2; }
        .sidebar-right { grid-column: 3; }
        
        .canvas-wrapper {
          flex-grow: 1; display: flex; align-items: center; justify-content: center; background-color: #1e1e1e;
          padding: 10px; border-radius: 8px; border: 1px solid #333; min-height: 0; min-width: 0; position: relative; 
        }
        .game-canvas {
          background-color: #ffffff; touch-action: none; width: 100%; height: auto;
          aspect-ratio: 4/3; border-radius: 4px; box-shadow: 0px 4px 10px rgba(0,0,0,0.5); border: 2px solid #333;
        }
        
        .waiting-text {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          color: #999; font-size: 24px; font-weight: bold; text-align: center; pointer-events: none; width: 90%;
        }
        .floating-status {
          position: absolute; top: 15px; left: 50%; transform: translateX(-50%);
          background-color: rgba(55, 0, 179, 0.85); color: white; padding: 8px 20px; border-radius: 20px;
          font-weight: bold; pointer-events: none; font-size: 16px; white-space: nowrap; z-index: 10; box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }

        /* NEW: Floating Toolbar Styles */
        .toolbar {
          position: absolute;
          bottom: 15px;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(20, 20, 20, 0.85);
          padding: 10px 15px;
          border-radius: 30px;
          display: flex;
          gap: 12px;
          align-items: center;
          border: 1px solid #444;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          transition: opacity 0.3s ease;
        }
        .color-btn {
          width: 24px; height: 24px; border-radius: 50%; cursor: pointer; transition: transform 0.1s;
        }
        .color-btn:hover { transform: scale(1.15); }
        .color-btn.eraser {
          background: linear-gradient(135deg, #fff 40%, #ff0000 45%, #ff0000 55%, #fff 60%);
        }

        @media (max-width: 900px) {
          .game-layout {
            grid-template-columns: 30fr 70fr; grid-template-rows: 60fr 40fr; gap: 0px; padding: 0px;
          }
          .center-canvas { grid-column: 1 / span 2; grid-row: 1; border-bottom: 2px solid #222; }
          .sidebar-left { grid-column: 1; grid-row: 2; }
          .sidebar-right { grid-column: 2; grid-row: 2; }
          
          .canvas-wrapper { padding: 0 !important; background-color: transparent !important; border: none !important; border-radius: 0 !important; }
          .game-canvas { border-radius: 0 !important; border: none !important; aspect-ratio: auto !important; height: 100% !important; }
          
          .sidebar-left > div, .sidebar-right > div { border: none !important; border-radius: 0 !important; }
          .sidebar-left > div { border-right: 2px solid #222 !important; }

          .waiting-text { font-size: 20px; }
          .floating-status { font-size: 15px; padding: 6px 14px; top: 15px; }
          
          .toolbar { bottom: 10px; padding: 8px 12px; gap: 8px; }
          .color-btn { width: 20px; height: 20px; }
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
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #333', color: p.name === playerInfo.name ? '#03dac6' : '#e0e0e0', fontWeight: p.name === playerInfo.name ? 'bold' : 'normal', fontSize: '13px' }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '5px' }}>{index + 1}. {p.name}</span>
                  <span>{p.score}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Drawing Board */}
        <div className="center-canvas">
          <div className="canvas-wrapper">
            
            {gameStatus === "Waiting for a second player to join..." ? (
              <div className="waiting-text">Waiting for a second player to join...</div>
            ) : (
              <div className="floating-status">{gameStatus}</div>
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

            {/* NEW: Floating Tool Bar overlay */}
            <div 
              className="toolbar" 
              style={{ 
                opacity: isMyTurn ? 1 : 0.3, // Fades out if it's not your turn
                pointerEvents: isMyTurn ? 'auto' : 'none' // Locks clicks if it's not your turn
              }}
            >
              {/* Color Swatches */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {colors.map(color => (
                  <button
                    key={color}
                    onClick={() => setBrushColor(color)}
                    className={color === '#ffffff' ? 'color-btn eraser' : 'color-btn'}
                    style={{
                      backgroundColor: color,
                      border: brushColor === color ? '2px solid #fff' : '1px solid #666',
                    }}
                    title={color === '#ffffff' ? 'Eraser' : 'Color'}
                  />
                ))}
              </div>
              
              <div style={{ width: '2px', height: '20px', backgroundColor: '#555', margin: '0 4px' }} />
              
              {/* Brush Size Slider */}
              <input 
                type="range" 
                min="2" 
                max="25" 
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                style={{ width: '70px' }}
              />
            </div>
            
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