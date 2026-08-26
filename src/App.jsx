import { useState, useEffect } from 'react'
import GameRoom from './components/GameRoom'

export default function App() {
  const [name, setName] = useState('')
  const [playerInfo, setPlayerInfo] = useState(null)
  const [error, setError] = useState('') 
  
  const [mode, setMode] = useState('public') 
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [rounds, setRounds] = useState(3)
  const [drawTime, setDrawTime] = useState(120)
  const [customWords, setCustomWords] = useState('') 
  const [hintLevel, setHintLevel] = useState(2) 

  const avatars = ['🦊', '🐱', '🐼', '🐨', '🐸', '🐯', '🦖', '🐙', '👻', '👽', '🤖', '👾', '🤡', '🤠', '🦄', '🐲']

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
      let parsedWords = customWords.split(',').map(w => w.trim()).filter(w => w.length > 1)

      if (inviteRoom) {
        setPlayerInfo({ playerName: finalName, roomId: inviteRoom })
      } else if (mode === 'private') {
        setPlayerInfo({ 
          playerName: finalName, 
          privateSettings: { maxPlayers, rounds, drawTime, hintLevel, customWords: parsedWords } 
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
          /* Deep artistic dark background with a subtle drawing-canvas dot pattern */
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

          /* --- NEW: Floating Organic Paint Blobs --- */
          .art-blob {
            position: absolute;
            filter: blur(60px);
            z-index: 0;
            opacity: 0.5;
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

          /* --- Ultra Premium Glassmorphism --- */
          .glass-card { 
            position: relative; z-index: 10;
            background: rgba(20, 20, 25, 0.45); 
            backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); 
            border: 1px solid rgba(255, 255, 255, 0.1); 
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            border-left: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); 
            border-radius: 30px; padding: 45px 40px; width: 100%; max-width: 440px; 
            text-align: center; animation: floatCard 6s ease-in-out infinite; 
          }
          
          /* --- Artist Neon Title --- */
          .game-title { 
            font-size: 48px; font-weight: 900; margin: 0 0 5px 0; letter-spacing: 1px; 
            background: linear-gradient(to right, #ff1493, #bb86fc, #03dac6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(0px 2px 15px rgba(187, 134, 252, 0.4));
          }
          .game-subtitle { color: #aaa; font-size: 15px; margin: 0 0 35px 0; font-weight: 500; letter-spacing: 0.5px; }
          
          /* Inputs and Buttons */
          .name-input { 
            width: 100%; padding: 18px 20px; font-size: 18px; 
            background: rgba(0, 0, 0, 0.3); border: 2px solid rgba(255, 255, 255, 0.08); 
            color: white; border-radius: 16px; outline: none; transition: all 0.3s ease; 
            box-sizing: border-box; text-align: center; font-weight: bold; margin-bottom: 20px; 
            box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);
          }
          .name-input::placeholder { color: rgba(255, 255, 255, 0.3); font-weight: normal; }
          .name-input:focus { border-color: #bb86fc; background: rgba(0, 0, 0, 0.5); box-shadow: 0 0 20px rgba(187, 134, 252, 0.2), inset 0 2px 10px rgba(0,0,0,0.3); }
          
          .join-btn { 
            width: 100%; padding: 18px; font-size: 18px; font-weight: 800; color: #fff; 
            background: linear-gradient(135deg, #bb86fc, #7928ca); 
            border: none; border-radius: 16px; cursor: pointer; transition: all 0.3s ease; 
            box-shadow: 0 8px 25px rgba(121, 40, 202, 0.5); text-transform: uppercase; letter-spacing: 1px;
          }
          .join-btn:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(121, 40, 202, 0.7); }
          .join-btn:active { transform: translateY(1px); }
          
          /* Settings UI */
          .settings-box {
            background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255,255,255,0.05);
            padding: 20px; border-radius: 20px; margin-bottom: 25px; text-align: left;
            box-shadow: inset 0 4px 15px rgba(0,0,0,0.2);
          }
          .tab-btn {
            flex: 1; padding: 12px; border-radius: 12px; border: none; cursor: pointer; font-weight: bold; transition: 0.2s;
          }
          
          /* Custom Slider CSS */
          input[type=range] { -webkit-appearance: none; background: rgba(255,255,255,0.1); height: 6px; border-radius: 3px; outline: none; margin-top: 5px; }
          input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #03dac6; cursor: pointer; box-shadow: 0 0 10px rgba(3, 218, 198, 0.5); }
        `}</style>

        <div className="login-container">
          {/* Animated Artistic Background Blobs */}
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
              <div style={{ color: '#03dac6', marginBottom: '25px', fontWeight: 'bold', fontSize: '15px' }}>
                🎟️ You have been invited to a Private Room!
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
                  <button 
                    className="tab-btn"
                    onClick={() => setMode('public')}
                    style={{ background: mode === 'public' ? '#bb86fc' : 'rgba(255,255,255,0.05)', color: mode === 'public' ? '#000' : '#888' }}
                  >🌍 Public</button>
                  <button 
                    className="tab-btn"
                    onClick={() => setMode('private')}
                    style={{ background: mode === 'private' ? '#bb86fc' : 'rgba(255,255,255,0.05)', color: mode === 'private' ? '#000' : '#888' }}
                  >🔒 Private</button>
                </div>

                {mode === 'private' && (
                  <div className="settings-box">
                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc', fontSize: '14px', marginBottom: '8px' }}>
                        <span>Max Players</span><span style={{ color: '#03dac6', fontWeight: 'bold' }}>{maxPlayers}</span>
                      </div>
                      <input type="range" min="2" max="8" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} style={{ width: '100%' }} />
                    </div>

                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc', fontSize: '14px', marginBottom: '8px' }}>
                        <span>Total Rounds</span><span style={{ color: '#03dac6', fontWeight: 'bold' }}>{rounds}</span>
                      </div>
                      <input type="range" min="1" max="10" value={rounds} onChange={e => setRounds(e.target.value)} style={{ width: '100%' }} />
                    </div>

                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc', fontSize: '14px', marginBottom: '8px' }}>
                        <span>Draw Time</span><span style={{ color: '#03dac6', fontWeight: 'bold' }}>{drawTime}s</span>
                      </div>
                      <input type="range" min="30" max="300" step="10" value={drawTime} onChange={e => setDrawTime(e.target.value)} style={{ width: '100%' }} />
                    </div>

                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc', fontSize: '14px', marginBottom: '8px' }}>
                        <span>Hint Amount</span>
                        <span style={{ color: '#03dac6', fontWeight: 'bold' }}>
                          {hintLevel == 1 ? 'Low' : hintLevel == 2 ? 'Normal' : 'High'}
                        </span>
                      </div>
                      <input type="range" min="1" max="3" step="1" value={hintLevel} onChange={e => setHintLevel(e.target.value)} style={{ width: '100%' }} />
                    </div>

                    <div style={{ marginBottom: '5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc', fontSize: '14px', marginBottom: '8px' }}>
                        <span>Custom Words (Optional)</span>
                      </div>
                      <textarea 
                        value={customWords} 
                        onChange={e => setCustomWords(e.target.value)} 
                        placeholder="e.g. Anime, Naruto, Luffy, Goku"
                        maxLength="30000"
                        style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '12px', outline: 'none', resize: 'vertical', minHeight: '70px', boxSizing: 'border-box', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.2)' }}
                      />
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>Separate words with commas.</div>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {error && (
              <div style={{ color: '#ff6b6b', fontWeight: 'bold', marginBottom: '20px', fontSize: '15px', textShadow: '0 2px 4px rgba(0,0,0,0.5)', animation: 'pulse 1.5s infinite' }}>
                {error}
              </div>
            )}
            
            <button className="join-btn" onClick={handleJoin}>
              {mode === 'private' ? "Create Custom Game" : "Enter Game"}
            </button>
          </div>
        </div>
      </>
    )
  }

  return <GameRoom playerInfo={playerInfo} />
}