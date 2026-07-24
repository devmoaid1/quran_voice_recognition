# Continuous Per-Chunk Transcription Plan

## Top-Level Overview

**Goal**: Replace the fixed 5-second clock-based chunking approach with a continuous transcription
model that sends each audio chunk independently and responds immediately, building up a running
transcript line by line.

**Approach — Option A (stateless per-chunk, server-side position tracking)**:
- Frontend: Replace `opus-recorder` + `setInterval` stop/start cycle with the native `MediaRecorder`
  API (`timeslice: 3000ms`), which emits `ondataavailable` automatically every 3 seconds.
- Backend: Each chunk is transcribed independently (no rolling audio buffer). The server tracks the
  last matched word position per session (`last_word_index` keyed by `request.sid`) so word matching
  always searches forward from where the user left off — never backwards.
- Frontend: Each transcription result is appended to a growing transcript list (new line per chunk).
  Matched word highlights accumulate on the Quran page as the user reads forward.

**Non-Goals**:
- No rolling audio buffer or growing window (Option B).
- No VAD or silence detection.
- No changes to the Whisper model, `map_transcription_words`, `find_closest_verse`, or
  `QuranPageStructure`.
- No removal of the `opus-recorder` package from `package.json` (leave for later cleanup).

---

## Sub-Task 1 — Replace opus-recorder with native MediaRecorder on the frontend

**Status**: [x] done

### Intent
Remove the dependency on `opus-recorder` and its manual stop/start interval timer. Use the
browser-native `MediaRecorder` API with a `timeslice` argument so chunks are emitted automatically
every 3 seconds without any external encoder worker. This eliminates `chunkIntervalRef`,
`audioContextRef`, and the `encoderWorker.min.js` dependency.

### Expected Outcomes
- `startRecording` creates a `MediaRecorder(stream, { mimeType: 'audio/webm' })` and calls
  `.start(3000)`.
- `ondataavailable` fires every ~3 seconds; the handler converts `event.data` to `ArrayBuffer` and
  immediately emits `live_audio` over the socket.
- `stopRecording` calls `mediaRecorder.stop()` — this triggers one final `ondataavailable` for the
  tail audio, which is also sent before the stream closes.
- No `setInterval`, no `clearInterval`, no `AudioContext` setup.
- `recorderRef` holds a `MediaRecorder` instance instead of an `opus-recorder` instance.

### Todo List
1. In `startRecording`, remove the `AudioContext` creation and `opus-recorder` instantiation.
2. Create `const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })`.
3. Set `mediaRecorder.ondataavailable = async (event) => { ... }` — convert `event.data` to
   `ArrayBuffer` via `event.data.arrayBuffer()` and emit `live_audio`.
4. Assign `recorderRef.current = mediaRecorder` and call `mediaRecorder.start(3000)`.
5. In `stopRecording`, remove `clearInterval(chunkIntervalRef.current)` and replace
   `recorderRef.current.stop()` call with the `MediaRecorder` stop (same API, no change needed).
6. Remove `chunkIntervalRef` and `audioContextRef` refs and all their teardown logic from
   `stopRecording`.
7. Keep `mediaStreamRef` teardown unchanged (microphone release still required).

### Relevant Context
- File: `quran-voice-recognition/src/features/home/view/components/recording_section.js`
- Refs to remove: `chunkIntervalRef` (line 33), `audioContextRef` (line 32)
- `startRecording`: lines 188–259 (opus-recorder + setInterval logic to replace)
- `stopRecording`: lines 261–289 (clearInterval + audioContext teardown to remove)
- `opus-recorder` import at line 3

---

## Sub-Task 2 — Add per-session last-word-position tracking on the backend

**Status**: [x] done

### Intent
Currently `map_transcription_words` always scans from the beginning of the surah's word list for
each chunk, which means a new chunk can match words the user already read in a previous chunk. By
storing the last matched `filtered_positions` index per session on the server, each new chunk starts
its forward search from that position, ensuring the matcher only advances — never jumps back.

