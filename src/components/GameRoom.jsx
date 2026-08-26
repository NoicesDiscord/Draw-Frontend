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
  const [currentDrawer, setCurrentDrawer] = useState("") 
  const [secretWord, setSecretWord] = useState("") 
  const [currentRound, setCurrentRound] = useState(1) // NEW: Tracks the current round
  const [showPlayerModal, setShowPlayerModal] = useState(false)
  const [roomId, setRoomId] = useState(null)
  const [isHost, setIsHost] = useState(false)
  const [waitingForHost, setWaitingForHost] = useState(false)
  const [maxRounds, setMaxRounds] = useState(3)
  const [hintLevel, setHintLevel] = useState(2) // NEW: Catches the host's setting
  const [isPrivate, setIsPrivate] = useState(false)
  const [isChoosing, setIsChoosing] = useState(false)
  const [wordChoices, setWordChoices] = useState([])

  // --- NEW: Brush Tools State ---
  const [brushColor, setBrushColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(5)
  const [isBucketMode, setIsBucketMode] = useState(false) 
  
  // NEW: 25 Essential Colors (Now with Theme Colors and extra vibrance!)
  const presetColors = [
    '#000000', '#333333', '#777777', '#cccccc', '#ffffff',
    '#ff0000', '#ff6600', '#ffcc00', '#ffff00', '#99cc00', 
    '#00cc00', '#006600', '#00ffff', '#00ccff', '#0000ff', 
    '#000066', '#9900cc', '#ff00ff', '#ff99cc', '#8b4513',
    // 5 NEW COLORS:
    '#bb86fc', // Theme Purple
    '#03dac6', // Theme Teal
    '#ff1493', // Deep Pink
    '#32cd32', // Lime Green
    '#8a2be2'  // Blue Violet
  ]

  // --- NEW: Undo / Redo Memory Stacks ---
  const undoStack = useRef([])
  const redoStack = useRef([])

  const saveState = () => {
    if (!canvasRef.current || !contextRef.current) return
    const data = contextRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
    undoStack.current.push(data)
    if (undoStack.current.length > 30) undoStack.current.shift() // Cap at 30 steps so browsers don't crash!
  }

  const handleUndo = () => {
    if (undoStack.current.length > 1) {
      redoStack.current.push(undoStack.current.pop()) // Move current state to Redo
      const previousState = undoStack.current[undoStack.current.length - 1] // Get the state before it
      contextRef.current.putImageData(previousState, 0, 0) // Draw it!
    }
  }

  const handleRedo = () => {
    if (redoStack.current.length > 0) {
      const nextState = redoStack.current.pop() // Grab from Redo
      undoStack.current.push(nextState) // Put back into Undo
      contextRef.current.putImageData(nextState, 0, 0) // Draw it!
    }
  }

  // FIX: Using local sound files
  const dingSound = useRef(new Audio('/sounds/success.mp3'))
  const winSound = useRef(new Audio('/sounds/win.mp3'))
  
  // NEW: Add a sound for clicking the word buttons
  const selectSound = useRef(new Audio('/sounds/select.mp3'))

  // --- NEW: Smart Progressive Hint Generator (20%-33% Intervals & 50% Cap) ---
  const getDynamicHint = () => {
    if (!secretWord) return ""

    // 1. Calculate allowed hints per word (strictly max 50% per word)
    let allowedIndices = []
    let wordStart = 0
    const words = secretWord.split(' ')
    
    for (let w of words) {
      const maxForWord = Math.floor(w.length / 2) // e.g. "water" (5) = 2, "melons" (6) = 3
      
      // Deterministically pick which letters to reveal for this specific word
      if (maxForWord > 0) allowedIndices.push(wordStart + 0)                  // 1st letter
      if (maxForWord > 1) allowedIndices.push(wordStart + w.length - 1)       // Last letter
      if (maxForWord > 2) allowedIndices.push(wordStart + Math.floor(w.length / 2)) // Middle
      if (maxForWord > 3) allowedIndices.push(wordStart + 1)                  // 2nd letter
      if (maxForWord > 4) allowedIndices.push(wordStart + w.length - 2)       // 2nd to last
      
      wordStart += w.length + 1 // Advance the index past this word AND the space
    }

    // 2. Hard cap the total allowed hints to a maximum of 5 across the entire phrase
    allowedIndices = allowedIndices.slice(0, 5)

    // 3. Distribute hints evenly across the 60-second timer
    const maxHints = allowedIndices.length
    let revealCount = 0
    
    // NEW: Dynamically calculate allowed hints based on the Host's slider!
    let dynamicMaxHints = 0;
    if (secretWord.length > 2) {
      if (hintLevel == 1) dynamicMaxHints = Math.floor(secretWord.length / 4); // Low
      if (hintLevel == 2) dynamicMaxHints = Math.floor(secretWord.length / 3); // Normal
      if (hintLevel == 3) dynamicMaxHints = Math.floor(secretWord.length / 2); // High
      
      // Safety lock: Never reveal the entire word (always keep at least 2 letters hidden)
      if (dynamicMaxHints >= secretWord.length - 1) dynamicMaxHints = secretWord.length - 2;
      if (dynamicMaxHints < 0) dynamicMaxHints = 0;
    }

    if (dynamicMaxHints > 0 && timeLeft > 0 && timeLeft <= 120) {
      const timeElapsed = 120 - Math.min(timeLeft, 120);
      revealCount = Math.floor((timeElapsed / 120) * (dynamicMaxHints + 1));
      revealCount = Math.min(dynamicMaxHints, revealCount); 
    }

    const revealed = new Set(allowedIndices.slice(0, revealCount))

    // 4. Render the final output WITH tiny word length numbers!
    const displayElements = []
    let currentIndex = 0
    
    words.forEach((w, wordIdx) => {
      let wordChars = []
      for (let i = 0; i < w.length; i++) {
        if (revealed.has(currentIndex)) {
          wordChars.push(w[i].toUpperCase())
        } else {
          wordChars.push('_')
        }
        currentIndex++
      }
      currentIndex++ // Skip the space so the index perfectly matches the math above!
      
      displayElements.push(
        <span key={wordIdx} style={{ whiteSpace: 'nowrap' }}>
          {wordChars.join(' ')}
          <span style={{ fontSize: '11px', verticalAlign: 'super', marginLeft: '4px', opacity: 0.8 }}>
            {w.length}
          </span>
        </span>
      )
    })

    return (
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 20px' }}>
        {displayElements}
      </span>
    )
  }

  

  // --- NEW: Prevent accidental back-swipes and refreshes on mobile! ---
  useEffect(() => {
    // 1. Push a dummy state to trap the first back-swipe
    window.history.pushState(null, null, window.location.href)
    
    const handleBackSwipe = () => {
      // If they swipe back, push another dummy state immediately to keep them in the game
      window.history.pushState(null, null, window.location.href)
    }
    window.addEventListener('popstate', handleBackSwipe)

    // 2. Trigger the browser's native "Leave Site?" warning popup if they try to close the tab
    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('popstate', handleBackSwipe)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    canvas.width = 800
    canvas.height = 600
    const context = canvas.getContext('2d')
    
    const clearCanvas = () => {
      context.fillStyle = 'white'
      context.fillRect(0, 0, canvas.width, canvas.height)
      undoStack.current = [] // Wipe history on a clear board
      redoStack.current = []
      undoStack.current.push(context.getImageData(0, 0, canvas.width, canvas.height)) // Save pure white board as Step 1
    }
    clearCanvas()
    
    context.lineCap = 'round'
    contextRef.current = context

    // --- YOUR LIVE RENDER URL ---
    socketRef.current = io('https://skribbl-backend-dgot.onrender.com') 
    setIsSocketReady(true)

    socketRef.current.emit('join_game', playerInfo) // FIX: Sends the whole object containing settings!
    // NEW: Catch room settings when joining!
    socketRef.current.on('room_joined', (data) => {
      setRoomId(data.roomId)
      setIsHost(data.isHost)
      setIsPrivate(data.isPrivate)
      setMaxRounds(data.maxRounds)
      if (data.hintLevel) setHintLevel(data.hintLevel) // NEW
    })

    // NEW: Put everyone in the lobby in a waiting state until the host clicks start
    socketRef.current.on('waiting_for_host', () => {
      setWaitingForHost(true)
      setCurrentDrawer("")
      setSecretWord("")
      setIsMyTurn(false)
      setTimeLeft(0)
      setWinner(null)
      setIsChoosing(false)
      clearCanvas()
    })
    socketRef.current.on('update_players', (playersArray) => {
      const sortedPlayers = playersArray.sort((a, b) => b.score - a.score)
      setPlayerList(sortedPlayers)
    })

    socketRef.current.on('round_update', (data) => {
      setIsMyTurn(data.drawerName === playerInfo.playerName)
      setCurrentDrawer(data.drawerName) 
      setWinner(null) 
      if (data.maxRounds) setMaxRounds(data.maxRounds)
      if (data.hintLevel) setHintLevel(data.hintLevel) 
      
      setIsChoosing(false) 
      setWaitingForHost(false)
      setSecretWord(data.word || "")
      setTimeLeft(120) 
      setCurrentRound(data.currentRound || 1); if (data.maxRounds) setMaxRounds(data.maxRounds); 

      // NEW: Play the selection sound for the guessers so they know the drawing phase started!
      if (data.drawerName !== playerInfo.playerName) {
        const clone = selectSound.current.cloneNode()
        clone.volume = 0.6
        clone.play().catch(err => console.log("Audio blocked:", err))
      }
    })

    // NEW: Catch room errors (like trying to join a full or expired room)
    socketRef.current.on('room_error', (errorMessage) => {
      alert(errorMessage); // Pops up "This room is currently full."
      window.location.href = '/'; // Bounces them back to the clean login screen!
    })

    socketRef.current.on('kicked_from_server', () => {
      alert("You have been kicked from the lobby by a vote.");
      window.location.href = '/'; // FIX: Also sends kicked players back to the main menu instead of just reloading!
    })
    socketRef.current.on('game_over', (winnerName) => {
      setWinner(winnerName)
      
      // NEW: Play the epic celebration sound!
      winSound.current.volume = 0.7
      winSound.current.currentTime = 0
      winSound.current.play().catch(err => console.log("Audio blocked:", err))
    })
    // NEW: The Choosing Phase!
    socketRef.current.on('choosing_word', (data) => {
      setWaitingForHost(false)
      setIsChoosing(true)
      setCurrentDrawer(data.drawerName)
      setIsMyTurn(data.drawerName === playerInfo.playerName)
      setSecretWord("") // Hide the old word
      setWinner(null)
    })

    socketRef.current.on('your_word_choices', (words) => {
      setWordChoices(words)
    })
    // FIX 1: Handle everyone leaving the lobby (Solo player fix)
    socketRef.current.on('waiting_for_players', () => {
      setCurrentDrawer("")
      setSecretWord("")
      setIsMyTurn(false)
      setTimeLeft(0)
      setWinner(null)
      clearCanvas()
    })

    // FIX 2: Handle mobile sleep / background network drops
    socketRef.current.on('disconnect', (reason) => {
      // If the drop wasn't intentional (e.g. phone went to sleep, wifi dropped) -> reload!
      if (reason === 'ping timeout' || reason === 'transport close' || reason === 'transport error') {
        window.location.reload()
      }
    })

    // Backup Mobile Sleep Fix: If they tab back in and the socket is dead, reload.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && socketRef.current && !socketRef.current.connected) {
        window.location.reload()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Disabled: We handle this dynamically in the HTML now!
    socketRef.current.on('secret_word', () => {})

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
      // FIX: Instantly draw a dot for single taps from the network!
      contextRef.current.lineTo(data.x, data.y)
      contextRef.current.stroke()
    })
    socketRef.current.on('draw', (data) => {
      contextRef.current.strokeStyle = data.color || '#000000'
      contextRef.current.lineWidth = data.size || 5
      contextRef.current.lineTo(data.x, data.y)
      contextRef.current.stroke()
    })
    // NEW: If the server asks, the drawer takes a snapshot of their canvas!
    socketRef.current.on('request_canvas_state', (targetId) => {
      if (canvasRef.current) {
        // toDataURL() instantly turns the whole drawing into a lightweight string
        const canvasData = canvasRef.current.toDataURL()
        socketRef.current.emit('send_canvas_state', { targetId, canvasData })
      }
    })

    // NEW: The late joiner receives the snapshot and pastes it on their empty canvas!
    socketRef.current.on('load_canvas_state', (canvasData) => {
      if (canvasData && contextRef.current && canvasRef.current) {
        const img = new Image()
        img.onload = () => {
          contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
          contextRef.current.drawImage(img, 0, 0)
        }
        img.src = canvasData
      }
    })
    socketRef.current.on('stop', () => {
      contextRef.current.closePath()
      saveState() // Guessers save the line!
      redoStack.current = []
    })

    // NEW: Listen for the other player using the paint bucket
    socketRef.current.on('fill', (data) => {
      applyFill(contextRef.current, canvasRef.current, data.x, data.y, data.color)
    })

    // NEW: Listen for Undo/Redo from the Drawer
    socketRef.current.on('undo', () => handleUndo())
    socketRef.current.on('redo', () => handleRedo())

    // NEW: Play ding sound when the server confirms a correct guess!
    socketRef.current.on('correct_guess', () => {
      dingSound.current.volume = 0.6
      dingSound.current.currentTime = 0
      dingSound.current.play().catch(err => console.log("Audio blocked:", err))
    })     

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      socketRef.current.disconnect()
    }
  }, [playerInfo.playerName])

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
    
    // NEW: Save the canvas state immediately after filling a shape!
    undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    if (undoStack.current.length > 30) undoStack.current.shift()
    redoStack.current = []
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
    
    // FIX: Instantly draw a dot locally in case they lift their finger without dragging!
    contextRef.current.lineTo(x, y)
    contextRef.current.stroke()
    
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
    if (!isDrawing) return // FIX: Ignore ghost events! Only save state if we were actually drawing a line!
    
    contextRef.current.closePath()
    setIsDrawing(false)
    socketRef.current.emit('stop')
    
    // Drawer saves state immediately after lifting their mouse/finger
    saveState()
    redoStack.current = []
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
        
        /* FIX: Forces React's hidden root container to stretch all the way to the bottom! */
        #root { width: 100%; height: 100%; }
        
        .game-layout {
          display: grid; grid-template-columns: 280px 1fr 300px; grid-template-rows: 100%; gap: 20px;
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
          position: absolute; top: 15px; left: 110px; /* FIX: Anchored safely to the right of the clock! */
          background-color: rgba(55, 0, 179, 0.85); color: white; padding: 8px 20px; border-radius: 20px;
          font-weight: bold; pointer-events: none; font-size: 16px; 
          white-space: pre-wrap; text-align: left; width: max-content; max-width: calc(100% - 130px); line-height: 1.4; 
          z-index: 10; box-shadow: 0 4px 6px rgba(0,0,0,0.3);
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
            grid-template-columns: 45fr 55fr; grid-template-rows: 60fr 40fr; gap: 0px; padding: 0px;
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
          <div 
            onClick={() => setShowPlayerModal(true)}
            title="Click to manage lobby players"
            style={{ backgroundColor: '#1e1e1e', padding: '10px', borderRadius: '8px', border: '1px solid #333', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.2s' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '10px', borderBottom: '1px solid #333', paddingBottom: '12px', position: 'relative' }}>
              <h3 style={{ margin: '0 0 6px 0', color: '#bb86fc', fontSize: '16px', letterSpacing: '1px' }}>SCORES</h3>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#aaa', backgroundColor: '#333', padding: '3px 8px', borderRadius: '12px' }}>
                  ROUND {currentRound} OF {maxRounds}
                </span>
                {isPrivate && (
                  <button onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/?room=${roomId}`);
                    alert("Invite link copied!");
                  }} style={{ background: '#333', color: '#03dac6', border: '1px solid #03dac6', borderRadius: '12px', padding: '2px 8px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                    + INVITE
                  </button>
                )}
              </div>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: 'auto', flexGrow: 1 }}>
              {playerList.map((p, index) => (
                <li 
                  key={index} 
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #333', color: p.name === playerInfo.playerName ? '#03dac6' : '#e0e0e0', fontWeight: p.name === playerInfo.playerName ? 'bold' : 'normal', fontSize: '13px' }}
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
              {timeLeft > 0 ? timeLeft : "0"}
            </div>

            {!currentDrawer ? (
              <div className="waiting-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', pointerEvents: 'auto' }}>
                {waitingForHost ? (
                  <>
                    <div style={{ color: '#bb86fc' }}>Waiting for host to start the game...</div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      {isHost && playerList.length >= 2 && (
                        <button onClick={() => socketRef.current.emit('start_private_game')} style={{ padding: '12px 20px', background: '#03dac6', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
                          🚀 Start Game
                        </button>
                      )}
                      {isPrivate && (
                        <button onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/?room=${roomId}`);
                          alert("Invite link copied to clipboard!");
                        }} style={{ padding: '12px 20px', background: '#bb86fc', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
                          📋 Copy Invite Link
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div>Waiting for a second player to join...</div>
                )}
              </div>
            ) : winner ? (
              <div className="floating-status" style={{ background: '#FFD54F', color: '#000' }}>
                🏆 {winner} won the game!
              </div>
            ) : (
              <div className="floating-status" style={{ fontSize: 'clamp(13px, 4vw, 20px)', letterSpacing: '1px', padding: '6px 14px' }}>
                {/* FIX: Replaces every standard space with two forced non-breaking spaces so multi-word prompts are obvious! */}
                {isMyTurn ? secretWord.toUpperCase().split(' ').join('\u00A0\u00A0') : getDynamicHint()}
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
              style={{ 
                cursor: !isMyTurn 
                  ? 'not-allowed' 
                  : isBucketMode 
                    ? 'crosshair' 
                    : `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${brushSize + 6}" height="${brushSize + 6}"><circle cx="${(brushSize + 6) / 2}" cy="${(brushSize + 6) / 2}" r="${brushSize / 2}" fill="${brushColor.replace('#', '%23')}" stroke="%23000000" stroke-width="2"/><circle cx="${(brushSize + 6) / 2}" cy="${(brushSize + 6) / 2}" r="${brushSize / 2}" fill="none" stroke="%23ffffff" stroke-width="0.5"/></svg>') ${Math.round((brushSize + 6) / 2)} ${Math.round((brushSize + 6) / 2)}, crosshair` 
              }}
            />

            {/* NEW: Floating Tool Bar overlay */}
            {/* NEW: Maximized Space Tool Bar (Colors on Left, Tools on Right) */}
            <div 
              className="toolbar" 
              style={{ 
                opacity: isMyTurn ? 1 : 0.3, 
                pointerEvents: isMyTurn ? 'auto' : 'none',
                width: '96vw', 
                maxWidth: '700px', 
                boxSizing: 'border-box',
                justifyContent: 'space-between'
              }}
            >
              {/* NEW: Custom Glassmorphism Scrollbar CSS just for the colors! */}
              <style>{`
                .color-palette-container::-webkit-scrollbar {
                  height: 6px; /* Super slim! */
                }
                .color-palette-container::-webkit-scrollbar-track {
                  background: rgba(255, 255, 255, 0.05);
                  border-radius: 10px;
                }
                .color-palette-container::-webkit-scrollbar-thumb {
                  background: rgba(187, 134, 252, 0.5); /* Semi-transparent theme purple */
                  border-radius: 10px;
                  cursor: pointer;
                }
                .color-palette-container::-webkit-scrollbar-thumb:hover {
                  background: rgba(3, 218, 198, 0.8); /* Glows teal on hover! */
                }
              `}</style>

              {/* 25 Fast Colors (Pushed to the far left to maximize mobile visibility!) */}
              {/* FIX: Added className and increased paddingBottom to 8px so the new scrollbar fits perfectly! */}
              <div className="color-palette-container" style={{ display: 'flex', gap: '6px', overflowX: 'auto', flex: 1, paddingBottom: '8px', alignItems: 'center' }}>
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
                  />
                ))}
              </div>

              <div style={{ width: '2px', height: '20px', backgroundColor: '#555', margin: '0 4px', flexShrink: 0 }} />

              {/* Paint Bucket & Brush Size Slider */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                <button 
                  onClick={() => setIsBucketMode(!isBucketMode)}
                  style={{ background: isBucketMode ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', padding: '4px' }}
                  title="Paint Bucket (Fill)"
                >🪣</button>
                
                <input 
                  type="range" min="2" max="25" value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  style={{ width: '50px', flexShrink: 0, margin: 0 }} 
                />
              </div>
              
              <div style={{ width: '2px', height: '20px', backgroundColor: '#555', margin: '0 4px', flexShrink: 0 }} />
              
              {/* Undo & Trash Can (Destructive Actions) */}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                <button 
                  onClick={() => { handleUndo(); socketRef.current.emit('undo'); }}
                  style={{ background: 'transparent', border: '1px solid #666', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', padding: '4px' }}
                  title="Undo"
                >↩️</button>
                
                <button 
                  onClick={handleClearBoard}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px', flexShrink: 0 }}
                  title="Clear Board"
                >🗑️</button>
              </div>
            </div>
            
          </div> {/* NEW: Restored missing canvas-wrapper closing tag */}
        </div> {/* NEW: Restored missing center-canvas closing tag */}

       {/* Chat Box */}
        <div className="sidebar-right">
          {isSocketReady && (
            <ChatBox socket={socketRef.current} playerInfo={playerInfo} isMyTurn={isMyTurn} />
          )}
        </div>

        {/* NEW: Word Choosing Phase Overlay */}
        {isChoosing && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 100,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            {isMyTurn ? (
              <div style={{ background: '#1e1e1e', padding: '30px', borderRadius: '12px', textAlign: 'center', border: '2px solid #bb86fc', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', maxWidth: '90%' }}>
                <h2 style={{ color: '#03dac6', marginTop: 0 }}>Choose a word to draw!</h2>
                <h3 style={{ color: '#FFD54F', fontSize: '24px' }}>⏱ {timeLeft}s</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
                  {wordChoices.map(w => (
                    <button 
                      key={w}
                      onClick={() => {
                        // NEW: Play the selection sound!
                        const clone = selectSound.current.cloneNode()
                        clone.volume = 0.6
                        clone.play().catch(e => console.log(e))
                        
                        socketRef.current.emit('word_chosen', w)
                        setIsChoosing(false)
                      }}
                      style={{ padding: '12px 20px', fontSize: '18px', background: '#bb86fc', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ color: '#bb86fc' }}>{currentDrawer} is picking a word...</h2>
                <h3 style={{ color: '#FFD54F', fontSize: '24px' }}>⏱ {timeLeft}s</h3>
              </div>
            )}
          </div>
        )}
        {/* NEW: Player List & Vote Kick Modal */}
        {showPlayerModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 200,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ background: '#1e1e1e', border: '1px solid #333', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
              <h2 style={{ color: '#bb86fc', marginTop: 0, textAlign: 'center', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Lobby Players</h2>
              <ul style={{ listStyle: 'none', padding: 0, maxHeight: '300px', overflowY: 'auto' }}>
                {playerList.map(p => (
                  <li key={p.id || p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #333', color: '#e0e0e0' }}>
                    <span style={{ fontWeight: p.name === playerInfo.playerName ? 'bold' : 'normal', color: p.name === playerInfo.playerName ? '#03dac6' : '#e0e0e0' }}>
                      {p.name} {p.name === playerInfo.playerName ? '(You)' : ''} - {p.score} pts
                    </span>
                    {p.name !== playerInfo.playerName && (
                      <button 
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to start a vote to kick ${p.name}?`)) {
                            socketRef.current.emit('initiate_votekick', p.id);
                            setShowPlayerModal(false);
                          }
                        }}
                        style={{ background: '#ff3b30', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                      >
                        Kick
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => setShowPlayerModal(false)} 
                style={{ width: '100%', padding: '12px', background: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '15px', fontWeight: 'bold' }}
              >
                Close
              </button>
            </div>
          </div>
        )}

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