import { useRef, useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import ChatBox from './ChatBox'
import PlayerList from './PlayerList'       // NEW
import GameToolbar from './GameToolbar'     // NEW
import { soundManager } from './soundManager' 
import '../styles/game.css' // NEW: Import extracted game styles

export default function GameRoom({ playerInfo, onJoinError }) {
  const canvasRef = useRef(null)
  const contextRef = useRef(null)
  const previewCanvasRef = useRef(null)  // NEW: Overlay canvas for cheap shape previews
  const previewContextRef = useRef(null) 
  const pointBuffer = useRef([])         // NEW: Memory buffer for drawing packets
  const socketRef = useRef(null)
  
  const [isDrawing, setIsDrawing] = useState(false)
  const [isSocketReady, setIsSocketReady] = useState(false)
  const [isMyTurn, setIsMyTurn] = useState(false) 
  
  const [gameStatus, setGameStatus] = useState("Waiting for a second player to join...") 
  const [playerList, setPlayerList] = useState([])
  const [timeLeft, setTimeLeft] = useState(0)
  const endsAtRef = useRef(0) // NEW: Local authoritative clock target
  const [winner, setWinner] = useState(null)
  const [currentDrawer, setCurrentDrawer] = useState("") 
  const [secretWord, setSecretWord] = useState("") 
  const [currentRound, setCurrentRound] = useState(1) 
  const [showPlayerModal, setShowPlayerModal] = useState(false)
  const [roomId, setRoomId] = useState(null)
  const [isHost, setIsHost] = useState(false)
  const [waitingForHost, setWaitingForHost] = useState(false)
  const [maxRounds, setMaxRounds] = useState(3)
  const [hintLevel, setHintLevel] = useState(2) 
  const [totalDrawTime, setTotalDrawTime] = useState(120) 
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [roomPassword, setRoomPassword] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [transferTarget, setTransferTarget] = useState("")
  const [isChoosing, setIsChoosing] = useState(false)
  const [wordChoices, setWordChoices] = useState([])
  const [underdogs, setUnderdogs] = useState([]) 
  const [wordSkeleton, setWordSkeleton] = useState([])
  const [revealedChars, setRevealedChars] = useState({})
  const [correctGuessers, setCorrectGuessers] = useState([])
  
  const [turnSummary, setTurnSummary] = useState(null) 
   
  
  const [hasVotedThisTurn, setHasVotedThisTurn] = useState(false) 
  
  // --- NEW: Offline & Session Management ---
  const [connectionState, setConnectionState] = useState('connected')
  const offlineStrokes = useRef([]) // Queues drawing actions while disconnected
  const hasJoined = useRef(false) // FIX: Tracks if this is an initial join or a reconnect!

  

  // --- NEW: Theme Toggle State & Effect ---
  const [isLightMode, setIsLightMode] = useState(true)
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
  
  const shapeStartRef = useRef(null)
  const savedImageRef = useRef(null)
  const sprayIntervalRef = useRef(null)
  const lastEmitRef = useRef({ x: 0, y: 0 })

  // --- NEW: Undo / Redo Memory Stacks ---
  const undoStack = useRef([])
  const redoStack = useRef([])

  const saveState = () => {
    if (!canvasRef.current || !contextRef.current) return
    const data = contextRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
    undoStack.current.push(data)
    if (undoStack.current.length > 10) undoStack.current.shift() 
  }

  const handleUndo = () => {
    if (undoStack.current.length > 1) {
      redoStack.current.push(undoStack.current.pop())
      const previousState = undoStack.current[undoStack.current.length - 1]
      contextRef.current.putImageData(previousState, 0, 0)
    }
  }

  const handleRedo = () => {
    if (redoStack.current.length > 0) {
      const nextState = redoStack.current.pop()
      undoStack.current.push(nextState)
      contextRef.current.putImageData(nextState, 0, 0)
    }
  }

  const lastTickRef = useRef(null) 

  // --- NEW: Timer Tick Effect (Last 10 Seconds) ---
  useEffect(() => {
    const totalGuessers = playerList.length - 1;
    const everyoneGuessed = totalGuessers > 0 && correctGuessers.length >= totalGuessers;

    if (timeLeft <= 10 && timeLeft > 1 && currentDrawer && !winner && !turnSummary && !isChoosing && !everyoneGuessed) {
      if (lastTickRef.current !== timeLeft) {
        lastTickRef.current = timeLeft;
        soundManager.stop('tick'); // Rewind safely
        soundManager.play('tick');
      }
    } else if (timeLeft > 10 || isChoosing || turnSummary || everyoneGuessed || timeLeft <= 1) {
      lastTickRef.current = null;
      soundManager.stop('tick');
    }
  }, [timeLeft, currentDrawer, winner, turnSummary, isChoosing, correctGuessers.length, playerList.length])

  const getDynamicHint = (showFullWord) => {
    if (!wordSkeleton || wordSkeleton.length === 0) return "";

    const displayElements = [];
    let absoluteIndex = 0;
    const isWinner = correctGuessers.includes(playerInfo.playerName) || isMyTurn;
    
    wordSkeleton.forEach((b, blockIdx) => {
      if (b.isWord) {
        let wordChars = [];
        for (let i = 0; i < b.length; i++) {
          const charIndex = absoluteIndex + i;
          const serverChar = revealedChars[charIndex];
          const isHinted = serverChar !== undefined; 
          
          let displayChar = '_';
          if (isWinner && secretWord) {
             displayChar = secretWord[charIndex]?.toUpperCase() || '_'; 
          } else if (isHinted) {
             displayChar = serverChar; 
          }
          
          const highlightColor = isHinted ? '#FFD54F' : (isWinner ? '#ffffff' : 'inherit'); 
          const shadowEffect = isHinted ? '0 0 8px rgba(255, 213, 79, 0.6)' : 'none';
          const weight = (isHinted || isWinner) ? '900' : 'normal';
          
          wordChars.push(
            <span key={charIndex} style={{ color: highlightColor, textShadow: shadowEffect, fontWeight: weight, transition: 'all 0.3s ease' }}>
              {displayChar}
            </span>
          );
        }
        absoluteIndex += b.length;
        
        displayElements.push(
          <span key={`block_${blockIdx}`} style={{ whiteSpace: 'nowrap', display: 'inline-flex', gap: '4px' }}>
            {wordChars}
            <span style={{ fontSize: '11px', verticalAlign: 'super', marginLeft: '4px', opacity: 0.8, color: 'white', textShadow: 'none' }}>
              {b.length}
            </span>
          </span>
        );
      } else {
        const specialChars = [];
        for(let i = 0; i < b.text.length; i++) {
            if (b.text[i] === ' ') {
                specialChars.push(<span key={i} style={{ width: '20px', display: 'inline-block' }}></span>);
            } else {
                specialChars.push(<span key={i} style={{ margin: '0 4px', fontWeight: '900', color: '#FF5252', textShadow: '0 0 6px rgba(255, 82, 82, 0.6)' }}>{b.text[i]}</span>);
            }
        }
        absoluteIndex += b.text.length;
        
        displayElements.push(
          <span key={`block_${blockIdx}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {specialChars}
          </span>
        );
      }
    });

    return (
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 0px' }}>
        {displayElements}
      </span>
    );
  }

  const restingViewportHeightRef = useRef(
    window.visualViewport ? window.visualViewport.height : window.innerHeight
  )

  useEffect(() => {
    const vv = window.visualViewport

    const applyHeights = () => {
      const liveHeight = vv ? vv.height : window.innerHeight
      if (liveHeight > restingViewportHeightRef.current) {
        restingViewportHeightRef.current = liveHeight
      }
      const restingHeight = restingViewportHeightRef.current

      let canvasHeight = Math.floor(restingHeight * 0.42)
      if (liveHeight < canvasHeight + 120) {
        canvasHeight = Math.max(100, liveHeight - 120) 
      }
      
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

  useEffect(() => {
    window.history.pushState(null, null, window.location.href)
    const handleBackSwipe = () => {
      window.history.pushState(null, null, window.location.href)
    }
    window.addEventListener('popstate', handleBackSwipe)

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
    const context = canvas.getContext('2d', { willReadFrequently: true })
    
    // NEW: Setup preview canvas
    const previewCanvas = previewCanvasRef.current
    if (previewCanvas) {
      previewCanvas.width = 800
      previewCanvas.height = 600
      const previewContext = previewCanvas.getContext('2d')
      previewContext.lineCap = 'round'
      previewContextRef.current = previewContext
    }
    
    const clearCanvas = () => {
      context.fillStyle = 'white'
      context.fillRect(0, 0, canvas.width, canvas.height)
      undoStack.current = [] 
      redoStack.current = []
      undoStack.current.push(context.getImageData(0, 0, canvas.width, canvas.height)) 
    }
    clearCanvas()
    
    context.lineCap = 'round'
    contextRef.current = context

    // https://skribbl-backend-dgot.onrender.com

    socketRef.current = io('https://skribbl-backend-dgot.onrender.com') 
    setIsSocketReady(true)

    // --- NEW: Smart Connection Bootstrap ---
    // This fires on the very first load AND every time Chrome wakes up and reconnects
    socketRef.current.on('connect', () => {
      console.log('Socket connected! Checking for existing session...');
      socketRef.current.emit('resume_session', { sessionId: playerInfo.sessionId });
    });

    socketRef.current.on('room_joined', (data) => {
      setRoomId(data.roomId)
      setIsHost(data.isHost)
      setIsPrivate(data.isPrivate)
      setMaxRounds(data.maxRounds)
      if (data.hintLevel) setHintLevel(data.hintLevel)
      if (data.drawTime) setTotalDrawTime(data.drawTime)
      if (data.maxPlayers) setMaxPlayers(data.maxPlayers)
      if (data.password) setRoomPassword(data.password)
    })

    socketRef.current.on('room_settings_updated', (data) => {
      setMaxRounds(data.maxRounds)
      setTotalDrawTime(data.drawTime)
      setHintLevel(data.hintLevel)
      setMaxPlayers(data.maxPlayers)
    })

    socketRef.current.on('host_updated', (newHostId) => {
      setIsHost(socketRef.current.id === newHostId);
    })

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
    
    socketRef.current.on('game_started', () => {
      soundManager.play('start');
    })

    socketRef.current.on('update_players', (playersArray) => {
      const sortedPlayers = playersArray.sort((a, b) => b.score - a.score)
      setPlayerList(sortedPlayers)
    })

    socketRef.current.on('update_underdogs', (newUnderdogs) => {
      setUnderdogs(newUnderdogs || [])
    })

    socketRef.current.on('round_update', (data) => {
      setIsMyTurn(data.drawerName === playerInfo.playerName)
      if (data.endsAt) endsAtRef.current = data.endsAt; // Sync local target
      setCurrentDrawer(data.drawerName) 
      setWinner(null) 
      
      setIsDrawing(false)
      if (sprayIntervalRef.current) clearInterval(sprayIntervalRef.current) 
      if (data.maxRounds) setMaxRounds(data.maxRounds)
      if (data.hintLevel) setHintLevel(data.hintLevel) 
      
      if (data.underdogs) setUnderdogs(data.underdogs)
      else setUnderdogs([])
      
      if (data.skeleton) setWordSkeleton(data.skeleton) 
      else setWordSkeleton([])
      
      setIsChoosing(false) 
      setWaitingForHost(false)
      setSecretWord("") 
      setRevealedChars({}) 
      setTimeLeft(120) 
      setCurrentRound(data.currentRound || 1); 
      
      setHasVotedThisTurn(false) 

      if (data.drawerName !== playerInfo.playerName) {
        soundManager.play('select');
      }
    })

    socketRef.current.on('room_error', (errorMessage) => {
      if (onJoinError) {
        onJoinError(errorMessage); 
      } else {
        alert(errorMessage);
        window.location.href = '/'; 
      }
    })

    socketRef.current.on('kicked_from_server', () => {
      alert("You have been kicked from the lobby by a vote.");
      window.location.href = '/'; 
    })
    
    socketRef.current.on('game_over', (winnerName) => {
      setWinner(winnerName)
      setTurnSummary(null) 
      setIsChoosing(false) 
      soundManager.play('win');
    })
    
    socketRef.current.on('turn_summary', (data) => {
      setTurnSummary(data)
      soundManager.play('summary');
    })

    socketRef.current.on('choosing_word', (data) => {
      setWaitingForHost(false)
      setIsChoosing(true)
      setTurnSummary(null) 
      setCurrentDrawer(data.drawerName)
      setIsMyTurn(data.drawerName === playerInfo.playerName)
      setSecretWord("") 
      setWinner(null)
      setHasVotedThisTurn(false) 
    })

    socketRef.current.on('your_word_choices', (words) => {
      setWordChoices(words)
    })
    
    socketRef.current.on('waiting_for_players', () => {
      setCurrentDrawer(""); setSecretWord(""); setIsMyTurn(false); setTimeLeft(0); setWinner(null); setIsChoosing(false); clearCanvas();
    })

   socketRef.current.on('disconnect', (reason) => {
      console.log(`Socket disconnected due to: ${reason}`);
      setConnectionState('reconnecting');
    });

    socketRef.current.on('session_restored', () => {
      console.log('Session fully restored!');
      hasJoined.current = true;
      setConnectionState('restored');
      setTimeout(() => setConnectionState('connected'), 2000);
      socketRef.current.emit('request_game_state');
      
      // Send any drawings the player made while offline!
      if (offlineStrokes.current.length > 0) {
        offlineStrokes.current.forEach(stroke => {
          if (stroke.data) socketRef.current.emit(stroke.event, stroke.data);
          else socketRef.current.emit(stroke.event);
        });
        offlineStrokes.current = [];
      }
    });

    socketRef.current.on('session_restore_failed', () => {
      if (!hasJoined.current) {
        // Initial load: Backend says "I don't know this session." So we join normally!
        console.log('Joining as a new player.');
        socketRef.current.emit('join_game', playerInfo);
        hasJoined.current = true;
      } else {
        // We were playing, tabbed out for > 30s, and the backend deleted us.
        console.log('Grace period expired. Wiping session and returning to menu.');
        setConnectionState('lost');
        sessionStorage.removeItem('dn_playerInfo'); 
        
        // NEW: Safely kick the user back to the menu without forcing a destructive page reload!
        if (onJoinError) {
          setTimeout(() => onJoinError("Connection lost permanently. Please rejoin the lobby."), 1000);
        }
      }
    });

    socketRef.current.on('game_state_snapshot', (data) => {
       if (data.gameState === 'drawing') {
          setIsMyTurn(data.currentDrawerId === socketRef.current.id);
          setCurrentDrawer(data.drawerName);
          if (data.endsAt) endsAtRef.current = data.endsAt;
          setTimeLeft(data.timeRemaining);
          setWordSkeleton(data.wordSkeleton || []);
          setRevealedChars(data.revealedChars || {});
          
          // NEW: Replay the entire batched drawing history cleanly!
          if (data.drawingHistory && data.drawingHistory.length > 0 && contextRef.current) {
            const ctx = contextRef.current;
            data.drawingHistory.forEach(action => {
              if (action.type === 'start') {
                ctx.strokeStyle = action.color; ctx.lineWidth = action.size;
                ctx.beginPath(); ctx.moveTo(action.x, action.y); ctx.lineTo(action.x, action.y); ctx.stroke();
              } else if (action.type === 'draw') {
                ctx.strokeStyle = action.color; ctx.lineWidth = action.size;
                ctx.lineTo(action.x, action.y); ctx.stroke();
              } else if (action.type === 'draw_packet' && action.points.length > 0) {
                ctx.strokeStyle = action.color; ctx.lineWidth = action.size;
                ctx.beginPath(); ctx.moveTo(action.points[0].x, action.points[0].y);
                for (let i = 1; i < action.points.length; i++) ctx.lineTo(action.points[i].x, action.points[i].y);
                ctx.stroke();
              } else if (action.type === 'stop') {
                ctx.closePath(); saveState(); redoStack.current = [];
              } else if (action.type === 'fill') {
                applyFill(ctx, canvasRef.current, action.x, action.y, action.color);
              } else if (action.type === 'undo') handleUndo();
              else if (action.type === 'redo') handleRedo();
            });
          }
       }
    });

    const handleVisibility = () => {
      if (
    document.visibilityState === 'visible' &&
    socketRef.current &&
    !socketRef.current.connected
) {
    // REPLACEMENT: Force Socket.IO to attempt a reconnect instead of wiping the page
    console.log("Page visible again, forcing socket reconnect...");
    socketRef.current.connect(); 
}
    }
    document.addEventListener('visibilitychange', handleVisibility)

    socketRef.current.on('secret_word', (word) => {
      setSecretWord(word);
    })

    socketRef.current.on('clear_board', () => {
      clearCanvas()
    })

    // No more 1-second interval pings! The server only sends this when a hint actually appears.
    socketRef.current.on('hint_update', (chars) => {
      if (chars) setRevealedChars(chars);
    });

    socketRef.current.on('time_reduction', (data) => {
      endsAtRef.current = data.endsAt; // Sync when someone gets the first guess early
    });

    // NEW: Local Client Countdown Timer (Saves incredible amounts of bandwidth!)
    const localTimer = setInterval(() => {
      if (endsAtRef.current > 0) {
        setTimeLeft(Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000)));
      }
    }, 1000);

    socketRef.current.on('start', (data) => {
      contextRef.current.strokeStyle = data.color || '#000000'
      contextRef.current.lineWidth = data.size || 5
      contextRef.current.beginPath()
      contextRef.current.moveTo(data.x, data.y)
      contextRef.current.lineTo(data.x, data.y)
      contextRef.current.stroke()
    })
    
    socketRef.current.on('draw', (data) => {
      contextRef.current.strokeStyle = data.color || '#000000'
      contextRef.current.lineWidth = data.size || 5
      contextRef.current.lineTo(data.x, data.y)
      contextRef.current.stroke()
    })
    
    // NEW: Unpack and draw a batched array of lines instantly
    socketRef.current.on('draw_packet', (data) => {
      if (!data.points || data.points.length === 0) return;
      contextRef.current.strokeStyle = data.color || '#000000'
      contextRef.current.lineWidth = data.size || 5
      contextRef.current.beginPath()
      contextRef.current.moveTo(data.points[0].x, data.points[0].y)
      for (let i = 1; i < data.points.length; i++) {
        contextRef.current.lineTo(data.points[i].x, data.points[i].y)
      }
      contextRef.current.stroke()
    })
    
    // Removed old toDataURL socket relays for memory efficiency.
    
    socketRef.current.on('stop', () => {
      contextRef.current.closePath()
      saveState() 
      redoStack.current = []
    })

    socketRef.current.on('fill', (data) => {
      applyFill(contextRef.current, canvasRef.current, data.x, data.y, data.color)
    })

    socketRef.current.on('undo', () => handleUndo())
    socketRef.current.on('redo', () => handleRedo())

    socketRef.current.on('correct_guess', () => {
      soundManager.play('success');
    })    

    socketRef.current.on('chat_message', (data) => {
      if (data.isGuess) {
        setCorrectGuessers(prev => prev.includes(data.sender) ? prev : [...prev, data.sender]);
      }
    })

    socketRef.current.on('round_update', () => setCorrectGuessers([]));
    socketRef.current.on('waiting_for_players', () => setCorrectGuessers([]));
    socketRef.current.on('waiting_for_host', () => setCorrectGuessers([]));
    socketRef.current.on('choosing_word', () => setCorrectGuessers([]));

    // NEW: Send buffered points every 40ms to drastically reduce Socket.IO event overhead
    const packetInterval = setInterval(() => {
      if (pointBuffer.current.length > 0) {
        emitDrawCommand('draw_packet', { 
           points: pointBuffer.current, 
           color: contextRef.current.strokeStyle, 
           size: contextRef.current.lineWidth 
        });
        pointBuffer.current = []; // Clear buffer after sending
      }
    }, 40);

    return () => {
      clearInterval(packetInterval); 
      clearInterval(localTimer); // Cleanup local countdown
      document.removeEventListener('visibilitychange', handleVisibility)
      socketRef.current.disconnect()
    }
  }, [playerInfo.playerName])

  // --- NEW: Command buffer that automatically intercepts drawings if offline! ---
  const emitDrawCommand = (event, data = null) => {
    if (socketRef.current && socketRef.current.connected) {
      if (data) socketRef.current.emit(event, data);
      else socketRef.current.emit(event);
    } else {
      offlineStrokes.current.push({ event, data });
    }
  }
  
  const getCoordinates = (e) => {
    const clientX = e.clientX;
    const clientY = e.clientY;
    
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  const applyFill = (ctx, canvas, x, y, colorHex) => {
    const hexToRgb = (h) => [parseInt(h.slice(1,3), 16), parseInt(h.slice(3,5), 16), parseInt(h.slice(5,7), 16), 255]
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imgData.data
    const [fR, fG, fB, fA] = hexToRgb(colorHex)
    const startPos = (Math.floor(y) * canvas.width + Math.floor(x)) * 4
    const sR = data[startPos], sG = data[startPos+1], sB = data[startPos+2], sA = data[startPos+3]
    
    const tolerance = 16; 
    
    if (Math.abs(sR - fR) <= tolerance && Math.abs(sG - fG) <= tolerance && Math.abs(sB - fB) <= tolerance) return;
    const match = (p) => {
      return Math.abs(data[p] - sR) <= tolerance && 
             Math.abs(data[p+1] - sG) <= tolerance && 
             Math.abs(data[p+2] - sB) <= tolerance && 
             Math.abs(data[p+3] - sA) <= tolerance;
    }
    
    const color = (p) => { data[p]=fR; data[p+1]=fG; data[p+2]=fB; data[p+3]=fA }
    
    const stack = [[Math.floor(x), Math.floor(y)]]
    const w = canvas.width, h = canvas.height
    
    while(stack.length) {
      let [cx, cy] = stack.pop()
      let p = (cy * w + cx) * 4
      while(cy >= 0 && match(p)) { cy--; p -= w*4 }
      
      if (cy >= 0) color(p); 
      
      p += w*4; cy++
      let rL = false, rR = false
      while(cy < h && match(p)) {
        color(p)
        if (cx > 0) {
          if (match(p - 4)) { if (!rL) { stack.push([cx - 1, cy]); rL = true } }
          else { rL = false; color(p - 4); } 
        }
        if (cx < w - 1) {
          if (match(p + 4)) { if (!rR) { stack.push([cx + 1, cy]); rR = true } }
          else { rR = false; color(p + 4); } 
        }
        cy++; p += w*4
      }
      if (cy < h) color(p); 
    }
    ctx.putImageData(imgData, 0, 0)
    
    undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    if (undoStack.current.length > 10) undoStack.current.shift()
    redoStack.current = []
  }

  const startDrawing = (e) => {
    if (!isMyTurn) return;
    e.preventDefault(); 
    e.currentTarget.setPointerCapture(e.pointerId); // Keep drawing even if cursor leaves the canvas element
    
    const { x, y } = getCoordinates(e);
    
    pointBuffer.current = [{x, y}]; // Seed the buffer

    if (activeTool === 'bucket') {
      applyFill(contextRef.current, canvasRef.current, x, y, brushColor);
      emitDrawCommand('fill', { x, y, color: brushColor });
      return;
    }

    if (['ruler', 'circle', 'rect', 'triangle'].includes(activeTool)) {
      shapeStartRef.current = { sx: x, sy: y, ex: x, ey: y };
      // REMOVED getImageData to save CPU!
      setIsDrawing(true);
      return;
    }

    if (activeTool === 'spray' || activeTool === 'rainbowSpray') {
      setIsDrawing(true);
      if (sprayIntervalRef.current) clearInterval(sprayIntervalRef.current);
      
      const sprayDrop = (cx, cy) => {
        const sprayRadius = brushSize * 1.5; 
        const sprayDensity = Math.min(20, Math.max(8, Math.floor(brushSize * 0.8))); 
        
        for (let i = 0; i < sprayDensity; i++) {
           const angle = Math.random() * Math.PI * 2;
           const radius = Math.random() * sprayRadius;
           const dotX = cx + Math.cos(angle) * radius;
           const dotY = cy + Math.sin(angle) * radius;
           
           let dotColor = brushColor;
           if (activeTool === 'rainbowSpray') {
             const hue = Math.floor(Math.random() * 360);
             dotColor = `hsl(${hue}, 100%, 50%)`;
           }
           
           contextRef.current.fillStyle = dotColor;
           contextRef.current.fillRect(dotX, dotY, 4, 4);
           
           if (i < 2) {
             emitDrawCommand('start', { x: dotX, y: dotY, color: dotColor, size: 4 });
           }
        }
      };
      sprayDrop(x, y);
      shapeStartRef.current = { sx: x, sy: y };
      sprayIntervalRef.current = setInterval(() => {
         if (shapeStartRef.current) sprayDrop(shapeStartRef.current.sx, shapeStartRef.current.sy);
      }, 75); 
      return;
    }
    
    contextRef.current.strokeStyle = brushColor;
    contextRef.current.lineWidth = brushSize;
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
    
    setIsDrawing(true);
    lastEmitRef.current = { x, y }; 
    emitDrawCommand('start', { x, y, color: brushColor, size: brushSize });
  }

  const draw = (e) => {
    if (!isDrawing || !isMyTurn) return;
    e.preventDefault();

    if (e.buttons !== 1 && e.pointerType === 'mouse') {
      stopDrawing();
      return;
    }

    const { x, y } = getCoordinates(e);

    if (['ruler', 'circle', 'rect', 'triangle'].includes(activeTool)) {
       const dist = Math.abs(x - shapeStartRef.current.ex) + Math.abs(y - shapeStartRef.current.ey);
       if (dist < 4) return; 
       
       shapeStartRef.current.ex = x;
       shapeStartRef.current.ey = y;
       
       // Draw the preview directly on the cheap overlay canvas
       const pCtx = previewContextRef.current;
       pCtx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
       pCtx.strokeStyle = brushColor;
       pCtx.lineWidth = brushSize;
       pCtx.beginPath();
       
       const { sx, sy } = shapeStartRef.current;

       if (activeTool === 'ruler') {
          pCtx.moveTo(sx, sy);
          pCtx.lineTo(x, y);
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

    if (activeTool === 'spray' || activeTool === 'rainbowSpray') {
       shapeStartRef.current.sx = x;
       shapeStartRef.current.sy = y;
       return;
    }
    
    contextRef.current.strokeStyle = brushColor;
    contextRef.current.lineWidth = brushSize;
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
    
    const dist = Math.abs(x - lastEmitRef.current.x) + Math.abs(y - lastEmitRef.current.y);
    if (dist > 6) {
      pointBuffer.current.push({ x, y }); // Push to memory buffer instead of emitting immediately!
      lastEmitRef.current = { x, y };
    }
  }

  const stopDrawing = () => {
    if (!isDrawing) return;
    
    if (activeTool === 'spray' || activeTool === 'rainbowSpray') {
       clearInterval(sprayIntervalRef.current);
       setIsDrawing(false);
       saveState();
       redoStack.current = [];
       return;
    }

    if (['ruler', 'circle', 'rect', 'triangle'].includes(activeTool)) {
       const { sx, sy, ex, ey } = shapeStartRef.current;
       
       // Clear overlay and commit the final image to the permanent canvas
       previewContextRef.current.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
       
       contextRef.current.strokeStyle = brushColor;
       contextRef.current.lineWidth = brushSize;
       contextRef.current.beginPath();
       
       if (activeTool === 'ruler') {
          contextRef.current.moveTo(sx, sy);
          contextRef.current.lineTo(ex, ey);
          emitDrawCommand('start', { x: sx, y: sy, color: brushColor, size: brushSize });
          emitDrawCommand('draw', { x: ex, y: ey, color: brushColor, size: brushSize });
          emitDrawCommand('stop');
       } else if (activeTool === 'rect') {
          emitDrawCommand('start', { x: sx, y: sy, color: brushColor, size: brushSize });
          emitDrawCommand('draw', { x: ex, y: sy, color: brushColor, size: brushSize });
          emitDrawCommand('draw', { x: ex, y: ey, color: brushColor, size: brushSize });
          emitDrawCommand('draw', { x: sx, y: ey, color: brushColor, size: brushSize });
          emitDrawCommand('draw', { x: sx, y: sy, color: brushColor, size: brushSize });
          emitDrawCommand('stop');
       } else if (activeTool === 'triangle') {
          const midX = sx + (ex - sx) / 2;
          emitDrawCommand('start', { x: midX, y: sy, color: brushColor, size: brushSize });
          emitDrawCommand('draw', { x: ex, y: ey, color: brushColor, size: brushSize });
          emitDrawCommand('draw', { x: sx, y: ey, color: brushColor, size: brushSize });
          emitDrawCommand('draw', { x: midX, y: sy, color: brushColor, size: brushSize });
          emitDrawCommand('stop');
       } else if (activeTool === 'circle') {
          const radius = Math.sqrt(Math.pow(ex - sx, 2) + Math.pow(ey - sy, 2));
          const segments = 40; 
          emitDrawCommand('start', { x: sx + radius, y: sy, color: brushColor, size: brushSize });
          for (let i = 1; i <= segments; i++) {
             const angle = (i * 2 * Math.PI) / segments;
             emitDrawCommand('draw', { x: sx + Math.cos(angle) * radius, y: sy + Math.sin(angle) * radius, color: brushColor, size: brushSize });
          }
          emitDrawCommand('stop');
       }
       setIsDrawing(false);
       saveState();
       redoStack.current = [];
       return;
    }

    contextRef.current.closePath();
    setIsDrawing(false);
    
    // Force flush any remaining buffer points before lifting the brush
    if (pointBuffer.current.length > 0) {
      emitDrawCommand('draw_packet', { points: pointBuffer.current, color: brushColor, size: brushSize });
      pointBuffer.current = [];
    }
    
    emitDrawCommand('stop');
    
    saveState();
    redoStack.current = [];
  }

  const handleClearBoard = () => {
    if (!isMyTurn) return
    emitDrawCommand('clear_board')
  }

  return (
    <>
      {/* NEW: Polished, subtle, non-blocking connection banner! */}
      {connectionState !== 'connected' && (
        <div style={{ position: 'fixed', top: '15px', left: '50%', transform: 'translateX(-50%)', padding: '8px 18px', borderRadius: '24px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', zIndex: 10000, color: '#fff', backgroundColor: connectionState === 'reconnecting' ? 'rgba(245, 124, 0, 0.9)' : connectionState === 'restored' ? 'rgba(76, 175, 80, 0.9)' : 'rgba(211, 47, 47, 0.9)', backdropFilter: 'blur(6px)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', transition: 'all 0.3s' }}>
          {connectionState === 'reconnecting' ? '🟡 Reconnecting...' : connectionState === 'restored' ? '✓ Back in the game' : '🔴 Connection lost — restoring game...'}
        </div>
      )}
      
      <div className={`game-layout ${isMyTurn ? 'layout-drawer' : 'layout-guesser'}`}>
        
        {/* Extracted Leaderboard Component */}
        <PlayerList 
          playerList={playerList}
          playerInfo={playerInfo}
          currentDrawer={currentDrawer}
          correctGuessers={correctGuessers}
          underdogs={underdogs}
          currentRound={currentRound}
          maxRounds={maxRounds}
          isPrivate={isPrivate}
          roomId={roomId}
          setShowPlayerModal={setShowPlayerModal}
          setShowSettingsModal={setShowSettingsModal}
        />

        {/* Drawing Board */}
        <div className="center-canvas">
          <div className="canvas-wrapper">
            
            <div className="game-clock">
              {timeLeft > 0 ? timeLeft : "0"}
            </div>

            {!isMyTurn && currentDrawer && !isChoosing && !winner && !hasVotedThisTurn && (
              <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '8px', zIndex: 60 }}>
                <button 
                  onClick={() => {
                    socketRef.current.emit('like_drawing');
                    setHasVotedThisTurn(true); 
                  }}
                  style={{ background: 'rgba(76, 175, 80, 0.2)', border: '2px solid #4caf50', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', transition: 'transform 0.1s ease', backdropFilter: 'blur(4px)' }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.85)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  title="Like"
                >👍</button>
                <button 
                  onClick={() => {
                    socketRef.current.emit('dislike_drawing');
                    setHasVotedThisTurn(true); 
                  }}
                  style={{ background: 'rgba(244, 67, 54, 0.2)', border: '2px solid #f44336', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', transition: 'transform 0.1s ease', backdropFilter: 'blur(4px)' }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.85)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  title="Dislike"
                >👎</button>
              </div>
            )}

            {!currentDrawer ? (
              <div className="waiting-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', pointerEvents: 'auto', width: '90%', maxWidth: '400px' }}>
                {waitingForHost ? (
                  <>
                    <div style={{ color: '#bb86fc', fontSize: '22px' }}>{isHost ? "Lobby Settings" : "Waiting for host..."}</div>
                    
                    {isPrivate && (
                      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-main)', padding: '15px', borderRadius: '12px', width: '100%', fontSize: '15px', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', pointerEvents: 'auto', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <span style={{ fontWeight: 'bold' }}>Max Players: <span style={{ color: '#03dac6' }}>{maxPlayers}</span></span>
                           {isHost && <input type="range" min="2" max="8" value={maxPlayers} onChange={e => { setMaxPlayers(e.target.value); socketRef.current.emit('update_room_settings', { maxPlayers: e.target.value }); }} style={{ width: '120px', cursor: 'pointer' }} />}
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <span style={{ fontWeight: 'bold' }}>Total Rounds: <span style={{ color: '#bb86fc' }}>{maxRounds}</span></span>
                           {isHost && <input type="range" min="1" max="10" value={maxRounds} onChange={e => { setMaxRounds(e.target.value); socketRef.current.emit('update_room_settings', { maxRounds: e.target.value }); }} style={{ width: '120px', cursor: 'pointer' }} />}
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <span style={{ fontWeight: 'bold' }}>Draw Time: <span style={{ color: '#FFD54F' }}>{totalDrawTime}s</span></span>
                           {isHost && <input type="range" min="30" max="300" step="10" value={totalDrawTime} onChange={e => { setTotalDrawTime(e.target.value); socketRef.current.emit('update_room_settings', { drawTime: e.target.value }); }} style={{ width: '120px', cursor: 'pointer' }} />}
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <span style={{ fontWeight: 'bold' }}>Hint Amount: <span style={{ color: '#FF5252' }}>{hintLevel == 1 ? 'Low' : hintLevel == 2 ? 'Norm' : hintLevel == 3 ? 'High' : 'Max'}</span></span>
                           {isHost && <input type="range" min="1" max="4" value={hintLevel} onChange={e => { setHintLevel(e.target.value); socketRef.current.emit('update_room_settings', { hintLevel: e.target.value }); }} style={{ width: '120px', cursor: 'pointer' }} />}
                        </div>
                      </div>
                    )}

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
                          setInviteCopied(true);
                          setTimeout(() => setInviteCopied(false), 5000);
                        }} style={{ padding: '12px 20px', background: inviteCopied ? '#4caf50' : '#bb86fc', color: inviteCopied ? '#fff' : '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', transition: 'all 0.3s ease' }}>
                          {inviteCopied ? '✔️ Copied to Clipboard!' : '📋 Copy Invite Link'}
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
                  backgroundColor: correctGuessers.includes(playerInfo.playerName) ? 'rgba(3, 218, 198, 0.9)' : 'rgba(55, 0, 179, 0.85)',
                  color: correctGuessers.includes(playerInfo.playerName) ? '#000' : 'white'
                }}
              >
                {getDynamicHint(isMyTurn || correctGuessers.includes(playerInfo.playerName))}
              </div>
            )}
            
              <canvas
                ref={canvasRef}
                className="game-canvas"
                style={{ position: 'absolute', zIndex: 1 }}
              />
              <canvas
                ref={previewCanvasRef}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
                onPointerOut={stopDrawing}
                className="game-canvas"
                style={{ position: 'absolute', zIndex: 2, touchAction: 'none', backgroundColor: 'transparent',
                  cursor: !isMyTurn 
                    ? 'not-allowed' 
                  : activeTool === 'bucket' 
                    ? 'crosshair' 
                    : ['ruler', 'circle', 'rect', 'triangle'].includes(activeTool)
                      ? 'cell'
                      : (activeTool === 'spray' || activeTool === 'rainbowSpray')
                        ? 'alias'
                        : `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${brushSize + 6}" height="${brushSize + 6}"><circle cx="${(brushSize + 6) / 2}" cy="${(brushSize + 6) / 2}" r="${brushSize / 2}" fill="${brushColor.replace('#', '%23')}" stroke="%23000000" stroke-width="2"/><circle cx="${(brushSize + 6) / 2}" cy="${(brushSize + 6) / 2}" r="${brushSize / 2}" fill="none" stroke="%23ffffff" stroke-width="0.5"/></svg>') ${Math.round((brushSize + 6) / 2)} ${Math.round((brushSize + 6) / 2)}, crosshair` 
              }}
            />

            {isMyTurn && (
              <GameToolbar 
                brushColor={brushColor}
                setBrushColor={setBrushColor}
                brushSize={brushSize}
                setBrushSize={setBrushSize}
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                handleUndo={handleUndo}
                handleRedo={handleRedo}
                handleClearBoard={handleClearBoard}
                emitDrawCommand={emitDrawCommand}
              />
            )}

          </div> 
        </div> 

        <div className="sidebar-right">
          {isSocketReady && (
            <ChatBox socket={socketRef.current} playerInfo={playerInfo} isMyTurn={isMyTurn} />
          )}
        </div>

        {turnSummary && !winner && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
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

        {isChoosing && !turnSummary && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
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
                        soundManager.play('select');
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

        {showPlayerModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 200,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-main)', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', transition: 'all 0.3s ease' }}>
              
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', borderBottom: '1px solid var(--border-main)', paddingBottom: '15px', marginBottom: '15px', transition: 'border-color 0.3s ease' }}>
                <h2 style={{ color: '#bb86fc', margin: 0 }}>Lobby Players</h2>
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
                    {isUnderdog && (
                      <div style={{ marginTop: '10px', fontSize: '12px', color: '#ff9800', background: 'rgba(255, 152, 0, 0.15)', padding: '10px', borderRadius: '8px', border: '1px dashed #ff9800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <span style={{ fontSize: '20px' }}>🔥</span> 
                         <span><strong>Late Joiner Buff Active:</strong> This player earns DOUBLE points on every correct guess until they catch up to the top players!</span>
                      </div>
                    )}
                  </li>
                )})}
              </ul>
              
              <button 
                onClick={() => setShowPlayerModal(false)} 
                style={{ width: '100%', padding: '12px', background: 'var(--border-main)', color: 'var(--text-main)', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '15px', fontWeight: 'bold', transition: 'all 0.3s ease' }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {showSettingsModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-main)', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
              
              <h2 style={{ color: '#bb86fc', margin: '0 0 20px 0', textAlign: 'center', borderBottom: '1px solid var(--border-main)', paddingBottom: '10px' }}>⚙️ Game Settings</h2>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '10px', background: 'var(--bg-player)', borderRadius: '8px', border: '1px solid var(--border-main)' }}>
                <strong style={{ color: 'var(--text-main)' }}>Theme</strong>
                <button 
                  onClick={() => setIsLightMode(!isLightMode)}
                  style={{ background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border-main)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {isLightMode ? '🌙 Switch to Dark Mode' : '☀️ Switch to Light Mode'}
                </button>
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-player)', borderRadius: '8px', marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-main)', border: '1px solid var(--border-main)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Room Type:</strong> <span>{isPrivate ? 'Private' : 'Public'}</span></div>
                {isPrivate && <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Password:</strong> <span>{roomPassword || 'None'}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Max Players:</strong> <span>{maxPlayers}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Total Rounds:</strong> <span>{maxRounds}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Draw Time:</strong> <span>{totalDrawTime}s</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Hint Level:</strong> <span>{hintLevel == 1 ? 'Low' : hintLevel == 2 ? 'Normal' : hintLevel == 3 ? 'High' : 'Max'}</span></div>
              </div>

              {isHost && isPrivate && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select 
                      value={transferTarget} 
                      onChange={(e) => setTransferTarget(e.target.value)}
                      style={{ flexGrow: 1, padding: '8px', borderRadius: '6px', background: 'var(--bg-player)', color: 'var(--text-main)', border: '1px solid var(--border-main)', outline: 'none' }}
                    >
                      <option value="">-- Transfer Host To --</option>
                      {playerList.filter(p => p.name !== playerInfo.playerName).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => {
                        if (transferTarget && window.confirm("Are you sure you want to transfer host?")) {
                          socketRef.current.emit('transfer_host', transferTarget);
                          setShowSettingsModal(false);
                        }
                      }}
                      style={{ background: '#03dac6', color: '#000', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      Assign
                    </button>
                  </div>

                  <button 
                    onClick={() => {
                      if (window.confirm("This will end the current game and return everyone to the waiting lobby canvas to change settings. Are you sure?")) {
                        socketRef.current.emit('restart_lobby');
                        setShowSettingsModal(false);
                      }
                    }}
                    style={{ background: '#ff3b30', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}
                  >
                    🔄 Restart Lobby & Change Settings
                  </button>
                </div>
              )}

              <button 
                onClick={() => setShowSettingsModal(false)} 
                style={{ width: '100%', padding: '12px', background: '#bb86fc', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {winner && Array.isArray(winner) && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 15, 20, 0.95)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)', padding: '20px', overflowY: 'auto'
          }}>
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
              
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '10px', height: '180px', marginTop: '10px' }}>
                
                {winner[1] && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%', animation: 'slideUp 0.6s ease forwards', opacity: 0, animationDelay: '0.2s' }}>
                    <div style={{ fontSize: '20px', marginBottom: '5px', color: '#C0C0C0', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{winner[1].name}</div>
                    <div style={{ fontSize: '16px', color: '#fff', marginBottom: '10px' }}>{winner[1].score} pts</div>
                    <div style={{ width: '100%', height: '100px', background: 'linear-gradient(to top, #424242, #9E9E9E)', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '10px', fontSize: '40px' }}>🥈</div>
                  </div>
                )}
                
                {winner[0] && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '35%', animation: 'slideUp 0.6s ease forwards', zIndex: 10 }}>
                    <div style={{ fontSize: '24px', marginBottom: '5px', color: '#FFD54F', fontWeight: '900', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textShadow: '0 0 10px rgba(255,215,0,0.4)' }}>{winner[0].name}</div>
                    <div style={{ fontSize: '18px', color: '#fff', marginBottom: '10px', fontWeight: 'bold' }}>{winner[0].score} pts</div>
                    <div style={{ width: '100%', height: '140px', background: 'linear-gradient(to top, #F57F17, #FFD54F)', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '10px', fontSize: '50px', boxShadow: '0 -10px 30px rgba(255,215,0,0.2)' }}>👑</div>
                  </div>
                )}
                
                {winner[2] && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%', animation: 'slideUp 0.6s ease forwards', opacity: 0, animationDelay: '0.4s' }}>
                    <div style={{ fontSize: '20px', marginBottom: '5px', color: '#CD7F32', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{winner[2].name}</div>
                    <div style={{ fontSize: '16px', color: '#fff', marginBottom: '10px' }}>{winner[2].score} pts</div>
                    <div style={{ width: '100%', height: '70px', background: 'linear-gradient(to top, #4E342E, #8D6E63)', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '10px', fontSize: '35px' }}>🥉</div>
                  </div>
                )}
              </div>

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