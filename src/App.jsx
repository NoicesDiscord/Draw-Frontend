import { useState, useEffect } from 'react'
import GameRoom from './components/GameRoom'

export default function App() {
  const [name, setName] = useState('')
  const [playerInfo, setPlayerInfo] = useState(null)
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

  const avatars = ['🦊', '🐱', '🐼', '🐨', '🐸', '🐯', '🦖', '🐙', '👻', '👽', '🤖', '👾', '🤡', '🤠', '🦄', '🐲']

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

  const handleJoin = (targetLobby = null) => {
    if (!name.trim()) {
      setError('⚠️ You must enter a nickname to play!')
      return
    }
    
    const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)]
    const finalName = `${randomAvatar} ${name.trim()}`
    
    const inviteRoom = new URLSearchParams(window.location.search).get('room')
    let parsedWords = customWords.split(',').map(w => w.trim()).filter(w => w.length > 1)

    if (inviteRoom) {
      // NEW: Pass the joinPassword to the server when joining via invite link
      setPlayerInfo({ playerName: finalName, roomId: inviteRoom, password: joinPassword.trim() })
    } else if (mode === 'private') {
      setPlayerInfo({ 
        playerName: finalName, 
        privateSettings: { 
          maxPlayers, rounds, drawTime, hintLevel, customWords: parsedWords, 
          password: password.trim() 
        } 
      })
    } else if (mode === 'browse' && targetLobby) {
      setPlayerInfo({ 
        playerName: finalName, 
        roomId: targetLobby.id, 
        password: joinPassword.trim()
      })
    } else if (mode === 'public') {
      setPlayerInfo({ playerName: finalName })
    }
  }

  if (!playerInfo) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Quicksand:wght@500;600;700&family=Caveat:wght@600;700&display=swap');

          body, html {
            margin: 0; padding: 0; overflow: hidden;
            background-color: #FBF8F1;
            background-image: radial-gradient(rgba(79, 168, 224, 0.16) 1.6px, transparent 1.6px);
            background-size: 28px 28px;
            font-family: 'Quicksand', system-ui, sans-serif;
          }

          .dn-login-container {
            --paper: #FFFCF5;
            --ink: #2B2420;
            --ink-soft: #6E6355;
            --red: #FF5A5F;
            --yellow: #FFC94D;
            --blue: #4FA8E0;
            --green: #3FBE87;
            --purple: #9B6BF0;
            --orange: #FF9142;
            height: 100vh; width: 100vw; display: flex; align-items: center; justify-content: center;
            position: relative; padding: 20px; box-sizing: border-box;
          }

          .dn-doodle {
            position: absolute; z-index: 0;
            filter: drop-shadow(0 8px 10px rgba(43,36,32,0.18));
            animation: dnBob 7s ease-in-out infinite;
            user-select: none; pointer-events: none; line-height: 1;
          }
          .dn-doodle-1 { top: 8%; left: 9%; font-size: 68px; animation-delay: 0s; }
          .dn-doodle-2 { bottom: 9%; right: 7%; font-size: 78px; animation-delay: -2.3s; }
          .dn-doodle-3 { top: 11%; right: 13%; font-size: 44px; animation-delay: -4.1s; }
          .dn-doodle-4 { bottom: 13%; left: 7%; font-size: 50px; animation-delay: -1.2s; }

          @keyframes dnBob {
            0%, 100% { transform: translateY(0) rotate(var(--r, 0deg)); }
            50% { transform: translateY(-16px) rotate(var(--r, 0deg)); }
          }
          @keyframes dnFloatCard {
            0%, 100% { transform: rotate(-0.6deg) translateY(0); }
            50% { transform: rotate(-0.6deg) translateY(-6px); }
          }
          @keyframes dnPopIn {
            0% { opacity: 0; transform: scale(0.85) rotate(-3deg); }
            100% { opacity: 1; transform: scale(1) rotate(0deg); }
          }
          @keyframes dnWiggle {
            0%, 100% { transform: translateX(0) rotate(0); }
            20% { transform: translateX(-4px) rotate(-1deg); }
            40% { transform: translateX(4px) rotate(1deg); }
            60% { transform: translateX(-3px) rotate(-0.6deg); }
            80% { transform: translateX(3px) rotate(0.6deg); }
          }
          @keyframes dnFadeIn {
            from { opacity: 0; transform: translateY(-6px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .dn-card {
            position: relative; z-index: 10;
            background: var(--paper);
            border: 3px solid var(--ink);
            border-radius: 26px;
            box-shadow: 7px 7px 0 var(--blue), 7px 7px 0 3px var(--ink);
            padding: 26px 30px;
            width: 95%; max-width: 460px;
            text-align: center;
            animation: dnFloatCard 6s ease-in-out infinite;
            display: flex; flex-direction: column; max-height: 95vh;
          }

          .dn-title-wrap { flex-shrink: 0; margin-bottom: 2px; }

          .dn-title {
            font-family: 'Baloo 2', sans-serif;
            font-size: 44px; font-weight: 800; margin: 4px 0 0 0; letter-spacing: 0.5px;
            color: var(--yellow);
            -webkit-text-stroke: 2px var(--ink);
            text-shadow: 4px 4px 0 var(--blue);
            animation: dnPopIn 0.5s ease-out;
          }

          .dn-subtitle {
            font-family: 'Caveat', cursive;
            color: var(--ink-soft); font-size: 20px; font-weight: 600;
            margin: 2px 0 16px 0; flex-shrink: 0;
          }

          .dn-name-input {
            width: 100%; padding: 13px 20px; font-size: 18px;
            font-family: 'Quicksand', sans-serif; font-weight: 700;
            background: #fff; border: 2.5px solid var(--ink);
            color: var(--ink); border-radius: 16px; outline: none;
            transition: all 0.2s ease; box-sizing: border-box; text-align: center;
            margin-bottom: 14px; box-shadow: 3px 3px 0 rgba(43,36,32,0.15); flex-shrink: 0;
          }
          .dn-name-input::placeholder { color: #b7ab9b; font-weight: 600; }
          .dn-name-input:focus { border-color: var(--blue); box-shadow: 3px 3px 0 var(--blue); transform: translate(-1px,-1px); }

          .dn-plain-input {
            width: 100%; padding: 11px 14px; font-family: 'Quicksand', sans-serif; font-weight: 600;
            background: #fff; border: 2px solid var(--ink); color: var(--ink);
            border-radius: 12px; outline: none; box-sizing: border-box; font-size: 14px;
            transition: all 0.2s ease;
          }
          .dn-plain-input:focus { border-color: var(--purple); box-shadow: 2px 2px 0 var(--purple); }
          .dn-plain-input::placeholder { color: #b7ab9b; }

          .dn-invite-box { margin-bottom: 20px; }
          .dn-invite-badge {
            display: inline-flex; align-items: center; gap: 6px;
            background: #FFF1CE; border: 2px dashed var(--orange); color: #8a5a12;
            padding: 8px 14px; border-radius: 14px; font-weight: 700; font-size: 14px;
            margin-bottom: 14px;
          }

          .dn-tab-row { display: flex; gap: 8px; margin-bottom: 14px; flex-shrink: 0; }
          .dn-tab-btn {
            flex: 1; padding: 10px 5px; border-radius: 12px; cursor: pointer;
            font-family: 'Quicksand', sans-serif; font-weight: 700; font-size: 14px;
            transition: all 0.15s ease; border: 2.5px solid var(--ink);
          }

          .dn-settings-box {
            background: #FFF9EC; border: 2px solid rgba(43,36,32,0.15);
            padding: 16px; border-radius: 18px; margin-bottom: 14px; text-align: left;
            overflow-y: auto; flex-grow: 1; min-height: 0;
          }

          .dn-settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; margin-bottom: 10px; }

          .dn-compact-label { display: flex; align-items: center; justify-content: space-between; color: var(--ink); font-size: 13px; font-weight: 700; margin-bottom: 5px; }
          .dn-label-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; border: 1.5px solid var(--ink); vertical-align: middle; }

          .dn-notebook {
            width: 100%; padding: 12px 14px 12px 20px; font-family: 'Quicksand', sans-serif; font-size: 13px;
            color: var(--ink); background: #fff repeating-linear-gradient(to bottom, transparent, transparent 22px, rgba(79,168,224,0.25) 23px);
            border: 2px solid var(--ink); border-radius: 10px; outline: none; resize: none;
            box-sizing: border-box; line-height: 23px; flex-grow: 1;
            border-left: 3px solid var(--red);
          }
          .dn-notebook::placeholder { color: #b7ab9b; }

          .dn-join-btn {
            width: 100%; padding: 14px; font-size: 18px; font-weight: 800; color: var(--ink);
            font-family: 'Baloo 2', sans-serif; letter-spacing: 0.5px;
            background: var(--green); border: 3px solid var(--ink); border-radius: 16px;
            cursor: pointer; transition: all 0.15s ease; box-shadow: 5px 5px 0 var(--ink);
            text-transform: uppercase; flex-shrink: 0;
          }
          .dn-join-btn:hover { transform: translate(-2px, -2px); box-shadow: 7px 7px 0 var(--ink); }
          .dn-join-btn:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--ink); }

          .dn-error {
            color: #B3261E; font-weight: 700; margin-bottom: 16px; font-size: 14px;
            background: #FFE7E4; border: 2px dashed #B3261E; border-radius: 12px; padding: 8px 12px;
            animation: dnWiggle 0.5s ease; flex-shrink: 0;
          }

          .dn-browse-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
          .dn-refresh-btn { background: transparent; border: none; color: var(--purple); cursor: pointer; font-size: 13px; font-weight: 700; font-family: 'Quicksand', sans-serif; }
          .dn-empty-state { color: var(--ink-soft); text-align: center; padding: 20px; font-family: 'Caveat', cursive; font-size: 18px; }

          .dn-lobby-card {
            position: relative; background: #fff; border-radius: 14px; padding: 13px;
            margin-bottom: 12px; border: 2px solid rgba(43,36,32,0.18);
            box-shadow: 3px 3px 0 rgba(43,36,32,0.08);
          }
          .dn-washi { position: absolute; top: -8px; left: 16px; width: 44px; height: 16px; border-radius: 3px; opacity: 0.85; transform: rotate(-4deg); }
          .dn-lobby-row { display: flex; justify-content: space-between; align-items: center; }
          .dn-lobby-name { color: var(--ink); font-weight: 700; font-size: 15px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; font-family: 'Quicksand', sans-serif; }
          .dn-lobby-meta { color: var(--ink-soft); font-size: 12px; margin-top: 4px; font-weight: 600; }
          .dn-join-pill {
            padding: 8px 16px; border: 2px solid var(--ink); border-radius: 10px; font-weight: 800;
            cursor: pointer; flex-shrink: 0; transition: 0.15s; font-family: 'Quicksand', sans-serif;
            box-shadow: 2px 2px 0 var(--ink);
          }
          .dn-join-pill:active { transform: translate(2px,2px); box-shadow: none; }

          @media (max-width: 500px) {
            .dn-card { padding: 16px 16px; border-radius: 20px; }
            .dn-title { font-size: 32px !important; }
            .dn-subtitle { font-size: 16px !important; margin-bottom: 12px !important; }
            .dn-name-input { padding: 12px !important; font-size: 16px !important; margin-bottom: 10px !important; }
            .dn-join-btn { padding: 12px !important; font-size: 16px !important; }
            .dn-settings-box { padding: 12px !important; margin-bottom: 10px !important; border-radius: 14px !important; }
            .dn-tab-btn { padding: 8px 4px !important; font-size: 12.5px !important; }
            .dn-compact-label { font-size: 11.5px !important; }
            .dn-doodle { display: none; }
          }

          @media (prefers-reduced-motion: reduce) {
            .dn-card, .dn-title, .dn-doodle, .dn-error { animation: none !important; }
          }

          input[type=range] { -webkit-appearance: none; appearance: none; background: rgba(43,36,32,0.12); height: 7px; border-radius: 4px; outline: none; margin-top: 4px; }
          input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--thumb, var(--blue)); border: 2px solid var(--ink); cursor: pointer; }
          input[type=range]::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: var(--thumb, var(--blue)); border: 2px solid var(--ink); cursor: pointer; }

          button:focus-visible, input:focus-visible, textarea:focus-visible {
            outline: 3px solid var(--purple); outline-offset: 2px;
          }
        `}</style>

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

            <input 
              className="dn-name-input"
              type="text" 
              value={name} 
              onChange={(e) => { setName(e.target.value); setError(''); }} 
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()} 
              placeholder="Enter your nickname..." 
              maxLength="12"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />

            {mode === 'invite' ? (
              <div className="dn-invite-box">
                <div className="dn-invite-badge">🎟️ You've been invited to a private room!</div>
                <input 
                  className="dn-plain-input"
                  type="text" 
                  placeholder="Room Password (if any)" 
                  value={joinPassword}
                  onChange={e => setJoinPassword(e.target.value)}
                  maxLength="20"
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
                      <input 
                        className="dn-plain-input"
                        type="text" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        placeholder="Room Password (Optional)"
                        maxLength="20"
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
                        maxLength="30000"
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
                               <input 
                                 className="dn-plain-input"
                                 type="text" 
                                 placeholder="Enter Room Password" 
                                 value={joinPassword}
                                 onChange={e => setJoinPassword(e.target.value)}
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

  return <GameRoom playerInfo={playerInfo} />
}
