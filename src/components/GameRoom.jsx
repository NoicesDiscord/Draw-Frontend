import { useRef, useState, useEffect } from 'react'

export default function GameRoom({ playerInfo }) {
  // These refs act as direct links to our canvas element and its 2D drawing context
  const canvasRef = useRef(null)
  const contextRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)

  // This runs once when the GameRoom first loads to set up the canvas
  useEffect(() => {
    const canvas = canvasRef.current
    // Set fixed dimensions for the drawing board
    canvas.width = 800
    canvas.height = 600

    const context = canvas.getContext('2d')
    
    // Fill the background white (otherwise it's transparent)
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    // Set up our brush styling
    context.lineCap = 'round'
    context.strokeStyle = 'black'
    context.lineWidth = 5
    
    contextRef.current = context
  }, [])

  // 1. Mouse down: Start the stroke
  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent
    contextRef.current.beginPath()
    contextRef.current.moveTo(offsetX, offsetY)
    setIsDrawing(true)
  }

  // 2. Mouse move: Draw the line
  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return
    const { offsetX, offsetY } = nativeEvent
    contextRef.current.lineTo(offsetX, offsetY)
    contextRef.current.stroke()
  }

  // 3. Mouse up or leave: Stop the stroke
  const stopDrawing = () => {
    contextRef.current.closePath()
    setIsDrawing(false)
  }

  return (
    <div style={{ display: 'flex', gap: '20px', maxWidth: '1000px', margin: '40px auto' }}>
      
      {/* Sidebar for players and future chat */}
      <div style={{ width: '200px', padding: '20px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
        <h3>Players</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ fontWeight: 'bold', color: '#4CAF50' }}>{playerInfo.name} (You)</li>
        </ul>
      </div>

      {/* The main drawing area */}
      <div>
        <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
          <h2>Drawing Board</h2>
          {/* We will add color pickers here later! */}
        </div>
        
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{ 
            border: '2px solid #333', 
            borderRadius: '8px', 
            cursor: 'crosshair',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
        />
      </div>

    </div>
  )
}