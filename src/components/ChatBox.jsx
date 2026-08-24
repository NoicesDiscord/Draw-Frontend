import { useState, useEffect, useRef } from 'react'

export default function ChatBox({ socket, playerInfo }) {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (!socket) return
    const handleNewMessage = (msg) => setMessages((prev) => [...prev, msg])
    socket.on('chat_message', handleNewMessage)
    return () => socket.off('chat_message', handleNewMessage)
  }, [socket])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    // We just send the raw text string now!
    socket.emit('chat_message', inputValue)
    setInputValue('')
  }

  return (
    <div style={{ width: '300px', display: 'flex', flexDirection: 'column', border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ flexGrow: 1, height: '400px', overflowY: 'auto', padding: '10px', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ fontSize: '14px' }}>
            {msg.isGuess ? (
              <span style={{ color: '#2E7D32', fontWeight: 'bold' }}>🎉 {msg.sender} guessed the word!</span>
            ) : (
              <span><strong style={{ color: '#1976D2' }}>{msg.sender}: </strong>{msg.text}</span>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', borderTop: '1px solid #ccc' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Guess the word..."
          style={{ flexGrow: 1, padding: '10px', border: 'none', outline: 'none' }}
        />
        <button type="submit" style={{ padding: '10px', backgroundColor: '#eee', border: 'none', cursor: 'pointer' }}>Send</button>
      </form>
    </div>
  )
}