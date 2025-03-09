import React, { useState, useRef, useEffect } from 'react';
import DotLoader from '../../../../components/dot_loader';
import io from 'socket.io-client';

// Replace with your ngrok URL
const socket = io('https://22aa-34-126-168-200.ngrok-free.app/', {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

const RecordingSection = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcription, setTranscription] = useState('Transcription will appear here...');
  const [error, setError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksQueue = useRef([]);
  const streamRef = useRef(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    socket.on('connect', () => console.log('[Frontend] Connected to server'));
    
    socket.on('transcription_result', (data) => {
      console.log('[Frontend] Received Transcription:', data.text);
      setTranscription((prev) => `${prev === 'Transcription will appear here...' ? '' : prev} ${data.text}`);
      setIsLoading(false);
      setProcessing(false);
    });

    socket.on('transcription_error', (data) => {
      console.error('[Frontend] Server error:', data.error);
      setError('Transcription failed. Please try again.');
      setIsLoading(false);
      setProcessing(false);
    });

    return () => {
      socket.off('connect');
      socket.off('transcription_result');
      socket.off('transcription_error');
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      setIsLoading(true);
      setTranscription('');
      console.log('[Frontend] Requesting microphone access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/wav' });

      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      console.log('[Frontend] Recording started...');

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('[Frontend] Captured audio chunk...');
          audioChunksQueue.current.push(event.data);
          if (!processing) processAudioQueue();
        }
      };

      mediaRecorderRef.current.onstop = () => {
        console.log('[Frontend] Recording stopped.');
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        socket.emit('stop_recording');
      };

    } catch (err) {
      console.error('[Frontend] Recording failed:', err);
      setError('Failed to access microphone. Please check permissions.');
      setIsLoading(false);
    }
  };

  const processAudioQueue = () => {
    if (audioChunksQueue.current.length > 0 && !processing) {
      setProcessing(true);
      const audioBlob = audioChunksQueue.current.shift();
      console.log('[Frontend] Sending audio chunk to backend...');
      
      socket.emit('audio_chunk', { audio: audioBlob, format: 'wav' });
    }
  };

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
              value={error || transcription}
              readOnly
            />
          )}
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className="btn absolute right-0 top-0 h-full aspect-square scale-[102%] rounded-full"
            disabled={!!error}
          >
            {isRecording ? 'Stop' : 'Record'}
          </button>
        </div>
      </div>
    </section>
  );
};

export default RecordingSection;
