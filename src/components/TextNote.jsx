'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function TextNote({ 
  note, 
  isSelected, 
  isEditing, 
  onSelect, 
  onEdit, 
  onDelete, 
  onStartDrag,
  editingText,
  setEditingText 
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isSelected && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isSelected]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onEdit(editingText);
    } else if (e.key === 'Escape') {
      onEdit('');
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    onSelect();
  };

  return (
    <div
      className={`absolute cursor-move select-none note-item ${
        isSelected ? 'ring-2 ring-white/20' : ''
      }`}
      style={{
        left: note.position?.x || 0,
        top: note.position?.y || 0,
        zIndex: note.zIndex || 1,
        touchAction: 'none'
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onStartDrag(e);
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
        onStartDrag(e);
      }}
      onClick={handleClick}
    >
      <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg shadow-lg hover:shadow-xl transition-shadow min-w-[200px]">
        {isSelected ? (
          <textarea
            ref={textareaRef}
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => onEdit(editingText)}
            className="w-full bg-transparent text-white resize-none focus:outline-none"
            rows={3}
            placeholder="Enter your note..."
            autoFocus
          />
        ) : (
          <div 
            className="text-white whitespace-pre-wrap break-words cursor-text"
            onClick={() => onSelect()}
          >
            {note.text || 'Click to edit...'}
          </div>
        )}
        {isSelected && (
          <button
            className="remove-button absolute -top-2 -right-2 bg-red-500/80 backdrop-blur-sm text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
} 