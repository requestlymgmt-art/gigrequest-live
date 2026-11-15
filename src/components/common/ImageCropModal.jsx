import { useState, useRef, useEffect } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Check, 
  Move,
  Camera
} from 'lucide-react';

/**
 * ImageCropModal
 * Allows bands to pan (drag) and zoom any uploaded image inside a circular frame
 * before saving as their profile picture / avatar.
 */
export default function ImageCropModal({
  isOpen,
  imageSrc,
  onClose,
  onCrop,
  title = 'Crop Profile Picture'
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Viewport circular crop size in pixels
  const CROP_SIZE = 260;

  // Reset offset and zoom when a new image is loaded
  useEffect(() => {
    if (!imageSrc || !isOpen) return;

    setZoom(1);
    setOffset({ x: 0, y: 0 });

    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageSrc;
  }, [imageSrc, isOpen]);

  if (!isOpen || !imageSrc) return null;

  // Mouse drag handlers
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch drag handlers (for mobile)
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({
        x: touch.clientX - offset.x,
        y: touch.clientY - offset.y,
      });
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setOffset({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((prev) => Math.min(Math.max(1, +(prev + delta).toFixed(2)), 3.5));
  };

  // Reset to center and 1x zoom
  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Crop & Export to High-Res JPEG (450x450)
  const handleApplyCrop = () => {
    if (!imgRef.current) return;

    const img = imgRef.current;
    const exportDim = 450;
    const canvas = document.createElement('canvas');
    canvas.width = exportDim;
    canvas.height = exportDim;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Background fill
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, exportDim, exportDim);

    // Calculate crop parameters
    // Container display width/height of the image when zoom is 1
    const renderedWidth = img.offsetWidth;
    const renderedHeight = img.offsetHeight;

    if (renderedWidth === 0 || renderedHeight === 0) {
      onCrop(imageSrc);
      onClose();
      return;
    }

    // Scale ratio between rendered CSS pixels and export canvas
    const scaleFactor = exportDim / CROP_SIZE;

    // Draw transformed image
    ctx.save();
    // Move canvas origin to center of export circle
    ctx.translate(exportDim / 2, exportDim / 2);
    // Apply pan offset & zoom scaled to export canvas
    ctx.translate(offset.x * scaleFactor, offset.y * scaleFactor);
    ctx.scale(zoom, zoom);

    // Draw the image centered
    const targetW = renderedWidth * scaleFactor;
    const targetH = renderedHeight * scaleFactor;
    ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
    ctx.restore();

    try {
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      onCrop(croppedDataUrl);
      onClose();
    } catch (e) {
      console.error('Failed to export crop:', e);
      onCrop(imageSrc);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000, padding: '1rem' }}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '460px', 
          width: '100%',
          background: '#0d131f',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={18} color="#3b82f6" />
            <h3 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700 }}>{title}</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-outline btn-sm"
            style={{ padding: '0.35rem 0.5rem' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Instructions banner */}
        <p style={{
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem'
        }}>
          <Move size={14} color="#60a5fa" />
          <span><strong>Drag</strong> to reposition • <strong>Slider</strong> to zoom</span>
        </p>

        {/* Crop Viewport Container */}
        <div 
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          style={{
            position: 'relative',
            width: '100%',
            height: '320px',
            background: '#020617',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            touchAction: 'none'
          }}
        >
          {/* Draggable & Scalable Image */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="To crop"
            draggable={false}
            style={{
              position: 'absolute',
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transition: isDragging ? 'none' : 'transform 0.05s ease-out',
              pointerEvents: 'none'
            }}
          />

          {/* Mask Overlay: Circular Cutout Frame */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            <div style={{
              width: `${CROP_SIZE}px`,
              height: `${CROP_SIZE}px`,
              borderRadius: '50%',
              border: '2px solid #3b82f6',
              boxShadow: '0 0 0 9999px rgba(3, 7, 18, 0.72)',
              position: 'relative'
            }}>
              {/* Subtle crosshairs / guides */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '20px',
                right: '20px',
                height: '1px',
                background: 'rgba(255, 255, 255, 0.15)',
                transform: 'translateY(-50%)'
              }} />
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '20px',
                bottom: '20px',
                width: '1px',
                background: 'rgba(255, 255, 255, 0.15)',
                transform: 'translateX(-50%)'
              }} />
            </div>
          </div>
        </div>

        {/* Zoom & Controls Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          margin: '1.25rem 0 1.5rem',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '0.65rem 1rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)'
        }}>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, +(z - 0.2).toFixed(2)))}
            disabled={zoom <= 1}
            style={{
              background: 'none',
              border: 'none',
              color: zoom <= 1 ? 'var(--text-dim)' : '#fff',
              cursor: zoom <= 1 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>

          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{
              flex: 1,
              accentColor: 'var(--accent-blue)',
              cursor: 'pointer'
            }}
          />

          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))}
            disabled={zoom >= 3}
            style={{
              background: 'none',
              border: 'none',
              color: zoom >= 3 ? 'var(--text-dim)' : '#fff',
              cursor: zoom >= 3 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>

          <span style={{ fontSize: '0.78rem', color: '#60a5fa', fontWeight: 700, minWidth: '40px', textAlign: 'right' }}>
            {Math.round(zoom * 100)}%
          </span>

          <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', margin: '0 0.25rem' }} />

          <button
            type="button"
            onClick={handleReset}
            className="btn btn-outline btn-sm"
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
            title="Center image"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        </div>

        {/* Modal Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApplyCrop}
            className="btn btn-primary"
            style={{ gap: '0.5rem' }}
          >
            <Check size={16} />
            <span>Apply & Save Photo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
