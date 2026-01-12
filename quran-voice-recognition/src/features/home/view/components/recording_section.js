import React, { useState, useRef, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import Recorder from 'opus-recorder';
import DotLoader from '../../../../components/dot_loader';
import QuranPageStructure from "../../../../components/QuranPageStructure";
import { readers } from "../../../../core/constants/reader";
import { JuzData } from "../../../../core/constants/JuzData";
import { surahDict } from '../../../../core/constants/constants';
import { surahPages } from "../../../../core/constants/surah_pages";
import { getPageFromAyah } from '../../../../core/utils/quranUtils';

// NOTE: keeping your existing global socket connection.
// If your backend needs a page param, you can emit "set_page" on page change below.
const socket = io('https://five-doodles-trade.loca.lt/', {
  transports: ["websocket"],
});

const RecordingSection = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcription, setTranscription] = useState('Transcription will appear here...');
  const [selectedSurah, setSelectedSurah] = useState('');
  const [selectedPage, setSelectedPage] = useState(1);
  const [highlightedAyah, setHighlightedAyah] = useState(null);
  const [wrongWords, setWrongWords] = useState([]);
  const [mismatches, setMismatches] = useState('');
  const [selectedReader, setSelectedReader] = useState('');
  const [matchedWords, setMatchedWords] = useState([]);
  const [selectedJuz, setSelectedJuz] = useState(null);

  // ✅ NEW: progressive reveal state
  const [hiddenWordIds, setHiddenWordIds] = useState(() => new Set());         // Set<string>
  const [sequenceWarningAyahIds, setSequenceWarningAyahIds] = useState(() => new Set()); // Set<string|number>
  const [showContinueNextPage, setShowContinueNextPage] = useState(false);

  // refs
  const recorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioRef = useRef(null);

  // rolling buffer + flush timer
  const audioBufferRef = useRef([]); // stores typedArray frames
  const flushIntervalRef = useRef(null);

  // ✅ NEW: word order metadata (comes from QuranPageStructure)
  const pageWordOrderRef = useRef([]);               // string[] (word ids in reading order)
  const pageWordIndexMapRef = useRef(new Map());     // Map<string, number>
  const secondLastAyahWordIdsRef = useRef([]);       // string[] word ids for second-to-last ayah
  const lastRevealedIndexRef = useRef(-1);           // number
  const pendingHideAllRef = useRef(false);           // if we start recording before word map ready

  useEffect(() => {
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

  /**
   * ✅ QuranPageStructure must call this whenever it renders a new page
   * providing the word ids in reading order + second last ayah words.
   *
   * We will use it to:
   * - hide all words at start
   * - reveal progressively up to the "max matched index"
   */
  const handlePageWordMap = useCallback(({ wordOrder, secondLastAyahWordIds }) => {
    const safeWordOrder = Array.isArray(wordOrder) ? wordOrder.map(String) : [];
    pageWordOrderRef.current = safeWordOrder;

    const map = new Map();
    safeWordOrder.forEach((id, idx) => map.set(String(id), idx));
    pageWordIndexMapRef.current = map;

    secondLastAyahWordIdsRef.current = Array.isArray(secondLastAyahWordIds)
      ? secondLastAyahWordIds.map(String)
      : [];

    // If recording started before this map arrived, hide now.
    if (pendingHideAllRef.current && isRecording) {
      setHiddenWordIds(new Set(safeWordOrder));
      pendingHideAllRef.current = false;
    }
  }, [isRecording]);

  // ✅ Subscribe to live transcription events only when recording.
  useEffect(() => {
    if (!isRecording) return;

    const handleLiveTranscription = (data) => {
      console.log("📥 Full live_transcription event:", data);

      setTranscription(data.text || 'No transcription received.');

      setMismatches(
        data.mismatched_words?.length > 0
          ? data.mismatched_words.map(([wrong, correct]) => `${wrong} → ${correct}`).join(', ')
          : 'No mismatches detected'
      );

      // wrong words (for your existing UI)
      if (data.wrong_word_ids && Array.isArray(data.wrong_word_ids)) {
        setWrongWords(data.wrong_word_ids.map(String));
      } else {
        setWrongWords([]);
      }

      // matched words (for your existing UI)
      const incomingMatched = (data.matched_word_ids && Array.isArray(data.matched_word_ids))
        ? data.matched_word_ids.map(String)
        : [];
      setMatchedWords(incomingMatched);

      // ✅ NEW: progressive reveal based on GLOBAL word order
      // We reveal everything from 0 -> maxIndex among matched words that exist on this page.
      const indexMap = pageWordIndexMapRef.current;
      if (indexMap && indexMap.size > 0 && incomingMatched.length > 0) {
        let maxIndex = -1;
        for (const wid of incomingMatched) {
          const idx = indexMap.get(String(wid));
          if (typeof idx === 'number' && idx > maxIndex) maxIndex = idx;
        }

        if (maxIndex > lastRevealedIndexRef.current) {
          lastRevealedIndexRef.current = maxIndex;

          // hideWordIds = words AFTER maxIndex
          const order = pageWordOrderRef.current;
          const wordsToHide = order.slice(maxIndex + 1); // Get words after maxIndex
          const newHidden = new Set(order.slice(maxIndex + 1));
          setHiddenWordIds(newHidden);
        }
      }else {
        console.log('⚠️ Cannot perform progressive reveal:', {
          hasIndexMap: indexMap && indexMap.size > 0,
          hasMatchedWords: incomingMatched.length > 0
        });
      }

      // ✅ Sequence warnings (optional: depends on your backend payload)
      // Expected shape:
      // data.sequence_error = { type: 'skip_aya', details: { skipped_aya_ids: [...] } }
      if (data.sequence_error?.type === 'skip_aya') {
        const skipped = data.sequence_error.details?.skipped_aya_ids || [];
        if (Array.isArray(skipped) && skipped.length > 0) {
          setSequenceWarningAyahIds(prev => {
            const next = new Set(prev);
            skipped.forEach(id => next.add(String(id)));
            return next;
          });
        }
      }

      // Existing "matched_ayah" navigation
      if (data.matched_ayah) {
        const { sura, ayah } = data.matched_ayah;
        const page = getPageFromAyah(sura, ayah);
        setSelectedPage(page);

        if (!highlightedAyah || highlightedAyah.sura !== sura || highlightedAyah.ayah !== ayah) {
          setHighlightedAyah({ sura, ayah });
        }
      }
    };

    socket.on('live_transcription', handleLiveTranscription);
    return () => {
      socket.off('live_transcription', handleLiveTranscription);
    };
  }, [isRecording, highlightedAyah]);

  // ✅ NEW: show "Continue" when second-to-last ayah is fully revealed
  useEffect(() => {
    if (!isRecording) return;

    const secondLastIds = secondLastAyahWordIdsRef.current;
    if (!secondLastIds || secondLastIds.length === 0) return;

    // If none of second last words are hidden -> completed
    const completed = secondLastIds.every(id => !hiddenWordIds.has(String(id)));
    if (completed && selectedPage < 604) {
      setShowContinueNextPage(true);
    }
  }, [hiddenWordIds, isRecording, selectedPage]);

  // Handle Surah selection
  const handleSurahChange = (event) => {
    const surahValue = event.target.value;
    setSelectedSurah(surahValue);

    const surahNumber = parseInt(surahValue.replace("surah_", ""));
    const page = surahPages[surahNumber];

    if (page) {
      setSelectedPage(page);

      setTimeout(() => {
        setHighlightedAyah({ sura: surahNumber, ayah: 1 });
      }, 50);

      // Sync Juz dropdown
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
    }, 50);
  };

  const handlePageChange = (newPage) => {
    setSelectedPage(newPage);

    // optional: tell backend page changed (ONLY if your backend supports it)
    // socket.emit('set_page', { page: newPage });

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

      setTimeout(() => {
        setHighlightedAyah({ sura: parseInt(surahNumber), ayah: 1 });
      }, 50);
    }
  };

  const startRecording = async () => {
    if (!selectedSurah) {
      alert('Please select a Surah before recording.');
      return;
    }

    setHighlightedAyah(null);
    setIsLoading(true);

    // ✅ Reset progressive reveal
    setShowContinueNextPage(false);
    setSequenceWarningAyahIds(new Set());
    lastRevealedIndexRef.current = -1;

    // ✅ Hide all words (if we already have the map), else wait for QuranPageStructure to provide it.
    const currentWordOrder = pageWordOrderRef.current;
    if (currentWordOrder && currentWordOrder.length > 0) {
      setHiddenWordIds(new Set(currentWordOrder));
      pendingHideAllRef.current = false;
    } else {
      pendingHideAllRef.current = true;
      setHiddenWordIds(new Set()); // temporary until word map arrives
    }

    try {
      // Request microphone access.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Create AudioContext and source node.
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);

      // Configure Opus-Recorder options.
      const options = {
        encoderPath: '/encoderWorker.min.js',
        numberOfChannels: 1,
        encoderSampleRate: 48000,
      };

      // Create Recorder instance
      const recorder = new Recorder(options, source);
      recorderRef.current = recorder;

      // Reset rolling buffer
      audioBufferRef.current = [];

      // Accumulate frames continuously
      recorder.ondataavailable = (typedArray) => {
        if (typedArray && typedArray.length > 0) {
          audioBufferRef.current.push(typedArray);
        }
      };

      recorder.onerror = (err) => {
        console.error("Recorder error:", err);
      };

      // Start once
      await recorder.start();
      console.log("Recorder started (continuous).");

      // Flush every 2 seconds (faster feedback than 5s)
      flushIntervalRef.current = setInterval(() => {
        try {
          const frames = audioBufferRef.current;
          if (!frames || frames.length === 0) return;

          const blob = new Blob(frames, { type: 'audio/ogg' });
          audioBufferRef.current = [];

          if (blob.size <= 0) return;

          const reader = new FileReader();
          reader.onload = function (e) {
            socket.emit('live_audio', {
              audio: e.target.result,
              surah: selectedSurah,
              page: selectedPage, // include page if your backend uses it
            });
          };
          reader.readAsArrayBuffer(blob);
        } catch (e) {
          console.error("Error while flushing audio buffer:", e);
        }
      }, 2000);

      setIsRecording(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsLoading(false);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    setTranscription("Transcription will appear here...");

    // ✅ Reset reveal state
    setHiddenWordIds(new Set());
    setSequenceWarningAyahIds(new Set());
    setShowContinueNextPage(false);
    lastRevealedIndexRef.current = -1;
    pendingHideAllRef.current = false;

    // Stop flush timer
    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }

    // Clear buffer
    audioBufferRef.current = [];

    // Stop recorder
    if (recorderRef.current) {
      await recorderRef.current.stop();
      recorderRef.current = null;
    }

    // Close AudioContext
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop media stream tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  // ✅ Continue to next page logic (like your old JS)
  const continueToNextPage = async () => {
    if (selectedPage >= 604) return;
    await stopRecording();
    // small delay
    await new Promise(r => setTimeout(r, 300));
    setShowContinueNextPage(false);
    handlePageChange(selectedPage + 1);
    // start again after render
    setTimeout(() => {
      startRecording();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 600);
  };

  return (
    <section
      id="quran"
      className="flex flex-col items-center gap-10 py-16 w-full px-4 bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-100 transition-all duration-500"
    >
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
              <option value="" disabled>-- Choose a Surah --</option>
              {Object.keys(surahDict).map((arabicName) => (
                <option key={arabicName} value={surahDict[arabicName]}>
                  {`سورة ${arabicName}`}
                </option>
              ))}
            </select>
          </div>

          {/* Juz Dropdown */}
          <div className="w-1/3 max-w-xs">
            <select
              id="juz-dropdown"
              className="w-full p-3 border rounded-lg bg-gray-50 shadow-md dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37] shadow-sm transition"
              value={selectedJuz || ""}
              onChange={handleJuzChange}
            >
              <option value="" disabled>-- Choose a Juz --</option>
              {JuzData.map((juz) => (
                <option key={juz.value} value={juz.value}>
                  {juz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ✅ Continue to next page button */}
        {showContinueNextPage && (
          <div className="w-full flex justify-center mt-4">
            <button
              onClick={continueToNextPage}
              className="px-4 py-2 rounded-lg bg-[#D4AF37] text-black font-semibold hover:opacity-90 transition"
            >
              Continue to next page →
            </button>
          </div>
        )}

        {/* Quran Page Content */}
        <div className="quran-page-container relative w-full flex justify-center">
          <div className="quran-fixed-page">
            <QuranPageStructure
              pageNumber={selectedPage}
              highlightedAyah={highlightedAyah}
              wrongWords={wrongWords}
              matchedWords={matchedWords}
              hiddenWordIds={hiddenWordIds}                 // ✅ NEW
              sequenceWarningAyahIds={sequenceWarningAyahIds} // ✅ NEW
              onAyahClick={(ayah) => setHighlightedAyah(ayah)}
              onPageWordMap={handlePageWordMap}             // ✅ NEW (required)
            />
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="flex items-center justify-between w-full flex-wrap gap-4 px-3 mt-0">
          {/* Page Navigation Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              className="px-2 py-1 rounded hover:bg-gray-300 dark:text-white dark:hover:bg-gray-600 disabled:opacity-50"
              onClick={() => handlePageChange(Math.max(selectedPage - 1, 1))}
              disabled={selectedPage <= 1}
            >
              &#60;
            </button>

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

            <button
              className="px-2 py-1 rounded hover:bg-gray-300 dark:text-white dark:hover:bg-gray-600 disabled:opacity-50"
              onClick={() => handlePageChange(Math.min(selectedPage + 1, 604))}
              disabled={selectedPage >= 604}
            >
              &#62;
            </button>
          </div>

          {/* Transcription Text */}
          <div className="flex-1 text-sm text-gray-700 dark:text-gray-400 text-center sm:text-right truncate">
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
                  <svg className="w-8 h-8 text-[#D4AF37] dark:text-white" viewBox="0 0 256 256">
                    <path
                      fill="currentColor"
                      d="M80 128V64a48 48 0 0 1 96 0v64a48 48 0 0 1-96 0m128 0a8 8 0 0 0-16 0a64 64 0 0 1-128 0a8 8 0 0 0-16 0a80.11 80.11 0 0 0 72 79.6V240a8 8 0 0 0 16 0v-32.4a80.11 80.11 0 0 0 72-79.6"
                    />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Audio Element */}
        <audio ref={audioRef} hidden />
      </div>
    </section>
  );
};

export default RecordingSection;
