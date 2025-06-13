'use client';

import { useState, useRef } from 'react';
import FileUploader from '../components/FileUploader';
import { storage, db } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';

import AnimatedText from '../components/AnimatedText';

export default function Home() {
  const [files, setFiles] = useState([]);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef(null);

  const handleFileUpload = async (file, position) => {
    // Create temporary file object
    const tempId = `temp-${Date.now()}`;
    const tempFile = {
      id: tempId,
      name: file.name,
      type: file.type,
      position,
      isUploading: true,
      zIndex: files.length + 1 // Ensure new file is on top
    };

    // Add temporary file to the list
    setFiles(prev => [...prev, tempFile]);

    try {
      // Upload file to Firebase Storage
      const storageRef = ref(storage, `files/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Add file metadata to Firestore
      const docRef = await addDoc(collection(db, 'files'), {
        name: file.name,
        type: file.type,
        url: downloadURL,
        position,
        zIndex: files.length + 1, // Store zIndex in Firestore
        createdAt: new Date().toISOString()
      });

      // Replace temporary file with real file
      setFiles(prev => prev.map(f => 
        f.id === tempId 
          ? {
              id: docRef.id,
              name: file.name,
              type: file.type,
              url: downloadURL,
              position,
              zIndex: files.length + 1
            }
          : f
      ));
    } catch (error) {
      console.error('Error uploading file:', error);
      // Remove temporary file on error
      setFiles(prev => prev.filter(f => f.id !== tempId));
    }
  };

  const handleFileSelect = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    for (const file of selectedFiles) {
      // Position the file in the center of the viewport, accounting for pan offset
      const position = { 
        x: (window.innerWidth / 2 - 75) - panOffset.x, 
        y: (window.innerHeight / 2 - 75) - panOffset.y 
      };
      await handleFileUpload(file, position);
    }
    
    // Reset the file input
    e.target.value = '';
  };

  return (
    <main className="min-h-screen">
      <div className="fixed top-4 left-4 z-50 flex items-center gap-4">
        <h1 className="lg:text-2xl text-md font-bold text-white">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer gradient px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:animate-pulse transition-colors"
          >
            <AnimatedText content="drop files anywhere " speed={150} className="font-mono tracking-wide whitespace-nowrap lg:w-75 w-50" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </h1>
      </div>
      <FileUploader 
        files={files} 
        setFiles={setFiles} 
        panOffset={panOffset}
        setPanOffset={setPanOffset}
        fileInputRef={fileInputRef}
      />
    </main>
  );
}
