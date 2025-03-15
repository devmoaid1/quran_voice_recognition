import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import DotLoader from '../../../../components/dot_loader';
import Recorder from 'opus-recorder';
import { surahDict } from '../../../../core/constants/constants'; // Import Surah List

// Initialize Socket.IO connection
const socket = io('https://calm-goats-tease.loca.lt/', {
  transports: ["websocket"], // Force WebSocket-only transport
});

const RecordingSection = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcription, setTranscription] = useState('Transcription will appear here...');
  const [selectedSurah, setSelectedSurah] = useState(''); // Track the selected Surah
  const [mismatches, setMismatches] = useState('');
  const mediaRecorderRef = useRef(null);
  const recorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const chunkIntervalRef = useRef(null);
  const mediaStreamRef = useRef(null);

  useEffect(() => {
    // Always subscribe to connect/disconnect events.
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });
    socket.on('connect_message', (data) => {
      console.log("connected to socket from event:" + data.message);
    });
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
    return () => {
      socket.off('connect');
      socket.off('connect_message');
      socket.off('disconnect');
    };
  }, []);

  // Subscribe to live transcription events only when recording.
  useEffect(() => {
    if (isRecording) {
      const handleLiveTranscription = (data) => {
        console.log("📢 Received transcription:", data)
        setTranscription(data.text || 'No transcription received.');
        
        setMismatches(
          data.mismatched_words?.length > 0
            ? data.mismatched_words.map(([wrong, correct]) => `${wrong} → ${correct}`).join(', ')
            : 'No mismatches detected'
        );
      };
      
      socket.on('live_transcription', handleLiveTranscription);
      return () => {
        socket.off('live_transcription', handleLiveTranscription);
      };
    }
  }, [isRecording]);
  

  // Handle Surah selection
  const handleSurahChange = (event) => {
    setSelectedSurah(event.target.value);
    console.log(`📖 Selected Surah: ${event.target.value}`);
  };

  const startRecording = async () => {
    if (!selectedSurah) {
      alert('Please select a Surah before recording.');
      return;
    }

    setIsLoading(true);
    try {
      // Request microphone access.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      console.log("Audio stream acquired", stream);

      // Create AudioContext and source node.
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      console.log("Created AudioContext and source node", source);

      // Configure Opus-Recorder options.
      const options = {
        encoderPath: '/encoderWorker.min.js', // Must be in your public folder.
        numberOfChannels: 1,
        encoderSampleRate: 48000,
      };

      // Create the Recorder instance using the source node.
      const recorder = new Recorder(options, source);
      recorderRef.current = recorder;

      // Set the ondataavailable callback.
      recorder.ondataavailable = (typedArray) => {
        console.log("ondataavailable triggered, typedArray length:", typedArray?.length);
        if (typedArray && typedArray.length > 0) {
          const blob = new Blob([typedArray], { type: 'audio/ogg' });
          console.log("Got blob, size:", blob.size);
          if (blob.size > 0) {
            const reader = new FileReader();
            reader.onload = function(e) {
              console.log("Sending 5-second chunk to server...");
              socket.emit('live_audio', { 
                audio: e.target.result,
              surah: selectedSurah
              });
            };
            reader.readAsArrayBuffer(blob);
          }
        }
      };

      recorder.onerror = (err) => {
        console.error("Recorder error:", err);
      };

      // Start the recorder.
      await recorder.start();
      console.log("Recorder started.");

      // Set an interval to stop and restart the recorder every 5 seconds.
      chunkIntervalRef.current = setInterval(async () => {
        await recorder.stop(); // Finalize the current chunk.
        await recorder.start(); // Restart for the next chunk.
        console.log("Recorder restarted for next chunk.");
      }, 5000);

      setIsRecording(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsLoading(false);
    }
  };

  const stopRecording = async () => {
    console.log("Stop recording function called.");
    setIsRecording(false);
    setTranscription("Transcription will appear here...");

    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }
    if (recorderRef.current) {
      console.log("Stopping recorder...");
      await recorderRef.current.stop();
      recorderRef.current = null;
      console.log("Recorder stopped.");
    }
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
      console.log("AudioContext closed.");
    }
    // Stop the media stream tracks to release the microphone.
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStreamRef.current = null;
      console.log("Media stream tracks stopped.");
    }
  };

  return (
    <section className="flex flex-col items-center gap-10 py-10 mb-24">
      <h2 className="text-2xl font-bold">Start Reciting!</h2>

      {/* Dropdown List */}
      <div className="w-full max-w-md text-center">
        <label htmlFor="surah-dropdown" className="block text-lg font-semibold mb-2">
          Select a Surah:
        </label>
        <select
          id="surah-dropdown"
          className="w-full p-2 border rounded"
          value={selectedSurah}
          onChange={handleSurahChange}
        >
          <option value="" disabled>
            -- Choose a Surah --
          </option>
          {Object.keys(surahDict).map((key) => (
            <option key={key} value={surahDict[key]}>
              {surahDict[key]}
            </option>
          ))}
        </select>
      </div>

      {/* Recording Section */}
      <div className="relative w-full max-w-md" id="audio-form">
        <div className="relative p-2 pr-16 border rounded-full box-border border-black text-right text-2xl h-[3rem] flex items-center justify-between">
          {isLoading ? (
            <div className="flex items-center justify-center w-full">
              <DotLoader />
            </div>
          ) : (
            <input
              className="w-full h-full border-none outline-none text-right bg-transparent py-40"
              type="text"
              value={transcription}
              readOnly
            />
          )}
          <button
            id="record-button"
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className="btn absolute right-0 top-0 h-full aspect-square scale-[102%] rounded-full"
          >
            {isRecording ? (
              <svg
                id="stop-icon"
                className="translate-x-[0.08rem] w-8 h-8"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 256 256"
              >
                <path fill="currentColor" d="M64 64h128v128H64z" />
              </svg>
            ) : (
              <svg
                id="recording-icon"
                className="translate-x-[0.08rem] w-8 h-8"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 256 256"
              >
                <path
                  fill="currentColor"
                  d="M80 128V64a48 48 0 0 1 96 0v64a48 48 0 0 1-96 0m128 0a8 8 0 0 0-16 0a64 64 0 0 1-128 0a8 8 0 0 0-16 0a80.11 80.11 0 0 0 72 79.6V240a8 8 0 0 0 16 0v-32.4a80.11 80.11 0 0 0 72-79.6"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </section>
  );
};

export default RecordingSection;