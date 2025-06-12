'use client';

import { useEffect, useRef, useState } from "react";

export default function FooterPlayer({ file, audioRef, isPlaying, setIsPlaying }) {
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const progressBarRef = useRef(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        audio.addEventListener("play", handlePlay);
        audio.addEventListener("pause", handlePause);

        const updateProgress = () => {
            setProgress(audio.currentTime);
            setDuration(audio.duration || 0);
        };

        audio.addEventListener("timeupdate", updateProgress);

        return () => {
            audio.removeEventListener("play", handlePlay);
            audio.removeEventListener("pause", handlePause);
            audio.removeEventListener("timeupdate", updateProgress);
        };
    }, [audioRef, setIsPlaying]);

    useEffect(() => {
        const audio = audioRef.current;
        if (audio) audio.volume = volume;
    }, [volume]);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (audio.paused) {
            audio.play();
            setIsPlaying(true);
        } else {
            audio.pause();
            setIsPlaying(false);
        }
    };

    const seek = (e) => {
        const audio = audioRef.current;
        const progressBar = progressBarRef.current;
        if (!audio || !progressBar) return;

        const rect = progressBar.getBoundingClientRect();
        const x = e.clientX;
        const percent = (x - rect.left) / rect.width;
        audio.currentTime = Math.min(1, percent) * audio.duration;
    };

    const format = (t) =>
        isNaN(t) ? "--:--" : `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, "0")}`;

    if (!file) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 px-4 py-2 z-50 backdrop-blur-xs select-none font-semibold">
            <div className="flex items-center justify-between gap-3">
                {/* Play/Pause Button */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={togglePlay}
                        className="w-6 flex-auto text-center cursor-pointer hover:animate-pulse"
                    >
                        {isPlaying ? "❚❚" : "▶"}
                    </button>
                </div>

                {/* Track Info */}
                <div className="flex-1 min-w-[200px] lg:mr-0">
                    <div className="font-medium truncate mb-[2px]">
                        {file.name}
                    </div>
                    <div
                        ref={progressBarRef}
                        className="h-2 border opacity-40 cursor-pointer w-full m-0"
                        onClick={seek}
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

                {/* Volume */}
                <div className="hidden lg:flex items-center gap-2 min-w-[120px] hover:animate-pulse">
                    <label className="cursor-pointer" onClick={() => setVolume(volume !== 0 ? 0 : 1)}>vol</label>
                    <input
                        className="volume opacity-40 cursor-pointer"
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                    />
                </div>
            </div>
        </div>
    );
} 