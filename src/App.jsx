import { useState } from 'react'
import Lobby from './components/Lobby'
import GameRoom from './components/GameRoom'

function App() {
  const [inGame, setInGame] = useState(false)
  const [playerInfo, setPlayerInfo] = useState(null)

  const handleJoin = (name) => {
    setPlayerInfo({ name })
    setInGame(true)
  }

  return (
    <div style={
      !inGame 
        // 1. LOBBY STYLE: Uses flexbox to perfectly center the name input box
        ? { width: '100vw', height: '100dvh', margin: 0, padding: 0, backgroundColor: '#121212', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontFamily: 'sans-serif' }
        // 2. GAMEROOM STYLE: Removes the centering so the GameRoom grid can lock to the edges
        : { width: '100vw', height: '100dvh', margin: 0, padding: 0, backgroundColor: '#121212', overflow: 'hidden', fontFamily: 'sans-serif' }
    }>
      {!inGame ? (
        <Lobby onJoin={handleJoin} />
      ) : (
        <GameRoom playerInfo={playerInfo} />
      )}
    </div>
  )
}

export default App