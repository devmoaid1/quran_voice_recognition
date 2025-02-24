import React, { useState, useRef, useEffect } from 'react';
import DotLoader from '../../../../components/dot_loader';
import io from 'socket.io-client';

// Initialize socket with additional options for better debugging
const socket = io('https://dfba-34-16-173-222.ngrok-free.app/', {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

const RecordingSection = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcription, setTranscription] = useState('Transcription will appear here...');
  const mediaRecorderRef = useRef(null);
  const audioChunksQueue = useRef([]);
  const [processing, setProcessing] = useState(false);

  // Socket event listeners
  useEffect(() => {
    console.log('useEffect mounting');

    socket.on('connect', () => {
      console.log('Connected to backend successfully');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection failed:', error.message);
      console.error('Full error details:', JSON.stringify(error, null, 2));
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected from backend. Reason:', reason);
    });

    socket.on('transcription_result', (data) => {
      console.log('Transcription received:', data.text);
      setTranscription((prev) => `${prev} ${data.text}`);
      setIsLoading(false);
      setProcessing(false);
      processAudioQueue();
    });

    socket.on('transcription_error', (data) => {
      console.error('Transcription error:', data);
      setIsLoading(false);
      setProcessing(false);
      processAudioQueue();
    });

    // Cleanup
    return () => {
      console.log('useEffect cleaning up');
      socket.off('connect');
      socket.off('connect_error');
      socket.off('disconnect');
      socket.off('transcription_result');
      socket.off('transcription_error');
    };
  }, []);

  // Log socket status
  useEffect(() => {
    console.log('Socket connected status:', socket.connected);
  }, []);

  // Function to process audio queue
  const processAudioQueue = () => {
    if (audioChunksQueue.current.length > 0 && !processing) {
      setProcessing(true);
      const audioBlob = audioChunksQueue.current.shift();
      const reader = new FileReader();

      reader.onloadend = () => {
        const arrayBuffer = reader.result;
        console.log('Received ArrayBuffer:', {
          byteLength: arrayBuffer.byteLength,
          type: arrayBuffer.constructor.name,
        });
        socket.emit('audio_chunk', arrayBuffer);
      };

      reader.readAsArrayBuffer(audioBlob);
    }
  };

  // Function to start recording
  const startRecording = async () => {
    setIsLoading(true);
    setTranscription('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Media stream settings:', stream.getAudioTracks()[0].getSettings());

      let mimeType;
      const supportedTypes = [
        'audio/webm; codecs=opus',
        'audio/ogg; codecs=opus',
        'audio/webm',
        'audio/ogg',
      ];
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      if (!mimeType) {
        console.error('No supported MIME type found for MediaRecorder');
        setIsLoading(false);
        return;
      }
      console.log('Using MIME type:', mimeType);

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current.start(1000); // Split into 1-second chunks
      setIsRecording(true);

      mediaRecorderRef.current.ondataavailable = (event) => {
        console.log('Chunk size:', event.data.size, 'MIME type:', mediaRecorderRef.current.mimeType);
        audioChunksQueue.current.push(event.data);
        if (!processing) {
          processAudioQueue();
        }
      };

      mediaRecorderRef.current.onstop = () => {
        stream.getTracks().forEach((track) => track.stop()); // Clean up audio stream
      };
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsLoading(false);
    }
  };

  // Function to stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsLoading(false);
    }
  };

  return (
    <section className="flex flex-col items-center gap-20 py-20 mb-24">
      <h2 className="text-2xl font-bold">Start Reciting!</h2>
      <div className="relative" id="audio-form">
        <div className="relative p-2 pr-16 border rounded-full box-border border-black text-right text-2xl w-[38rem] h-[3rem] flex items-center justify-between">
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