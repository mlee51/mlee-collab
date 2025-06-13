'use client';

import { useState, useRef, useEffect } from 'react';
import { db, storage } from '../firebase/config';
import { collection, getDocs, deleteDoc, doc, updateDoc, addDoc } from 'firebase/firestore';
import TextNote from './TextNote';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const FileUploader = ({ files, setFiles, panOffset, setPanOffset, fileInputRef }) => {
  const [playingFile, setPlayingFile] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const audioRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFile, setDraggedFile] = useState(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const [maxZIndex, setMaxZIndex] = useState(1);
  const [fileZIndices, setFileZIndices] = useState({});
  const [noteZIndices, setNoteZIndices] = useState({});
  const [currentZIndex, setCurrentZIndex] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressBarRef = useRef(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [notes, setNotes] = useState([]);
  const [showAddButton, setShowAddButton] = useState(false);
  const [addButtonPosition, setAddButtonPosition] = useState({ x: 0, y: 0 });
  const [isClicking, setIsClicking] = useState(false);
  
  // Canvas panning state
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPosition, setLastPanPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const [isPanningEnabled, setIsPanningEnabled] = useState(true);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState('');
  const textareaRef = useRef(null);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [scale, setScale] = useState(1);
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 });
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);

  // Load initial position from URL
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const x = parseFloat(params.get('x')) || 0;
      const y = parseFloat(params.get('y')) || 0;
      panOffsetRef.current = { x, y };
    }
  }, []);

  // Update URL when panning
  useEffect(() => {
    const hash = `#x=${Math.round(panOffset.x)}&y=${Math.round(panOffset.y)}`;
    if (window.location.hash !== hash) {
      // window.history.replaceState(null, '', hash);
    }
  }, [panOffset]);

  // Handle URL changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash) {
        try {
          const params = new URLSearchParams(hash.substring(1));
          const x = parseFloat(params.get('x'));
          const y = parseFloat(params.get('y'));
          if (!isNaN(x) && !isNaN(y)) {
            setPanOffset({ x, y });
          }
        } catch (error) {
          console.error('Error parsing URL hash:', error);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Initialize audio on client side
  useEffect(() => {
    audioRef.current = new Audio();
    
    audioRef.current.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      setPlayingFile(null);
    });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // Handle audio state changes and progress
  useEffect(() => {
    if (!audioRef.current) return;

    const handlePlay = () => {
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error);
        setPlayingFile(null);
      });
    };

    const handlePause = () => {
      audioRef.current.pause();
    };

    const updateProgress = () => {
      setProgress(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    };

    audioRef.current.addEventListener('timeupdate', updateProgress);

    if (playingFile) {
      handlePlay();
    } else {
      handlePause();
    }

    return () => {
      audioRef.current.removeEventListener('timeupdate', updateProgress);
    };
  }, [playingFile]);

  // Load files and notes from Firestore on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const filesCollection = collection(db, 'files');
        const notesCollection = collection(db, 'notes');
        
        const [filesSnapshot, notesSnapshot] = await Promise.all([
          getDocs(filesCollection),
          getDocs(notesCollection)
        ]);

        const loadedFiles = filesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const loadedNotes = notesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setFiles(loadedFiles);
        setNotes(loadedNotes);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Add onChange handler to fileInputRef
  useEffect(() => {
    if (fileInputRef.current) {
      fileInputRef.current.onchange = handleFileSelect;
    }
  }, [fileInputRef]);

  const setZIndex = (id) => {
    setCurrentZIndex(prev => prev + 1);
    setFileZIndices(prev => ({
      ...prev,
      [id]: currentZIndex + 1
    }));
  };

  const handleStart = (e, item) => {
    e.stopPropagation();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    
    setDraggedFile(item);
    setStartPos({ x: clientX, y: clientY });
    setLastPosition({ x: clientX, y: clientY });
    setHasMoved(false);
    setIsDragging(true);
    setZIndex(item.id);
    setShowAddButton(false);
    console.log('Started dragging:', 'type' in item ? (item.type.startsWith('audio/') ? 'audio file' : 'image file') : 'note');
  };

  const handleMove = (e) => {
    if (!isDragging || !draggedFile) return;

    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    
    const deltaX = clientX - lastPosition.x;
    const deltaY = clientY - lastPosition.y;
    
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      setHasMoved(true);
      console.log('Moving:', 'type' in draggedFile ? (draggedFile.type.startsWith('audio/') ? 'audio file' : 'image file') : 'note');
    }

    setLastPosition({ x: clientX, y: clientY });
    
    if ('type' in draggedFile) {
      // Handle file dragging
      setFiles(prevFiles => 
        prevFiles.map(f => 
          f.id === draggedFile.id 
            ? { 
                ...f, 
                position: { 
                  x: (f.position?.x || 0) + deltaX, 
                  y: (f.position?.y || 0) + deltaY 
                } 
              }
            : f
        )
      );
    } else {
      // Handle note dragging
      setNotes(prevNotes =>
        prevNotes.map(n =>
          n.id === draggedFile.id
            ? {
                ...n,
                position: {
                  x: (n.position?.x || 0) + deltaX,
                  y: (n.position?.y || 0) + deltaY
                }
              }
            : n
        )
      );
    }
  };

  const handleEnd = () => {
    if (!isDragging || !draggedFile) return;
    
    console.log('Finished dragging:', 'type' in draggedFile ? (draggedFile.type.startsWith('audio/') ? 'audio file' : 'image file') : 'note');
    
    // Save final position to Firestore
    if ('type' in draggedFile) {
      // Update file position in Firestore
      const file = files.find(f => f.id === draggedFile.id);
      if (file) {
        updateDoc(doc(db, 'files', file.id), {
          position: file.position
        });
      }
    } else {
      // Update note position in Firestore
      const note = notes.find(n => n.id === draggedFile.id);
      if (note) {
        updateDoc(doc(db, 'notes', note.id), {
          position: note.position
        });
      }
    }
    
    setDraggedFile(null);
    setIsDragging(false);
    setHasMoved(false);
  };

  const handlePanStart = (e) => {
    if (!isPanningEnabled) return;

    // Check if we're clicking on a file or note
    const isFileOrNote = e.target.closest('.file-item, .note-item');
    if (isFileOrNote) {
      return;
    }

    if (containerRef.current && containerRef.current.contains(e.target))  {    
      e.preventDefault();
      setIsPanning(true);
      setIsClicking(true);
      setHasMoved(false);
      setShowAddButton(false);
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      
      // Log the adjusted position
      console.log('Mouse position adjusted for pan:', {
        x: clientX - panOffsetRef.current.x,
        y: clientY - panOffsetRef.current.y
      });
      
      setInitialPosition({ x: clientX, y: clientY });
      setLastPanPosition({ x: clientX, y: clientY });
    }
  };

  const handlePanMove = (e) => {
    if (!isPanningEnabled || !isPanning) return;

    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const deltaX2 = clientX - lastPanPosition.x;
    const deltaY2 = clientY - lastPanPosition.y;
    
    panOffsetRef.current = {
      x: panOffsetRef.current.x + deltaX2,
      y: panOffsetRef.current.y + deltaY2
    };
    
    setLastPanPosition({ x: clientX, y: clientY });
    setHasMoved(true);
  };

  const handlePanEnd = () => {
    setIsPanning(false);
    setIsClicking(false);
    setLastPanPosition({ x: 0, y: 0 });

    // Update URL with current position after panning ends
    const hash = `#x=${Math.round(panOffsetRef.current.x)}&y=${Math.round(panOffsetRef.current.y)}`;
    window.history.replaceState(null, '', hash);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY;
    const zoomFactor = 0.1;
    const newScale = scale + (delta > 0 ? -zoomFactor : zoomFactor);
    setScale(Math.max(0.1, Math.min(2, newScale)));
  };

  const format = (t) =>
    isNaN(t) ? "--:--" : `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, "0")}`;

  const seek = (e) => {
    const audio = audioRef.current;
    const progressBar = progressBarRef.current;
    if (!audio || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = clientX;
    const percent = (x - rect.left) / rect.width;
    audio.currentTime = Math.min(1, percent) * audio.duration;
  };

  const currentFile = files.find(file => file.id === playingFile);

  const handleBackgroundClick = (e) => {
    if (isDragging || hasMoved) return;
    
    // Only show plus button if it was a click (no movement)
    if (isClicking && !hasMoved) {
      setAddButtonPosition({
        x: e.clientX,
        y: e.clientY
      });
      setShowAddButton(true);
      console.log('Plus button appeared at:', { x: e.clientX, y: e.clientY });
    }
    if (e.target === containerRef.current) {
      // Only show add button if it was a click (not a drag)
      if (!hasMoved) {
        setAddButtonPosition({
          x: e.clientX,
          y: e.clientY
        });
        setShowAddButton(true);
      }
      setSelectedFile(null);
      setSelectedNote(null);
      setIsEditing(false);
      setEditingText('');
    }
  };

  const handleAddNote = async () => {
    const newNote = {
      text: '',
      position: {
        x: addButtonPosition.x - panOffset.x,
        y: addButtonPosition.y - panOffset.y
      },
      zIndex: maxZIndex + 1
    };

    try {
      const docRef = await addDoc(collection(db, 'notes'), newNote);
      setNotes([...notes, { ...newNote, id: docRef.id }]);
      setMaxZIndex(maxZIndex + 1);
      setShowAddButton(false);
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleUpdateNote = async (updatedNote) => {
    try {
      await updateDoc(doc(db, 'notes', updatedNote.id), updatedNote);
      setNotes(notes.map(note => 
        note.id === updatedNote.id ? updatedNote : note
      ));
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await deleteDoc(doc(db, 'notes', noteId));
      setNotes(notes.filter(note => note.id !== noteId));
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleFileClick = (file) => {
    if (hasMoved) {
      setHasMoved(false);
      return;
    }
    if (selectedFile === file.id) {
      setSelectedFile(null);
      if (file.type.startsWith('audio/')) {
        audioRef.current.pause();
        setPlayingFile(null);
        setCurrentAudio(null);
      }
    } else {
      setSelectedFile(file.id);
      setSelectedNote(null);
      if (file.type.startsWith('audio/')) {
        if (playingFile) {
          audioRef.current.pause();
        }
        audioRef.current.src = file.url;
        audioRef.current.play();
        setPlayingFile(file.id);
        setCurrentAudio(file);
      }
    }
  };

  const handleNoteClick = (note) => {
    if (hasMoved) {
      setHasMoved(false);
      return;
    }
    if (selectedNote === note.id) {
      setSelectedNote(null);
      setIsEditing(false);
      setEditingText('');
    } else {
      setSelectedNote(note.id);
      setSelectedFile(null);
      setIsEditing(true);
      setEditingText(note.text || '');
    }
  };

  const handleNoteDoubleClick = (note) => {
    setIsEditing(true);
    setEditingText(note.text || '');
  };

  const handleNoteSave = async (noteId) => {
    if (editingText.trim()) {
      const noteRef = doc(db, 'notes', noteId);
      await updateDoc(noteRef, {
        text: editingText.trim()
      });
      setNotes(prevNotes =>
        prevNotes.map(n =>
          n.id === noteId
            ? { ...n, text: editingText.trim() }
            : n
        )
      );
    } else {
      await handleDeleteNote(noteId);
    }
    setIsEditing(false);
    setEditingText('');
  };

  const removeFile = async (fileId) => {
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'files', fileId));
      // Update local state
      setFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
      // If the deleted file was playing, stop it
      if (playingFile === fileId) {
        audioRef.current.pause();
        setPlayingFile(null);
        setCurrentAudio(null);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const handleNoteKeyDown = (e, noteId) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNoteSave(noteId);
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditingText('');
    }
  };

  const handleHomeClick = () => {
    setIsAnimating(true);
    panOffsetRef.current = { x: 0, y: 0 };
    window.history.replaceState(null, '', '#x=0&y=0');
    
    // Remove animation class after transition completes
    setTimeout(() => {
      setIsAnimating(false);
    }, 1000); // Match this with the CSS transition duration
  };

  const handleFileUpload = async (file, position) => {
    try {
      // Create a unique filename
      const timestamp = Date.now();
      const uniqueFilename = `${timestamp}_${file.name}`;
      
      // Upload to Firebase Storage
      const storageRef = ref(storage, uniqueFilename);
      const uploadResult = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(uploadResult.ref);
      
      // Add to Firestore
      const docRef = await addDoc(collection(db, 'files'), {
        name: file.name,
        type: file.type,
        url: downloadURL,
        position: position,
        createdAt: new Date().toISOString()
      });
      
      // Update local state
      setFiles(prevFiles => [...prevFiles, {
        id: docRef.id,
        name: file.name,
        type: file.type,
        url: downloadURL,
        position: position
      }]);
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const handleFileSelect = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    for (const file of selectedFiles) {
      // Position the file in the center of the viewport, accounting for pan offset
      const position = { 
        x: (window.innerWidth / 2 - 75) - panOffsetRef.current.x, 
        y: (window.innerHeight / 2 - 75) - panOffsetRef.current.y 
      };
      await handleFileUpload(file, position);
    }
    
    // Reset the file input
    e.target.value = '';
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);

    for (const file of droppedFiles) {
      const position = { 
        x: e.clientX - 75 - panOffsetRef.current.x, 
        y: e.clientY - 75 - panOffsetRef.current.y 
      };
      await handleFileUpload(file, position);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        container.removeEventListener('wheel', handleWheel);
      };
    }
  }, []);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 overflow-hidden bg-black/20"
      onMouseMove={(e) => {
        if (isPanning) handlePanMove(e);
        else handleMove(e);
      }}
      onMouseUp={(e) => {
        if (isPanning) handlePanEnd();
        else handleEnd();
      }}
      onMouseLeave={(e) => {
        if (isPanning) handlePanEnd();
        else handleEnd();
      }}
      onMouseDown={handlePanStart}
      onTouchMove={(e) => {
        e.preventDefault();
        if (isPanning) handlePanMove(e);
        else handleMove(e);
      }}
      onTouchEnd={(e) => {
        if (isPanning) handlePanEnd();
        else handleEnd();
      }}
      onTouchStart={handlePanStart}
      onClick={handleBackgroundClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      style={{
        cursor: isPanning ? 'grabbing' : (isPanningEnabled ? 'grab' : 'default'),
        touchAction: 'none'
      }}
    >
      <button
        onClick={handleHomeClick}
        className="fixed cursor-pointer top-4 right-4 z-50 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors "
      >
        Come Home
      </button>
      {showAddButton && (
        <div
          className="fixed bg-white/10 backdrop-blur-sm rounded-full w-12 h-12 flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors z-50"
          style={{
            left: addButtonPosition.x,
            top: addButtonPosition.y,
            transform: 'translate(-50%, -50%)'
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleAddNote();
          }}
        >
          <span className="text-2xl text-white">+</span>
        </div>
      )}
      <div
        className="relative w-full h-full"
        style={{
          transform: `translate(${panOffsetRef.current.x}px, ${panOffsetRef.current.y}px)`,
          transition: isAnimating ? 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          willChange: 'transform'
        }}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white">Loading files...</p>
            </div>
          </div>
        ) : (
          <>
            {files.map((file) => (
              <div
                key={file.id}
                className={`absolute cursor-move select-none file-item ${
                  file.isUploading ? 'opacity-50' : ''
                }`}
                style={{
                  left: file.position?.x || 0,
                  top: file.position?.y || 0,
                  transform: isDragging && draggedFile?.id === file.id ? 'scale(1.05)' : 'none',
                  transition: isDragging ? 'none' : 'transform 0.2s',
                  zIndex: fileZIndices[file.id] || 1
                }}
                onMouseDown={(e) => handleStart(e, file)}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handleStart(e, file);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileClick(file);
                }}
              >
                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                  {file.type.startsWith('image/') ? (
                    <img 
                      src={file.url} 
                      alt={file.name}
                      className="w-24 h-24 object-cover rounded pointer-events-none"
                      draggable="false"
                    />
                  ) : (
                    <div className="text-4xl mb-2">🎵</div>
                  )}
                  <div className="text-sm break-words max-w-[150px] mt-2 text-white">{file.name}</div>
                  {file.isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-sm rounded-lg">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                  )}
                  {selectedFile === file.id && (
                    <button
                      className="remove-button absolute -top-2 -right-2 bg-red-500/80 backdrop-blur-sm text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file.id);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
            {notes.map((note) => (
              <TextNote
                key={note.id}
                note={note}
                isSelected={selectedNote === note.id}
                isEditing={editingText.trim() !== ''}
                onSelect={() => handleNoteClick(note)}
                onEdit={(text) => setEditingText(text)}
                onDelete={() => handleDeleteNote(note.id)}
                onStartDrag={(e) => handleStart(e, note)}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handleStart(e, note);
                }}
                editingText={editingText}
                setEditingText={(text) => setEditingText(text)}
              />
            ))}
          </>
        )}
      </div>
      {currentFile && (
        <div className="fixed bottom-0 left-0 right-0 px-4 py-2 z-50 backdrop-blur-xs select-none font-semibold pointer-events-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (audioRef.current.paused) {
                    audioRef.current.play();
                  } else {
                    audioRef.current.pause();
                  }
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  if (audioRef.current.paused) {
                    audioRef.current.play();
                  } else {
                    audioRef.current.pause();
                  }
                }}
                className="w-6 flex-auto text-center cursor-pointer hover:animate-pulse"
              >
                {audioRef.current?.paused ? "▶" : "❚❚"}
              </button>
            </div>

            <div className="flex-1 min-w-[200px] lg:mr-0">
              <div className="font-medium truncate mb-[2px]">
                {currentFile.name}
              </div>
              <div
                ref={progressBarRef}
                className="h-2 border opacity-40 cursor-pointer w-full m-0"
                onClick={seek}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  seek(e);
                }}
              >
                <div
                  className="h-1.5 bg-foreground"
                  style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                />
              </div>
              <div className="text-xs mt-1">
                {format(progress)} / {format(duration)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader; 