import { useState, useEffect, useRef } from 'react'

export default function ChatBox({ socket, playerInfo }) {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef(null)

  // This simple dummy logic represents the game state for now
  const secretWord = "apple" 

  useEffect(() => {
    if (!socket) return

    // 1. Define the exact function we want to run
    const handleNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg])
    }

    // 2. Attach the listener
    socket.on('chat_message', handleNewMessage)

    // 3. Explicitly remove ONLY this exact listener to prevent leaks
    return () => {
      socket.off('chat_message', handleNewMessage)
    }
  }, [socket])

  // Auto-scroll to the bottom when a new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    // Core Game Logic: Is this a correct guess?
    const isCorrectGuess = inputValue.trim().toLowerCase() === secretWord.toLowerCase()
    
    // Construct the message payload
    const messageData = {
      sender: playerInfo.name,
      text: inputValue,
      isGuess: isCorrectGuess
    }

    // Send to the Node server
    socket.emit('chat_message', messageData)
    setInputValue('')
  }

  return (
    <div style={{ width: '300px', display: 'flex', flexDirection: 'column', border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
      
      {/* Message History Area */}
      <div style={{ flexGrow: 1, height: '400px', overflowY: 'auto', padding: '10px', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ fontSize: '14px' }}>
            {msg.isGuess ? (
               // If it's a correct guess, show a special green notification
              <span style={{ color: '#2E7D32', fontWeight: 'bold' }}>
                🎉 {msg.sender} guessed the word!
              </span>
            ) : (
              // Otherwise, show the normal chat message
              <span>
                <strong style={{ color: '#1976D2' }}>{msg.sender}: </strong>
                {msg.text}
              </span>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', borderTop: '1px solid #ccc' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Guess the word..."
          style={{ flexGrow: 1, padding: '10px', border: 'none', outline: 'none' }}
        />
        <button type="submit" style={{ padding: '10px', backgroundColor: '#eee', border: 'none', cursor: 'pointer' }}>
          Send
        </button>
      </form>
    </div>
  )
}