import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import DotLoader from '../../../../components/dot_loader';
import QuranPageStructure from "../../../../components/QuranPageStructure";
import { readers } from "../../../../core/constants/reader"; // Import readers for playing audio
import { JuzData } from "../../../../core/constants/JuzData";
import { surahDict } from '../../../../core/constants/constants'; // Import Surah List
import { surahPages } from "../../../../core/constants/surah_pages"; // Import Surah Page Numbers
import { getPageFromAyah } from '../../../../core/utils/quranUtils';


// Initialize Socket.IO connection
const socket = io('http://localhost:5001', {
  transports: ["websocket"], // Force WebSocket-only transport
});

const RecordingSection = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcription, setTranscription] = useState([]);
  const [selectedSurah, setSelectedSurah] = useState(''); // Track the selected Surah
  const [selectedPage, setSelectedPage] = useState(1); // Default Page 1
  const [highlightedAyah, setHighlightedAyah] = useState(null);
  const [wrongWords, setWrongWords] = useState([]);
  const [mismatches, setMismatches] = useState('');
  const [selectedReader, setSelectedReader] = useState('');
  const [matchedWords, setMatchedWords] = useState([]); //To sync audio with word-by-word
  const [selectedJuz, setSelectedJuz] = useState(null);

  const recorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioRef = useRef(null);
  // Accumulates all WebM chunks for the lifetime of one MediaRecorder instance.
  // Index 0 is always the WebM header (initialization segment).
  const audioChunksRef = useRef([]);
  // Index into audioChunksRef where the current send-window starts.
  // Updated after each server response instead of restarting the recorder.
  const resetChunkIndexRef = useRef(0);
  // Keep selectedSurah accessible inside ondataavailable without stale closure.
  const selectedSurahRef = useRef('');


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

  // Subscribe to live transcription events whenever recording is active or just stopped.
  // We keep the listener alive for a short grace period after stop so the final
  // chunk result (which arrives after setIsRecording(false)) is not silently dropped.
  const isRecordingRef = useRef(false);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    const handleLiveTranscription = (data) => {
      console.log("📥 Full live_transcription event:", data);

      // Append each chunk result as a new line in the transcript.
      setTranscription(prev => [...prev, data.text || '']);

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
        // Merge new IDs into existing set — never shrink during a session.
        setMatchedWords(prev => [...new Set([...prev, ...data.matched_word_ids.map(String)])]);
        console.log("⚡ Matched Words:", data.matched_word_ids);
      }

      if (data.matched_ayah) {
        const { sura, ayah } = data.matched_ayah;
        // Fetch the page first, then set the highlight so both state updates
        // land in the same render — eliminating the page/highlight race condition.
        getPageFromAyah(sura, ayah).then((page) => {
          setSelectedPage(page);
          setHighlightedAyah({ sura, ayah });
        });
      }

      // After every successful chunk the server sends buffer_reset: true.
      // Keep the MediaRecorder running — stopping and restarting it creates a
      // dead window of ~200ms where spoken words are lost at chunk boundaries.
      // Instead, just mark the current chunk index so ondataavailable knows
      // where to start the next send window. The recorder (and its WebM header)
      // stay alive; the server's last_index already prevents re-matching.
      if (data.buffer_reset && recorderRef.current) {
        console.log("🔄 Buffer reset — marking new window start (recorder keeps running)");
        resetChunkIndexRef.current = audioChunksRef.current.length;
      }
    };

    socket.on('live_transcription', handleLiveTranscription);
    return () => {
      socket.off('live_transcription', handleLiveTranscription);
    };
  }, []);
  

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
      // 🔄 Sync Juz dropdown
      const matchingJuz = JuzData.find((j, index) => {
        const startPage = j.page;
        const endPage = JuzData[index + 1] ? JuzData[index + 1].page : 605;
        return page >= startPage && page < endPage;
      });
      if (matchingJuz) {
        setSelectedJuz(matchingJuz.value);
      }
    } else {
      console.warn("No page found for Surah:", surahNumber);
    }
  };

  const handleJuzChange = (event) => {
    const selected = parseInt(event.target.value);
    setSelectedJuz(selected);

    const juz = JuzData.find(j => j.value === selected);
    if (!juz) return;

    setSelectedSurah(`surah_${juz.start.sura}`);
    setSelectedPage(juz.page);

    setTimeout(() => {
      setHighlightedAyah(juz.start);
      console.log(`📖 Jumped to Juz ${selected}: Surah ${juz.start.sura}, Ayah ${juz.start.ayah}, Page ${juz.page}`);
    }, 50);
  };

  const handlePageChange = (newPage) => {
    setSelectedPage(newPage);

    // Find and set matching Juz
    const matchingJuz = JuzData.find((j, index) => {
      const startPage = j.page;
      const endPage = JuzData[index + 1] ? JuzData[index + 1].page : 605;
      return newPage >= startPage && newPage < endPage;
    });
    if (matchingJuz) {
      setSelectedJuz(matchingJuz.value);
    }

    // Find and set matching Surah
    const surahEntry = Object.entries(surahPages).find(
      ([surahNum, startPage], idx, arr) => {
        const nextStart = arr[idx + 1]?.[1] ?? 605;
        return newPage >= startPage && newPage < nextStart;
      }
    );
    if (surahEntry) {
      const [surahNumber] = surahEntry;
      setSelectedSurah(`surah_${surahNumber}`);
      // Optionally highlight Ayah 1 of the Surah
      setTimeout(() => {
        setHighlightedAyah({ sura: parseInt(surahNumber), ayah: 1 });
        console.log("📄 Page changed → Surah", surahNumber, "Ayah 1");
      }, 50);
    }
  };


  

  // Creates and starts a MediaRecorder on the given stream.
  // The recorder runs continuously for the entire recording session — no
  // stop/restart on chunk boundaries, which eliminates the dead window where
  // words spoken at the seam of two chunks were silently dropped.
  const startMediaRecorder = (stream) => {
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    recorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = async (event) => {
      console.log("ondataavailable triggered, size:", event.data?.size);
      if (!event.data || event.data.size === 0) return;

      audioChunksRef.current.push(event.data);

      // Build a blob covering: WebM header (index 0) + every chunk since the
      // last server-acknowledged reset. This is never just the latest slice —
      // accumulating from the reset point means boundary words are always
      // included in exactly one send window, with no gap between them.
      const header     = audioChunksRef.current[0];
      const windowStart = resetChunkIndexRef.current;
      const windowChunks = audioChunksRef.current.slice(Math.max(1, windowStart));

      // If the window already contains the header (windowStart === 0), don't
      // prepend it a second time.
      const parts = windowStart === 0
        ? audioChunksRef.current.slice()       // header is already chunk[0]
        : [header, ...windowChunks];

      const blobToSend = new Blob(parts, { type: 'audio/webm' });

      // Client-side silence gate: check only the newest slice so we don't
      // re-evaluate older (already-matched) audio.
      const isSilent = await (async () => {
        try {
          const audioCtx = new AudioContext({ sampleRate: 16000 });
          const buf = await event.data.arrayBuffer();
          const decoded = await audioCtx.decodeAudioData(buf);
          const pcm = decoded.getChannelData(0);
          let sumSq = 0;
          for (let i = 0; i < pcm.length; i++) sumSq += pcm[i] * pcm[i];
          const rms = Math.sqrt(sumSq / pcm.length);
          audioCtx.close();
          console.log("Client RMS:", rms.toFixed(5));
          return rms < 0.005;
        } catch (_) {
          return false; // if decode fails, let the server decide
        }
      })();

      if (isSilent) {
        console.log("Silent chunk — not sending to server.");
        return;
      }

      const arrayBuffer = await blobToSend.arrayBuffer();
      console.log("Sending chunk to server, size:", blobToSend.size);
      socket.emit('live_audio', {
        audio: arrayBuffer,
        surah: selectedSurahRef.current,
      });
    };

    mediaRecorder.onerror = (err) => {
      console.error("MediaRecorder error:", err);
    };

    mediaRecorder.start(5000);
    console.log("MediaRecorder started (continuous stream).");
  };

  const startRecording = async () => {
    if (!selectedSurah) {
      alert('Please select a Surah before recording.');
      return;
    }
    setHighlightedAyah(null);
    setIsLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      selectedSurahRef.current = selectedSurah;
      audioChunksRef.current = [];
      resetChunkIndexRef.current = 0;
      console.log("Audio stream acquired", stream);

      startMediaRecorder(stream);

      setIsRecording(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsLoading(false);
    }
  };

  const stopRecording = () => {
    console.log("Stop recording function called.");
    setIsRecording(false);
    // Reset all session state for the next recording.
    setTranscription([]);
    setMatchedWords([]);
    setWrongWords([]);
    audioChunksRef.current = [];
    resetChunkIndexRef.current = 0;

    if (recorderRef.current) {
      console.log("Stopping MediaRecorder...");
      recorderRef.current.stop();
      recorderRef.current = null;
      console.log("MediaRecorder stopped.");
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
              className="w-full p-3 border rounded-lg bg-gray-50 shadow-md dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37] shadow-sm transition"
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
          <div className="w-1/3 max-w-xs">
            <select
              id="juz-dropdown"
              className="w-full p-3 border rounded-lg bg-gray-50 shadow-md dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37] shadow-sm transition"
              value={selectedJuz || ""}
              onChange={handleJuzChange}
            >
              <option value="" disabled>
                -- Choose a Juz --
              </option>
              {JuzData.map((juz) => (
                <option key={juz.value} value={juz.value}>
                  {juz.label}
                </option>
              ))}
            </select>

            {/* Safe Juz Info Below Dropdown */}
            {(() => {
              const selected = JuzData.find(j => j.value === selectedJuz);
              if (!selected || !Array.isArray(selected.hizbs)) return null;
            })()}
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
          <div className="flex items-center gap-3 flex-wrap">
            {/* Previous Button */}
            <button
              className="px-2 py-1 rounded hover:bg-gray-300 dark:text-white dark:hover:bg-gray-600 disabled:opacity-50"
              onClick={() => handlePageChange(Math.max(selectedPage - 1, 1))}
              disabled={selectedPage <= 1}
            >
              &#60;
            </button>

            {/* Page Dropdown */}
            <select
              value={selectedPage}
              onChange={(e) => handlePageChange(Number(e.target.value))}
              className="p-2 border rounded bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            >
              <option disabled>-- Page --</option>
              {Array.from({ length: 604 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  Page {i + 1}
                </option>
              ))}
            </select>

            {/* Next Button */}
            <button
              className="px-2 py-1 rounded hover:bg-gray-300 dark:text-white dark:hover:bg-gray-600 disabled:opacity-50"
              onClick={() => handlePageChange(Math.min(selectedPage + 1, 604))}
              disabled={selectedPage >= 604}
            >
              &#62;
            </button>

          </div>


          {/* Transcription Text */}
          <div className="flex-1 text-sm text-gray-700 dark:text-gray-400 text-center sm:text-right max-h-20 overflow-y-auto">
            {transcription.length === 0
              ? <span className="opacity-50">Transcription will appear here...</span>
              : transcription.map((line, i) => (
                  <div key={i}>{line}</div>
                ))
            }
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
                  <svg className="w-8 h-8 text-[#D4AF37] dark:text-white" viewBox="0 0 256 256">
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