### Expected Outcomes
- A module-level dict `session_state = {}` maps `sid` →
  `{ "surah": str, "last_index": int }`.
- On each `live_audio` event, the server reads `last_index` for the session and passes it as the
  forward-search starting point into `map_transcription_words`.
- After processing, `last_index` is updated to the highest matched position in this chunk.
- `map_transcription_words` accepts an optional `start_index` parameter and begins its forward
  search from that index instead of 0.
- On `disconnect`, the session entry is deleted to free memory.
- If the surah changes mid-session, `last_index` resets to 0.

### Todo List
1. Add `session_state = {}` as a module-level dict after the existing static data section in
   `server.py`.
2. Add an optional `start_index: int = 0` parameter to `map_transcription_words`.
3. In the forward search loop inside `map_transcription_words`, change the range start from
   `last_idx + 1` to `max(last_idx + 1, start_index)` for the very first word only (i.e. seed
   `last_idx = start_index - 1` at the top of the function).
4. Return `last_idx` (the final matched position) as a 5th return value from
   `map_transcription_words` so the caller can store it.
5. In `handle_live_audio`:
   a. Read `sid = request.sid`.
   b. Read `prev = session_state.get(sid, {})`.
   c. If `prev.get("surah") != surah_name`, reset `start_index = 0`; else use
      `prev.get("last_index", 0)`.
   d. Pass `start_index` to `map_transcription_words`.
   e. Store `session_state[sid] = { "surah": surah_name, "last_index": returned_last_idx }`.
6. In `handle_disconnect`, add `session_state.pop(request.sid, None)`.

### Relevant Context
- File: `quran-voice-recognition/server/server.py`
- `map_transcription_words`: lines 120–201 — `last_idx` is already tracked internally, just needs
  to be seeded from `start_index` and returned.
- `handle_live_audio`: lines 283–332
- `handle_disconnect`: lines 279–280
- Server uses `eventlet` — module-level dict is safe for greenlet concurrency.

---

## Sub-Task 3 — Accumulate transcript and matched words on the frontend

**Status**: [x] done

### Intent
Currently `transcription` state is a single string replaced on every response, and `matchedWords`
is also replaced. With continuous chunking each chunk result should be appended as a new line to
a growing transcript, and matched word IDs should accumulate so the Quran page shows full reading
progress across all chunks.

### Expected Outcomes
- `transcription` becomes a list of strings (one entry per committed chunk), rendered as stacked
  lines.
- Each new `live_transcription` response appends `data.text` to the list.
- `matchedWords` is merged (union) with each new response's `matched_word_ids` — already-green
  words stay green.
- On `stopRecording`, both `transcription` and `matchedWords` reset to their initial empty states.

### Todo List
1. Change `transcription` state from a string to an array: `useState([])`.
2. In `handleLiveTranscription`, replace `setTranscription(data.text)` with
   `setTranscription(prev => [...prev, data.text || ''])`.
3. In `handleLiveTranscription`, change `setMatchedWords(data.matched_word_ids.map(String))` to
   `setMatchedWords(prev => [...new Set([...prev, ...data.matched_word_ids.map(String)])])`.
4. In the JSX, replace the single `{transcription}` text node with a mapped list rendering each
   entry as its own `<div>` or `<p>`.
5. In `stopRecording`, add `setTranscription([])`, `setMatchedWords([])`, and `setWrongWords([])`
   to reset all state for the next session.

### Relevant Context
- File: `quran-voice-recognition/src/features/home/view/components/recording_section.js`
- `transcription` state: line 21, rendered at line 398
- `matchedWords` state: line 28, used at line 351 as prop to `QuranPageStructure`
- `handleLiveTranscription`: lines 65–99
- `stopRecording` reset logic: lines 261–289
- `QuranPageStructure` uses `matchedWords.includes(id)` per word — handles any array size with no
  changes needed.
