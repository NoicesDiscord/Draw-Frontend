import { useState, useEffect } from 'react'
import GameRoom from './components/GameRoom'

export default function App() {
  const [name, setName] = useState('')
  const [playerInfo, setPlayerInfo] = useState(null)
  const [error, setError] = useState('') // NEW: Tracks the empty name error!
  
  // NEW: State for Private Room Settings
  const [mode, setMode] = useState('public') // 'public', 'private', 'invite'
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [rounds, setRounds] = useState(3)
  const [drawTime, setDrawTime] = useState(120)

  const avatars = ['🦊', '🐱', '🐼', '🐨', '🐸', '🐯', '🦖', '🐙', '👻', '👽', '🤖', '👾', '🤡', '🤠', '🦄', '🐲']

  // NEW: Detect if they clicked an invite link!
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('room')) {
      setMode('invite')
    }
  }, [])

  const handleJoin = () => {
    if (!name.trim()) {
      setError('⚠️ You must enter a nickname to play!')
      return
    }
    
    if (name.trim()) {
      const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)]
      const finalName = `${randomAvatar} ${name.trim()}`
      
      const inviteRoom = new URLSearchParams(window.location.search).get('room')

      // FIX: Send the new structured object so the backend knows what type of room to create/join!
      if (inviteRoom) {
        setPlayerInfo({ playerName: finalName, roomId: inviteRoom })
      } else if (mode === 'private') {
        setPlayerInfo({ 
          playerName: finalName, 
          privateSettings: { maxPlayers, rounds, drawTime } 
        })
      } else {
        setPlayerInfo({ playerName: finalName })
      }
    }
  }

  if (!playerInfo) {
    return (
      <>
        <style>{`
          @keyframes gradientBG { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
          @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } }

          body, html { margin: 0; padding: 0; overflow: hidden; background-color: #121212; }
          .login-container { height: 100vh; width: 100vw; display: flex; align-items: center; justify-content: center; background: linear-gradient(-45deg, #0f0c29, #302b63, #24243e, #121212); background-size: 400% 400%; animation: gradientBG 15s ease infinite; font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; box-sizing: border-box; }
          .glass-card { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4); border-radius: 24px; padding: 40px; width: 100%; max-width: 420px; text-align: center; animation: float 6s ease-in-out infinite; }
          
          .game-title { color: #ffffff; font-size: 42px; font-weight: 900; margin: 0 0 10px 0; letter-spacing: 2px; text-shadow: 0 4px 10px rgba(0,0,0,0.5); }
          .game-subtitle { color: #bb86fc; font-size: 16px; margin: 0 0 30px 0; opacity: 0.9; }
          
          .name-input { width: 100%; padding: 16px 20px; font-size: 18px; background: rgba(0, 0, 0, 0.2); border: 2px solid rgba(255, 255, 255, 0.1); color: white; border-radius: 12px; outline: none; transition: all 0.3s ease; box-sizing: border-box; text-align: center; font-weight: bold; margin-bottom: 20px; }
          .name-input::placeholder { color: rgba(255, 255, 255, 0.4); font-weight: normal; }
          .name-input:focus { border-color: #03dac6; background: rgba(0, 0, 0, 0.4); box-shadow: 0 0 15px rgba(3, 218, 198, 0.3); }
          
          .join-btn { width: 100%; padding: 16px; font-size: 18px; font-weight: bold; color: #121212; background: linear-gradient(135deg, #03dac6, #018786); border: none; border-radius: 12px; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(3, 218, 198, 0.4); }
          .join-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(3, 218, 198, 0.6); }
          
          /* Custom Slider CSS */
          input[type=range] { -webkit-appearance: none; background: rgba(255,255,255,0.1); height: 6px; border-radius: 3px; outline: none; }
          input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #03dac6; cursor: pointer; }
        `}</style>

        <div className="login-container">
          <div className="glass-card">
            <h1 className="game-title">🎨 Draw & Guess</h1>
            <p className="game-subtitle">The ultimate multiplayer drawing game</p>
            
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

            {/* NEW: Menu Tabs and Settings */}
            {mode === 'invite' ? (
              <div style={{ color: '#03dac6', marginBottom: '20px', fontWeight: 'bold' }}>
                🎟️ You have been invited to a Private Room!
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  <button 
                    onClick={() => setMode('public')}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: mode === 'public' ? '#bb86fc' : 'rgba(255,255,255,0.1)', color: mode === 'public' ? '#000' : '#fff' }}
                  >🌍 Public</button>
                  <button 
                    onClick={() => setMode('private')}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: mode === 'private' ? '#bb86fc' : 'rgba(255,255,255,0.1)', color: mode === 'private' ? '#000' : '#fff' }}
                  >🔒 Private</button>
                </div>

                {mode === 'private' && (
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '12px', marginBottom: '20px', textAlign: 'left' }}>
                    <div style={{ marginBottom: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: '14px', marginBottom: '8px' }}>
                        <span>Max Players</span><span style={{ color: '#03dac6', fontWeight: 'bold' }}>{maxPlayers}</span>
                      </div>
                      <input type="range" min="2" max="8" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} style={{ width: '100%' }} />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: '14px', marginBottom: '8px' }}>
                        <span>Total Rounds</span><span style={{ color: '#03dac6', fontWeight: 'bold' }}>{rounds}</span>
                      </div>
                      <input type="range" min="1" max="10" value={rounds} onChange={e => setRounds(e.target.value)} style={{ width: '100%' }} />
                    </div>

                    <div style={{ marginBottom: '5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: '14px', marginBottom: '8px' }}>
                        <span>Draw Time</span><span style={{ color: '#03dac6', fontWeight: 'bold' }}>{drawTime}s</span>
                      </div>
                      <input type="range" min="30" max="180" step="10" value={drawTime} onChange={e => setDrawTime(e.target.value)} style={{ width: '100%' }} />
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* NEW: The glowing red error message! */}
            {error && (
              <div style={{ color: '#ff5252', fontWeight: 'bold', marginBottom: '15px', fontSize: '15px', textShadow: '0 2px 4px rgba(0,0,0,0.5)', animation: 'pulse 1.5s infinite' }}>
                {error}
              </div>
            )}
            
            <button className="join-btn" onClick={handleJoin}>
              {mode === 'private' ? "Create Private Room 🚀" : "Play Now 🚀"}
            </button>
          </div>
        </div>
      </>
    )
  }

  return <GameRoom playerInfo={playerInfo} />
}