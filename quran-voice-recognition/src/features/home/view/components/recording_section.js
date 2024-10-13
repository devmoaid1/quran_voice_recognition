import React, { useState, useRef,useEffect } from 'react';
import DotLoader from '../../../../components/dot_loader'; 
import io from 'socket.io-client';


const socket = io('http://127.0.0.1:5000');
const RecordingSection = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcription, setTranscription] = useState('Transcription will appear here...');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]); 

   // Set up Socket.IO connection and event listeners
   useEffect(() => {
    // Listen for transcription results from the server
    socket.on('transcription_result', (data) => {
      setTranscription((prev) => prev + ' ' + data.text);  // Append live transcription
      setIsLoading(false);
    });

    // Listen for errors from the server
    socket.on('transcription_error', (data) => {
      setTranscription(data.error);
      setIsLoading(false);

      
    });

    return () => {
      socket.off('transcription_result');
      socket.off('transcription_error');
    };
  }, []);

   // Function to start recording
   const startRecording = async () => {
    setIsLoading(true);
    setTranscription("");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    mediaRecorderRef.current.start(1000);  // Start recording and capture audio chunks every 100 milliseconds
    setIsRecording(true);

    // Send audio chunks to the server as they become available
    mediaRecorderRef.current.ondataavailable = (event) => {
        const audioBlob = event.data;
        const reader = new FileReader();

        reader.onloadend = () => {
            const arrayBuffer = reader.result;
            console.log("recieved audio chunk",arrayBuffer)
            socket.emit('audio_chunk', arrayBuffer);  // Send binary audio data to the server in real time
        };

        reader.readAsArrayBuffer(audioBlob);  // Read blob as ArrayBuffer
    };
};


  // Function to stop recording
  const stopRecording = () => {
    socket.disconnect();
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    setIsLoading(false);
    
  };

  // Function to send audio to the server
 // Function to send audio to the server
const sendAudioToServer = async () => {
  console.log("Sending audio to server...");

  // Create a Blob from the audio chunks
  const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
  audioChunksRef.current = []; // Clear the chunks after sending

  const formData = new FormData();
  formData.append('audio', audioBlob, 'audio.wav');

  try {
    // Make the POST request to the server
    const response = await fetch('http://127.0.0.1:5000/transcribe', {
      method: 'POST',
      body: formData,
    });

    // Check if the response is okay (status code 200-299)
    if (!response.ok) {
      const errorText = await response.text(); // Get the error text from the response
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    // Parse the response as JSON
    const data = await response.json();
    console.log(data);
    
    // Update the transcription state with the received text
    setTranscription(data['text']);

  } catch (error) {
    console.error('Error sending audio to server:', error);
    alert('Failed to send audio to server. Please try again.');
  } finally {
    // Always set loading to false once the request completes, regardless of success or failure
    setIsLoading(false);
  }
};


  return (
    <section className="flex flex-col items-center gap-20 py-20 mb-24">
    <h2 className="text-2xl font-bold">Start Reciting!</h2>
    <div className="relative" id="audio-form">
      <div className="relative p-2 pr-16 border rounded-full box-border border-black text-right text-2xl w-[38rem] h-[3rem] flex items-center justify-between">
        {isLoading ? (
          // Show the DotLoader when recording is active, centered inside the input container
          <div className="flex items-center justify-center w-full">
            <DotLoader />
          </div>
        ) : (
          // Show the input field text when not recording
          <input
            className="w-full h-full border-none outline-none text-right bg-transparent py-40"
            type="text"
            value={transcription}
            readOnly
          />
        )}
  
        {/* The record button positioned absolutely relative to the input or loader */}
        <button
          id="record-button"
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className="btn absolute right-0 top-0 h-full aspect-square scale-[102%] rounded-full" // Added rounded-full class
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
