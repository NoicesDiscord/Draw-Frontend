import { useRef, useEffect } from 'react';

export function useDrawingEngine() {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const previewContextRef = useRef(null);
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  const clearCanvas = () => {
    if (!contextRef.current || !canvasRef.current) return;
    contextRef.current.fillStyle = 'white';
    contextRef.current.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    undoStack.current = []; 
    redoStack.current = [];
  };

  useEffect(() => {
    const setupCanvas = (cvs) => {
      if (!cvs) return null;
      const rect = cvs.getBoundingClientRect();
      const baseWidth = rect.width || 800;
      const baseHeight = rect.height || 600;
      const dpr = window.devicePixelRatio || 1;
      
      cvs.width = baseWidth * dpr;
      cvs.height = baseHeight * dpr;
      
      const ctx = cvs.getContext('2d', { willReadFrequently: true });
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      return ctx;
    };

    contextRef.current = setupCanvas(canvasRef.current);
    previewContextRef.current = setupCanvas(previewCanvasRef.current);
    clearCanvas();
  }, []);

  const redrawFromHistory = () => {
    if (!canvasRef.current || !contextRef.current) return;
    contextRef.current.fillStyle = 'white';
    contextRef.current.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    const getActualCoords = (normX, normY) => ({
      x: normX * canvasRef.current.width,
      y: normY * canvasRef.current.height
    });

    const ctx = contextRef.current;
    undoStack.current.forEach(stroke => {
      stroke.forEach(cmd => {
        if (cmd.event === 'start') {
           const pt = getActualCoords(cmd.data.x, cmd.data.y);
           ctx.strokeStyle = cmd.data.color; ctx.lineWidth = cmd.data.size;
           ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
        } else if (cmd.event === 'draw') {
           const pt = getActualCoords(cmd.data.x, cmd.data.y);
           ctx.lineTo(pt.x, pt.y); ctx.stroke();
        } else if (cmd.event === 'draw_packet') {
           ctx.strokeStyle = cmd.data.color; ctx.lineWidth = cmd.data.size;
           ctx.beginPath();
           const first = getActualCoords(cmd.data.points[0].x, cmd.data.points[0].y);
           ctx.moveTo(first.x, first.y);
           for (let i = 1; i < cmd.data.points.length; i++) {
               const pt = getActualCoords(cmd.data.points[i].x, cmd.data.points[i].y);
               ctx.lineTo(pt.x, pt.y);
           }
           ctx.stroke();
        } else if (cmd.event === 'fill') {
           const pt = getActualCoords(cmd.data.x, cmd.data.y);
           applyFill(ctx, canvasRef.current, pt.x, pt.y, cmd.data.color);
        } else if (cmd.event === 'stop') {
           ctx.closePath();
        }
      });
    });
  };

  const handleUndo = () => {
    if (undoStack.current.length > 0) {
      redoStack.current.push(undoStack.current.pop());
      redrawFromHistory();
    }
  };

  const handleRedo = () => {
    if (redoStack.current.length > 0) {
      undoStack.current.push(redoStack.current.pop());
      redrawFromHistory();
    }
  };

  const applyFill = (ctx, canvas, x, y, colorHex) => {
    const hexToRgb = (h) => [parseInt(h.slice(1,3), 16), parseInt(h.slice(3,5), 16), parseInt(h.slice(5,7), 16), 255];
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const [fR, fG, fB, fA] = hexToRgb(colorHex);
    const startPos = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
    const sR = data[startPos], sG = data[startPos+1], sB = data[startPos+2], sA = data[startPos+3];
    const tolerance = 16; 
    if (Math.abs(sR - fR) <= tolerance && Math.abs(sG - fG) <= tolerance && Math.abs(sB - fB) <= tolerance) return;
    const match = (p) => Math.abs(data[p] - sR) <= tolerance && Math.abs(data[p+1] - sG) <= tolerance && Math.abs(data[p+2] - sB) <= tolerance && Math.abs(data[p+3] - sA) <= tolerance;
    const color = (p) => { data[p]=fR; data[p+1]=fG; data[p+2]=fB; data[p+3]=fA };
    const stack = [[Math.floor(x), Math.floor(y)]];
    const w = canvas.width, h = canvas.height;
    while(stack.length) {
      let [cx, cy] = stack.pop();
      let p = (cy * w + cx) * 4;
      while(cy >= 0 && match(p)) { cy--; p -= w*4; }
      if (cy >= 0) color(p); 
      p += w*4; cy++;
      let rL = false, rR = false;
      while(cy < h && match(p)) {
        color(p);
        if (cx > 0) { if (match(p - 4)) { if (!rL) { stack.push([cx - 1, cy]); rL = true; } } else { rL = false; color(p - 4); } }
        if (cx < w - 1) { if (match(p + 4)) { if (!rR) { stack.push([cx + 1, cy]); rR = true; } } else { rR = false; color(p + 4); } }
        cy++; p += w*4;
      }
      if (cy < h) color(p); 
    }
    ctx.putImageData(imgData, 0, 0);
    undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStack.current.length > 10) undoStack.current.shift();
    redoStack.current = [];
  };

  const saveState = () => {}; // Kept as a dummy function so the canvas doesn't crash if it calls it!

  return { canvasRef, previewCanvasRef, contextRef, previewContextRef, undoStack, redoStack, clearCanvas, handleUndo, handleRedo, applyFill, saveState };
}