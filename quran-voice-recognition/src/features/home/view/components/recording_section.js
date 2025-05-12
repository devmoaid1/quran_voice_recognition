import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import Recorder from 'opus-recorder';
import DotLoader from '../../../../components/dot_loader';
import QuranPageStructure from "../../../../components/QuranPageStructure";
import { readers } from "../../../../core/constants/reader"; // Import readers for playing audio
import { surahDict } from '../../../../core/constants/constants'; // Import Surah List
import { surahPages } from "../../../../core/constants/surah_pages"; // Import Surah Page Numbers
import { getPageFromAyah } from '../../../../core/utils/quranUtils';


// Initialize Socket.IO connection
const socket = io('https://rotten-poets-refuse.loca.lt/', {
  transports: ["websocket"], // Force WebSocket-only transport
});

const RecordingSection = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcription, setTranscription] = useState('Transcription will appear here...');
  const [selectedSurah, setSelectedSurah] = useState(''); // Track the selected Surah
  const [selectedPage, setSelectedPage] = useState(1); // Default Page 1
  const [highlightedAyah, setHighlightedAyah] = useState(null);
  const [wrongWords, setWrongWords] = useState([]);
  const [mismatches, setMismatches] = useState('');
  const [selectedReader, setSelectedReader] = useState('');
  const [matchedWords, setMatchedWords] = useState([]); //To sync audio with word-by-word

  const recorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const chunkIntervalRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioRef = useRef(null);


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
        console.log("📥 Full live_transcription event:", data);
      
        setTranscription(data.text || 'No transcription received.');
      
        setMismatches(
          data.mismatched_words?.length > 0
            ? data.mismatched_words.map(([wrong, correct]) => `${wrong} → ${correct}`).join(', ')
            : 'No mismatches detected'
        );
      
        if (data.wrong_word_ids && Array.isArray(data.wrong_word_ids)) {
          setWrongWords(data.wrong_word_ids.map(String));
          console.log("⚡ Wrong Words:", data.wrong_word_ids);
        } else {
          setWrongWords([]);
        }
      
        if (data.matched_word_ids && Array.isArray(data.matched_word_ids)) {
          setMatchedWords(data.matched_word_ids.map(String));
          console.log("⚡ Matched Words:", data.matched_word_ids);
        } else {
          setMatchedWords([]);
        }
      
        if (data.matched_ayah) {
          const { sura, ayah } = data.matched_ayah;
          const page = getPageFromAyah(sura, ayah);
          setSelectedPage(page);
          if (
            !highlightedAyah ||
            highlightedAyah.sura !== sura ||
            highlightedAyah.ayah !== ayah
          ) {
            setHighlightedAyah({ sura, ayah });
          }
        }
      };   
      
      
      socket.on('live_transcription', handleLiveTranscription);
      return () => {
        socket.off('live_transcription', handleLiveTranscription);
      };
    }
  }, [isRecording]);
  

  // Handle Surah selection
  const handleSurahChange = (event) => {
    const surahValue = event.target.value; // "surah_112"
    setSelectedSurah(surahValue);
  
    const surahNumber = parseInt(surahValue.replace("surah_", "")); // "112" → 112
  
    const page = surahPages[surahNumber];
    if (page) {
      setSelectedPage(page);
  
      // Highlight ayah 1
      setTimeout(() => {
        setHighlightedAyah({ sura: surahNumber, ayah: 1 });
        console.log("✅ Highlighting Surah:", surahNumber, "Ayah 1");
      }, 50);
    } else {
      console.warn("No page found for Surah:", surahNumber);
    }
  };
  

  const startRecording = async () => {
    if (!selectedSurah) {
      alert('Please select a Surah before recording.');
      return;
    }
    setHighlightedAyah(null);
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
    <section id="quran" className="flex flex-col items-center gap-10 py-16 w-full px-4 bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-100 transition-all duration-500">
  
      <div className="quran-page-container relative w-full max-w-4xl p-4 bg-white shadow-lg rounded-lg overflow-x-auto dark:bg-gray-800/80 backdrop-blur-md p-6">
  
        {/* Top Info Bar */}
        <div className="flex items-center justify-between w-full flex-wrap gap-4 px-3 mt-0">
          {/* Surah Dropdown */}
          <div className="w-1/3 max-w-xs">
            <select
              id="surah-dropdown"
              className="w-full p-3 border rounded-lg bg-gray-50 shadow-md dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 shadow-sm transition"
              value={selectedSurah}
              onChange={handleSurahChange}
            >
              <option value="" disabled>
                -- Choose a Surah --
              </option>
              {Object.keys(surahDict).map((arabicName) => (
                <option key={arabicName} value={surahDict[arabicName]}>
                  {`سورة ${arabicName}`}
                </option>
              ))}
            </select>
          </div>
  
          {/* Juz & Hizb Placeholder */}
          <div className="text-gray-600 text-right text-sm dark:text-gray-300 font-semibold">
            {/* Juz 30 | Hizb 60 */}
            Juz 30
          </div>
        </div>
  
        {/* Quran Page Content */}
        <div className="quran-page-container relative w-full flex justify-center">
          <div className="quran-fixed-page">
            <QuranPageStructure
              pageNumber={selectedPage}
              highlightedAyah={highlightedAyah}
              wrongWords={wrongWords}
              matchedWords={matchedWords}
              onAyahClick={(ayah) => setHighlightedAyah(ayah)}
            />
          </div>
        </div>
  
        {/* Bottom Control Bar */}
        <div className="flex items-center justify-between w-full flex-wrap gap-4 px-3 mt-0">
          {/* Page Navigation Controls */}
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 rounded hover:bg-gray-300 dark:text-white dark:hover:bg-gray-600 disabled:opacity-50"
              onClick={() => setSelectedPage(p => Math.max(p - 1, 1))}
              disabled={selectedPage <= 1}
            >
              &#60;
            </button>
            <span className="text-base font-semibold dark:text-white">Page {selectedPage}</span>
            <button
              className="px-2 py-1 rounded hover:bg-gray-300 dark:text-white dark:hover:bg-gray-600 disabled:opacity-50"
              onClick={() => setSelectedPage(p => p + 1)}
              disabled={selectedPage >= 604}
            >
              &#62;
            </button>
          </div>

          {/* Transcription Text */}
          <div className="flex-1 text-sm text-gray-700 dark:text-gray-400 text-center sm:text-right truncate ">
            {transcription}
          </div>

          {/* Recording Section */}
          <div className="relative w-16 h-16">
            {isLoading ? (
              <div className="flex items-center justify-center w-full h-full">
                <DotLoader />
              </div>
            ) : (
              <button
                id="record-button"
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`absolute right-0 bottom-0 h-16 w-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                  isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-hover'
                }`}
              >
                {isRecording ? (
                  <svg className="w-8 h-8 text-white" viewBox="0 0 256 256">
                    <path fill="currentColor" d="M64 64h128v128H64z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-white" viewBox="0 0 256 256">
                    <path fill="currentColor" d="M80 128V64a48 48 0 0 1 96 0v64a48 48 0 0 1-96 0m128 0a8 8 0 0 0-16 0a64 64 0 0 1-128 0a8 8 0 0 0-16 0a80.11 80.11 0 0 0 72 79.6V240a8 8 0 0 0 16 0v-32.4a80.11 80.11 0 0 0 72-79.6" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Audio Element */}
        <audio ref={audioRef} hidden />
        
        {/* Reader Section to play select ayah audio, keep it commented for now */}
        {/* {highlightedAyah && (
          <div className="w-full max-w-md text-center mt-6">
            ... (reader dropdown and audio playing section you commented) ...
          </div>
        )} */}
  
      </div>
    </section>
  );
};

export default RecordingSection;