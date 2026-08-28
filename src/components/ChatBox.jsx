import { useState, useEffect, useRef } from 'react'

// FIX: Pointing to your local public/sounds/ folder! No more Mixkit static!
const joinSound = new Audio('/sounds/join.mp3') 
const leaveSound = new Audio('/sounds/leave.mp3') 
const closeSound = new Audio('/sounds/close.mp3') 
const alertSound = new Audio('/sounds/alert.mp3') 
// Moved success sound here so it uses the same safe clone logic
const successSound = new Audio('/sounds/success.mp3') 

joinSound.volume = 0.4
leaveSound.volume = 0.4
closeSound.volume = 0.5
alertSound.volume = 0.6
successSound.volume = 0.5
 
const playSoundSafely = (audioObj) => {
  const clone = audioObj.cloneNode()
  clone.volume = audioObj.volume
  clone.play().catch(e => console.log(e))
}

export default function ChatBox({ socket, playerInfo, isMyTurn }) {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [votedOn, setVotedOn] = useState({}) // NEW: Remembers if you already voted on a kick
  const messagesEndRef = useRef(null)

 

  useEffect(() => {
    if (!socket) return
    
    const handleNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg])
      
      if (msg.isGuess) {
        playSoundSafely(successSound);
      }

      if (msg.sender === "System" && msg.text) {
        if (msg.text.includes("joined the lobby")) {
          playSoundSafely(joinSound);
        } else if (msg.text.includes("left the lobby")) {
          playSoundSafely(leaveSound);
        }
      }
      
      if (msg.type === 'votekick') {
        playSoundSafely(alertSound);
      }
      
      if (msg.isCloseGuess) {
        playSoundSafely(closeSound);
      }
    }
    
    socket.on('chat_message', handleNewMessage)

    return () => socket.off('chat_message', handleNewMessage)
  }, [socket])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' })
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    socket.emit('chat_message', inputValue)
    setInputValue('')
  }

  // NEW: Emit the vote and disable the buttons locally
  const handleVote = (targetId, voteType) => {
    socket.emit('submit_votekick', { targetId, vote: voteType })
    setVotedOn(prev => ({ ...prev, [targetId]: true }))
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', border: '1px solid #333', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#1e1e1e' }}>
      
      <div style={{ flexGrow: 1, height: '0px', overflowY: 'scroll', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ fontSize: '14px', lineHeight: '1.4' }}>
            
            {/* NEW: Render interactive Vote Kick block! */}
            {msg.type === 'votekick' ? (
              <div style={{ backgroundColor: '#2d2d2d', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #ff9800', marginTop: '5px' }}>
                <div style={{ color: '#ff9800', fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>
                  ⚠️ {msg.text}
                </div>
                {!votedOn[msg.targetId] ? (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => handleVote(msg.targetId, 'yes')} style={{ flex: 1, padding: '8px', background: '#4caf50', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#fff', fontWeight: 'bold' }}>
                      ✅ YES
                    </button>
                    <button onClick={() => handleVote(msg.targetId, 'no')} style={{ flex: 1, padding: '8px', background: '#f44336', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#fff', fontWeight: 'bold' }}>
                      ❌ NO
                    </button>
                  </div>
                ) : (
                  <div style={{ color: '#888', fontStyle: 'italic', fontSize: '12px', textAlign: 'center' }}>Vote casted</div>
                )}
              </div>
            ) : msg.isCloseGuess ? (
              /* FIX: Catches the close guess flag and renders it in bright yellow! */
              <span style={{ color: '#FFD54F', fontWeight: 'bold' }}>
                <strong style={{ color: '#FFC107' }}>{msg.sender}: </strong>
                {msg.text}
              </span>
            ) : msg.isGuess ? (
              <span style={{ color: '#03dac6', fontWeight: 'bold' }}>🎉 {msg.sender} guessed the word!</span>
            ) : (
              <span style={{ color: '#e0e0e0' }}>
                <strong style={{ color: '#bb86fc' }}>{msg.sender}: </strong>
                {msg.text}
              </span>
            )}

          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* FIX: Moved background colors to the form wrapper so the character counter sits beautifully inside the text box! */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid #333', marginTop: 'auto', backgroundColor: isMyTurn ? '#1a1a1a' : '#2d2d2d' }}>
        <input
          type="text"
          name="guess-input"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          data-lpignore="true"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={isMyTurn ? "You are drawing! 🎨" : "Guess the word..."}
          disabled={isMyTurn}
          style={{ 
            flexGrow: 1, padding: '12px', border: 'none', outline: 'none', minWidth: 0,
            backgroundColor: 'transparent', /* Lets the form background show through! */
            color: isMyTurn ? '#666' : '#fff', 
            cursor: isMyTurn ? 'not-allowed' : 'text'
          }}
        />
        
        {/* NEW: Live Character Counter! Only appears when a guesser starts typing. */}
        {!isMyTurn && inputValue.length > 0 && (
          <div style={{ 
            color: '#03dac6', fontWeight: '900', fontSize: '15px', 
            padding: '0 12px', opacity: 0.9, fontFamily: 'monospace'
          }}>
            {inputValue.length}
          </div>
        )}

        <button 
          type="submit" 
          disabled={isMyTurn}
          style={{ 
            padding: '12px 20px', border: 'none', fontWeight: 'bold', flexShrink: 0, height: '100%',
            backgroundColor: isMyTurn ? '#444' : '#bb86fc', 
            color: isMyTurn ? '#777' : '#000', 
            cursor: isMyTurn ? 'not-allowed' : 'pointer'
          }}
        >
          Send
        </button>
      </form>
    </div>
  )
}