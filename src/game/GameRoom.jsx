import { useRef, useState, useEffect } from 'react'
import ChatBox from '../components/ChatBox'
import PlayerList from '../components/PlayerList'
import GameToolbar from '../components/GameToolbar'
import GameModals from '../components/GameModals'
import DrawingCanvas from '../canvas/DrawingCanvas'
import { useGameSocket } from '../network/useGameSocket'
import { useDrawingEngine } from '../canvas/useDrawingEngine'
import { soundManager } from '../audio/soundManager'
import '../styles/game.css'

export default function GameRoom({ playerInfo, onJoinError }) {
  // Network & Game Refs
  const pointBuffer = useRef([]);        
  const socketRef = useRef(null);
  const endsAtRef = useRef(0); 
  const offlineStrokes = useRef([]); 
  const hasJoined = useRef(false); 
  const lastTickRef = useRef(null); 

  // Mount our new Drawing Engine Hook!
  const { 
    canvasRef, previewCanvasRef, contextRef, previewContextRef, 
    undoStack, redoStack, clearCanvas, handleUndo, handleRedo, applyFill, saveState 
  } = useDrawingEngine();
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
          <PlayerList 
            playerList={playerList} playerInfo={playerInfo} currentDrawer={currentDrawer} correctGuessers={correctGuessers}
            underdogs={underdogs} currentRound={currentRound} maxRounds={maxRounds} isPrivate={isPrivate}
            roomId={roomId} setShowPlayerModal={setShowPlayerModal} setShowSettingsModal={setShowSettingsModal}
          />
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