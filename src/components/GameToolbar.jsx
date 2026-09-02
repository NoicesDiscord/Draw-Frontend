import { useState } from 'react'

export default function GameToolbar({
  brushColor, setBrushColor,
  brushSize, setBrushSize,
  activeTool, setActiveTool,
  handleUndo, handleRedo, handleClearBoard, emitDrawCommand
}) {
  // We moved these out of GameRoom because only the toolbar cares if the popups are open!
  const [showColorPicker, setShowColorPicker] = useState(false) 
  const [showSizePicker, setShowSizePicker] = useState(false) 
  const [showShapePicker, setShowShapePicker] = useState(false) 

  const presetColors = [
    '#000000', '#4E342E', '#8B0000', '#BF360C', '#827717', '#004d00', '#006064', '#000080', '#4A148C', '#880E4F',
    '#555555', '#795548', '#FF0000', '#FF8C00', '#FFD700', '#008000', '#00BCD4', '#0000FF', '#800080', '#E91E63',
    '#AAAAAA', '#A1887F', '#FF5252', '#FFB74D', '#FFFF00', '#00FF00', '#4DD0E1', '#1E90FF', '#BA55D3', '#FF69B4',
    '#FFFFFF', '#D7CCC8', '#FFCDD2', '#FFE0B2', '#FFF9C4', '#B9F6CA', '#B2EBF2', '#BBDEFB', '#E1BEE7', '#F8BBD0'
  ];

  return (
    <div className="toolbar" style={{ boxSizing: 'border-box' }}>
      
      <div className="desktop-only">
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {setShowColorPicker(!showColorPicker); setShowSizePicker(false); setShowShapePicker(false);}}
            style={{ width: '40px', height: '40px', borderRadius: '8px', cursor: 'pointer', padding: 0, backgroundColor: brushColor, border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}
          />
          {showColorPicker && (
            <div className="color-popup">
              {presetColors.map(color => (
                <button key={color} onClick={() => { setBrushColor(color); setShowColorPicker(false); }} style={{ aspectRatio: '1', width: '100%', borderRadius: '5px', cursor: 'pointer', padding: 0, backgroundColor: color, border: brushColor === color ? '2px solid #fff' : '1px solid #333', transform: brushColor === color ? 'scale(1.15)' : 'scale(1)' }} />
              ))}
            </div>
          )}
        </div>

        <div className="toolbar-divider" />

        <button onClick={() => {setActiveTool('brush'); setShowColorPicker(false); setShowSizePicker(false); setShowShapePicker(false);}} style={{ background: activeTool === 'brush' ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', padding: '8px 12px' }}>🖌️</button>
        <button onClick={() => {setActiveTool(activeTool === 'bucket' ? 'brush' : 'bucket'); setShowColorPicker(false); setShowSizePicker(false); setShowShapePicker(false);}} style={{ background: activeTool === 'bucket' ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', padding: '8px 12px' }}>🪣</button>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
          <button onClick={() => {setShowSizePicker(!showSizePicker); setShowColorPicker(false); setShowShapePicker(false);}} style={{ width: '40px', height: '40px', borderRadius: '8px', cursor: 'pointer', padding: 0, background: 'transparent', border: '1px solid #666', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: `${Math.min(brushSize, 30)}px`, height: `${Math.min(brushSize, 30)}px`, backgroundColor: '#1E90FF', borderRadius: '50%' }} />
          </button>
          {showSizePicker && (
            <div className="size-popup">
              {[4, 8, 14, 20, 26, 32].map(size => (
                <button key={size} onClick={() => { setBrushSize(size); if (activeTool === 'bucket') setActiveTool('brush'); setShowSizePicker(false); }} style={{ width: '38px', height: '38px', borderRadius: '8px', cursor: 'pointer', padding: 0, backgroundColor: 'transparent', border: brushSize === size ? '2px solid #fff' : '1px solid transparent', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ width: `${size}px`, height: `${size}px`, backgroundColor: '#1E90FF', borderRadius: '50%' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="toolbar-divider" />

        <button onClick={() => {setActiveTool(activeTool === 'spray' ? 'brush' : 'spray'); setShowColorPicker(false); setShowSizePicker(false); setShowShapePicker(false);}} style={{ background: activeTool === 'spray' ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', padding: '8px 12px' }}>💨</button>
        <button onClick={() => {setActiveTool(activeTool === 'rainbowSpray' ? 'brush' : 'rainbowSpray'); setShowColorPicker(false); setShowSizePicker(false); setShowShapePicker(false);}} style={{ background: activeTool === 'rainbowSpray' ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', padding: '8px 12px' }}>🌈</button>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button onClick={() => {setShowShapePicker(!showShapePicker); setShowColorPicker(false); setShowSizePicker(false);}} style={{ background: ['ruler', 'circle', 'rect', 'triangle'].includes(activeTool) ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', padding: '8px 12px' }}>
            {activeTool === 'ruler' ? '📏' : activeTool === 'circle' ? '⭕' : activeTool === 'rect' ? '⬜' : activeTool === 'triangle' ? '🔺' : '📐'}
          </button>
          {showShapePicker && (
            <div className="shape-popup">
              {[ { id: 'ruler', icon: '📏' }, { id: 'circle', icon: '⭕' }, { id: 'rect', icon: '⬜' }, { id: 'triangle', icon: '🔺' } ].map(tool => (
                <button key={tool.id} onClick={() => {setActiveTool(activeTool === tool.id ? 'brush' : tool.id); setShowShapePicker(false);}} style={{ background: activeTool === tool.id ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', padding: '8px 12px' }}>{tool.icon}</button>
              ))}
            </div>
          )}
        </div>

        <div className="toolbar-divider" />

        <button onClick={() => { handleUndo(); emitDrawCommand('undo'); }} style={{ background: 'transparent', border: '1px solid #666', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', padding: '8px 12px' }}>↩️</button>
        <button onClick={() => { handleRedo(); emitDrawCommand('redo'); }} style={{ background: 'transparent', border: '1px solid #666', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', padding: '8px 12px' }}>↪️</button>
        <button onClick={handleClearBoard} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '22px', padding: '8px 12px' }}>🗑️</button>
      </div>

      <div className="mobile-only">
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '4px' }}>
          
          <div style={{ position: 'relative' }}>
            <button onClick={() => {setShowColorPicker(!showColorPicker); setShowSizePicker(false);}} style={{ width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', padding: 0, backgroundColor: brushColor, border: '2px solid #fff', boxShadow: '0 2px 5px rgba(0,0,0,0.4)' }} />
            {showColorPicker && (
              <div className="color-popup">
                {presetColors.map(color => (
                  <button key={color} onClick={() => { setBrushColor(color); setShowColorPicker(false); }} style={{ aspectRatio: '1', width: '100%', borderRadius: '4px', cursor: 'pointer', padding: 0, backgroundColor: color, border: brushColor === color ? '2px solid #fff' : '1px solid #333', transform: brushColor === color ? 'scale(1.15)' : 'scale(1)' }} />
                ))}
              </div>
            )}
          </div>

          <button onClick={() => {setActiveTool('brush'); setShowColorPicker(false); setShowSizePicker(false);}} style={{ background: activeTool === 'brush' ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', padding: '6px', flexGrow: 1 }}>🖌️</button>
          <button onClick={() => {setActiveTool(activeTool === 'bucket' ? 'brush' : 'bucket'); setShowColorPicker(false); setShowSizePicker(false);}} style={{ background: activeTool === 'bucket' ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', padding: '6px', flexGrow: 1 }}>🪣</button>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button onClick={() => {setShowSizePicker(!showSizePicker); setShowColorPicker(false);}} style={{ width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', padding: 0, background: 'transparent', border: '1px solid #666', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ width: `${Math.min(brushSize, 26)}px`, height: `${Math.min(brushSize, 26)}px`, backgroundColor: '#1E90FF', borderRadius: '50%' }} />
            </button>
            {showSizePicker && (
              <div className="size-popup">
                {[4, 8, 14, 20, 26].map(size => (
                  <button key={size} onClick={() => { setBrushSize(size); if (activeTool === 'bucket') setActiveTool('brush'); setShowSizePicker(false); }} style={{ width: '36px', height: '36px', borderRadius: '8px', cursor: 'pointer', padding: 0, backgroundColor: 'transparent', border: brushSize === size ? '2px solid #fff' : '1px solid transparent', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ width: `${size}px`, height: `${size}px`, backgroundColor: '#1E90FF', borderRadius: '50%' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => { handleUndo(); emitDrawCommand('undo'); }} style={{ background: 'transparent', border: '1px solid #666', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', padding: '6px', flexGrow: 1 }}>↩️</button>
          <button onClick={() => { handleRedo(); emitDrawCommand('redo'); }} style={{ background: 'transparent', border: '1px solid #666', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', padding: '6px', flexGrow: 1 }}>↪️</button>
          <button onClick={handleClearBoard} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '6px' }}>🗑️</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '6px' }}>
          {[ { id: 'spray', icon: '💨' }, { id: 'rainbowSpray', icon: '🌈' }, { id: 'ruler', icon: '📏' }, { id: 'circle', icon: '⭕' }, { id: 'rect', icon: '⬜' }, { id: 'triangle', icon: '🔺' } ].map(tool => (
            <button 
              key={tool.id} 
              onClick={() => {setActiveTool(activeTool === tool.id ? 'brush' : tool.id); setShowColorPicker(false); setShowSizePicker(false);}} 
              style={{ background: activeTool === tool.id ? '#03dac6' : 'transparent', border: '1px solid #666', borderRadius: '6px', cursor: 'pointer', fontSize: '18px', padding: '8px 6px', flexGrow: 1 }}
            >
              {tool.icon}
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}