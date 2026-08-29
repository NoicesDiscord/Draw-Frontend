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
          body, html { 
            margin: 0; padding: 0; overflow: hidden; 
            background-color: #0b0c10; 
            background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
            background-size: 24px 24px;
            font-family: 'Segoe UI', system-ui, sans-serif; 
          }
          
          .login-container { 
            height: 100vh; width: 100vw; display: flex; align-items: center; justify-content: center; 
            position: relative; padding: 20px; box-sizing: border-box; 
          }

          .art-blob {
            position: absolute; filter: blur(60px); z-index: 0; opacity: 0.5;
            animation: floatBlob 12s infinite alternate ease-in-out;
          }
          .blob-1 { 
            top: 5%; left: 15%; width: 400px; height: 400px; 
            background: linear-gradient(45deg, #ff1493, #ff6b6b); 
            border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; 
          }
          .blob-2 { 
            bottom: 5%; right: 10%; width: 450px; height: 450px; 
            background: linear-gradient(45deg, #03dac6, #1e90ff); 
            border-radius: 60% 40% 30% 70% / 50% 60% 40% 50%; 
            animation-delay: -3s;
          }
          .blob-3 { 
            top: 40%; left: 55%; width: 300px; height: 300px; 
            background: linear-gradient(45deg, #bb86fc, #8a2be2); 
            border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; 
            animation-delay: -7s;
          }

          @keyframes floatBlob {
            0% { transform: translate(0, 0) rotate(0deg) scale(1); }
            100% { transform: translate(40px, -40px) rotate(20deg) scale(1.1); }
          }
          @keyframes floatCard { 
            0% { transform: translateY(0px); } 
            50% { transform: translateY(-8px); } 
            100% { transform: translateY(0px); } 
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .glass-card { 
            position: relative; z-index: 10;
            background: rgba(20, 20, 25, 0.45); 
            backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); 
            border: 1px solid rgba(255, 255, 255, 0.1); 
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            border-left: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); 
            border-radius: 24px; padding: 25px 30px; width: 95%; max-width: 480px; 
            text-align: center; animation: floatCard 6s ease-in-out infinite; 
            display: flex; flex-direction: column; max-height: 95vh;
          }

          .settings-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 12px;
            margin-bottom: 8px;
          }

          @media (max-width: 500px) {
            .glass-card { padding: 15px 15px; border-radius: 16px; }
            .game-title { font-size: 32px !important; margin-bottom: 0px !important; }
            .game-subtitle { font-size: 12px !important; margin-bottom: 12px !important; }
            .name-input { padding: 12px !important; font-size: 16px !important; margin-bottom: 10px !important; }
            .join-btn { padding: 12px !important; font-size: 16px !important; }
            .settings-box { padding: 12px !important; margin-bottom: 10px !important; border-radius: 12px !important; }
            .tab-btn { padding: 8px 4px !important; font-size: 13px !important; }
            .compact-label { font-size: 11px !important; }
          }
          
          .compact-label {
            display: flex; justify-content: space-between; color: #ccc; font-size: 13px; margin-bottom: 4px;
          }
          
          .game-title { 
            font-size: 42px; font-weight: 900; margin: 0 0 5px 0; letter-spacing: 1px; 
            background: linear-gradient(to right, #ff1493, #bb86fc, #03dac6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(0px 2px 15px rgba(187, 134, 252, 0.4));
            flex-shrink: 0;
          }
          .game-subtitle { color: #aaa; font-size: 14px; margin: 0 0 20px 0; font-weight: 500; letter-spacing: 0.5px; flex-shrink: 0; }
          
          .name-input { 
            width: 100%; padding: 14px 20px; font-size: 18px; 
            background: rgba(0, 0, 0, 0.3); border: 2px solid rgba(255, 255, 255, 0.08); 
            color: white; border-radius: 14px; outline: none; transition: all 0.3s ease; 
            box-sizing: border-box; text-align: center; font-weight: bold; margin-bottom: 15px; 
            box-shadow: inset 0 2px 10px rgba(0,0,0,0.2); flex-shrink: 0;
          }
          .name-input::placeholder { color: rgba(255, 255, 255, 0.3); font-weight: normal; }
          .name-input:focus { border-color: #bb86fc; background: rgba(0, 0, 0, 0.5); box-shadow: 0 0 20px rgba(187, 134, 252, 0.2), inset 0 2px 10px rgba(0,0,0,0.3); }
          
          .join-btn { 
            width: 100%; padding: 14px; font-size: 18px; font-weight: 800; color: #fff; 
            background: linear-gradient(135deg, #bb86fc, #7928ca); 
            border: none; border-radius: 14px; cursor: pointer; transition: all 0.3s ease; 
            box-shadow: 0 8px 25px rgba(121, 40, 202, 0.5); text-transform: uppercase; letter-spacing: 1px; flex-shrink: 0;
          }
          .join-btn:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(121, 40, 202, 0.7); }
          .join-btn:active { transform: translateY(1px); }
          
          .settings-box {
            background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255,255,255,0.05);
            padding: 16px; border-radius: 16px; margin-bottom: 15px; text-align: left;
            box-shadow: inset 0 4px 15px rgba(0,0,0,0.2); overflow-y: auto; flex-grow: 1; min-height: 0;
          }
          .tab-btn {
            flex: 1; padding: 10px 5px; border-radius: 10px; border: none; cursor: pointer; font-weight: bold; transition: 0.2s; font-size: 14px;
          }
          
          input[type=range] { -webkit-appearance: none; background: rgba(255,255,255,0.1); height: 6px; border-radius: 3px; outline: none; margin-top: 5px; }
          input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #03dac6; cursor: pointer; box-shadow: 0 0 10px rgba(3, 218, 198, 0.5); }
        `}</style>

        <div className="login-container">
          <div className="art-blob blob-1"></div>
          <div className="art-blob blob-2"></div>
          <div className="art-blob blob-3"></div>

          <div className="glass-card">
            <h1 className="game-title">Draw Noices</h1>
            <p className="game-subtitle">The ultimate artistic multiplayer experience</p>
            
            <input 
              className="name-input"
              type="text" 
              value={name} 
              onChange={(e) => { setName(e.target.value); setError(''); }} 
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()} 
              placeholder="Enter your nickname..." 
              maxLength="12"
              autoFocus
            />

            {mode === 'invite' ? (
              <div style={{ marginBottom: '25px' }}>
                <div style={{ color: '#03dac6', marginBottom: '15px', fontWeight: 'bold', fontSize: '15px' }}>
                  🎟️ You have been invited to a Private Room!
                </div>
                <input 
                  type="text" 
                  placeholder="Room Password (if any)" 
                  value={joinPassword}
                  onChange={e => setJoinPassword(e.target.value)}
                  maxLength="20"
                  style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '12px', outline: 'none', boxSizing: 'border-box', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.2)' }}
                />
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexShrink: 0 }}>
                  <button className="tab-btn" onClick={() => setMode('public')} style={{ background: mode === 'public' ? '#bb86fc' : 'rgba(255,255,255,0.05)', color: mode === 'public' ? '#000' : '#888' }}>🌍 Public</button>
                  <button className="tab-btn" onClick={() => setMode('private')} style={{ background: mode === 'private' ? '#bb86fc' : 'rgba(255,255,255,0.05)', color: mode === 'private' ? '#000' : '#888' }}>🔒 Create</button>
                  <button className="tab-btn" onClick={() => setMode('browse')} style={{ background: mode === 'browse' ? '#bb86fc' : 'rgba(255,255,255,0.05)', color: mode === 'browse' ? '#000' : '#888' }}>🔍 Browse</button>
                </div>

                {/* --- CREATE PRIVATE LOBBY --- */}
                {mode === 'private' && (
                  <div className="settings-box" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: '8px', flexShrink: 0 }}>
                      <input 
                        type="text" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        placeholder="Room Password (Optional)"
                        maxLength="20"
                        style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', outline: 'none', boxSizing: 'border-box', fontSize: '14px' }}
                      />
                    </div>

                    <div className="settings-grid">
                      <div>
                        <div className="compact-label">
                          <span>Max Players</span><span style={{ color: '#03dac6', fontWeight: 'bold' }}>{maxPlayers}</span>
                        </div>
                        <input type="range" min="2" max="8" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} style={{ width: '100%' }} />
                      </div>

                      <div>
                        <div className="compact-label">
                          <span>Total Rounds</span><span style={{ color: '#03dac6', fontWeight: 'bold' }}>{rounds}</span>
                        </div>
                        <input type="range" min="1" max="10" value={rounds} onChange={e => setRounds(e.target.value)} style={{ width: '100%' }} />
                      </div>

                      <div>
                        <div className="compact-label">
                          <span>Draw Time</span><span style={{ color: '#03dac6', fontWeight: 'bold' }}>{drawTime}s</span>
                        </div>
                        <input type="range" min="30" max="300" step="10" value={drawTime} onChange={e => setDrawTime(e.target.value)} style={{ width: '100%' }} />
                      </div>

                      <div>
                        <div className="compact-label">
                          <span>Hint Amount</span>
                          <span style={{ color: '#03dac6', fontWeight: 'bold' }}>
                            {hintLevel == 1 ? 'Low' : hintLevel == 2 ? 'Norm' : hintLevel == 3 ? 'High' : 'Max'}
                          </span>
                        </div>
                        {/* INCREASED MAX TO 4 */}
                        <input type="range" min="1" max="4" step="1" value={hintLevel} onChange={e => setHintLevel(e.target.value)} style={{ width: '100%' }} />
                      </div>
                    </div>

                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '50px' }}>
                      <textarea 
                        value={customWords} 
                        onChange={e => setCustomWords(e.target.value)} 
                        placeholder="Custom Words (e.g. Anime, Naruto)..."
                        maxLength="30000"
                        style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', outline: 'none', resize: 'none', boxSizing: 'border-box', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.2)', fontSize: '13px', flexGrow: 1 }}
                      />
                    </div>
                  </div>
                )}

                {/* --- BROWSE CUSTOM LOBBIES --- */}
                {mode === 'browse' && (
                  <div className="settings-box" style={{ maxHeight: '35vh' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <span style={{ color: '#03dac6', fontWeight: 'bold' }}>Active Custom Games</span>
                      <button onClick={fetchLobbies} style={{ background: 'transparent', border: 'none', color: '#bb86fc', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>🔄 Refresh</button>
                    </div>
                    
                    {customLobbies.length === 0 ? (
                      <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>No custom games currently active.</div>
                    ) : (
                      customLobbies.map(lobby => (
                        <div key={lobby.id} style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '12px', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ textAlign: 'left', overflow: 'hidden', paddingRight: '10px' }}>
                              <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '15px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{lobby.hostName}'s Room</div>
                              <div style={{ color: '#aaa', fontSize: '12px', marginTop: '4px' }}>
                                👥 {lobby.players}/{lobby.maxPlayers} Players &nbsp;
                                {lobby.hasPassword ? '🔒 Password' : '🔓 Open'}
                              </div>
                            </div>
                            
                            <button 
                              onClick={() => {
                                if (selectedLobbyId === lobby.id) {
                                   handleJoin(lobby) // Confirm join
                                } else {
                                   setSelectedLobbyId(lobby.id)
                                   setJoinPassword('')
                                }
                              }}
                              style={{ padding: '8px 16px', background: selectedLobbyId === lobby.id ? '#03dac6' : '#bb86fc', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0, transition: '0.2s' }}
                            >
                              {selectedLobbyId === lobby.id ? 'Confirm' : 'Join'}
                            </button>
                          </div>
                          
                          {/* Reveal password input if required and selected */}
                          {selectedLobbyId === lobby.id && lobby.hasPassword && (
                            <div style={{ marginTop: '12px', animation: 'fadeIn 0.3s ease' }}>
                               <input 
                                 type="text" 
                                 placeholder="Enter Room Password" 
                                 value={joinPassword}
                                 onChange={e => setJoinPassword(e.target.value)}
                                 style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', border: '1px solid #bb86fc', color: '#fff', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }}
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
              <div style={{ color: '#ff6b6b', fontWeight: 'bold', marginBottom: '20px', fontSize: '15px', textShadow: '0 2px 4px rgba(0,0,0,0.5)', animation: 'pulse 1.5s infinite' }}>
                {error}
              </div>
            )}
            
            {/* Hide the main enter button when browsing, since joining happens on the lobby card itself */}
            {mode !== 'browse' && (
              <button className="join-btn" onClick={() => handleJoin()}>
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