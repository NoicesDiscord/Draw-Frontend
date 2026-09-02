import { useRef, useState, useEffect } from 'react';

export default function DrawingCanvas({
  canvasRef, previewCanvasRef, contextRef, previewContextRef,
  isMyTurn, activeTool, brushColor, brushSize, applyFill,
  emitDrawCommand, pointBuffer, undoStack, redoStack, saveState
}) {
  const [isDrawing, setIsDrawing] = useState(false);
  const shapeStartRef = useRef(null);
  const sprayIntervalRef = useRef(null);
  const lastEmitRef = useRef({ x: 0, y: 0 });

  // Instantly stop drawing and clear spray intervals if our turn ends abruptly!
  useEffect(() => {
    if (!isMyTurn && sprayIntervalRef.current) {
      clearInterval(sprayIntervalRef.current);
      setIsDrawing(false);
    }
  }, [isMyTurn]);

  const getCoordinates = (e) => {
    const clientX = e.clientX;
    const clientY = e.clientY;
    const rect = canvasRef.current.getBoundingClientRect();
    
    // We calculate ACTUAL pixel coordinates for local drawing
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    const actualX = (clientX - rect.left) * scaleX;
    const actualY = (clientY - rect.top) * scaleY;

    // We also calculate NORMALIZED coordinates (0.0 to 1.0) for network sending
    const normX = actualX / canvasRef.current.width;
    const normY = actualY / canvasRef.current.height;

    return {
      actual: { x: actualX, y: actualY },
      norm: { x: normX, y: normY }
    };
  };

  const startDrawing = (e) => {
    if (!isMyTurn) return;
    e.preventDefault(); 
    e.currentTarget.setPointerCapture(e.pointerId); 
    
    const { actual: { x, y }, norm } = getCoordinates(e);
    pointBuffer.current = [norm]; // Send normalized points to network

    if (activeTool === 'bucket') {
      applyFill(contextRef.current, canvasRef.current, x, y, brushColor);
      emitDrawCommand('fill', { x: norm.x, y: norm.y, color: brushColor });
      return;
    }

    if (['ruler', 'circle', 'rect', 'triangle'].includes(activeTool)) {
      shapeStartRef.current = { sx: x, sy: y, ex: x, ey: y };
      setIsDrawing(true);
      return;
    }

    if (activeTool === 'spray' || activeTool === 'rainbowSpray') {
      setIsDrawing(true);
      if (sprayIntervalRef.current) clearInterval(sprayIntervalRef.current);
      
      const sprayDrop = (cx, cy) => {
        const sprayRadius = brushSize * 1.5; 
        const sprayDensity = Math.min(20, Math.max(8, Math.floor(brushSize * 0.8))); 
        
        for (let i = 0; i < sprayDensity; i++) {
           const angle = Math.random() * Math.PI * 2;
           const radius = Math.random() * sprayRadius;
           const dotX = cx + Math.cos(angle) * radius;
           const dotY = cy + Math.sin(angle) * radius;
           
           let dotColor = brushColor;
           if (activeTool === 'rainbowSpray') {
             const hue = Math.floor(Math.random() * 360);
             dotColor = `hsl(${hue}, 100%, 50%)`;
           }
           
           contextRef.current.fillStyle = dotColor;
           contextRef.current.fillRect(dotX, dotY, 4, 4);
           
           if (i < 2) {
             const normDotX = dotX / canvasRef.current.width;
             const normDotY = dotY / canvasRef.current.height;
             emitDrawCommand('start', { x: normDotX, y: normDotY, color: dotColor, size: 4 });
           }
        }
      };
      sprayDrop(x, y);
      shapeStartRef.current = { sx: x, sy: y };
      sprayIntervalRef.current = setInterval(() => {
         if (shapeStartRef.current) sprayDrop(shapeStartRef.current.sx, shapeStartRef.current.sy);
      }, 75); 
      return;
    }
    
    contextRef.current.strokeStyle = brushColor;
    contextRef.current.lineWidth = brushSize;
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
    
    setIsDrawing(true);
    lastEmitRef.current = { x, y }; 
    emitDrawCommand('start', { x: norm.x, y: norm.y, color: brushColor, size: brushSize });
  };

  const draw = (e) => {
    if (!isDrawing || !isMyTurn) return;
    e.preventDefault();

    if (e.buttons !== 1 && e.pointerType === 'mouse') {
      stopDrawing();
      return;
    }

    const { actual: { x, y }, norm } = getCoordinates(e);

    if (['ruler', 'circle', 'rect', 'triangle'].includes(activeTool)) {
       const dist = Math.abs(x - shapeStartRef.current.ex) + Math.abs(y - shapeStartRef.current.ey);
       if (dist < 4) return; 
       
       shapeStartRef.current.ex = x;
       shapeStartRef.current.ey = y;
       
       const pCtx = previewContextRef.current;
       pCtx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
       pCtx.strokeStyle = brushColor;
       pCtx.lineWidth = brushSize;
       pCtx.beginPath();
       
       const { sx, sy } = shapeStartRef.current;

       if (activeTool === 'ruler') {
          pCtx.moveTo(sx, sy);
          pCtx.lineTo(x, y);
       } else if (activeTool === 'rect') {
          contextRef.current.rect(sx, sy, x - sx, y - sy);
       } else if (activeTool === 'circle') {
          const radius = Math.sqrt(Math.pow(x - sx, 2) + Math.pow(y - sy, 2));
          contextRef.current.arc(sx, sy, radius, 0, 2 * Math.PI);
       } else if (activeTool === 'triangle') {
          contextRef.current.moveTo(sx + (x - sx) / 2, sy);
          contextRef.current.lineTo(x, y);
          contextRef.current.lineTo(sx, y);
          contextRef.current.closePath();
       }
       contextRef.current.stroke();
       return;
    }

    if (activeTool === 'spray' || activeTool === 'rainbowSpray') {
       shapeStartRef.current.sx = x;
       shapeStartRef.current.sy = y;
       return;
    }
    
    contextRef.current.strokeStyle = brushColor;
    contextRef.current.lineWidth = brushSize;
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
    
    const dist = Math.abs(x - lastEmitRef.current.x) + Math.abs(y - lastEmitRef.current.y);
    if (dist > 6) {
      pointBuffer.current.push(norm); // Buffer normalized points
      lastEmitRef.current = { x, y };
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    
    if (activeTool === 'spray' || activeTool === 'rainbowSpray') {
       clearInterval(sprayIntervalRef.current);
       setIsDrawing(false);
       saveState();
       redoStack.current = [];
       return;
    }

    if (['ruler', 'circle', 'rect', 'triangle'].includes(activeTool)) {
       const { sx, sy, ex, ey } = shapeStartRef.current;
       const w = canvasRef.current.width;
       const h = canvasRef.current.height;
       
       // Normalized start and end points
       const n_sx = sx/w, n_sy = sy/h, n_ex = ex/w, n_ey = ey/h;
       
       previewContextRef.current.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
       
       contextRef.current.strokeStyle = brushColor;
       contextRef.current.lineWidth = brushSize;
       contextRef.current.beginPath();
       
       if (activeTool === 'ruler') {
          contextRef.current.moveTo(sx, sy);
          contextRef.current.lineTo(ex, ey);
          emitDrawCommand('start', { x: n_sx, y: n_sy, color: brushColor, size: brushSize });
          emitDrawCommand('draw', { x: n_ex, y: n_ey, color: brushColor, size: brushSize });
          emitDrawCommand('stop');
       } else if (activeTool === 'rect') {
          contextRef.current.rect(sx, sy, ex - sx, ey - sy);
          emitDrawCommand('start', { x: n_sx, y: n_sy, color: brushColor, size: brushSize });
          emitDrawCommand('draw', { x: n_ex, y: n_sy, color: brushColor, size: brushSize });
          emitDrawCommand('draw', { x: n_ex, y: n_ey, color: brushColor, size: brushSize });
          emitDrawCommand('draw', { x: n_sx, y: n_ey, color: brushColor, size: brushSize });
          emitDrawCommand('draw', { x: n_sx, y: n_sy, color: brushColor, size: brushSize });
          emitDrawCommand('stop');
       } else if (activeTool === 'triangle') {
          const midX = sx + (ex - sx) / 2;
          const n_midX = midX/w;
          
          contextRef.current.moveTo(midX, sy);
          contextRef.current.lineTo(ex, ey);
          contextRef.current.lineTo(sx, ey);
          contextRef.current.closePath();
          
          emitDrawCommand('start', { x: n_midX, y: n_sy, color: brushColor, size: brushSize });
          emitDrawCommand('draw', { x: n_ex, y: n_ey, color: brushColor, size: brushSize });
          emitDrawCommand('draw', { x: n_sx, y: n_ey, color: brushColor, size: brushSize });
          emitDrawCommand('draw', { x: n_midX, y: n_sy, color: brushColor, size: brushSize });
          emitDrawCommand('stop');
       } else if (activeTool === 'circle') {
          const radius = Math.sqrt(Math.pow(ex - sx, 2) + Math.pow(ey - sy, 2));
          contextRef.current.arc(sx, sy, radius, 0, 2 * Math.PI);
          
          const segments = 40; 
          emitDrawCommand('start', { x: (sx + radius)/w, y: n_sy, color: brushColor, size: brushSize });
          for (let i = 1; i <= segments; i++) {
             const angle = (i * 2 * Math.PI) / segments;
             emitDrawCommand('draw', { 
                 x: (sx + Math.cos(angle) * radius)/w, 
                 y: (sy + Math.sin(angle) * radius)/h, 
                 color: brushColor, size: brushSize 
             });
          }
          emitDrawCommand('stop');
       }
       
       contextRef.current.stroke();
       setIsDrawing(false);
       saveState();
       redoStack.current = [];
       return;
    }

    contextRef.current.closePath();
    setIsDrawing(false);
    
    if (pointBuffer.current.length > 0) {
      emitDrawCommand('draw_packet', { points: pointBuffer.current, color: brushColor, size: brushSize });
      pointBuffer.current = [];
    }
    
    emitDrawCommand('stop');
    
    saveState();
    redoStack.current = [];
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        style={{ position: 'absolute', zIndex: 1 }}
      />
      <canvas
        ref={previewCanvasRef}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onPointerOut={stopDrawing}
        className="game-canvas"
        style={{ position: 'absolute', zIndex: 2, touchAction: 'none', backgroundColor: 'transparent',
          cursor: !isMyTurn 
            ? 'not-allowed' 
            : activeTool === 'bucket' 
              ? 'crosshair' 
              : ['ruler', 'circle', 'rect', 'triangle'].includes(activeTool)
                ? 'cell'
                : (activeTool === 'spray' || activeTool === 'rainbowSpray')
                  ? 'alias'
                  : `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${brushSize + 6}" height="${brushSize + 6}"><circle cx="${(brushSize + 6) / 2}" cy="${(brushSize + 6) / 2}" r="${brushSize / 2}" fill="${brushColor.replace('#', '%23')}" stroke="%23000000" stroke-width="2"/><circle cx="${(brushSize + 6) / 2}" cy="${(brushSize + 6) / 2}" r="${brushSize / 2}" fill="none" stroke="%23ffffff" stroke-width="0.5"/></svg>') ${Math.round((brushSize + 6) / 2)} ${Math.round((brushSize + 6) / 2)}, crosshair` 
        }}
      />
    </div>
  );
}