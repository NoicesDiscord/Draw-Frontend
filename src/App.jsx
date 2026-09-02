import { useState, useEffect } from 'react'
import GameRoom from './components/GameRoom'
import './styles/lobby.css' // NEW: Import extracted lobby styles

export default function App() {
  const [name, setName] = useState('')
  const [playerInfo, setPlayerInfo] = useState(() => {
    const saved = sessionStorage.getItem('dn_playerInfo');
    return saved ? JSON.parse(saved) : null;
  })
  const [error, setError] = useState('') 
  
  const [mode, setMode] = useState('public') // 'public', 'private', or 'browse'
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [rounds, setRounds] = useState(3)
  const [drawTime, setDrawTime] = useState(120)
  const [customWords, setCustomWords] = useState('') 
  const [hintLevel, setHintLevel] = useState(2) 
  const [password, setPassword] = useState('') // NEW: Password for creating
  
  const [customLobbies, setCustomLobbies] = useState([]) // NEW: Server list
  const [selectedLobbyId, setSelectedLobbyId] = useState(null) // NEW: Tracks clicked lobby
  const [joinPassword, setJoinPassword] = useState('') // NEW: Password for joining
  const [passwordStatus, setPasswordStatus] = useState('normal') // NEW: Tracks input color
  
  // REPLACEMENT: Make Session ID survive Chrome tab discards!
  const [sessionId] = useState(() => {
    let stored = sessionStorage.getItem('dn_sessionId');
    if (!stored) {
      stored = Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('dn_sessionId', stored);
    }
    return stored;
  })

  // NEW: Auto-save player state so they don't get sent to the login screen on a hard reload
  useEffect(() => {
    if (playerInfo) {
      sessionStorage.setItem('dn_playerInfo', JSON.stringify(playerInfo));
    } else {
      sessionStorage.removeItem('dn_playerInfo');
    }
  }, [playerInfo]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('room')) {
      setMode('invite')
    }
  }, [])

  // NEW: Fetch live lobbies when opening the Browse tab
  const fetchLobbies = () => {
    fetch('https://skribbl-backend-dgot.onrender.com/api/rooms')
      .then(res => res.json())
      .then(data => setCustomLobbies(data))
      .catch(err => console.log("Failed to fetch lobbies", err))
  }

  useEffect(() => {
    if (mode === 'browse') fetchLobbies()
  }, [mode])

  const handleJoin = async (targetLobby = null) => {
    if (!name.trim()) {
      setError('⚠️ You must enter a nickname to play!')
      return
    }
    
    // Avatar system removed! The final name is now just the exact text they typed.
    const finalName = name.trim();
    
    const inviteRoom = new URLSearchParams(window.location.search).get('room')
    let parsedWords = customWords.split(',').map(w => w.trim()).filter(w => w.length > 1)

    // --- NEW: Pre-validate password without leaving the screen! ---
    const roomToValidate = inviteRoom || (targetLobby ? targetLobby.id : null);
    const requiresCheck = (inviteRoom && joinPassword) || (targetLobby && targetLobby.hasPassword);

    if (requiresCheck) {
      try {
        const res = await fetch(`https://skribbl-backend-dgot.onrender.com/api/validate-password?roomId=${roomToValidate}&password=${encodeURIComponent(joinPassword.trim())}`);
        const data = await res.json();
        
        if (!data.success) {
          setPasswordStatus('error');
          setError(`⚠️ ${data.message}`);
          return; 
        } else {
          setPasswordStatus('success');
          setError('');
          setTimeout(() => {
            setPlayerInfo({ playerName: finalName, roomId: roomToValidate, password: joinPassword.trim(), sessionId });
          }, 1000);
          return;
        }
      } catch (err) {
        setError('⚠️ Could not connect to server.');
        return;
      }
    }

    if (inviteRoom) {
      setPlayerInfo({ playerName: finalName, roomId: inviteRoom, password: joinPassword.trim(), sessionId })
    } else if (mode === 'private') {
      setPlayerInfo({ 
        playerName: finalName, 
        privateSettings: { maxPlayers, rounds, drawTime, hintLevel, customWords: parsedWords, password: password.trim() },
        sessionId 
      })
    } else if (mode === 'browse' && targetLobby) {
      setPlayerInfo({ playerName: finalName, roomId: targetLobby.id, password: joinPassword.trim(), sessionId })
    } else if (mode === 'public') {
      setPlayerInfo({ playerName: finalName, sessionId })
    }
  }

  if (!playerInfo) {
    return (
      <>
        <div className="dn-login-container">
          <span className="dn-doodle dn-doodle-1" style={{ '--r': '-12deg' }}>🎨</span>
          <span className="dn-doodle dn-doodle-2" style={{ '--r': '10deg' }}>✏️</span>
          <span className="dn-doodle dn-doodle-3" style={{ '--r': '8deg' }}>⭐</span>
          <span className="dn-doodle dn-doodle-4" style={{ '--r': '-8deg' }}>🖍️</span>

          <div className="dn-card">
            <div className="dn-title-wrap">
              <h1 className="dn-title">Draw Noices</h1>
              <p className="dn-subtitle">grab a crayon, it's your turn to doodle!</p>
            </div>

            <textarea 
              className="dn-name-input"
              rows="1"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              value={name} 
              onChange={(e) => { setName(e.target.value.replace(/\n/g, '')); setError(''); }} 
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault(); 
                  handleJoin();
                }
              }}
              placeholder="Enter your nickname..." 
              maxLength="12"
              autoFocus
              style={{ resize: 'none', overflow: 'hidden', whiteSpace: 'nowrap' }}
            />

            {mode === 'invite' ? (
              <div className="dn-invite-box">
                <div className="dn-invite-badge">🎟️ You've been invited to a private room!</div>
                <textarea 
                  className="dn-plain-input"
                  rows="1"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  placeholder="Room Password (if any)" 
                  value={joinPassword}
                  onChange={e => setJoinPassword(e.target.value.replace(/\n/g, ''))}
                  onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                  maxLength="20"
                  style={{ resize: 'none', overflow: 'hidden', whiteSpace: 'nowrap' }}
                />
              </div>
            ) : (
              <>
                <div className="dn-tab-row">
                  <button className="dn-tab-btn" onClick={() => setMode('public')} style={{ background: mode === 'public' ? 'var(--blue)' : '#fff', color: mode === 'public' ? '#fff' : 'var(--ink-soft)' }}>🌍 Public</button>
                  <button className="dn-tab-btn" onClick={() => setMode('private')} style={{ background: mode === 'private' ? 'var(--purple)' : '#fff', color: mode === 'private' ? '#fff' : 'var(--ink-soft)' }}>🔒 Create</button>
                  <button className="dn-tab-btn" onClick={() => setMode('browse')} style={{ background: mode === 'browse' ? 'var(--green)' : '#fff', color: mode === 'browse' ? '#fff' : 'var(--ink-soft)' }}>🔍 Browse</button>
                </div>

                {/* --- CREATE PRIVATE LOBBY --- */}
                {mode === 'private' && (
                  <div className="dn-settings-box" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: '10px', flexShrink: 0 }}>
                      <textarea 
                        className="dn-plain-input"
                        rows="1"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        value={password} 
                        onChange={e => setPassword(e.target.value.replace(/\n/g, ''))} 
                        onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                        placeholder="Room Password (Optional)"
                        maxLength="20"
                        style={{ resize: 'none', overflow: 'hidden', whiteSpace: 'nowrap' }}
                      />
                    </div>

                    <div className="dn-settings-grid">
                      <div>
                        <div className="dn-compact-label">
                          <span><span className="dn-label-dot" style={{ background: 'var(--blue)' }}></span>Max Players</span>
                          <span style={{ color: 'var(--blue)' }}>{maxPlayers}</span>
                        </div>
                        <input type="range" min="2" max="8" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} style={{ width: '100%', '--thumb': 'var(--blue)' }} />
                      </div>

                      <div>
                        <div className="dn-compact-label">
                          <span><span className="dn-label-dot" style={{ background: 'var(--purple)' }}></span>Total Rounds</span>
                          <span style={{ color: 'var(--purple)' }}>{rounds}</span>
                        </div>
                        <input type="range" min="1" max="10" value={rounds} onChange={e => setRounds(e.target.value)} style={{ width: '100%', '--thumb': 'var(--purple)' }} />
                      </div>

                      <div>
                        <div className="dn-compact-label">
                          <span><span className="dn-label-dot" style={{ background: 'var(--orange)' }}></span>Draw Time</span>
                          <span style={{ color: 'var(--orange)' }}>{drawTime}s</span>
                        </div>
                        <input type="range" min="30" max="300" step="10" value={drawTime} onChange={e => setDrawTime(e.target.value)} style={{ width: '100%', '--thumb': 'var(--orange)' }} />
                      </div>

                      <div>
                        <div className="dn-compact-label">
                          <span><span className="dn-label-dot" style={{ background: 'var(--green)' }}></span>Hint Amount</span>
                          <span style={{ color: 'var(--green)' }}>
                            {hintLevel == 1 ? 'Low' : hintLevel == 2 ? 'Norm' : hintLevel == 3 ? 'High' : 'Max'}
                          </span>
                        </div>
                        {/* INCREASED MAX TO 4 */}
                        <input type="range" min="1" max="4" step="1" value={hintLevel} onChange={e => setHintLevel(e.target.value)} style={{ width: '100%', '--thumb': 'var(--green)' }} />
                      </div>
                    </div>

                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '50px' }}>
                      <textarea 
                        className="dn-notebook"
                        value={customWords} 
                        onChange={e => setCustomWords(e.target.value)} 
                        placeholder="Custom Words (e.g. Anime, Naruto)..."
                        maxLength="300000" // FIX: Increased to 10x the limit!
                      />
                    </div>
                  </div>
                )}

                {/* --- BROWSE CUSTOM LOBBIES --- */}
                {mode === 'browse' && (
                  <div className="dn-settings-box" style={{ maxHeight: '35vh' }}>
                    <div className="dn-browse-header">
                      <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>Active Custom Games</span>
                      <button className="dn-refresh-btn" onClick={fetchLobbies}>🔄 Refresh</button>
                    </div>
                    
                    {customLobbies.length === 0 ? (
                      <div className="dn-empty-state">No custom games currently active.</div>
                    ) : (
                      customLobbies.map((lobby, i) => (
                        <div key={lobby.id} className="dn-lobby-card">
                          <div className="dn-washi" style={{ background: ['var(--red)', 'var(--blue)', 'var(--yellow)', 'var(--green)', 'var(--purple)'][i % 5] }}></div>
                          <div className="dn-lobby-row">
                            <div style={{ textAlign: 'left', overflow: 'hidden', paddingRight: '10px' }}>
                              <div className="dn-lobby-name">{lobby.hostName}'s Room</div>
                              <div className="dn-lobby-meta">
                                👥 {lobby.players}/{lobby.maxPlayers} Players &nbsp;
                                {lobby.hasPassword ? '🔒 Password' : '🔓 Open'}
                              </div>
                            </div>
                            
                            <button 
                              className="dn-join-pill"
                              onClick={() => {
                                if (selectedLobbyId === lobby.id) {
                                   handleJoin(lobby) // Confirm join
                                } else {
                                   setSelectedLobbyId(lobby.id)
                                   setJoinPassword('')
                                   setPasswordStatus('normal')
                                   setError('')
                                }
                              }}
                              style={{ background: selectedLobbyId === lobby.id ? 'var(--green)' : 'var(--yellow)', color: 'var(--ink)' }}
                            >
                              {selectedLobbyId === lobby.id ? 'Confirm' : 'Join'}
                            </button>
                          </div>
                          
                          {/* Reveal password input if required and selected */}
                          {selectedLobbyId === lobby.id && lobby.hasPassword && (
                            <div style={{ marginTop: '12px', animation: 'dnFadeIn 0.3s ease' }}>
                               <textarea 
                                 className="dn-plain-input"
                                 rows="1"
                                 autoComplete="off"
                                 autoCorrect="off"
                                 autoCapitalize="off"
                                 spellCheck="false"
                                 placeholder="Enter Room Password" 
                                 value={joinPassword}
                                 onChange={e => {
                                   setJoinPassword(e.target.value.replace(/\n/g, ''));
                                   setPasswordStatus('normal');
                                   setError('');
                                 }}
                                 onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleJoin(lobby); } }}
                                 maxLength="20"
                                 style={{ 
                                   resize: 'none', overflow: 'hidden', whiteSpace: 'nowrap',
                                   borderColor: passwordStatus === 'error' ? '#B3261E' : passwordStatus === 'success' ? '#3FBE87' : 'var(--ink)',
                                   backgroundColor: passwordStatus === 'error' ? '#FFE7E4' : passwordStatus === 'success' ? '#E8F5E9' : '#fff',
                                   boxShadow: passwordStatus === 'error' ? '2px 2px 0 #B3261E' : passwordStatus === 'success' ? '2px 2px 0 #3FBE87' : 'none',
                                   color: passwordStatus === 'error' ? '#B3261E' : passwordStatus === 'success' ? '#1b5e20' : 'var(--ink)',
                                   transition: 'all 0.3s ease'
                                 }}
                               />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
            
            {error && (
              <div className="dn-error">
                {error}
              </div>
            )}
            
            {/* Hide the main enter button when browsing, since joining happens on the lobby card itself */}
            {mode !== 'browse' && (
              <button className="dn-join-btn" onClick={() => handleJoin()}>
                {mode === 'private' ? "Create Custom Game" : "Enter Game"}
              </button>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <GameRoom 
      playerInfo={playerInfo} 
      onJoinError={(errorMessage) => {
        setPlayerInfo(null); // Unmounts the game and safely brings them back to their current menu
        setError(`⚠️ ${errorMessage}`); // Triggers your built-in jiggly error animation!
      }} 
    />
  )
}
