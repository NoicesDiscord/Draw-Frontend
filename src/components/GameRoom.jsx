import { useRef, useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import ChatBox from './ChatBox'

export default function GameRoom({ playerInfo }) {
  const canvasRef = useRef(null)
  const contextRef = useRef(null)
  const socketRef = useRef(null)
  const hintOrderRef = useRef([]) // NEW: Locks in the random hint order
  const lastWordRef = useRef("")  // NEW: Detects when a new word is chosen
  
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
  const [totalDrawTime, setTotalDrawTime] = useState(120) // NEW: Tracks max timer for hints
  const [isPrivate, setIsPrivate] = useState(false)
  const [isChoosing, setIsChoosing] = useState(false)
  const [wordChoices, setWordChoices] = useState([])
  const [underdogs, setUnderdogs] = useState([]) // NEW: Tracks who has the Underdog ability
  
  const [correctGuessers, setCorrectGuessers] = useState([]) // NEW: Tracks who guessed correctly!
  
  const [turnSummary, setTurnSummary] = useState(null) // NEW: Holds the round end scores
  const summarySound = useRef(new Audio('/sounds/summary.mp3')) // NEW: Sound effect for round end screen
  
  const [hasVotedThisTurn, setHasVotedThisTurn] = useState(false) // NEW: Hides like/dislike buttons after clicking



  // --- NEW: Theme Toggle State & Effect ---
  const [isLightMode, setIsLightMode] = useState(false)
  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add('light-mode')
    } else {
      document.body.classList.remove('light-mode')
    }
  }, [isLightMode])

  // --- NEW: Brush Tools State ---
  const [brushColor, setBrushColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(5)
  const [activeTool, setActiveTool] = useState('brush') 
  const [showColorPicker, setShowColorPicker] = useState(false) 
  const [showSizePicker, setShowSizePicker] = useState(false) 
  const [showShapePicker, setShowShapePicker] = useState(false) // NEW: Controls the Desktop shape menu 
  
  const shapeStartRef = useRef(null) // NEW: Tracks coordinates for shapes
  const savedImageRef = useRef(null) // NEW: Tracks the preview frame for shapes
  const sprayIntervalRef = useRef(null) // NEW: Runs continuous spray dots
  
  // NEW: 40 Perfectly Organized Colors (Creates a uniform 4x10 Grid on Desktop & Mobile!)
const presetColors = [
  // Row 1: Grays & Monochromes
  '#000000', '#222222', '#444444', '#666666', '#888888', '#AAAAAA', '#CCCCCC', '#E0E0E0', '#F5F5F5', '#FFFFFF',
  // Row 2: Browns, Reds & Oranges
  '#3E2723', '#5D4037', '#8B4513', '#5C0000', '#8B0000', '#FF0000', '#FF4500', '#FF8C00', '#FFA500', '#FFD700',
  // Row 3: Yellows, Greens & Cyans
  '#FFFF00', '#FFFFE0', '#004d00', '#008000', '#00FF00', '#32CD32', '#98FB98', '#008B8B', '#00CED1', '#00FFFF',
  // Row 4: Blues, Purples & Pinks
  '#000080', '#0000FF', '#1E90FF', '#87CEFA', '#4B0082', '#800080', '#BA55D3', '#FF00FF', '#FF1493', '#FFB6C1'
];

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
  
  // NEW: Add a sound for the Start Game button!
  const startSound = useRef(new Audio('/sounds/start.mp3'))

  // NEW: Add a ticking sound for the last 10 seconds!
  const tickSound = useRef(new Audio('/sounds/tick.mp3'))
  const lastTickRef = useRef(null) 

  // --- NEW: Timer Tick Effect (Last 10 Seconds) ---
  useEffect(() => {
    const totalGuessers = playerList.length - 1;
    const everyoneGuessed = totalGuessers > 0 && correctGuessers.length >= totalGuessers;

    // FIX: Play only between 10s and 2s (Stops the moment it touches 1). 
    // Also strictly stops if everyone guessed the word!
    if (timeLeft <= 10 && timeLeft > 1 && currentDrawer && !winner && !turnSummary && !isChoosing && !everyoneGuessed) {
      if (lastTickRef.current !== timeLeft) {
        lastTickRef.current = timeLeft;
        
        // Stop the previous tick instantly to prevent any audio overlap
        tickSound.current.pause();
        tickSound.current.currentTime = 0;
        
        tickSound.current.volume = 0.5;
        tickSound.current.play().catch(err => console.log("Audio blocked:", err));
      }
    } else if (timeLeft > 10 || isChoosing || turnSummary || everyoneGuessed || timeLeft <= 1) {
      // Release lock and force silence if the phase resets, everyone guesses, or timer reaches 1
      lastTickRef.current = null;
      tickSound.current.pause();
    }
  }, [timeLeft, currentDrawer, winner, turnSummary, isChoosing, correctGuessers.length, playerList.length])

  // --- NEW: Smart Progressive Hint Generator (20%-33% Intervals & 50% Cap) ---
  // --- NEW: Smart Progressive Hint Generator (Round-Robin & Dynamic Slider) ---
 // --- NEW: Smart Progressive Hint Generator (Randomized Round-Robin) ---
  const getDynamicHint = () => {
    if (!secretWord) return ""

    // 1. If a new word starts, shuffle a random hint order and lock it in memory!
    if (secretWord !== lastWordRef.current) {
      lastWordRef.current = secretWord;
      const words = secretWord.split(' ');
      const wordStartIndices = [];
      let currentIdx = 0;
      
      for (let w of words) {
        wordStartIndices.push(currentIdx);
        currentIdx += w.length + 1;
      }

      // Generate completely random letter indices for each word using Fisher-Yates shuffle
      const wordPriorities = words.map(w => {
        let indices = Array.from({ length: w.length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        return indices;
      });

      const maxLength = Math.max(...words.map(w => w.length));
      let allowedIndices = [];

      // Round-Robin Distribution across the randomized words!
      for (let p = 0; p < maxLength; p++) {
         for (let wIdx = 0; wIdx < words.length; wIdx++) {
            if (p < wordPriorities[wIdx].length) {
               allowedIndices.push(wordStartIndices[wIdx] + wordPriorities[wIdx][p]);
            }
         }
      }
      hintOrderRef.current = allowedIndices;
    }

    const words = secretWord.split(' ');
    
    // 2. Dynamic Max Hints based on the Host's Hint Slider
    let dynamicMaxHints = 0;
    const totalLetters = secretWord.replace(/ /g, '').length;
    
    if (totalLetters > 2) {
      if (hintLevel == 1) dynamicMaxHints = Math.floor(totalLetters * 0.25); // Low (25%)
      if (hintLevel == 2) dynamicMaxHints = Math.floor(totalLetters * 0.45); // Normal (45%)
      if (hintLevel == 3) dynamicMaxHints = Math.floor(totalLetters * 0.70); // High (70%)
      if (hintLevel == 4) dynamicMaxHints = Math.floor(totalLetters * 0.95); // Max (95%)
      
      if (dynamicMaxHints >= totalLetters) dynamicMaxHints = totalLetters - 1;
      if (dynamicMaxHints < 0) dynamicMaxHints = 0;
    }

    const cappedIndices = hintOrderRef.current.slice(0, dynamicMaxHints);

    // 3. Progressive Reveal over time
    let revealCount = 0;
    const maxDrawTime = typeof totalDrawTime !== 'undefined' ? totalDrawTime : 120; 
    
    if (dynamicMaxHints > 0 && timeLeft > 0 && timeLeft <= maxDrawTime) {
      const timeElapsed = maxDrawTime - Math.min(timeLeft, maxDrawTime);
      revealCount = Math.floor((timeElapsed / maxDrawTime) * (dynamicMaxHints + 1));
      revealCount = Math.min(dynamicMaxHints, revealCount); 
    }

    const revealed = new Set(cappedIndices.slice(0, revealCount));

    // 4. Render the final output with tiny word length numbers
    const displayElements = [];
    let absoluteIndex = 0;
    
    words.forEach((w, wordIdx) => {
      let wordChars = [];
      for (let i = 0; i < w.length; i++) {
        if (revealed.has(absoluteIndex)) {
          wordChars.push(w[i].toUpperCase());
        } else {
          wordChars.push('_');
        }
        absoluteIndex++;
      }
      absoluteIndex++; 
      
      displayElements.push(
        <span key={wordIdx} style={{ whiteSpace: 'nowrap' }}>
          {wordChars.join(' ')}
          <span style={{ fontSize: '11px', verticalAlign: 'super', marginLeft: '4px', opacity: 0.8 }}>
            {w.length}
          </span>
        </span>
      );
    });

    return (
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 20px' }}>
        {displayElements}
      </span>
    );
  }

  
// --- FIX: RESTORED THE FROZEN CANVAS LOGIC ---
  // We track the tallest screen height (keyboard closed) and freeze the canvas to 42% of THAT height.
  // When the keyboard opens, ONLY the chat area shrinks, while the canvas stays perfectly frozen and clear!
  // --- FIX: Stable Viewport Logic. No more hiding inputs, no more offsetTop math! ---
  const restingViewportHeightRef = useRef(
    window.visualViewport ? window.visualViewport.height : window.innerHeight
  )

  useEffect(() => {
    const vv = window.visualViewport

    const applyHeights = () => {
      const liveHeight = vv ? vv.height : window.innerHeight
      
      // Track the height of the screen when the keyboard is CLOSED
      if (liveHeight > restingViewportHeightRef.current) {
        restingViewportHeightRef.current = liveHeight
      }
      const restingHeight = restingViewportHeightRef.current

      // Canvas height is forever frozen based on the closed keyboard height
      const canvasHeight = Math.floor(restingHeight * 0.42)
      // Chat height dynamically shrinks to whatever space is left
      const chatHeight = Math.max(60, liveHeight - canvasHeight)

      const root = document.documentElement.style
      root.setProperty('--app-height', `${liveHeight}px`)
      root.setProperty('--canvas-h', `${canvasHeight}px`)
      root.setProperty('--chat-h', `${chatHeight}px`)
    }

    applyHeights()

    const handleOrientation = () => {
      restingViewportHeightRef.current = vv ? vv.height : window.innerHeight
      applyHeights()
    }

    if (vv) {
      vv.addEventListener('resize', applyHeights)
      vv.addEventListener('scroll', applyHeights)
    } else {
      window.addEventListener('resize', applyHeights)
    }
    window.addEventListener('orientationchange', handleOrientation)

    return () => {
      if (vv) {
        vv.removeEventListener('resize', applyHeights)
        vv.removeEventListener('scroll', applyHeights)
      } else {
        window.removeEventListener('resize', applyHeights)
      }
      window.removeEventListener('orientationchange', handleOrientation)
    }
  }, [])

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
      if (data.drawTime) setTotalDrawTime(data.drawTime) // NEW: Syncs the clock total for hints
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
    
    // NEW: Everyone plays the sound when the network confirms the game has started!
    socketRef.current.on('game_started', () => {
      const clone = startSound.current.cloneNode()
      clone.volume = 0.6
      clone.play().catch(e => console.log("Audio blocked:", e))
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
      
      // NEW: Catch Underdogs
      if (data.underdogs) setUnderdogs(data.underdogs)
      else setUnderdogs([])
      
      setIsChoosing(false) 
      setWaitingForHost(false)
      setSecretWord(data.word || "")
      setTimeLeft(120) 
      setCurrentRound(data.currentRound || 1); 
      
      setHasVotedThisTurn(false) // NEW: Restore their ability to vote for the new drawer!

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
      setTurnSummary(null) // NEW: Clear summary just in case
      setIsChoosing(false) // FIX: Make sure the overlay never blocks the victory screen!
      
      // NEW: Play the epic celebration sound!
      winSound.current.volume = 0.7
      winSound.current.currentTime = 0
      winSound.current.play().catch(err => console.log("Audio blocked:", err))
    })
    
    // NEW: Listener for the end-of-turn score summary!
    socketRef.current.on('turn_summary', (data) => {
      setTurnSummary(data)
      const clone = summarySound.current.cloneNode()
      clone.volume = 0.6
      clone.play().catch(err => console.log("Audio blocked:", err))
    })

    // NEW: The Choosing Phase!
    socketRef.current.on('choosing_word', (data) => {
      setWaitingForHost(false)
      setIsChoosing(true)
      setTurnSummary(null) // NEW: Hide summary overlay!
      setCurrentDrawer(data.drawerName)
      setIsMyTurn(data.drawerName === playerInfo.playerName)
      setSecretWord("") // Hide the old word
      setWinner(null)
      setHasVotedThisTurn(false) // NEW: Reset the button visibility
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
      setIsChoosing(false) // FIX: Force the overlay to close when left alone!
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

    // FIX: Listen to the chat! If the server says it's a guess, add that player to the winners list!
    socketRef.current.on('chat_message', (data) => {
      if (data.isGuess) {
        setCorrectGuessers(prev => prev.includes(data.sender) ? prev : [...prev, data.sender]);
      }
    })

    // FIX: Automatically wipe the winners list clean whenever the game state resets!
    socketRef.current.on('round_update', () => setCorrectGuessers([]));
    socketRef.current.on('waiting_for_players', () => setCorrectGuessers([]));
    socketRef.current.on('waiting_for_host', () => setCorrectGuessers([]));
    socketRef.current.on('choosing_word', () => setCorrectGuessers([]));

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
  // --- UPDATED: Advanced Tool Handlers (Brush, Bucket, Ruler, Shapes, Spray) ---
  const startDrawing = (e) => {
    if (!isMyTurn) return;
    if (e.touches && e.cancelable) e.preventDefault();
    
    const { x, y } = getCoordinates(e);

    if (activeTool === 'bucket') {
      applyFill(contextRef.current, canvasRef.current, x, y, brushColor);
      socketRef.current.emit('fill', { x, y, color: brushColor });
      return;
    }

    // Prepare rubber-band preview for shapes
    if (['ruler', 'circle', 'rect', 'triangle'].includes(activeTool)) {
      shapeStartRef.current = { sx: x, sy: y, ex: x, ey: y };
      savedImageRef.current = contextRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      setIsDrawing(true);
      return;
    }

    // Continuous Spray Logic
    if (activeTool === 'spray') {
      setIsDrawing(true);
      if (sprayIntervalRef.current) clearInterval(sprayIntervalRef.current);
      
      const sprayDrop = (cx, cy) => {
        for (let i = 0; i < 7; i++) {
           const angle = Math.random() * Math.PI * 2;
           const radius = Math.random() * (brushSize * 1.5);
           const dotX = cx + Math.cos(angle) * radius;
           const dotY = cy + Math.sin(angle) * radius;
           
           contextRef.current.fillStyle = brushColor;
           contextRef.current.fillRect(dotX, dotY, 2, 2);
           
           // Trick the server into rendering dots by sending micro-strokes
           socketRef.current.emit('start', { x: dotX, y: dotY, color: brushColor, size: 2 });
           socketRef.current.emit('stop');
        }
      };
      sprayDrop(x, y);
      shapeStartRef.current = { sx: x, sy: y };
      sprayIntervalRef.current = setInterval(() => {
         if (shapeStartRef.current) sprayDrop(shapeStartRef.current.sx, shapeStartRef.current.sy);
      }, 40);
      return;
    }
    
    // Default Brush
    contextRef.current.strokeStyle = brushColor;
    contextRef.current.lineWidth = brushSize;
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
    
    setIsDrawing(true);
    socketRef.current.emit('start', { x, y, color: brushColor, size: brushSize });
  }

  const draw = (e) => {
    if (!isDrawing || !isMyTurn) return;
    if (e.touches && e.cancelable) e.preventDefault();

    const { x, y } = getCoordinates(e);

    // Live preview dragging for shapes!
    if (['ruler', 'circle', 'rect', 'triangle'].includes(activeTool)) {
       shapeStartRef.current.ex = x;
       shapeStartRef.current.ey = y;
       
       contextRef.current.putImageData(savedImageRef.current, 0, 0);
       contextRef.current.strokeStyle = brushColor;
       contextRef.current.lineWidth = brushSize;
       contextRef.current.beginPath();
       
       const { sx, sy } = shapeStartRef.current;

       if (activeTool === 'ruler') {
          contextRef.current.moveTo(sx, sy);
          contextRef.current.lineTo(x, y);
       } else if (activeTool === 'rect') {
          contextRef.current.rect(sx, sy, x - sx, y - sy);
       } else if (activeTool === 'circle') {
          const radius = Math.sqrt(Math.pow(x - sx, 2) + Math.pow(y - sy, 2));
          contextRef.current.arc(sx, sy, radius, 0, 2 * Math.PI);
       } else if (activeTool === 'triangle') {
          contextRef.current.moveTo(sx + (x - sx) / 2, sy);
          contextRef.current.lineTo(x, y);
          contextRef.current.lineTo(sx, y);
          contextRef.current.closePath();
       }
       contextRef.current.stroke();
       return;
    }

    if (activeTool === 'spray') {
       shapeStartRef.current.sx = x;
       shapeStartRef.current.sy = y;
       return;
    }
    
    contextRef.current.strokeStyle = brushColor;
    contextRef.current.lineWidth = brushSize;
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
    
    socketRef.current.emit('draw', { x, y, color: brushColor, size: brushSize });
  }

  const stopDrawing = () => {
    if (!isMyTurn || !isDrawing) return;
    
    if (activeTool === 'spray') {
       clearInterval(sprayIntervalRef.current);
       setIsDrawing(false);
       saveState();
       redoStack.current = [];
       return;
    }

    // Instantly draws the final shape over the network using native socket lines
    if (['ruler', 'circle', 'rect', 'triangle'].includes(activeTool)) {
       const { sx, sy, ex, ey } = shapeStartRef.current;
       
       if (activeTool === 'ruler') {
          socketRef.current.emit('start', { x: sx, y: sy, color: brushColor, size: brushSize });
          socketRef.current.emit('draw', { x: ex, y: ey, color: brushColor, size: brushSize });
          socketRef.current.emit('stop');
       } else if (activeTool === 'rect') {
          socketRef.current.emit('start', { x: sx, y: sy, color: brushColor, size: brushSize });
          socketRef.current.emit('draw', { x: ex, y: sy, color: brushColor, size: brushSize });
          socketRef.current.emit('draw', { x: ex, y: ey, color: brushColor, size: brushSize });
          socketRef.current.emit('draw', { x: sx, y: ey, color: brushColor, size: brushSize });
          socketRef.current.emit('draw', { x: sx, y: sy, color: brushColor, size: brushSize });
          socketRef.current.emit('stop');
       } else if (activeTool === 'triangle') {
          const midX = sx + (ex - sx) / 2;
          socketRef.current.emit('start', { x: midX, y: sy, color: brushColor, size: brushSize });
          socketRef.current.emit('draw', { x: ex, y: ey, color: brushColor, size: brushSize });
          socketRef.current.emit('draw', { x: sx, y: ey, color: brushColor, size: brushSize });
          socketRef.current.emit('draw', { x: midX, y: sy, color: brushColor, size: brushSize });
          socketRef.current.emit('stop');
       } else if (activeTool === 'circle') {
          const radius = Math.sqrt(Math.pow(ex - sx, 2) + Math.pow(ey - sy, 2));
          const segments = 40; 
          socketRef.current.emit('start', { x: sx + radius, y: sy, color: brushColor, size: brushSize });
          for (let i = 1; i <= segments; i++) {
             const angle = (i * 2 * Math.PI) / segments;
             socketRef.current.emit('draw', { x: sx + Math.cos(angle) * radius, y: sy + Math.sin(angle) * radius, color: brushColor, size: brushSize });
          }
          socketRef.current.emit('stop');
       }
       setIsDrawing(false);
       saveState();
       redoStack.current = [];
       return;
    }

    contextRef.current.closePath();
    setIsDrawing(false);
    socketRef.current.emit('stop');
    
    saveState();
    redoStack.current = [];
  }

  // NEW: Tells the server to wipe the board
  const handleClearBoard = () => {
    if (!isMyTurn) return
    socketRef.current.emit('clear_board')
  }

  return (
    <>
      <style>{`
        :root {
          --bg-body: #121212;
          --bg-panel: #1e1e1e;
          --bg-player: #252525;
          --bg-chat-form: #2d2d2d;
          --bg-chat-disabled: #1a1a1a;
          --border-main: #333333;
          --text-main: #e0e0e0;
          --text-muted: #aaaaaa;
        }
          @keyframes fireGlow {
          0% { box-shadow: 0 0 5px #ff9800, inset 0 0 5px #ff9800; border-color: #ff9800; }
          50% { box-shadow: 0 0 15px #f44336, inset 0 0 10px #f44336; border-color: #f44336; }
          100% { box-shadow: 0 0 5px #ff9800, inset 0 0 5px #ff9800; border-color: #ff9800; }
        }
        .underdog-glow {
          animation: fireGlow 1.5s infinite alternate;
          position: relative;
        }
        .light-mode {
          --bg-body: #e4e6eb;
          --bg-panel: #ffffff;
          --bg-player: #f0f2f5;
          --bg-chat-form: #f0f2f5;
          --bg-chat-disabled: #e4e6eb;
          --border-main: #cccccc;
          --text-main: #1c1e21;
          --text-muted: #65676b;
        }

        body, html {
          margin: 0; padding: 0; background-color: var(--bg-body); color: var(--text-main); font-family: sans-serif;
          position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important;
          width: 100% !important; height: var(--app-height, 100%) !important;
          overflow: hidden !important; touch-action: none; overscroll-behavior: none; 
          transition: background-color 0.3s ease, color 0.3s ease;
        }
        * { box-sizing: border-box; }
        
        #root { 
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          width: 100%; height: 100%; overflow: hidden;
        }
        
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
          flex-grow: 1; display: flex; align-items: center; justify-content: center; background-color: var(--bg-panel);
          padding: 10px; border-radius: 8px; border: 1px solid var(--border-main); min-height: 0; min-width: 0; position: relative; 
          transition: background-color 0.3s ease, border-color 0.3s ease;
        }
        
        .game-canvas {
          background-color: #ffffff; touch-action: none; 
          max-width: 100%; max-height: 100%; width: auto; height: auto; aspect-ratio: 4 / 3;
          border-radius: 4px; box-shadow: 0px 4px 10px rgba(0,0,0,0.5); border: 2px solid #333;
        }
         
        .waiting-text {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          color: #999; font-size: 24px; font-weight: bold; text-align: center; pointer-events: none; width: 90%;
        }
        
        .floating-status {
          position: absolute; top: 15px; left: 50%; transform: translateX(-50%);
          background-color: rgba(55, 0, 179, 0.85); color: white; padding: 8px 20px; border-radius: 20px;
          font-weight: bold; pointer-events: none; font-size: 16px; 
          white-space: pre-wrap; text-align: center; width: max-content; max-width: 80%; line-height: 1.4; 
          z-index: 10; box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }

        /* --- DESKTOP POPUPS & UI --- */
        .game-clock {
          position: absolute; top: 15px; left: 15px;
          background-color: rgba(255, 255, 255, 0.85); padding: 2px 8px; border-radius: 6px;
          color: #000; font-size: 24px; font-weight: 900; 
          font-family: monospace; z-index: 50; pointer-events: none; border: 2px solid #000;
        }
        
        .color-popup {
          position: absolute; bottom: 65px; left: -5px;
          background-color: rgba(20, 20, 20, 0.95); padding: 12px; border-radius: 14px;
          border: 1px solid #555; display: grid; grid-template-columns: repeat(10, minmax(22px, 26px)); 
          gap: 6px; box-shadow: 0 -4px 20px rgba(0,0,0,0.6); z-index: 200; width: max-content;
        }
        
        .size-popup, .shape-popup {
          position: absolute; bottom: 65px; left: 50%; transform: translateX(-50%);
          background-color: rgba(20, 20, 20, 0.95); padding: 10px 14px; border-radius: 14px;
          border: 1px solid #555; display: flex; gap: 12px; box-shadow: 0 -4px 20px rgba(0,0,0,0.6); z-index: 200;
        }

        .toolbar {
          position: absolute; bottom: 0px; left: 50%; transform: translateX(-50%);
          background-color: rgba(20, 20, 20, 0.95); padding: 10px 20px; border-radius: 18px 18px 0 0; 
          border: 1px solid #444; border-bottom: none; box-shadow: 0 -4px 18px rgba(0,0,0,0.5); 
          transition: opacity 0.3s ease; z-index: 50; width: max-content; max-width: 98vw;
        }

        .desktop-only { display: flex; gap: 10px; align-items: center; }
        .mobile-only { display: none; }
        .toolbar-divider { width: 2px; height: 30px; background-color: #555; margin: 0 6px; flex-shrink: 0; }

        @media (max-width: 900px) {
          .color-popup { bottom: 45px !important; padding: 10px !important; grid-template-columns: repeat(10, minmax(20px, 24px)) !important; gap: 6px !important; left: 10px !important; right: 10px !important; width: auto !important; }
          .size-popup, .shape-popup { bottom: 45px !important; padding: 8px 12px !important; }
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; flex-direction: column !important; width: 100%; gap: 12px !important; }
          .toolbar { padding: 12px 10px !important; border-radius: 16px !important; width: 95vw !important; bottom: 10px !important; }
        }

        /* --- MOBILE RESPONSIVENESS MASTER CLASS --- */
      /* --- MOBILE RESPONSIVENESS MASTER CLASS --- */
        @media (max-width: 900px) {
          .game-layout { 
            position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
            display: grid !important; gap: 0px !important; padding: 0px !important; 
            width: 100% !important; height: var(--app-height, 100%) !important;
          }
          
          /* --- GUESSER MOBILE LAYOUT --- */
          .layout-guesser.game-layout {
            grid-template-columns: 45fr 55fr !important; 
            grid-template-rows: var(--canvas-h, 42vh) var(--chat-h, 58vh) !important; 
          }
          
          .layout-guesser .center-canvas { 
            grid-column: 1 / span 2 !important; grid-row: 1 !important; 
            width: 100% !important; height: 100% !important;
            background-color: var(--bg-panel); border-bottom: 2px solid var(--border-main); 
            display: flex !important; align-items: center !important; justify-content: center !important;
            overflow: hidden !important; z-index: 200 !important; 
          }
          
          .layout-guesser .sidebar-left { 
            grid-column: 1 !important; grid-row: 2 !important; 
            width: 100% !important; height: 100% !important; overflow: hidden !important;
            padding-bottom: 55px !important; /* Protects scores from chat bar */
          }
          .layout-guesser .sidebar-right { 
            grid-column: 2 !important; grid-row: 2 !important; 
            width: 100% !important; height: 100% !important; overflow: hidden !important;
          }
          .layout-guesser .sidebar-right > div {
            height: 100% !important; max-height: 100% !important;
            display: flex !important; flex-direction: column !important;
            overflow: hidden !important;
            padding-bottom: 55px !important; /* Protects messages from chat bar */
          }

          /* EDGE-TO-EDGE CHAT INPUT BAR */
          .layout-guesser .sidebar-right form {
            position: absolute !important;
            bottom: 0 !important; left: 0 !important;
            width: 100vw !important; height: 55px !important;
            background-color: var(--bg-chat-form) !important; border-top: 2px solid var(--border-main) !important;
            z-index: 300 !important;
            transition: background-color 0.3s ease, border-color 0.3s ease !important;
          }
          
          /* --- DRAWER MOBILE LAYOUT --- */
          .layout-drawer.game-layout { 
            grid-template-columns: 45fr 55fr !important; 
            grid-template-rows: 1fr auto !important; 
          }
          .layout-drawer .sidebar-left { grid-column: 1; grid-row: 1; min-height: 0; padding: 10px; overflow: hidden; }
          .layout-drawer .sidebar-right { grid-column: 2; grid-row: 1; min-height: 0; padding: 10px; pointer-events: auto; overflow: hidden; }
          .layout-drawer .sidebar-right form { display: none !important; } 
          .layout-drawer .sidebar-right > div { background: var(--bg-panel) !important; height: 100% !important; display: flex !important; flex-direction: column !important; overflow: hidden !important; } 
          
          .layout-drawer .center-canvas { grid-column: 1 / span 2 !important; grid-row: 2 !important; }
          
          .layout-drawer .canvas-wrapper {
            flex-direction: column !important;
            justify-content: center !important;
          }
          
          .layout-drawer .toolbar { 
            position: relative !important; 
            bottom: auto !important; left: auto !important; transform: none !important;
            border-radius: 16px !important; border: 1px solid var(--border-main) !important; z-index: 300 !important;
            margin-top: 15px !important; margin-bottom: 15px !important;
          }

          /* --- MISC UI TWEAKS --- */
          .color-popup { position: fixed !important; bottom: 75px !important; left: 10px !important; right: 10px !important; width: auto !important; grid-template-columns: repeat(10, 1fr) !important; padding: 12px !important; gap: 8px !important; border-radius: 16px !important; }
          .size-popup { position: fixed !important; bottom: 75px !important; left: 50% !important; transform: translateX(-50%) !important; }
          .canvas-wrapper { padding: 0 !important; background-color: transparent !important; border: none !important; border-radius: 0 !important; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; }
          .game-canvas { width: auto !important; max-width: 100vw !important; height: auto !important; max-height: 100% !important; border-radius: 0 !important; border: none !important; aspect-ratio: 4 / 3; margin: 0 auto; }
          .sidebar-left > div, .sidebar-right > div { border: none !important; border-radius: 0 !important; }
          .sidebar-left > div { border-right: 2px solid var(--border-main) !important; }
          .waiting-text { font-size: 20px; }
          .game-clock { font-size: 15px !important; padding: 2px 6px !important; top: 10px !important; left: 10px !important; border-width: 1px !important; }
          .floating-status { top: 10px !important; left: 50% !important; transform: translateX(-50%) !important; font-size: 13px !important; padding: 4px 12px !important; width: max-content !important; max-width: 80% !important; text-align: center !important; }
          
          /* COMPACT SCOREBOARD */
          .sidebar-left ul li { padding: 8px 10px !important; }
          .sidebar-left ul li > div { gap: 8px !important; }
          .sidebar-left ul li > div > div:first-child { width: 22px !important; height: 22px !important; font-size: 11px !important; } 
          .sidebar-left ul li > div > div:nth-child(2) span:first-child { font-size: 12px !important; } 
          .sidebar-left ul li > div > div:nth-child(2) span:last-child { font-size: 10px !important; } 
          .sidebar-left ul li > span { font-size: 14px !important; } 
          .sidebar-left h3 { font-size: 14px !important; margin-bottom: 4px !important; } 
        }
      `}</style>
      {/* FIX: Dynamically applies a different layout depending on if you are drawing or guessing! */}
      <div className={`game-layout ${isMyTurn ? 'layout-drawer' : 'layout-guesser'}`}>
        
        {/* Leaderboard */}
        <div className="sidebar-left">
          <div 
            onClick={() => setShowPlayerModal(true)}
            title="Click to manage lobby players"
            style={{ backgroundColor: 'var(--bg-panel)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-main)', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.3s ease' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '10px', borderBottom: '1px solid var(--border-main)', paddingBottom: '12px', position: 'relative', transition: 'border-color 0.3s ease' }}>
              <h3 style={{ margin: '0 0 6px 0', color: '#bb86fc', fontSize: '16px', letterSpacing: '1px' }}>SCORES</h3>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', backgroundColor: 'var(--border-main)', padding: '3px 8px', borderRadius: '12px', transition: 'all 0.3s ease' }}>
                  ROUND {currentRound} OF {maxRounds}
                </span>
                {isPrivate && (
                  <button onClick={(e) => {
                    e.stopPropagation(); // Prevents opening the modal when clicking invite
                    navigator.clipboard.writeText(`${window.location.origin}/?room=${roomId}`);
                    alert("Invite link copied!");
                  }} style={{ background: 'var(--border-main)', color: '#03dac6', border: '1px solid #03dac6', borderRadius: '12px', padding: '2px 8px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.3s ease' }}>
                    + INVITE
                  </button>
                )}
              </div>
            </div>
            
            <ul style={{ listStyle: 'none', padding: '0 5px', margin: 0, overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {playerList.map((p, index) => {
                const isMe = p.name === playerInfo.playerName;
                const isDrawer = p.name === currentDrawer;
                const hasGuessed = correctGuessers.includes(p.name);
                const isUnderdog = underdogs.includes(p.id) && !isDrawer; // NEW: Detect Underdog
                
                return (
                  <li 
                    key={index}
                    className={isUnderdog ? "underdog-glow" : ""} 
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                      padding: '10px 14px', borderRadius: '12px',
                      backgroundColor: hasGuessed ? 'rgba(3, 218, 198, 0.15)' : (isMe ? 'rgba(187, 134, 252, 0.15)' : 'var(--bg-player)'),
                      border: isUnderdog ? '2px solid transparent' : (hasGuessed ? '1px solid #03dac6' : (isMe ? '1px solid #bb86fc' : '1px solid transparent')),
                      transition: 'all 0.3s ease', boxShadow: isUnderdog ? 'none' : '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: hasGuessed ? '#03dac6' : (isUnderdog ? '#ff9800' : 'var(--border-main)'), color: hasGuessed || isUnderdog ? '#000' : 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold', flexShrink: 0, transition: 'all 0.3s ease' }}>
                        {isUnderdog ? '🔥' : (index + 1)}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ fontSize: '15px', fontWeight: 'bold', color: hasGuessed ? '#03dac6' : (isUnderdog ? '#ff9800' : (isMe ? '#bb86fc' : 'var(--text-main)')), whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', transition: 'color 0.3s ease' }}>
                          {p.name} {isMe && '(You)'}
                        </span>
                        <span style={{ fontSize: '11px', color: isUnderdog ? '#ff9800' : 'var(--text-muted)', marginTop: '2px', transition: 'color 0.3s ease' }}>
                          {hasGuessed ? '✔️ Guessed correctly!' : (isDrawer ? '✏️ Drawing...' : (isUnderdog ? '🔥 Underdog Buff!' : 'Guesser'))}
                        </span>
                      </div>
                    </div>
                    
                    <span style={{ fontSize: '16px', fontWeight: '900', color: hasGuessed ? '#03dac6' : (isUnderdog ? '#ff9800' : 'var(--text-main)'), flexShrink: 0, transition: 'color 0.3s ease' }}>
                      {p.score}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Drawing Board */}
        <div className="center-canvas">
          <div className="canvas-wrapper">
            
            {/* FIX: Uses CSS classes now so it can shrink on mobile! */}
            <div className="game-clock">
              {timeLeft > 0 ? timeLeft : "0"}
            </div>

            {/* NEW: Space-optimized Like and Dislike buttons for Guessers */}
            {!isMyTurn && currentDrawer && !isChoosing && !winner && !hasVotedThisTurn && (
              <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '8px', zIndex: 60 }}>
                <button 
                  onClick={() => {
                    socketRef.current.emit('like_drawing');
                    setHasVotedThisTurn(true); // NEW: Hide both buttons immediately!
                  }}
                  style={{ background: 'rgba(76, 175, 80, 0.2)', border: '2px solid #4caf50', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', transition: 'transform 0.1s ease', backdropFilter: 'blur(4px)' }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.85)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  title="Like"
                >👍</button>
                <button 
                  onClick={() => {
                    socketRef.current.emit('dislike_drawing');
                    setHasVotedThisTurn(true); // NEW: Hide both buttons immediately!
                  }}
                  style={{ background: 'rgba(244, 67, 54, 0.2)', border: '2px solid #f44336', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', transition: 'transform 0.1s ease', backdropFilter: 'blur(4px)' }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.85)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  title="Dislike"
                >👎</button>
              </div>
            )}

            {!currentDrawer ? (
              <div className="waiting-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', pointerEvents: 'auto' }}>
                {waitingForHost ? (
                  <>
                    <div style={{ color: '#bb86fc' }}>Waiting for host to start the game...</div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      {isHost && playerList.length >= 2 && (
                        <button onClick={() => {
                          socketRef.current.emit('start_private_game')
                        }} 
                        style={{ padding: '12px 20px', background: '#03dac6', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', transition: 'transform 0.1s ease' }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
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
                🏆 {winner[0]?.name} won the game!
              </div>
            ) : (
              <div 
                className="floating-status" 
                style={{ 
                  fontSize: 'clamp(13px, 4vw, 20px)', letterSpacing: '1px', padding: '6px 14px',
                  /* FIX: The bar turns bright Teal if you guessed the word correctly! */
                  backgroundColor: correctGuessers.includes(playerInfo.playerName) ? 'rgba(3, 218, 198, 0.9)' : 'rgba(55, 0, 179, 0.85)',
                  color: correctGuessers.includes(playerInfo.playerName) ? '#000' : 'white'
                }}
              >
                {/* FIX: Fully reveals the word for the Drawer AND for any Guesser who solved it! */}
                {(isMyTurn || correctGuessers.includes(playerInfo.playerName)) 
                  ? secretWord.toUpperCase().split(' ').join('\u00A0\u00A0') 
                  : getDynamicHint()}
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
                  : activeTool === 'bucket' 
                    ? 'crosshair' 
                    : ['ruler', 'circle', 'rect', 'triangle'].includes(activeTool)
                      ? 'cell'
                      : activeTool === 'spray'
                        ? 'alias'
                        : `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${brushSize + 6}" height="${brushSize + 6}"><circle cx="${(brushSize + 6) / 2}" cy="${(brushSize + 6) / 2}" r="${brushSize / 2}" fill="${brushColor.replace('#', '%23')}" stroke="%23000000" stroke-width="2"/><circle cx="${(brushSize + 6) / 2}" cy="${(brushSize + 6) / 2}" r="${brushSize / 2}" fill="none" stroke="%23ffffff" stroke-width="0.5"/></svg>') ${Math.round((brushSize + 6) / 2)} ${Math.round((brushSize + 6) / 2)}, crosshair` 
              }}
            />

           {/* FIX: Completely hides the toolbar from Guessers for a clean view! */}
            {/* FIX: Completely hides the toolbar from Guessers for a clean view! */}
            {isMyTurn && (
              <div className="toolbar" style={{ boxSizing: 'border-box' }}>
                
                {/* --- DESKTOP TOOLBAR (1 Clean Row) --- */}
                {/* --- DESKTOP TOOLBAR (1 Clean Row - SCALED UP) --- */}
                {/* --- DESKTOP TOOLBAR (Medium Size) --- */}
                <div className="desktop-only">
                  {/* Color Box */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => {setShowColorPicker(!showColorPicker); setShowSizePicker(false); setShowShapePicker(false);}}
                      style={{ width: '40px', height: '40px', borderRadius: '8px', cursor: 'pointer', padding: 0, backgroundColor: brushColor, border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}
                    />
                    {showColorPicker && (
                      <div className="color-popup">
                        {presetColors.map(color => (
                          <button key={color} onClick={() => { setBrushColor(color); if (activeTool === 'bucket') setActiveTool('brush'); setShowColorPicker(false); }} style={{ aspectRatio: '1', width: '100%', borderRadius: '5px', cursor: 'pointer', padding: 0, backgroundColor: color, border: brushColor === color ? '2px solid #fff' : '1px solid #333', transform: brushColor === color ? 'scale(1.15)' : 'scale(1)' }} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="toolbar-divider" />

                  {/* Brush & Bucket */}
                  <button onClick={() => {setActiveTool('brush'); setShowColorPicker(false); setShowSizePicker(false); setShowShapePicker(false);}} style={{ background: activeTool === 'brush' ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', padding: '8px 12px' }}>🖌️</button>
                  <button onClick={() => {setActiveTool('bucket'); setShowColorPicker(false); setShowSizePicker(false); setShowShapePicker(false);}} style={{ background: activeTool === 'bucket' ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', padding: '8px 12px' }}>🪣</button>

                  {/* Blue Dot Size */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
                    <button onClick={() => {setShowSizePicker(!showSizePicker); setShowColorPicker(false); setShowShapePicker(false);}} style={{ width: '40px', height: '40px', borderRadius: '8px', cursor: 'pointer', padding: 0, background: 'transparent', border: '1px solid #666', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <div style={{ width: `${Math.min(brushSize, 30)}px`, height: `${Math.min(brushSize, 30)}px`, backgroundColor: '#1E90FF', borderRadius: '50%' }} />
                    </button>
                    {showSizePicker && (
                      <div className="size-popup">
                        {[4, 8, 14, 20, 26, 32].map(size => (
                          <button key={size} onClick={() => { setBrushSize(size); if (activeTool === 'bucket') setActiveTool('brush'); setShowSizePicker(false); }} style={{ width: '38px', height: '38px', borderRadius: '8px', cursor: 'pointer', padding: 0, backgroundColor: 'transparent', border: brushSize === size ? '2px solid #fff' : '1px solid transparent', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <div style={{ width: `${size}px`, height: `${size}px`, backgroundColor: '#1E90FF', borderRadius: '50%' }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="toolbar-divider" />

                  {/* Spray Can */}
                  <button onClick={() => {setActiveTool('spray'); setShowColorPicker(false); setShowSizePicker(false); setShowShapePicker(false);}} style={{ background: activeTool === 'spray' ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', padding: '8px 12px' }}>💨</button>

                  {/* Desktop Shape Menu */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <button onClick={() => {setShowShapePicker(!showShapePicker); setShowColorPicker(false); setShowSizePicker(false);}} style={{ background: ['ruler', 'circle', 'rect', 'triangle'].includes(activeTool) ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', padding: '8px 12px' }}>
                      {activeTool === 'ruler' ? '📏' : activeTool === 'circle' ? '⭕' : activeTool === 'rect' ? '⬜' : activeTool === 'triangle' ? '🔺' : '📐'}
                    </button>
                    {showShapePicker && (
                      <div className="shape-popup">
                        {[ { id: 'ruler', icon: '📏' }, { id: 'circle', icon: '⭕' }, { id: 'rect', icon: '⬜' }, { id: 'triangle', icon: '🔺' } ].map(tool => (
                          <button key={tool.id} onClick={() => {setActiveTool(tool.id); setShowShapePicker(false);}} style={{ background: activeTool === tool.id ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', padding: '8px 12px' }}>{tool.icon}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="toolbar-divider" />

                  {/* Undo, Redo, Trash */}
                  <button onClick={() => { handleUndo(); socketRef.current.emit('undo'); }} style={{ background: 'transparent', border: '1px solid #666', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', padding: '8px 12px' }}>↩️</button>
                  <button onClick={() => { handleRedo(); socketRef.current.emit('redo'); }} style={{ background: 'transparent', border: '1px solid #666', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', padding: '8px 12px' }}>↪️</button>
                  <button onClick={handleClearBoard} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '22px', padding: '8px 12px' }}>🗑️</button>
                </div>

                {/* --- MOBILE TOOLBAR (2 Distant Rows) --- */}
                <div className="mobile-only">
                  
                  {/* Row 1: Essentials */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '4px' }}>
                    
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => {setShowColorPicker(!showColorPicker); setShowSizePicker(false);}} style={{ width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', padding: 0, backgroundColor: brushColor, border: '2px solid #fff', boxShadow: '0 2px 5px rgba(0,0,0,0.4)' }} />
                      {showColorPicker && (
                        <div className="color-popup">
                          {presetColors.map(color => (
                            <button key={color} onClick={() => { setBrushColor(color); if (activeTool === 'bucket') setActiveTool('brush'); setShowColorPicker(false); }} style={{ aspectRatio: '1', width: '100%', borderRadius: '4px', cursor: 'pointer', padding: 0, backgroundColor: color, border: brushColor === color ? '2px solid #fff' : '1px solid #333', transform: brushColor === color ? 'scale(1.15)' : 'scale(1)' }} />
                          ))}
                        </div>
                      )}
                    </div>

                    <button onClick={() => {setActiveTool('brush'); setShowColorPicker(false); setShowSizePicker(false);}} style={{ background: activeTool === 'brush' ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', padding: '6px', flexGrow: 1 }}>🖌️</button>
                    <button onClick={() => {setActiveTool('bucket'); setShowColorPicker(false); setShowSizePicker(false);}} style={{ background: activeTool === 'bucket' ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', padding: '6px', flexGrow: 1 }}>🪣</button>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <button onClick={() => {setShowSizePicker(!showSizePicker); setShowColorPicker(false);}} style={{ width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', padding: 0, background: 'transparent', border: '1px solid #666', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{ width: `${Math.min(brushSize, 26)}px`, height: `${Math.min(brushSize, 26)}px`, backgroundColor: '#1E90FF', borderRadius: '50%' }} />
                      </button>
                      {showSizePicker && (
                        <div className="size-popup">
                          {[4, 8, 14, 20, 26].map(size => (
                            <button key={size} onClick={() => { setBrushSize(size); if (activeTool === 'bucket') setActiveTool('brush'); setShowSizePicker(false); }} style={{ width: '36px', height: '36px', borderRadius: '8px', cursor: 'pointer', padding: 0, backgroundColor: 'transparent', border: brushSize === size ? '2px solid #fff' : '1px solid transparent', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              <div style={{ width: `${size}px`, height: `${size}px`, backgroundColor: '#1E90FF', borderRadius: '50%' }} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button onClick={() => { handleUndo(); socketRef.current.emit('undo'); }} style={{ background: 'transparent', border: '1px solid #666', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', padding: '6px', flexGrow: 1 }}>↩️</button>
                    <button onClick={() => { handleRedo(); socketRef.current.emit('redo'); }} style={{ background: 'transparent', border: '1px solid #666', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', padding: '6px', flexGrow: 1 }}>↪️</button>
                    <button onClick={handleClearBoard} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '6px' }}>🗑️</button>
                  </div>

                  {/* Row 2: Assistant Tools */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '6px' }}>
                    {[ { id: 'spray', icon: '💨' }, { id: 'ruler', icon: '📏' }, { id: 'circle', icon: '⭕' }, { id: 'rect', icon: '⬜' }, { id: 'triangle', icon: '🔺' } ].map(tool => (
                      <button 
                        key={tool.id} 
                        onClick={() => {setActiveTool(tool.id); setShowColorPicker(false); setShowSizePicker(false);}} 
                        style={{ background: activeTool === tool.id ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '6px', cursor: 'pointer', fontSize: '18px', padding: '8px 6px', flexGrow: 1 }}
                      >
                        {tool.icon}
                      </button>
                    ))}
                  </div>

                </div>
              </div>
            )}

          </div> {/* NEW: Restored missing canvas-wrapper closing tag */}
        </div> {/* NEW: Restored missing center-canvas closing tag */}

       {/* Chat Box */}
        <div className="sidebar-right">
          {isSocketReady && (
            <ChatBox socket={socketRef.current} playerInfo={playerInfo} isMyTurn={isMyTurn} />
          )}
        </div>

        {/* NEW: Turn Summary Overlay */}
        {turnSummary && !winner && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            /* FIX: Boosted zIndex to 999 so it fully covers the mobile canvas! */
            backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 999, 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ background: 'var(--bg-panel)', padding: '30px', borderRadius: '16px', textAlign: 'center', border: '2px solid #03dac6', boxShadow: '0 10px 40px rgba(0,0,0,0.6)', width: '90%', maxWidth: '400px' }}>
              <h2 style={{ color: '#FFD54F', margin: '0 0 10px 0', fontSize: '24px' }}>{turnSummary.reason}</h2>
              <div style={{ color: 'var(--text-muted)', marginBottom: '5px' }}>The word was</div>
              <h1 style={{ color: '#03dac6', margin: '0 0 25px 0', fontSize: '32px', letterSpacing: '2px', textTransform: 'uppercase' }}>{turnSummary.word}</h1>
              
              <div style={{ background: 'var(--bg-player)', borderRadius: '10px', padding: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {turnSummary.scores.map((p, idx) => (
                    <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: idx < turnSummary.scores.length - 1 ? '1px solid var(--border-main)' : 'none', fontWeight: 'bold' }}>
                      <span style={{ color: p.earned > 0 ? '#bb86fc' : 'var(--text-main)' }}>{p.name}</span>
                      <span style={{ color: p.earned > 0 ? '#03dac6' : 'var(--text-muted)' }}>+{p.earned} pts</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* NEW: Word Choosing Phase Overlay */}
        {isChoosing && !turnSummary && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            /* FIX: Boosted zIndex to 999 here as well to protect it from mobile canvas overlap! */
            backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 999,
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
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-main)', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', transition: 'all 0.3s ease' }}>
              
              {/* NEW: Title & Theme Toggle Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-main)', paddingBottom: '15px', marginBottom: '15px', transition: 'border-color 0.3s ease' }}>
                <h2 style={{ color: '#bb86fc', margin: 0 }}>Lobby Players</h2>
                <button 
                  onClick={() => setIsLightMode(!isLightMode)}
                  style={{ background: 'var(--bg-player)', border: '1px solid var(--border-main)', color: 'var(--text-main)', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.3s ease' }}
                >
                  {isLightMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
                </button>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, maxHeight: '300px', overflowY: 'auto' }}>
                {playerList.map(p => {
                  const isUnderdog = underdogs.includes(p.id) && p.name !== currentDrawer;
                  return (
                  <li key={p.id || p.name} style={{ display: 'flex', flexDirection: 'column', padding: '12px 0', borderBottom: '1px solid var(--border-main)', color: 'var(--text-main)', transition: 'all 0.3s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: p.name === playerInfo.playerName ? 'bold' : 'normal', color: p.name === playerInfo.playerName ? '#03dac6' : (isUnderdog ? '#ff9800' : 'var(--text-main)'), transition: 'color 0.3s ease' }}>
                        {isUnderdog ? '🔥 ' : ''}{p.name} {p.name === playerInfo.playerName ? '(You)' : ''} - {p.score} pts
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
                    </div>
                    {/* NEW: Explicitly explain the buff in the pop-up menu! */}
                    {isUnderdog && (
                      <div style={{ marginTop: '10px', fontSize: '12px', color: '#ff9800', background: 'rgba(255, 152, 0, 0.15)', padding: '10px', borderRadius: '8px', border: '1px dashed #ff9800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <span style={{ fontSize: '20px' }}>🔥</span> 
                         <span><strong>Underdog Ability Active:</strong> If this player guesses the word 1st, they get double points (300 pts)!</span>
                      </div>
                    )}
                  </li>
                )})}
              </ul>
              
              {/* FIX 1: Restored the missing Close Button and closing tags for the modal! */}
              <button 
                onClick={() => setShowPlayerModal(false)} 
                style={{ width: '100%', padding: '12px', background: 'var(--border-main)', color: 'var(--text-main)', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '15px', fontWeight: 'bold', transition: 'all 0.3s ease' }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* --- NEW: Advanced Statistical Game Over Screen --- */}
        {/* FIX 2: Added Array.isArray(winner) to stop the app from crashing if Render hasn't updated your backend yet! */}
        {winner && Array.isArray(winner) && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 15, 20, 0.95)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)', padding: '20px', overflowY: 'auto'
          }}>
            {/* Embedded animation keyframes so the UI builds up cinematically */}
            <style>{`
              @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
              @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
            `}</style>
            
            <h1 style={{ color: '#03dac6', fontSize: 'clamp(32px, 6vw, 55px)', margin: '0 0 5px 0', textShadow: '0 0 20px rgba(3, 218, 198, 0.5)', animation: 'scaleIn 0.5s ease-out' }}>
              MATCH RESULTS
            </h1>
            <p style={{ color: '#bb86fc', fontSize: '16px', margin: '0 0 30px 0', letterSpacing: '3px', fontWeight: 'bold' }}>
              FINAL LEADERBOARD & STATS
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%', maxWidth: '800px' }}>
              
              {/* TOP 3 PODIUM */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '10px', height: '180px', marginTop: '10px' }}>
                
                {/* Silver - 2nd Place */}
                {winner[1] && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%', animation: 'slideUp 0.6s ease forwards', opacity: 0, animationDelay: '0.2s' }}>
                    <div style={{ fontSize: '20px', marginBottom: '5px', color: '#C0C0C0', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{winner[1].name}</div>
                    <div style={{ fontSize: '16px', color: '#fff', marginBottom: '10px' }}>{winner[1].score} pts</div>
                    <div style={{ width: '100%', height: '100px', background: 'linear-gradient(to top, #424242, #9E9E9E)', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '10px', fontSize: '40px' }}>🥈</div>
                  </div>
                )}
                
                {/* Gold - 1st Place */}
                {winner[0] && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '35%', animation: 'slideUp 0.6s ease forwards', zIndex: 10 }}>
                    <div style={{ fontSize: '24px', marginBottom: '5px', color: '#FFD54F', fontWeight: '900', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textShadow: '0 0 10px rgba(255,215,0,0.4)' }}>{winner[0].name}</div>
                    <div style={{ fontSize: '18px', color: '#fff', marginBottom: '10px', fontWeight: 'bold' }}>{winner[0].score} pts</div>
                    <div style={{ width: '100%', height: '140px', background: 'linear-gradient(to top, #F57F17, #FFD54F)', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '10px', fontSize: '50px', boxShadow: '0 -10px 30px rgba(255,215,0,0.2)' }}>👑</div>
                  </div>
                )}
                
                {/* Bronze - 3rd Place */}
                {winner[2] && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%', animation: 'slideUp 0.6s ease forwards', opacity: 0, animationDelay: '0.4s' }}>
                    <div style={{ fontSize: '20px', marginBottom: '5px', color: '#CD7F32', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{winner[2].name}</div>
                    <div style={{ fontSize: '16px', color: '#fff', marginBottom: '10px' }}>{winner[2].score} pts</div>
                    <div style={{ width: '100%', height: '70px', background: 'linear-gradient(to top, #4E342E, #8D6E63)', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '10px', fontSize: '35px' }}>🥉</div>
                  </div>
                )}
              </div>

              {/* STATISTICAL BAR CHARTS */}
              <div style={{ background: 'var(--bg-panel)', padding: '20px 25px', borderRadius: '16px', border: '1px solid #333', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', animation: 'scaleIn 0.5s ease-out forwards', opacity: 0, animationDelay: '0.6s' }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '16px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Performance Data</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '220px', overflowY: 'auto', paddingRight: '10px' }}>
                  {winner.map((p, idx) => {
                    const topScore = Math.max(winner[0]?.score || 1, 1);
                    const barWidth = Math.max((p.score / topScore) * 100, 2); 
                    
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ width: '25px', color: '#888', fontWeight: 'bold', textAlign: 'right', fontSize: '14px' }}>#{idx + 1}</div>
                        <div style={{ width: '110px', color: '#e0e0e0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '15px' }}>{p.name}</div>
                        <div style={{ flexGrow: 1, height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                          <div style={{ width: `${barWidth}%`, height: '100%', background: idx === 0 ? '#FFD54F' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : '#bb86fc', borderRadius: '6px', transition: 'width 1.5s cubic-bezier(0.2, 0.8, 0.2, 1)' }} />
                        </div>
                        <div style={{ width: '40px', textAlign: 'right', color: '#fff', fontWeight: 'bold', fontSize: '15px' }}>{p.score}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px', animation: 'scaleIn 0.5s ease-out forwards', opacity: 0, animationDelay: '1s' }}>
                {(!isPrivate || isHost) ? (
                  <button 
                    onClick={() => socketRef.current.emit('return_to_lobby')}
                    style={{ padding: '16px 36px', fontSize: '18px', fontWeight: '900', color: '#000', background: 'linear-gradient(135deg, #03dac6, #018786)', border: 'none', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(3, 218, 198, 0.4)', transition: 'transform 0.1s ease', textTransform: 'uppercase', letterSpacing: '1px' }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    Proceed to Next Game ➡️
                  </button>
                ) : (
                  <div style={{ padding: '16px 32px', fontSize: '16px', color: '#bb86fc', background: 'rgba(187, 134, 252, 0.1)', border: '1px solid #bb86fc', borderRadius: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>
                    ⏳ Waiting for Host to Proceed...
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

      </div>
    </>
  )
}