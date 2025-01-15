import React, { useState, useRef } from 'react';
import DotLoader from '../../../../components/dot_loader';
import { surahDict } from '../../../../core/constants/constants';

const hostedServerUrl = 'https://mahfouz.site/transcribe';
const localServerUrl = "https://d9bb-35-233-191-184.ngrok-free.app/";

const RecordingSection = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcription, setTranscription] = useState('Transcription will appear here...');
  const [mismatches, setMismatches] = useState([]); // Track mismatched words
  const [selectedSurah, setSelectedSurah] = useState(''); // Track the selected Surah
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Function to handle Surah selection
  const handleSurahChange = (event) => {
    setSelectedSurah(event.target.value);
  };

  // Function to start recording
  const startRecording = async () => {
    try {
      setIsLoading(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.start();
      setIsRecording(true);

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        // Send the audio to the server when recording stops
        await sendAudioToServer();
      };
    } catch (error) {
      console.error('Error accessing audio device:', error);
      alert('Unable to access the microphone. Please ensure it is connected and try again.');
      setIsLoading(false);
    }
  };

  // Function to stop recording
  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  // Function to send audio to the server
  const sendAudioToServer = async () => {
    console.log("Sending audio to server...");
  
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
    audioChunksRef.current = []; // Clear the chunks after sending
  
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.wav');
  
    try {
      const response = await fetch(localServerUrl + 'transcribe', {
        method: 'POST',
        body: formData,
        headers: {
          "ngrok-skip-browser-warning": "true",
          "Surah-Name": selectedSurah || 'الإخلاص', // Use the selected Surah or default one
        }
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
  
      const data = await response.json();
      console.log(data);
  
      // Update transcription and mismatches from the server response
      const transcriptionText = data['mapped_transcription'] || 'No transcription received.';
      const mismatchedWords = data['mismatched_words'] || [];
  
      setTranscription(transcriptionText); // Update transcription state
  
      // Format mismatches for display
      setMismatches(
        mismatchedWords.length > 0
          ? mismatchedWords.join(', ') // Join mismatches into a readable format
          : 'No mismatches detected'
      );
  
    } catch (error) {
      console.error('Error sending audio to server:', error);
      setTranscription('Failed to process transcription.');
      setMismatches('Failed to detect mismatches.');
    } finally {
      setIsLoading(false);
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
        {/* {mismatches.length > 0 && (
          <div className="mt-4 text-left">
            <h3 className="text-lg font-semibold">Mismatched Words:</h3>
            <ul className="list-disc list-inside">
              {mismatches.map(([original, corrected], index) => (
                <li key={index}>
                  <strong>{original}</strong> → {corrected}
                </li>
              ))}
            </ul>
          </div>
        )} */}
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