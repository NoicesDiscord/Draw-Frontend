import { useState } from 'react'
import Lobby from './components/Lobby'
import GameRoom from './components/GameRoom'

function App() {
  // This state tracks whether the user is in the lobby or has joined a game
  const [inGame, setInGame] = useState(false)
  const [playerInfo, setPlayerInfo] = useState(null)

  const handleJoin = (name) => {
    setPlayerInfo({ name })
    setInGame(true)
  }

  return (
    <div style={{ fontFamily: 'sans-serif', margin: 0, padding: '20px' }}>
      {/* Conditional Rendering: Show Lobby if not in game, otherwise show GameRoom */}
      {!inGame ? (
        <Lobby onJoin={handleJoin} />
      ) : (
        <GameRoom playerInfo={playerInfo} />
      )}
    </div>
  )
}

export default App