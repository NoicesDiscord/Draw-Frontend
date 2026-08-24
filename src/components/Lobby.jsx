import { useState } from 'react'

export default function Lobby({ onJoin }) {
  const [name, setName] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault() // Prevents the page from refreshing
    if (name.trim()) {
      onJoin(name)
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center' }}>
      <h1>Draw & Guess Clone</h1>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input 
          type="text" 
          placeholder="Enter your name..." 
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={15}
          style={{ padding: '10px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        
        <button 
          type="submit"
          style={{ padding: '10px 20px', fontSize: '18px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          Play!
        </button>
      </form>
    </div>
  )
}