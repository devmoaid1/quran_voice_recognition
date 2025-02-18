import React, { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client'; // Changed to Socket.IO client
import DotLoader from '../../../../components/dot_loader';
import { surahDict } from '../../../../core/constants/constants';

const localServerUrl = "https://84e9-34-126-114-33.ngrok-free.app/";

const RecordingSection = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcription, setTranscription] = useState('Transcription will appear here...');
  const [mismatches, setMismatches] = useState([]);
  const [selectedSurah, setSelectedSurah] = useState('');
  const mediaRecorderRef = useRef(null);
  const socketRef = useRef(null);

  // WebSocket setup with Socket.IO
  useEffect(() => {
    socketRef.current = io(localServerUrl, {
      transports: ['websocket'], // Force WebSocket transport
      reconnection: true,
      extraHeaders: {
        "ngrok-skip-browser-warning": "true"
      }
    });

    socketRef.current.on('connect', () => {
      console.log('WebSocket connected');
    });

    socketRef.current.on('transcription', (data) => {
      setTranscription(prev => `${prev} ${data.transcription}`);
      setMismatches(prev => [...prev, ...data.mismatched_words]);
    });

    return () => {
      if (socketRef.current.connected) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const handleSurahChange = (event) => {
    setSelectedSurah(event.target.value);
  };

  const startRecording = async () => {
    try {
      setIsLoading(true);
      
      // Send Surah selection
      socketRef.current.emit('start_recording', {
        surah: selectedSurah || 'الإخلاص'
      });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          socketRef.current.emit('audio_chunk', event.data); // Send as ArrayBuffer
        }
      };

      mediaRecorderRef.current.start(2000);
      setIsRecording(true);

    } catch (error) {
      console.error('Microphone error:', error);
      setIsLoading(false);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setIsLoading(false);
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
            <div className="flex items-center justify-center w-full h-full">
              <DotLoader />
            </div>
          ) : (
            <input
              className="w-full h-full border-none outline-none text-right bg-transparent"
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

        {/* Display mismatched words */}
        {mismatches && (
          <div className="mt-4 text-left">
            <h3 className="text-lg font-semibold">Mismatched Words:</h3>
              <p>{mismatches}</p> {/* Display mismatches as a readable string */}
          </div>
        )}
      </div>
    </section>
  );
};

export default RecordingSection;