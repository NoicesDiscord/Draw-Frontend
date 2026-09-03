import { useState } from 'react'

export default function GameToolbar({
  brushColor, setBrushColor,
  brushSize, setBrushSize,
  activeTool, setActiveTool,
  handleUndo, handleRedo, handleClearBoard, emitDrawCommand
}) {
  const [showColorPicker, setShowColorPicker] = useState(false) 
  const [showSizePicker, setShowSizePicker] = useState(false) 
  const [showShapePicker, setShowShapePicker] = useState(false) 
  const [showMobileMore, setShowMobileMore] = useState(false) // NEW: Mobile extended menu

  const presetColors = [
    '#000000', '#4E342E', '#8B0000', '#BF360C', '#827717', '#004d00', '#006064', '#000080', '#4A148C', '#880E4F',
    '#555555', '#795548', '#FF0000', '#FF8C00', '#FFD700', '#008000', '#00BCD4', '#0000FF', '#800080', '#E91E63',
    '#AAAAAA', '#A1887F', '#FF5252', '#FFB74D', '#FFFF00', '#00FF00', '#4DD0E1', '#1E90FF', '#BA55D3', '#FF69B4',
    '#FFFFFF', '#D7CCC8', '#FFCDD2', '#FFE0B2', '#FFF9C4', '#B9F6CA', '#B2EBF2', '#BBDEFB', '#E1BEE7', '#F8BBD0'
  ];

  const closePopups = () => {
    setShowColorPicker(false); setShowSizePicker(false); setShowShapePicker(false);
  }

  const shapes = [
    { id: 'ruler', icon: '📏' }, { id: 'circle', icon: '⭕' }, 
    { id: 'rect', icon: '⬜' }, { id: 'triangle', icon: '🔺' }
  ];

  return (
    <div className="toolbar" style={{ boxSizing: 'border-box' }}>
      
      {/* PRIMARY TOOLS: Visible on Desktop & Mobile */}
      <div className="toolbar-group">
        <div style={{ position: 'relative' }}>
          <button
            className="tool-btn color-btn"
            onClick={() => { setShowColorPicker(!showColorPicker); setShowSizePicker(false); setShowShapePicker(false); setShowMobileMore(false); }}
            style={{ backgroundColor: brushColor, borderColor: showColorPicker ? 'var(--text-main)' : 'transparent' }}
          />
          {showColorPicker && (
            <div className="tool-popup color-popup">
              {presetColors.map(color => (
                <button key={color} onClick={() => { setBrushColor(color); closePopups(); }} style={{ backgroundColor: color, transform: brushColor === color ? 'scale(1.15)' : 'scale(1)', border: brushColor === color ? '2px solid var(--text-main)' : '1px solid rgba(0,0,0,0.2)' }} />
              ))}
            </div>
          )}
        </div>

        <button className={`tool-btn ${activeTool === 'brush' ? 'active' : ''}`} onClick={() => { setActiveTool('brush'); closePopups(); setShowMobileMore(false); }}>🖌️</button>
        <button className={`tool-btn ${activeTool === 'bucket' ? 'active' : ''}`} onClick={() => { setActiveTool('bucket'); closePopups(); setShowMobileMore(false); }}>🪣</button>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button className="tool-btn size-btn" onClick={() => { setShowSizePicker(!showSizePicker); setShowColorPicker(false); setShowShapePicker(false); setShowMobileMore(false); }}>
            <div style={{ width: `${Math.min(brushSize, 24)}px`, height: `${Math.min(brushSize, 24)}px`, backgroundColor: 'var(--text-main)', borderRadius: '50%' }} />
          </button>
          {showSizePicker && (
            <div className="tool-popup size-popup">
              {[4, 8, 14, 20, 26, 32].map(size => (
                <button key={size} onClick={() => { setBrushSize(size); if (activeTool === 'bucket') setActiveTool('brush'); closePopups(); }} style={{ borderColor: brushSize === size ? 'var(--text-main)' : 'transparent' }}>
                  <div style={{ width: `${Math.min(size, 28)}px`, height: `${Math.min(size, 28)}px`, backgroundColor: 'var(--text-main)', borderRadius: '50%' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="tool-btn" onClick={() => { handleUndo(); emitDrawCommand('undo'); closePopups(); setShowMobileMore(false); }}>↩️</button>
        <button className="tool-btn" onClick={() => { handleRedo(); emitDrawCommand('redo'); closePopups(); setShowMobileMore(false); }}>↪️</button>
      </div>

      <div className="toolbar-divider desktop-only" />

      {/* EXTENDED TOOLS: Desktop Only inline */}
      <div className="toolbar-group desktop-only">
        <button className={`tool-btn ${activeTool === 'spray' ? 'active' : ''}`} onClick={() => { setActiveTool('spray'); closePopups(); }}>💨</button>
        <button className={`tool-btn ${activeTool === 'rainbowSpray' ? 'active' : ''}`} onClick={() => { setActiveTool('rainbowSpray'); closePopups(); }}>🌈</button>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button className={`tool-btn ${['ruler', 'circle', 'rect', 'triangle'].includes(activeTool) ? 'active' : ''}`} onClick={() => { setShowShapePicker(!showShapePicker); setShowColorPicker(false); setShowSizePicker(false); }}>
            {activeTool === 'ruler' ? '📏' : activeTool === 'circle' ? '⭕' : activeTool === 'rect' ? '⬜' : activeTool === 'triangle' ? '🔺' : '📐'}
          </button>
          {showShapePicker && (
            <div className="tool-popup shape-popup">
              {shapes.map(tool => (
                <button key={tool.id} className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`} onClick={() => { setActiveTool(activeTool === tool.id ? 'brush' : tool.id); closePopups(); }}>{tool.icon}</button>
              ))}
            </div>
          )}
        </div>

        <button className="tool-btn danger-btn" onClick={handleClearBoard}>🗑️</button>
      </div>

      {/* MOBILE MORE BUTTON */}
      <button className={`tool-btn mobile-only ${showMobileMore ? 'active' : ''}`} onClick={() => { setShowMobileMore(!showMobileMore); closePopups(); }}>⋯</button>

      {/* MOBILE EXTENDED POPUP */}
      {showMobileMore && (
        <div className="mobile-more-popup mobile-only">
           <div className="more-grid">
              <button className={`tool-btn ${activeTool === 'spray' ? 'active' : ''}`} onClick={() => { setActiveTool('spray'); setShowMobileMore(false); }}>💨 Spray</button>
              <button className={`tool-btn ${activeTool === 'rainbowSpray' ? 'active' : ''}`} onClick={() => { setActiveTool('rainbowSpray'); setShowMobileMore(false); }}>🌈 Rainbow</button>
              <div className="menu-divider" />
              {shapes.map(tool => (
                <button key={tool.id} className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`} onClick={() => { setActiveTool(activeTool === tool.id ? 'brush' : tool.id); setShowMobileMore(false); }}>{tool.icon} Shape</button>
              ))}
              <div className="menu-divider" />
              <button className="tool-btn danger-btn" onClick={() => { handleClearBoard(); setShowMobileMore(false); }}>🗑️ Clear Board</button>
           </div>
        </div>
      )}

    </div>
  )
}