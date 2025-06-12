'use client';

import { useState, useRef, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, deleteDoc, doc, updateDoc, addDoc } from 'firebase/firestore';
import TextNote from './TextNote';

const FileUploader = ({ files, setFiles }) => {
  const [playingFile, setPlayingFile] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const audioRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [draggedFile, setDraggedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMoved, setHasMoved] = useState(false);
  const [maxZIndex, setMaxZIndex] = useState(1);
  const [fileZIndices, setFileZIndices] = useState({});
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressBarRef = useRef(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [notes, setNotes] = useState([]);
  const [showAddButton, setShowAddButton] = useState(false);
  const [addButtonPosition, setAddButtonPosition] = useState({ x: 0, y: 0 });

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Initialize audio on client side
  useEffect(() => {
    audioRef.current = new Audio();
    
    // Add error handling for audio
    audioRef.current.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      setPlayingFile(null);
    });

    // Cleanup on unmount
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

  const handleFileClick = (file) => {
    // Don't play audio if we just finished dragging
    if (hasMoved) {
      setHasMoved(false);
      return;
    }

    if (file.type.startsWith('audio/')) {
      if (playingFile === file.id) {
        audioRef.current.pause();
        setPlayingFile(null);
      } else {
        if (playingFile) {
          audioRef.current.pause();
        }
        audioRef.current.src = file.url;
        audioRef.current.play();
        setPlayingFile(file.id);
      }
    }
    setSelectedFile(file.id);
    // Bring clicked file to front
    const newMaxZIndex = maxZIndex + 1;
    setMaxZIndex(newMaxZIndex);
    setFileZIndices(prev => ({
      ...prev,
      [file.id]: newMaxZIndex
    }));
  };

  const removeFile = async (fileId) => {
    if (playingFile === fileId) {
      audioRef.current.pause();
      setPlayingFile(null);
    }
    
    // Delete from Firestore
    await deleteDoc(doc(db, 'files', fileId));
    
    // Update local state
    setFiles(files.filter(file => file.id !== fileId));
    setSelectedFile(null);
  };

  const handleStart = (e, item) => {
    e.preventDefault();
    setIsDragging(true);
    setDraggedFile(item);
    
    // Get the initial touch/click position
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    setDragOffset({
      x: clientX - (item.position?.x || 0),
      y: clientY - (item.position?.y || 0)
    });
    setHasMoved(false);
    
    // Bring dragged item to front
    const newMaxZIndex = maxZIndex + 1;
    setMaxZIndex(newMaxZIndex);
    if ('type' in item) {
      setFileZIndices(prev => ({
        ...prev,
        [item.id]: newMaxZIndex
      }));
    }
  };

  const handleMove = (e) => {
    if (!isDragging || !draggedFile) return;

    const container = e.currentTarget.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - container.left - dragOffset.x;
    const y = clientY - container.top - dragOffset.y;

    // Set hasMoved to true if we've moved more than 5 pixels
    if (!hasMoved && (Math.abs(x - (draggedFile.position?.x || 0)) > 5 || 
                      Math.abs(y - (draggedFile.position?.y || 0)) > 5)) {
      setHasMoved(true);
    }

    // Update position in Firestore
    if ('type' in draggedFile) {
      const fileRef = doc(db, 'files', draggedFile.id);
      updateDoc(fileRef, {
        position: { x, y }
      });
      setFiles(files.map(file => 
        file.id === draggedFile.id 
          ? { ...file, position: { x, y } }
          : file
      ));
    } else {
      const noteRef = doc(db, 'notes', draggedFile.id);
      updateDoc(noteRef, {
        position: { x, y }
      });
      setNotes(notes.map(note => 
        note.id === draggedFile.id 
          ? { ...note, position: { x, y } }
          : note
      ));
    }
  };

  const handleEnd = () => {
    if (isDragging && draggedFile) {
      setIsDragging(false);
      setDraggedFile(null);
    }
  };

  const getFileIcon = (type) => {
    if (type.startsWith('audio/')) return '🎵';
    return '📄';
  };

  const renderFileContent = (file) => {
    if (file.type.startsWith('image/')) {
      return (
        <img 
          src={file.url} 
          alt={file.name}
          className="w-24 h-24 object-cover rounded pointer-events-none"
          draggable="false"
        />
      );
    }
    return <div className="text-4xl mb-2">{getFileIcon(file.type)}</div>;
  };

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

  const format = (t) =>
    isNaN(t) ? "--:--" : `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, "0")}`;

  const currentFile = files.find(file => file.id === playingFile);

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) {
      if (playingFile) {
        audioRef.current.pause();
        setPlayingFile(null);
      }
      setSelectedFile(null);
      
      // Show add button at click position
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setAddButtonPosition({ x, y });
      setShowAddButton(true);
    }
  };

  const handleAddNote = async () => {
    const newNote = {
      text: '',
      position: addButtonPosition,
      zIndex: maxZIndex + 1
    };

    try {
      const docRef = await addDoc(collection(db, 'notes'), newNote);
      setNotes([...notes, { ...newNote, id: docRef.id }]);
      setMaxZIndex(maxZIndex + 1);
    } catch (error) {
      console.error('Error adding note:', error);
    }
    setShowAddButton(false);
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

  return (
    <div 
      className="fixed inset-0"
      onMouseMove={!isTouchDevice ? handleMove : undefined}
      onTouchMove={isTouchDevice ? handleMove : undefined}
      onMouseUp={!isTouchDevice ? handleEnd : undefined}
      onTouchEnd={isTouchDevice ? handleEnd : undefined}
      onMouseLeave={!isTouchDevice ? handleEnd : undefined}
      onClick={handleBackgroundClick}
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
              className={`absolute cursor-move select-none ${
                file.isUploading ? 'opacity-50' : ''
              }`}
              style={{
                left: file.position?.x || 0,
                top: file.position?.y || 0,
                transform: isDragging && draggedFile?.id === file.id ? 'scale(1.05)' : 'none',
                transition: isDragging ? 'none' : 'transform 0.2s',
                zIndex: fileZIndices[file.id] || 1,
                touchAction: 'none'
              }}
              onMouseDown={!isTouchDevice ? (e) => handleStart(e, file) : undefined}
              onTouchStart={isTouchDevice ? (e) => handleStart(e, file) : undefined}
              onClick={(e) => {
                e.stopPropagation();
                handleFileClick(file);
              }}
            >
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                {renderFileContent(file)}
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
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
              isDragging={isDragging && draggedFile?.id === note.id}
              onDragStart={handleStart}
              onDragMove={handleMove}
              onDragEnd={handleEnd}
              isTouchDevice={isTouchDevice}
              onDeselect={() => {
                if (e.target === e.currentTarget) {
                  setIsSelected(false);
                }
              }}
            />
          ))}

          {showAddButton && (
            <div
              className="absolute cursor-pointer"
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
              <div className="bg-white/10 backdrop-blur-sm w-8 h-8 rounded-full flex items-center justify-center text-white text-xl hover:bg-white/20 transition-colors">
                +
              </div>
            </div>
          )}
        </>
      )}

      {currentFile && (
        <div className="fixed bottom-0 left-0 right-0 px-4 py-2 z-50 backdrop-blur-xs select-none font-semibold">
          <div className="flex items-center justify-between gap-3">
            {/* Play/Pause Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
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

            {/* Track Info */}
            <div className="flex-1 min-w-[200px] lg:mr-0">
              <div className="font-medium truncate mb-[2px]">
                {currentFile.name}
              </div>
              <div
                ref={progressBarRef}
                className="h-2 border opacity-40 cursor-pointer w-full m-0"
                onClick={seek}
                onTouchStart={seek}
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