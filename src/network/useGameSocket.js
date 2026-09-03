import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { soundManager } from '../audio/soundManager';

export function useGameSocket(deps) {
  const {
    playerInfo, onJoinError, socketRef, canvasRef, contextRef, pointBuffer, endsAtRef,
    offlineStrokes, hasJoined, undoStack, redoStack,
    setIsSocketReady, setRoomId, setIsHost, setIsPrivate, setMaxRounds, setHintLevel,
    setTotalDrawTime, setMaxPlayers, setRoomPassword, setWaitingForHost, setCurrentDrawer,
    setSecretWord, setIsMyTurn, setTimeLeft, setWinner, setIsChoosing, setPlayerList,
    setUnderdogs, setWordSkeleton, setCurrentRound, setHasVotedThisTurn, setTurnSummary,
    setWordChoices, setConnectionState, setRevealedChars, setCorrectGuessers,
    applyFill, saveState, handleUndo, handleRedo, clearCanvas
  } = deps;

  const currentStroke = useRef([]);

  const emitDrawCommand = (event, data = null) => {
    // Intercept commands to build a lightweight, vector-based undo/redo history (#8)
    if (['start', 'draw', 'draw_packet', 'fill'].includes(event)) {
        currentStroke.current.push({ event, data });
        if (event === 'fill') { // Fill is a single-event stroke
            undoStack.current.push([...currentStroke.current]);
            currentStroke.current = [];
            redoStack.current = [];
        }
    } else if (event === 'stop') {
        if (currentStroke.current.length > 0) {
            undoStack.current.push([...currentStroke.current, { event: 'stop' }]);
            currentStroke.current = [];
            redoStack.current = [];
        }
    }

    if (socketRef.current && socketRef.current.connected) {
      if (data) socketRef.current.emit(event, data);
      else socketRef.current.emit(event);
    } else {
      offlineStrokes.current.push({ event, data });
    }
  };

  useEffect(() => {
    socketRef.current = io('https://skribbl-backend-dgot.onrender.com');
    setIsSocketReady(true);

    socketRef.current.on('connect', () => {
      console.log('Socket connected! Checking for existing session...');
      socketRef.current.emit('resume_session', { sessionId: playerInfo.sessionId });
    });

    socketRef.current.on('room_joined', (data) => {
      setRoomId(data.roomId); setIsHost(data.isHost); setIsPrivate(data.isPrivate);
      setMaxRounds(data.maxRounds);
      if (data.hintLevel) setHintLevel(data.hintLevel);
      if (data.drawTime) setTotalDrawTime(data.drawTime);
      if (data.maxPlayers) setMaxPlayers(data.maxPlayers);
      if (data.password) setRoomPassword(data.password);
    });

    socketRef.current.on('room_settings_updated', (data) => {
      setMaxRounds(data.maxRounds); setTotalDrawTime(data.drawTime);
      setHintLevel(data.hintLevel); setMaxPlayers(data.maxPlayers);
    });

    socketRef.current.on('host_updated', (newHostId) => setIsHost(socketRef.current.id === newHostId));

    socketRef.current.on('waiting_for_host', () => {
      setWaitingForHost(true); setCurrentDrawer(""); setSecretWord(""); setIsMyTurn(false);
      setTimeLeft(0); setWinner(null); setIsChoosing(false); clearCanvas();
    });
    
    socketRef.current.on('game_started', () => soundManager.play('start'));

    socketRef.current.on('update_players', (playersArray) => {
      setPlayerList(playersArray.sort((a, b) => b.score - a.score));
    });

    socketRef.current.on('update_underdogs', (newUnderdogs) => setUnderdogs(newUnderdogs || []));

    socketRef.current.on('round_update', (data) => {
      setIsMyTurn(data.drawerName === playerInfo.playerName);
      if (data.endsAt) endsAtRef.current = data.endsAt;
      setCurrentDrawer(data.drawerName); setWinner(null);
      if (data.maxRounds) setMaxRounds(data.maxRounds);
      if (data.hintLevel) setHintLevel(data.hintLevel); 
      setUnderdogs(data.underdogs || []);
      setWordSkeleton(data.skeleton || []);
      setIsChoosing(false); setWaitingForHost(false); setSecretWord(""); 
      setRevealedChars({}); setTimeLeft(120); setCurrentRound(data.currentRound || 1); 
      setHasVotedThisTurn(false); 
      if (data.drawerName !== playerInfo.playerName) soundManager.play('select');
    });

    socketRef.current.on('room_error', (errorMessage) => {
      if (onJoinError) onJoinError(errorMessage); 
      else { alert(errorMessage); window.location.href = '/'; }
    });

    socketRef.current.on('kicked_from_server', () => {
      alert("You have been kicked from the lobby by a vote.");
      window.location.href = '/'; 
    });
    
    socketRef.current.on('game_over', (winnerName) => {
      setWinner(winnerName); setTurnSummary(null); setIsChoosing(false); soundManager.play('win');
    });
    
    socketRef.current.on('turn_summary', (data) => {
      setTurnSummary(data); soundManager.play('summary');
    });

    socketRef.current.on('choosing_word', (data) => {
      setWaitingForHost(false); setIsChoosing(true); setTurnSummary(null); 
      setCurrentDrawer(data.drawerName); setIsMyTurn(data.drawerName === playerInfo.playerName);
      setSecretWord(""); setWinner(null); setHasVotedThisTurn(false); 
    });

    socketRef.current.on('your_word_choices', (words) => setWordChoices(words));
    
    socketRef.current.on('waiting_for_players', () => {
      setCurrentDrawer(""); setSecretWord(""); setIsMyTurn(false); setTimeLeft(0); 
      setWinner(null); setIsChoosing(false); clearCanvas();
    });

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
        console.log('Joining as a new player.');
        socketRef.current.emit('join_game', playerInfo);
        hasJoined.current = true;
      } else {
        console.log('Grace period expired. Wiping session and returning to menu.');
        setConnectionState('lost');
        sessionStorage.removeItem('dn_playerInfo'); 
        if (onJoinError) setTimeout(() => onJoinError("Connection lost permanently. Please rejoin the lobby."), 1000);
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
          
          if (data.drawingHistory && data.drawingHistory.length > 0 && contextRef.current) {
            const ctx = contextRef.current;
            // Helper needed here too
            const getHistCoords = (normX, normY) => {
              if (!canvasRef.current) return {x:0, y:0};
              return { x: normX * canvasRef.current.width, y: normY * canvasRef.current.height };
            };

            data.drawingHistory.forEach(action => {
              if (action.type === 'start') {
                const pt = getHistCoords(action.x, action.y);
                ctx.strokeStyle = action.color; ctx.lineWidth = action.size;
                ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
              } else if (action.type === 'draw') {
                const pt = getHistCoords(action.x, action.y);
                ctx.strokeStyle = action.color; ctx.lineWidth = action.size;
                ctx.lineTo(pt.x, pt.y); ctx.stroke();
              } else if (action.type === 'draw_packet' && action.points.length > 0) {
                ctx.strokeStyle = action.color; ctx.lineWidth = action.size;
                ctx.beginPath(); 
                const first = getHistCoords(action.points[0].x, action.points[0].y);
                ctx.moveTo(first.x, first.y);
                for (let i = 1; i < action.points.length; i++) {
                    const pt = getHistCoords(action.points[i].x, action.points[i].y);
                    ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();
              } else if (action.type === 'stop') {
                ctx.closePath(); saveState(); redoStack.current = [];
              } else if (action.type === 'fill') {
                const pt = getHistCoords(action.x, action.y);
                applyFill(ctx, canvasRef.current, pt.x, pt.y, action.color);
              } else if (action.type === 'undo') handleUndo();
              else if (action.type === 'redo') handleRedo();
            });
          }
       }
    });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect(); 
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    socketRef.current.on('secret_word', (word) => setSecretWord(word));
    socketRef.current.on('clear_board', () => clearCanvas());
    socketRef.current.on('hint_update', (chars) => { if (chars) setRevealedChars(chars); });
    socketRef.current.on('time_reduction', (data) => endsAtRef.current = data.endsAt);

    const localTimer = setInterval(() => {
      if (endsAtRef.current > 0) setTimeLeft(Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000)));
    }, 1000);

    // Helper to convert normalized coordinates back to actual canvas pixels
    const getActualCoords = (normX, normY) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      return {
        x: normX * canvas.width,
        y: normY * canvas.height
      };
    };

    socketRef.current.on('start', (data) => {
      if (!contextRef.current) return;
      const { x, y } = getActualCoords(data.x, data.y);
      contextRef.current.strokeStyle = data.color || '#000000'; 
      contextRef.current.lineWidth = data.size || 5;
      contextRef.current.beginPath(); 
      contextRef.current.moveTo(x, y); 
      contextRef.current.lineTo(x, y); 
      contextRef.current.stroke();
    });
    
    socketRef.current.on('draw', (data) => {
      if (!contextRef.current) return;
      const { x, y } = getActualCoords(data.x, data.y);
      contextRef.current.strokeStyle = data.color || '#000000'; 
      contextRef.current.lineWidth = data.size || 5;
      contextRef.current.lineTo(x, y); 
      contextRef.current.stroke();
    });
    
    socketRef.current.on('draw_packet', (data) => {
      if (!data.points || data.points.length === 0 || !contextRef.current) return;
      contextRef.current.strokeStyle = data.color || '#000000'; 
      contextRef.current.lineWidth = data.size || 5;
      contextRef.current.beginPath(); 
      
      // Interpolate points for smooth rendering on the receiver end
      const firstPt = getActualCoords(data.points[0].x, data.points[0].y);
      contextRef.current.moveTo(firstPt.x, firstPt.y);
      
      // Draw smooth lines between all points in the batch
      for (let i = 1; i < data.points.length; i++) {
         const pt = getActualCoords(data.points[i].x, data.points[i].y);
         contextRef.current.lineTo(pt.x, pt.y);
      }
      contextRef.current.stroke();
    });
    
    // Also update fill coordinates
    socketRef.current.on('fill', (data) => {
       const { x, y } = getActualCoords(data.x, data.y);
       applyFill(contextRef.current, canvasRef.current, x, y, data.color);
    });
    
    socketRef.current.on('stop', () => {
      contextRef.current.closePath(); saveState(); redoStack.current = [];
    });

    socketRef.current.on('fill', (data) => applyFill(contextRef.current, canvasRef.current, data.x, data.y, data.color));
    socketRef.current.on('undo', () => handleUndo());
    socketRef.current.on('redo', () => handleRedo());
    socketRef.current.on('correct_guess', () => soundManager.play('success'));    

    socketRef.current.on('chat_message', (data) => {
      if (data.isGuess) setCorrectGuessers(prev => prev.includes(data.sender) ? prev : [...prev, data.sender]);
    });

    socketRef.current.on('round_update', () => setCorrectGuessers([]));
    socketRef.current.on('waiting_for_players', () => setCorrectGuessers([]));
    socketRef.current.on('waiting_for_host', () => setCorrectGuessers([]));
    socketRef.current.on('choosing_word', () => setCorrectGuessers([]));

    const packetInterval = setInterval(() => {
      if (pointBuffer.current.length > 0) {
        emitDrawCommand('draw_packet', { 
           points: pointBuffer.current, color: contextRef.current.strokeStyle, size: contextRef.current.lineWidth 
        });
        pointBuffer.current = []; 
      }
    }, 40);

    return () => {
      clearInterval(packetInterval); 
      clearInterval(localTimer); 
      document.removeEventListener('visibilitychange', handleVisibility);
      socketRef.current.disconnect();
    };
  }, [playerInfo.playerName]);

  return { emitDrawCommand };
}