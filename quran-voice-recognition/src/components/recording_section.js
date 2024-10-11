import React, { useState, useRef } from 'react';

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('Transcription will appear here...');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Function to start recording
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    
    mediaRecorderRef.current.start();
    setIsRecording(true);
    
    mediaRecorderRef.current.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    // Move the `sendAudioToServer` call to the stop function
    mediaRecorderRef.current.onstop = async () => {
      // Send the audio to the server when recording stops
      await sendAudioToServer();
    };
  };

  // Function to stop recording
  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

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
      const response = await fetch('http://38.80.123.219:5000/transcribe', {
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

      // Update the transcription state
      setTranscription(data['text']);

    } catch (error) {
      console.error('Error sending audio to server:', error);
      alert('Failed to send audio to server. Please try again.');
    }
  };

  return (
    <section className="flex flex-col items-center gap-20 py-20 mb-24">
      <h2 className="text-2xl font-bold">Try it out!</h2>
      <div className="relative" id="audio-form">
        <input
          className="p-3 pr-16 border rounded-full box-border border-black text-right text-2xl w-[38rem]"
          type="text"
          value={transcription}
          readOnly // Assuming you want to keep it read-only
        />
        <button
          id="record-button"
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className="btn absolute right-0 h-full aspect-square scale-[102%]"
        >
          {isRecording ? (
            <svg
              id="stop-icon"
              className="translate-x-[0.08rem] w-8 h-8"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 256 256"
            >
              <path
                fill="currentColor"
                d="M64 64h128v128H64z"
              />
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
    
    </section>
  );
};

export default AudioRecorder;
