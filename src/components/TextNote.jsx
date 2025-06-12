'use client';

import { useState, useRef, useEffect } from 'react';

const TextNote = ({ note, onUpdate, onDelete, isDragging, onDragStart, onDragMove, onDragEnd, isTouchDevice }) => {
  const [isEditing, setIsEditing] = useState(!note.text);
  const [text, setText] = useState(note.text);
  const [isSelected, setIsSelected] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const textareaRef = useRef(null);
  const noteRef = useRef(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (noteRef.current && !noteRef.current.contains(e.target)) {
        setIsSelected(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleSave = () => {
    if (text.trim()) {
      onUpdate({ ...note, text: text.trim() });
    } else {
      onDelete(note.id);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setText(note.text);
      setIsEditing(false);
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (!hasMoved) {
      setIsSelected(true);
      if (!isEditing) {
        setIsEditing(true);
      }
    }
    setHasMoved(false);
  };

  const handleStart = (e) => {
    setHasMoved(false);
    onDragStart(e, note);
  };

  const handleMove = (e) => {
    if (!hasMoved) {
      const movement = Math.abs(e.movementX) + Math.abs(e.movementY);
      if (movement > 5) {
        setHasMoved(true);
      }
    }
  };

  return (
    <div
      ref={noteRef}
      className="absolute cursor-move select-none"
      style={{
        left: note.position?.x || 0,
        top: note.position?.y || 0,
        transform: isDragging ? 'scale(1.05)' : 'none',
        transition: isDragging ? 'none' : 'transform 0.2s',
        zIndex: note.zIndex || 1,
        touchAction: 'none'
      }}
      onMouseDown={!isTouchDevice ? handleStart : undefined}
      onTouchStart={isTouchDevice ? handleStart : undefined}
      onMouseMove={!isTouchDevice ? handleMove : undefined}
      onTouchMove={isTouchDevice ? handleMove : undefined}
      onClick={handleClick}
    >
      <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg shadow-lg hover:shadow-xl transition-shadow min-w-[200px]">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className="w-full bg-transparent text-white resize-none focus:outline-none"
            rows={3}
            placeholder="Enter your note..."
            autoFocus
          />
        ) : (
          <div 
            className="text-white whitespace-pre-wrap break-words cursor-text"
            onClick={() => setIsEditing(true)}
          >
            {note.text || 'Click to edit...'}
          </div>
        )}
        {isSelected && (
          <button
            className="remove-button absolute -top-2 -right-2 bg-red-500/80 backdrop-blur-sm text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note.id);
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default TextNote; 