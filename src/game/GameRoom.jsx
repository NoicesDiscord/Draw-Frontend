import { useRef, useState, useEffect } from 'react'
import ChatBox from '../components/ChatBox'
import PlayerList from '../components/PlayerList'
import GameToolbar from '../components/GameToolbar'
import GameModals from '../components/GameModals'
import DrawingCanvas from '../canvas/DrawingCanvas'
import { useGameSocket } from '../network/useGameSocket'
import { soundManager } from '../audio/soundManager'
import '../styles/game.css'

export default function GameRoom({ playerInfo, onJoinError }) {
  // Refs
  const canvasRef = useRef(null)
  const contextRef = useRef(null)
  const previewCanvasRef = useRef(null) 
  const previewContextRef = useRef(null) 
  const pointBuffer = useRef([])        
  const socketRef = useRef(null)
  const endsAtRef = useRef(0) 
  const offlineStrokes = useRef([]) 
  const hasJoined = useRef(false) 
  const undoStack = useRef([])
  const redoStack = useRef([])
  const lastTickRef = useRef(null) 
  
  // State
  const [isSocketReady, setIsSocketReady] = useState(false)
  const [isMyTurn, setIsMyTurn] = useState(false) 
  const [playerList, setPlayerList] = useState([])
  const [timeLeft, setTimeLeft] = useState(0)
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
  const [inviteCopied, setInviteCopied] = useState(false)
  const [connectionState, setConnectionState] = useState('connected')
  const [isLightMode, setIsLightMode] = useState(true)
  const [brushColor, setBrushColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(5)
  const [activeTool, setActiveTool] = useState('brush') 

  // Theme Toggler
  useEffect(() => {
    if (isLightMode) document.body.classList.add('light-mode')
    else document.body.classList.remove('light-mode')
  }, [isLightMode])

  // Improved Viewport Logic (Simpler, allows CSS Flex to handle layout)
  useEffect(() => {
    const vv = window.visualViewport;
    const applyHeights = () => {
      const liveHeight = vv ? vv.height : window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${liveHeight}px`);
    }
    applyHeights();
    if (vv) { vv.addEventListener('resize', applyHeights); vv.addEventListener('scroll', applyHeights) } 
    else { window.addEventListener('resize', applyHeights) }
    window.addEventListener('orientationchange', applyHeights);
    return () => {
      if (vv) { vv.removeEventListener('resize', applyHeights); vv.removeEventListener('scroll', applyHeights) } 
      else { window.removeEventListener('resize', applyHeights) }


      window.removeEventListener('orientationchange', applyHeights);
      }
    }, []);

    

  // Block Back Swipe
  useEffect(() => {
    window.history.pushState(null, null, window.location.href)
    const handleBackSwipe = () => window.history.pushState(null, null, window.location.href)
    const handleBeforeUnload = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('popstate', handleBackSwipe)
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('popstate', handleBackSwipe)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // Canvas Initialization
  const clearCanvas = () => {
    if (!contextRef.current || !canvasRef.current) return;
    contextRef.current.fillStyle = 'white'
    contextRef.current.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    undoStack.current = [] 
    redoStack.current = []
    undoStack.current.push(contextRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)) 
  }

  useEffect(() => {
    const canvas = canvasRef.current
    // Use high resolution for crisp lines, CSS will handle responsive sizing
    canvas.width = 1200; canvas.height = 900
    const context = canvas.getContext('2d', { willReadFrequently: true })
    
    const previewCanvas = previewCanvasRef.current
    if (previewCanvas) {
      previewCanvas.width = 1200; previewCanvas.height = 900
      const previewContext = previewCanvas.getContext('2d')
      previewContext.lineCap = 'round'
      previewContextRef.current = previewContext
    }
    
    context.lineCap = 'round'
    contextRef.current = context
    clearCanvas()
  }, [])

  // Drawing Helpers
  const saveState = () => {
    if (!canvasRef.current || !contextRef.current) return
    undoStack.current.push(contextRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height))
    if (undoStack.current.length > 10) undoStack.current.shift() 
  }

  const handleUndo = () => {
    if (undoStack.current.length > 1) {
      redoStack.current.push(undoStack.current.pop())
      contextRef.current.putImageData(undoStack.current[undoStack.current.length - 1], 0, 0)
    }
  }

  const handleRedo = () => {
    if (redoStack.current.length > 0) {
      const nextState = redoStack.current.pop()
      undoStack.current.push(nextState)
      contextRef.current.putImageData(nextState, 0, 0)
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
    const match = (p) => Math.abs(data[p] - sR) <= tolerance && Math.abs(data[p+1] - sG) <= tolerance && Math.abs(data[p+2] - sB) <= tolerance && Math.abs(data[p+3] - sA) <= tolerance;
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
        if (cx > 0) { if (match(p - 4)) { if (!rL) { stack.push([cx - 1, cy]); rL = true } } else { rL = false; color(p - 4); } }
        if (cx < w - 1) { if (match(p + 4)) { if (!rR) { stack.push([cx + 1, cy]); rR = true } } else { rR = false; color(p + 4); } }
        cy++; p += w*4
      }
      if (cy < h) color(p); 
    }
    ctx.putImageData(imgData, 0, 0)
    undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    if (undoStack.current.length > 10) undoStack.current.shift()
    redoStack.current = []
  }

  // --- NETWORK INJECTION ---
  const { emitDrawCommand } = useGameSocket({
    playerInfo, onJoinError, socketRef, canvasRef, contextRef, pointBuffer, endsAtRef,
    offlineStrokes, hasJoined, undoStack, redoStack, setIsSocketReady, setRoomId, setIsHost,
    setIsPrivate, setMaxRounds, setHintLevel, setTotalDrawTime, setMaxPlayers, setRoomPassword,
    setWaitingForHost, setCurrentDrawer, setSecretWord, setIsMyTurn, setTimeLeft, setWinner,
    setIsChoosing, setPlayerList, setUnderdogs, setWordSkeleton, setCurrentRound,
    setHasVotedThisTurn, setTurnSummary, setWordChoices, setConnectionState, setRevealedChars,
    setCorrectGuessers, applyFill, saveState, handleUndo, handleRedo, clearCanvas
  });

  const handleClearBoard = () => { if (isMyTurn) emitDrawCommand('clear_board') }

  // Tick Sound Effect
  useEffect(() => {
    const totalGuessers = playerList.length - 1;
    const everyoneGuessed = totalGuessers > 0 && correctGuessers.length >= totalGuessers;
    if (timeLeft <= 10 && timeLeft > 1 && currentDrawer && !winner && !turnSummary && !isChoosing && !everyoneGuessed) {
      if (lastTickRef.current !== timeLeft) {
        lastTickRef.current = timeLeft;
        soundManager.stop('tick'); soundManager.play('tick');
      }
    } else if (timeLeft > 10 || isChoosing || turnSummary || everyoneGuessed || timeLeft <= 1) {
      lastTickRef.current = null; soundManager.stop('tick');
    }
  }, [timeLeft, currentDrawer, winner, turnSummary, isChoosing, correctGuessers.length, playerList.length])

  const getDynamicHint = (showFullWord) => {
    if (!wordSkeleton || wordSkeleton.length === 0) return "";
    const displayElements = []; let absoluteIndex = 0;
    const isWinner = correctGuessers.includes(playerInfo.playerName) || isMyTurn;
    wordSkeleton.forEach((b, blockIdx) => {
      if (b.isWord) {
        let wordChars = [];
        for (let i = 0; i < b.length; i++) {
          const charIndex = absoluteIndex + i; const serverChar = revealedChars[charIndex];
          const isHinted = serverChar !== undefined; 
          let displayChar = '_';
          if (isWinner && secretWord) displayChar = secretWord[charIndex]?.toUpperCase() || '_'; 
          else if (isHinted) displayChar = serverChar; 
          const highlightColor = isHinted ? '#FFD54F' : (isWinner ? '#ffffff' : 'inherit'); 
          const shadowEffect = isHinted ? '0 0 8px rgba(255, 213, 79, 0.6)' : 'none';
          const weight = (isHinted || isWinner) ? '900' : 'normal';
          wordChars.push(<span key={charIndex} style={{ color: highlightColor, textShadow: shadowEffect, fontWeight: weight, transition: 'all 0.3s ease' }}>{displayChar}</span>);
        }
        absoluteIndex += b.length;
        displayElements.push(<span key={`block_${blockIdx}`} style={{ whiteSpace: 'nowrap', display: 'inline-flex', gap: '4px' }}>{wordChars}<span style={{ fontSize: '11px', verticalAlign: 'super', marginLeft: '4px', opacity: 0.8, color: 'white', textShadow: 'none' }}>{b.length}</span></span>);
      } else {
        const specialChars = [];
        for(let i = 0; i < b.text.length; i++) {
            if (b.text[i] === ' ') specialChars.push(<span key={i} style={{ width: '20px', display: 'inline-block' }}></span>);
            else specialChars.push(<span key={i} style={{ margin: '0 4px', fontWeight: '900', color: '#FF5252', textShadow: '0 0 6px rgba(255, 82, 82, 0.6)' }}>{b.text[i]}</span>);
        }
        absoluteIndex += b.text.length;
        displayElements.push(<span key={`block_${blockIdx}`} style={{ display: 'inline-flex', alignItems: 'center' }}>{specialChars}</span>);
      }
    });
    return <span style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 0px' }}>{displayElements}</span>;
  }

  return (
    <>
      {connectionState !== 'connected' && (
        <div style={{ position: 'fixed', top: '15px', left: '50%', transform: 'translateX(-50%)', padding: '8px 18px', borderRadius: '24px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', zIndex: 10000, color: '#fff', backgroundColor: connectionState === 'reconnecting' ? 'rgba(245, 124, 0, 0.9)' : connectionState === 'restored' ? 'rgba(76, 175, 80, 0.9)' : 'rgba(211, 47, 47, 0.9)', backdropFilter: 'blur(6px)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', transition: 'all 0.3s' }}>
          {connectionState === 'reconnecting' ? '🟡 Reconnecting...' : connectionState === 'restored' ? '✓ Back in the game' : '🔴 Connection lost — restoring game...'}
        </div>
      )}
      
      <div className={`game-layout ${isMyTurn ? 'layout-drawer' : 'layout-guesser'}`}>
        
        <PlayerList 
          playerList={playerList} playerInfo={playerInfo} currentDrawer={currentDrawer} correctGuessers={correctGuessers}
          underdogs={underdogs} currentRound={currentRound} maxRounds={maxRounds} isPrivate={isPrivate}
          roomId={roomId} setShowPlayerModal={setShowPlayerModal} setShowSettingsModal={setShowSettingsModal}
        />

        <div className="center-canvas">
          <div className="canvas-wrapper">
            <div className="game-clock">{timeLeft > 0 ? timeLeft : "0"}</div>

            {!isMyTurn && currentDrawer && !isChoosing && !winner && !hasVotedThisTurn && (
              <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '8px', zIndex: 60 }}>
                <button onClick={() => { socketRef.current.emit('like_drawing'); setHasVotedThisTurn(true); }} style={{ background: 'rgba(76, 175, 80, 0.2)', border: '2px solid #4caf50', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', transition: 'transform 0.1s ease', backdropFilter: 'blur(4px)' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.85)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'} title="Like">👍</button>
                <button onClick={() => { socketRef.current.emit('dislike_drawing'); setHasVotedThisTurn(true); }} style={{ background: 'rgba(244, 67, 54, 0.2)', border: '2px solid #f44336', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', transition: 'transform 0.1s ease', backdropFilter: 'blur(4px)' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.85)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'} title="Dislike">👎</button>
              </div>
            )}

            {!currentDrawer ? (
              <div className="waiting-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', pointerEvents: 'auto', width: '90%', maxWidth: '400px' }}>
                {waitingForHost ? (
                  <>
                    <div style={{ color: '#bb86fc', fontSize: '22px' }}>{isHost ? "Lobby Settings" : "Waiting for host..."}</div>
                    {isPrivate && (
                      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-main)', padding: '15px', borderRadius: '12px', width: '100%', fontSize: '15px', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', pointerEvents: 'auto', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontWeight: 'bold' }}>Max Players: <span style={{ color: '#03dac6' }}>{maxPlayers}</span></span>{isHost && <input type="range" min="2" max="8" value={maxPlayers} onChange={e => { setMaxPlayers(e.target.value); socketRef.current.emit('update_room_settings', { maxPlayers: e.target.value }); }} style={{ width: '120px', cursor: 'pointer' }} />}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontWeight: 'bold' }}>Total Rounds: <span style={{ color: '#bb86fc' }}>{maxRounds}</span></span>{isHost && <input type="range" min="1" max="10" value={maxRounds} onChange={e => { setMaxRounds(e.target.value); socketRef.current.emit('update_room_settings', { maxRounds: e.target.value }); }} style={{ width: '120px', cursor: 'pointer' }} />}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontWeight: 'bold' }}>Draw Time: <span style={{ color: '#FFD54F' }}>{totalDrawTime}s</span></span>{isHost && <input type="range" min="30" max="300" step="10" value={totalDrawTime} onChange={e => { setTotalDrawTime(e.target.value); socketRef.current.emit('update_room_settings', { drawTime: e.target.value }); }} style={{ width: '120px', cursor: 'pointer' }} />}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontWeight: 'bold' }}>Hint Amount: <span style={{ color: '#FF5252' }}>{hintLevel == 1 ? 'Low' : hintLevel == 2 ? 'Norm' : hintLevel == 3 ? 'High' : 'Max'}</span></span>{isHost && <input type="range" min="1" max="4" value={hintLevel} onChange={e => { setHintLevel(e.target.value); socketRef.current.emit('update_room_settings', { hintLevel: e.target.value }); }} style={{ width: '120px', cursor: 'pointer' }} />}</div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      {isHost && playerList.length >= 2 && <button onClick={() => socketRef.current.emit('start_private_game')} style={{ padding: '12px 20px', background: '#03dac6', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', transition: 'transform 0.1s ease' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>🚀 Start Game</button>}
                      {isPrivate && <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?room=${roomId}`); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 5000); }} style={{ padding: '12px 20px', background: inviteCopied ? '#4caf50' : '#bb86fc', color: inviteCopied ? '#fff' : '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', transition: 'all 0.3s ease' }}>{inviteCopied ? '✔️ Copied to Clipboard!' : '📋 Copy Invite Link'}</button>}
                    </div>
                  </>
                ) : (<div>Waiting for a second player to join...</div>)}
              </div>
            ) : winner ? (
              <div className="floating-status" style={{ background: '#FFD54F', color: '#000' }}>🏆 {winner[0]?.name} won the game!</div>
            ) : (
              <div className="floating-status" style={{ fontSize: 'clamp(13px, 4vw, 20px)', letterSpacing: '1px', padding: '6px 14px', backgroundColor: correctGuessers.includes(playerInfo.playerName) ? 'rgba(3, 218, 198, 0.9)' : 'rgba(55, 0, 179, 0.85)', color: correctGuessers.includes(playerInfo.playerName) ? '#000' : 'white' }}>{getDynamicHint(isMyTurn || correctGuessers.includes(playerInfo.playerName))}</div>
            )}
            
            <DrawingCanvas 
              canvasRef={canvasRef} previewCanvasRef={previewCanvasRef} contextRef={contextRef} previewContextRef={previewContextRef}
              isMyTurn={isMyTurn} activeTool={activeTool} brushColor={brushColor} brushSize={brushSize} applyFill={applyFill}
              emitDrawCommand={emitDrawCommand} pointBuffer={pointBuffer} undoStack={undoStack} redoStack={redoStack} saveState={saveState}
            />

            {isMyTurn && (
              <GameToolbar 
                brushColor={brushColor} setBrushColor={setBrushColor} brushSize={brushSize} setBrushSize={setBrushSize}
                activeTool={activeTool} setActiveTool={setActiveTool} handleUndo={handleUndo} handleRedo={handleRedo}
                handleClearBoard={handleClearBoard} emitDrawCommand={emitDrawCommand}
              />
            )}

          </div> 
        </div> 

        <div className="sidebar-right">
          {isSocketReady && <ChatBox socket={socketRef.current} playerInfo={playerInfo} isMyTurn={isMyTurn} />}
        </div>

        <GameModals 
          turnSummary={turnSummary} winner={winner} isChoosing={isChoosing} isMyTurn={isMyTurn} timeLeft={timeLeft}
          wordChoices={wordChoices} currentDrawer={currentDrawer} socketRef={socketRef} showPlayerModal={showPlayerModal}
          setShowPlayerModal={setShowPlayerModal} playerList={playerList} playerInfo={playerInfo} underdogs={underdogs}
          showSettingsModal={showSettingsModal} setShowSettingsModal={setShowSettingsModal} isLightMode={isLightMode}
          setIsLightMode={setIsLightMode} isPrivate={isPrivate} roomPassword={roomPassword} maxPlayers={maxPlayers}
          setMaxPlayers={setMaxPlayers} maxRounds={maxRounds} setMaxRounds={setMaxRounds} totalDrawTime={totalDrawTime}
          setTotalDrawTime={setTotalDrawTime} hintLevel={hintLevel} setHintLevel={setHintLevel} isHost={isHost}
          transferTarget={transferTarget} setTransferTarget={setTransferTarget}
        />

      </div>
    </>
  )
}