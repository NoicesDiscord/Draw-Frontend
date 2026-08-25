import { useState } from 'react'
import GameRoom from './components/GameRoom' // Ensure this path matches your folder structure!

export default function App() {
  const [name, setName] = useState('')
  const [playerInfo, setPlayerInfo] = useState(null)

  const handleJoin = () => {
    if (name.trim()) {
      setPlayerInfo({ name: name.trim() })
    }
  }

  // If the player hasn't joined yet, show the premium login screen
  if (!playerInfo) {
    return (
      <>
        <style>{`
          /* Smoothly moving gradient background */
          @keyframes gradientBG {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          
          /* Subtle floating animation for the card */
          @keyframes float {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0px); }
          }

          body, html {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background-color: #121212;
          }

          .login-container {
            height: 100vh;
            width: 100vw;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(-45deg, #0f0c29, #302b63, #24243e, #121212);
            background-size: 400% 400%;
            animation: gradientBG 15s ease infinite;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
          }

          .glass-card {
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
            border-radius: 24px;
            padding: 50px 40px;
            width: 100%;
            max-width: 420px;
            text-align: center;
            animation: float 6s ease-in-out infinite;
          }

          .game-title {
            color: #ffffff;
            font-size: 42px;
            font-weight: 900;
            margin: 0 0 10px 0;
            letter-spacing: 2px;
            text-shadow: 0 4px 10px rgba(0,0,0,0.5);
          }

          .game-subtitle {
            color: #bb86fc;
            font-size: 16px;
            margin: 0 0 40px 0;
            opacity: 0.9;
          }

          .name-input {
            width: 100%;
            padding: 16px 20px;
            font-size: 18px;
            background: rgba(0, 0, 0, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.1);
            color: white;
            border-radius: 12px;
            outline: none;
            transition: all 0.3s ease;
            box-sizing: border-box;
            text-align: center;
            font-weight: bold;
          }

          .name-input::placeholder {
            color: rgba(255, 255, 255, 0.4);
            font-weight: normal;
          }

          .name-input:focus {
            border-color: #03dac6;
            background: rgba(0, 0, 0, 0.4);
            box-shadow: 0 0 15px rgba(3, 218, 198, 0.3);
          }

          .join-btn {
            width: 100%;
            padding: 16px;
            margin-top: 25px;
            font-size: 18px;
            font-weight: bold;
            color: #121212;
            background: linear-gradient(135deg, #03dac6, #018786);
            border: none;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(3, 218, 198, 0.4);
          }

          .join-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(3, 218, 198, 0.6);
          }
          
          .join-btn:active {
            transform: translateY(1px);
          }
        `}</style>

        <div className="login-container">
          <div className="glass-card">
            <h1 className="game-title">🎨 Draw & Guess</h1>
            <p className="game-subtitle">The ultimate multiplayer drawing game</p>
            
            <input 
              className="name-input"
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()} 
              placeholder="Enter your nickname..." 
              maxLength="12"
              autoFocus
            />
            
            <button 
              className="join-btn"
              onClick={handleJoin}
            >
              Play Now 🚀
            </button>
          </div>
        </div>
      </>
    )
  }

  // Once joined, render the actual game room and pass the player's info!
  return <GameRoom playerInfo={playerInfo} />
}