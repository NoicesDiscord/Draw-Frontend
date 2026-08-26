import { useState, useEffect, useRef } from 'react'

export default function ChatBox({ socket, playerInfo, isMyTurn }) {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef(null)

  // Load the sound file into memory
  const successSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3')
  successSound.volume = 0.5 // Keep it from being too loud

  useEffect(() => {
    if (!socket) return
    
    const handleNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg])
      
      // If the server tags this message as a correct guess, play the ding!
      if (msg.isGuess) {
        successSound.currentTime = 0 // Resets the audio in case multiple people guess instantly
        successSound.play().catch(err => console.log("Browser blocked audio:", err))
      }
    }
    
    socket.on('chat_message', handleNewMessage)
    return () => socket.off('chat_message', handleNewMessage)
  }, [socket])

  useEffect(() => {
    // FIX: "inline: nearest" strictly forbids the browser from shifting the page left or right!
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' })
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    socket.emit('chat_message', inputValue)
    setInputValue('')
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', border: '1px solid #333', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#1e1e1e' }}>
      
      {/* FIX: overflowY set to 'scroll' so the track is always there, preventing width recalculations */}
      <div style={{ flexGrow: 1, height: '0px', overflowY: 'scroll', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ fontSize: '14px', lineHeight: '1.4' }}>
            {msg.isGuess ? (
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

      <form onSubmit={handleSubmit} style={{ display: 'flex', borderTop: '1px solid #333', marginTop: 'auto' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={isMyTurn ? "You are drawing! 🎨" : "Guess the word..."}
          disabled={isMyTurn}
          style={{ 
            flexGrow: 1, padding: '12px', border: 'none', outline: 'none', minWidth: 0,
            backgroundColor: isMyTurn ? '#1a1a1a' : '#2d2d2d', 
            color: isMyTurn ? '#666' : '#fff', 
            cursor: isMyTurn ? 'not-allowed' : 'text'
          }}
        />
        <button 
          type="submit" 
          disabled={isMyTurn}
          style={{ 
            padding: '12px 20px', border: 'none', fontWeight: 'bold', flexShrink: 0,
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