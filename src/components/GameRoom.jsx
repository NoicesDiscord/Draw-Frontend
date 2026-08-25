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
  const [timeLeft, setTimeLeft] = useState(0) // <-- ADD THIS LINE
  const [winner, setWinner] = useState(null)
  const [currentDrawer, setCurrentDrawer] = useState("") // NEW: Tracks who has the pencil

  // --- NEW: Brush Tools State ---
  const [brushColor, setBrushColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(5)
  const [isBucketMode, setIsBucketMode] = useState(false) 
  
  // NEW: Fast 1-click colors for the toolbar
  const presetColors = ['#000000', '#808080', '#ff0000', '#ff8800', '#ffcc00', '#00cc00', '#0088ff', '#9900cc', '#ff66cc', '#8b4513']

  // NEW: Load the round-start sound into memory
  const roundSound = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'))

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
      // Creates a string like "_ _ _ _ _" dynamically based on the length
      const hints = Array(data.wordLength).fill('_').join(' ')
      setGameStatus(`✏️ ${data.drawerName} is drawing! ${hints}`)
      setIsMyTurn(data.drawerName === playerInfo.name)
      setCurrentDrawer(data.drawerName) // NEW: Save their name for the leaderboard!
      setWinner(null) // Hides the celebration screen when a new round begins!
      
      // NEW: Play the "new round" sound!
      roundSound.current.volume = 0.5
      roundSound.current.currentTime = 0
      roundSound.current.play().catch(err => console.log("Browser blocked audio:", err))
    })
    socketRef.current.on('game_over', (winnerName) => {
      setWinner(winnerName)
      setGameStatus(`🏆 ${winnerName} won the game!`)
    })

    socketRef.current.on('secret_word', (word) => {
      // Spaces out the letters so it looks stylish and matches the blank spaces
      const spacedWord = word.toUpperCase().split('').join(' ')
      setGameStatus(`🌟 YOUR TURN! Draw: ${spacedWord}`)
    })

    socketRef.current.on('clear_board', () => {
      clearCanvas()
    })

    // FAILSAFE: Ensure the timer is actually listening to the server ticks!
    socketRef.current.on('timer_update', (time) => {
      setTimeLeft(time)
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

    // NEW: Listen for the other player using the paint bucket
    socketRef.current.on('fill', (data) => {
      applyFill(contextRef.current, canvasRef.current, data.x, data.y, data.color)
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

  // --- NEW: HTML5 Canvas Scanline Flood Fill Algorithm ---
  const applyFill = (ctx, canvas, x, y, colorHex) => {
    const hexToRgb = (h) => [parseInt(h.slice(1,3), 16), parseInt(h.slice(3,5), 16), parseInt(h.slice(5,7), 16), 255]
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imgData.data
    const [fR, fG, fB, fA] = hexToRgb(colorHex)
    const startPos = (Math.floor(y) * canvas.width + Math.floor(x)) * 4
    const sR = data[startPos], sG = data[startPos+1], sB = data[startPos+2], sA = data[startPos+3]
    if (sR === fR && sG === fG && sB === fB) return // Color is already the same
    
    const match = (p) => data[p]===sR && data[p+1]===sG && data[p+2]===sB && data[p+3]===sA
    const color = (p) => { data[p]=fR; data[p+1]=fG; data[p+2]=fB; data[p+3]=fA }
    
    const stack = [[Math.floor(x), Math.floor(y)]]
    const w = canvas.width, h = canvas.height
    
    while(stack.length) {
      let [cx, cy] = stack.pop()
      let p = (cy * w + cx) * 4
      while(cy >= 0 && match(p)) { cy--; p -= w*4 }
      p += w*4; cy++
      let rL = false, rR = false
      while(cy < h && match(p)) {
        color(p)
        if (cx > 0) {
          if (match(p - 4)) { if (!rL) { stack.push([cx - 1, cy]); rL = true } }
          else if (rL) rL = false
        }
        if (cx < w - 1) {
          if (match(p + 4)) { if (!rR) { stack.push([cx + 1, cy]); rR = true } }
          else if (rR) rR = false
        }
        cy++; p += w*4
      }
    }
    ctx.putImageData(imgData, 0, 0)
  }

  // --- UPDATED: Apply local colors and send them to the server ---
  const startDrawing = (e) => {
    if (!isMyTurn) return 
    if (e.touches && e.cancelable) e.preventDefault() 
    
    const { x, y } = getCoordinates(e)

    // NEW: If bucket mode is ON, fill the canvas instead of drawing a line!
    if (isBucketMode) {
      applyFill(contextRef.current, canvasRef.current, x, y, brushColor)
      socketRef.current.emit('fill', { x, y, color: brushColor })
      return
    }
    
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

  // NEW: Tells the server to wipe the board
  const handleClearBoard = () => {
    if (!isMyTurn) return
    socketRef.current.emit('clear_board')
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
                  <span style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '5px' }}>
                    {index + 1}. {p.name}
                  </span>
                  
                  {/* NEW: The pulsing clock next to the active drawer! */}
                  {p.name === currentDrawer && timeLeft > 0 && (
                    <span style={{ color: '#FFD54F', fontSize: '13px', fontWeight: 'bold', marginRight: 'auto', marginLeft: '8px' }}>
                      ⏱ {timeLeft}s
                    </span>
                  )}

                  <span>{p.score}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Drawing Board */}
        <div className="center-canvas">
          <div className="canvas-wrapper">
            
            {/* NEW: Permanent Digital Clock overlay at the top-left */}
            <div style={{
              position: 'absolute', top: '15px', left: '15px',
              backgroundColor: 'rgba(255, 255, 255, 0.7)', padding: '2px 8px', borderRadius: '6px',
              color: '#000', fontSize: '24px', fontWeight: '900', 
              fontFamily: 'monospace', zIndex: 50, pointerEvents: 'none', border: '2px solid #000'
            }}>
              {timeLeft > 0 ? `0:${timeLeft < 10 ? `0${timeLeft}` : timeLeft}` : "0:00"}
            </div>

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
              {/* NEW: Custom Picker + Fast Presets + Tools */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', maxWidth: '100%' }}>
                
                {/* 1. Custom Color Wheel (The fallback) */}
                <input 
                  type="color" 
                  value={brushColor}
                  onChange={(e) => { setBrushColor(e.target.value); setIsBucketMode(false); }}
                  style={{ width: '32px', height: '32px', padding: '0', border: 'none', cursor: 'pointer', background: 'transparent', flexShrink: 0 }}
                  title="Custom Color"
                />

                <div style={{ width: '2px', height: '20px', backgroundColor: '#555' }} />

                {/* 2. Fast 1-Click Colors (Swipeable on mobile!) */}
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', maxWidth: '40vw', paddingBottom: '4px', alignItems: 'center' }}>
                  {presetColors.map(color => (
                    <button
                      key={color}
                      onClick={() => { setBrushColor(color); setIsBucketMode(false); }}
                      style={{
                        width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, cursor: 'pointer', padding: 0,
                        backgroundColor: color,
                        border: brushColor === color ? '2px solid #fff' : '1px solid #444',
                        boxShadow: brushColor === color ? '0 0 5px rgba(255,255,255,0.8)' : 'none'
                      }}
                      title="Quick Color"
                    />
                  ))}
                </div>

                <div style={{ width: '2px', height: '20px', backgroundColor: '#555' }} />

                {/* 3. Bucket and Eraser */}
                <button 
                  onClick={() => setIsBucketMode(!isBucketMode)}
                  style={{ background: isBucketMode ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '6px', cursor: 'pointer', fontSize: '18px', padding: '4px', flexShrink: 0 }}
                  title="Paint Bucket (Fill)"
                >
                  🪣
                </button>

                <button 
                  onClick={() => { setBrushColor('#ffffff'); setIsBucketMode(false); }}
                  style={{ background: '#ffffff', border: '1px solid #666', borderRadius: '6px', cursor: 'pointer', fontSize: '18px', padding: '4px', flexShrink: 0 }}
                  title="Eraser"
                >
                  🧽
                </button>
                
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

              <div style={{ width: '2px', height: '20px', backgroundColor: '#555', margin: '0 4px' }} />
              
              {/* NEW: Trash Can / Clear Board Button */}
              <button 
                onClick={handleClearBoard}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '0 4px', transform: 'translateY(-1px)' }}
                title="Clear Board"
              >
                🗑️
              </button>
            </div>
            
          </div>
        </div>

       {/* Chat Box */}
        <div className="sidebar-right">
          {isSocketReady && (
            <ChatBox socket={socketRef.current} playerInfo={playerInfo} />
          )}
        </div>

        {/* NEW: Cinematic Game Over Overlay goes HERE, outside the sidebar div! */}
        {winner && (
          <div style={{
            position: 'fixed', /* Note: I changed this to 'fixed' to guarantee it covers the whole screen! */
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)', zIndex: 100,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <h1 style={{ color: '#FFD54F', fontSize: 'clamp(40px, 8vw, 70px)', margin: '0 0 20px 0', textAlign: 'center', textShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
              🎉 GAME OVER 🎉
            </h1>
            <h2 style={{ color: '#fff', fontSize: 'clamp(24px, 5vw, 40px)', margin: '0 0 40px 0', textAlign: 'center' }}>
              <span style={{ color: '#03dac6' }}>{winner}</span> takes the crown!
            </h2>
            <p style={{ color: '#bb86fc', fontSize: '18px', animation: 'pulse 2s infinite' }}>
              Starting a new match in a few seconds...
            </p>
          </div>
        )}

      </div>
    </>
  )
}