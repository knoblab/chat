import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, Check, RotateCcw } from 'lucide-react';

interface ImageCropperModalProps {
  isOpen: boolean;
  file: File | null;
  onClose: () => void;
  onCropComplete: (croppedFile: File) => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  file,
  onClose,
  onCropComplete,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const VIEWPORT_SIZE = 260; // 260x260 circle viewport
  const OUTPUT_SIZE = 400;   // 400x400 final cropped avatar

  useEffect(() => {
    if (!file || !isOpen) {
      setImageSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });

    const img = new Image();
    img.src = url;
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
    };

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, isOpen]);

  if (!isOpen || !imageSrc) return null;

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setOffset({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleCrop = () => {
    if (!imgRef.current || !canvasRef.current || !file) return;

    const canvas = canvasRef.current;
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imgRef.current;
    
    // Clear canvas
    ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    // Create circular clip path
    ctx.save();
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Calculate scaling ratio from VIEWPORT_SIZE to OUTPUT_SIZE
    const ratio = OUTPUT_SIZE / VIEWPORT_SIZE;

    // Calculate base display size in viewport (fit-to-cover or fit-to-contain)
    let baseW = VIEWPORT_SIZE;
    let baseH = VIEWPORT_SIZE;
    if (imageDimensions.width && imageDimensions.height) {
      const aspect = imageDimensions.width / imageDimensions.height;
      if (aspect > 1) {
        baseH = VIEWPORT_SIZE;
        baseW = VIEWPORT_SIZE * aspect;
      } else {
        baseW = VIEWPORT_SIZE;
        baseH = VIEWPORT_SIZE / aspect;
      }
    }

    const drawW = baseW * zoom * ratio;
    const drawH = baseH * zoom * ratio;
    
    // Center of canvas plus scaled offset
    const drawX = (OUTPUT_SIZE - drawW) / 2 + offset.x * ratio;
    const drawY = (OUTPUT_SIZE - drawH) / 2 + offset.y * ratio;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();

    canvas.toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], file.name || 'profile_cropped.png', {
          type: 'image/png',
          lastModified: Date.now(),
        });
        onCropComplete(croppedFile);
        onClose();
      }
    }, 'image/png', 0.95);
  };

  // Calculate base display size for preview
  let dispW = VIEWPORT_SIZE;
  let dispH = VIEWPORT_SIZE;
  if (imageDimensions.width && imageDimensions.height) {
    const aspect = imageDimensions.width / imageDimensions.height;
    if (aspect > 1) {
      dispH = VIEWPORT_SIZE;
      dispW = VIEWPORT_SIZE * aspect;
    } else {
      dispW = VIEWPORT_SIZE;
      dispH = VIEWPORT_SIZE / aspect;
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 'var(--space-200)',
      }}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleMouseUp}
    >
      <div
        className="pdf-panel pdf-shadow-glow pdf-animate-modal"
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'var(--color-bg-primary)',
          padding: 'var(--space-300)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-200)',
          borderRadius: '16px',
          border: '1px solid var(--color-border-default)',
        }}
      >
        {/* Header */}
        <div className="pdf-flex-row pdf-items-center pdf-justify-between" style={{ borderBottom: '1px solid var(--color-border-default)', paddingBottom: 'var(--space-150)' }}>
          <h3 className="pdf-text-heading-24 pdf-text-red" style={{ margin: 0, fontSize: '1.2rem' }}>
            ✂️ 프로필 사진 자르기 (Crop Photo)
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="pdf-secondary-btn"
            style={{ width: '30px', height: '30px', padding: 0, justifyContent: 'center' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="pdf-text-copy-13-mono pdf-text-muted pdf-text-center">
          드래그하여 위치를 조정하고 슬라이더로 크기를 맞추세요.
        </div>

        {/* Viewport Area */}
        <div
          style={{
            width: `${VIEWPORT_SIZE}px`,
            height: `${VIEWPORT_SIZE}px`,
            margin: '0 auto',
            borderRadius: '50%',
            overflow: 'hidden',
            position: 'relative',
            border: '3px solid var(--color-functional-red)',
            boxShadow: '0 0 20px rgba(173, 29, 29, 0.3)',
            background: '#111',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop target"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: `${dispW}px`,
              height: `${dispH}px`,
              marginTop: `${-dispH / 2}px`,
              marginLeft: `${-dispW / 2}px`,
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              pointerEvents: 'none',
              maxWidth: 'none',
            }}
          />
        </div>

        {/* Zoom & Reset Controls */}
        <div className="pdf-flex-col" style={{ gap: 'var(--space-100)', padding: '0 var(--space-100)' }}>
          <div className="pdf-flex-row pdf-items-center" style={{ gap: 'var(--space-150)' }}>
            <ZoomOut size={16} className="pdf-text-muted" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--color-functional-red)', cursor: 'pointer' }}
            />
            <ZoomIn size={16} className="pdf-text-muted" />
            <button
              type="button"
              onClick={handleReset}
              className="pdf-secondary-btn pdf-btn-xs"
              style={{ padding: '4px 8px', gap: '4px' }}
              title="Reset Position"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>

        {/* Hidden Canvas for Cropping */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Actions */}
        <div className="pdf-flex-row" style={{ gap: 'var(--space-100)', marginTop: 'var(--space-100)' }}>
          <button
            type="button"
            onClick={onClose}
            className="pdf-secondary-btn pdf-btn-sm"
            style={{ flex: 1, justifyContent: 'center' }}
          >
            취소 (Cancel)
          </button>
          <button
            type="button"
            onClick={handleCrop}
            className="pdf-btn-primary pdf-btn-sm"
            style={{ flex: 1, justifyContent: 'center', gap: '6px', background: 'var(--color-functional-red)', color: '#fff' }}
          >
            <Check size={16} /> 크롭 & 적용 (Apply)
          </button>
        </div>
      </div>
    </div>
  );
};
