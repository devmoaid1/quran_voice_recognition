import os
import re
import wave
import json
import torch
import difflib
import librosa
import numpy as np
import soundfile as sf
from flask_cors import CORS
from io import BytesIO
from pydub import AudioSegment
from difflib import SequenceMatcher
from flask_socketio import SocketIO, emit
from flask import Flask, request, jsonify
from transformers import WhisperProcessor, WhisperForConditionalGeneration

# ── Device ────────────────────────────────────────────────────────────────────
if torch.backends.mps.is_available():
    DEVICE = "mps"
elif torch.cuda.is_available():
    DEVICE = "cuda"
else:
    DEVICE = "cpu"
print(f"Using device: {DEVICE}")

# ── Paths (relative to this file) ────────────────────────────────────────────
BASE_DIR         = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR        = os.path.join(BASE_DIR, "distil_whisper_large_ama")
CHECKPOINT_DIR   = os.path.join(MODEL_DIR, "checkpoint-1000")
WORDS_DIR        = os.path.join(BASE_DIR, "surahs_word")
VERSES_DIR       = os.path.join(BASE_DIR, "surahs_versus")
AYAH_RANGES_FILE = os.path.join(BASE_DIR, "ayah_ranges.json")

# ── App ───────────────────────────────────────────────────────────────────────
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
CORS(app)

# ── Model ─────────────────────────────────────────────────────────────────────
print("Loading model…")
processor = WhisperProcessor.from_pretrained(MODEL_DIR)
model = WhisperForConditionalGeneration.from_pretrained(CHECKPOINT_DIR)
model.to(DEVICE)
model.eval()
print("Model loaded.")

# ── Static data ───────────────────────────────────────────────────────────────
with open(AYAH_RANGES_FILE, encoding="utf-8") as f:
    AYAH_DATA = json.load(f)

# ── Per-session state ─────────────────────────────────────────────────────────
# Maps sid → {"surah": str, "last_index": int}
# last_index : filtered_positions index of the last matched word.
#              Advances word-by-word across chunks — the frontend resets its audio
#              buffer after every chunk so the server never needs ayah-level tracking.
session_state = {}

# Global word ID of the first word of each surah (= ayah_begin of ayah 1 in page JSON).
# Used to convert local (0-based) ayah_ranges indices ↔ global word IDs.
SURAH_STARTING_WORD_ID = {
    "surah_1":   1,     "surah_78":  75122, "surah_79":  75295, "surah_80":  75474,
    "surah_81":  75607, "surah_82":  75711, "surah_83":  75791, "surah_84":  75960,
    "surah_85":  76067, "surah_86":  76176, "surah_87":  76237, "surah_88":  76309,
    "surah_89":  76401, "surah_90":  76538, "surah_91":  76620, "surah_92":  76674,
    "surah_93":  76745, "surah_94":  76785, "surah_95":  76812, "surah_96":  76846,
    "surah_97":  76918, "surah_98":  76948, "surah_99":  77042, "surah_100": 77078,
    "surah_101": 77118, "surah_102": 77154, "surah_103": 77182, "surah_104": 77196,
    "surah_105": 77229, "surah_106": 77252, "surah_107": 77269, "surah_108": 77294,
    "surah_109": 77304, "surah_110": 77330, "surah_111": 77349, "surah_112": 77372,
    "surah_113": 77387, "surah_114": 77410,
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def load_surah_files(surah_name):
    """Load word list and verse list for the given surah."""
    word_file  = os.path.join(WORDS_DIR,  f"{surah_name}.txt")
    verse_file = os.path.join(VERSES_DIR, f"{surah_name}.txt")

    if not os.path.exists(word_file) or not os.path.exists(verse_file):
        print(f"Missing files for {surah_name}")
        return None, None

    with open(word_file, encoding="utf-8") as f:
        surah_words = [line.strip() for line in f if line.strip()]

    with open(verse_file, encoding="utf-8") as f:
        surah_verses = [line.strip() for line in f if line.strip()]

    return surah_verses, surah_words


def remove_harakat(text):
    """Strip Arabic diacritics."""
    return re.sub(r'[\u064B-\u065F\u0610-\u061A]', '', text)


def find_matched_ayah(surah_name, matched_word_ids):
    """Given a list of matched global word IDs, find which ayah most words fall in."""
    if not matched_word_ids or surah_name not in AYAH_DATA:
        return None

    surah_number = int(surah_name.replace("surah_", ""))
    starting_id  = SURAH_STARTING_WORD_ID.get(surah_name, 1)
    ayah_ranges  = AYAH_DATA[surah_name]

    # Convert global IDs → local indices
    local_indices = [int(wid) - starting_id for wid in matched_word_ids]

    # Count votes per ayah
    votes = {}
    for local_idx in local_indices:
        for entry in ayah_ranges:
            if entry["ayah_begin"] <= local_idx <= entry["ayah_end"]:
                ayah_id = entry["ayahID"]
                votes[ayah_id] = votes.get(ayah_id, 0) + 1
                break

    if not votes:
        return None

    best_ayah = max(votes, key=votes.get)
    return {"sura": surah_number, "ayah": best_ayah}


# How many words ahead of the last match to search before treating as a substitution.
# Wide enough to handle a skipped word or two; narrow enough to prevent jumping
# to a distant repeated word (e.g. "ما" or "الذي" appearing many times in long surahs).
MATCH_LOOKAHEAD = 6


def map_transcription_words(transcription, surah_words, surah_name, start_index=0):
    """Fuzzy-match each transcribed word to its Quran equivalent.
    Returns (mapped_text, mismatches, matched_word_ids, wrong_word_ids, last_idx).
    last_idx is the filtered_positions index of the final matched word.

    Matching strategy:
    - Search only within MATCH_LOOKAHEAD positions ahead of last_idx.
    - If no match >= 0.8 in that window → substitution error at next expected position.
    - Never searches behind start_index (prevents re-matching prior chunks).
    """
    trans_words        = transcription.split()
    starting_id        = SURAH_STARTING_WORD_ID.get(surah_name, 1)

    # Filter out digit-only entries (ayah markers), preserve original positions.
    filtered_words     = []
    filtered_positions = []
    for idx, w in enumerate(surah_words):
        if not w.strip().isdigit():
            filtered_words.append(remove_harakat(w))
            filtered_positions.append(idx)

    mismatches       = []
    mapped           = []
    matched_word_ids = []
    wrong_word_ids   = []
    used_indices     = set()
    last_idx         = start_index - 1   # last successfully matched filtered index

    for tw in trans_words:
        tw_norm    = remove_harakat(tw)
        best_idx   = None
        best_score = 0.0

        # Search only within MATCH_LOOKAHEAD positions ahead of last match.
        # Prevents silent word-skipping and avoids matching distant repeated words.
        search_start = max(start_index, last_idx + 1)
        search_end   = min(len(filtered_words), search_start + MATCH_LOOKAHEAD)

        for i in range(search_start, search_end):
            if i in used_indices:
                continue
            score = SequenceMatcher(None, tw_norm, filtered_words[i]).ratio()
            if score > best_score:
                best_score = score
                best_idx   = i

        if best_idx is not None and best_score >= 0.8:
            # Good match within lookahead window.
            used_indices.add(best_idx)
            last_idx       = best_idx
            real_idx       = filtered_positions[best_idx]
            original_word  = surah_words[real_idx]
            global_word_id = starting_id + real_idx
            matched_word_ids.append(str(global_word_id))

            if remove_harakat(original_word) != tw_norm:
                # Matched positionally but spelling differs → wrong word.
                mapped.append(f"({tw}) {original_word}")
                mismatches.append((tw, original_word))
                wrong_word_ids.append(str(global_word_id))
            else:
                mapped.append(original_word)
        else:
            # No match in lookahead window → substitution error at next expected position.
            # Advance last_idx so subsequent words stay in sync.
            next_idx = last_idx + 1
            if next_idx < len(filtered_words):
                real_idx       = filtered_positions[next_idx]
                original_word  = surah_words[real_idx]
                global_word_id = starting_id + real_idx
                matched_word_ids.append(str(global_word_id))
                mismatches.append((tw, original_word))
                wrong_word_ids.append(str(global_word_id))
                mapped.append(f"({tw}) {original_word}")
                used_indices.add(next_idx)
                last_idx = next_idx
            else:
                mapped.append(tw)

    return " ".join(mapped), mismatches, matched_word_ids, wrong_word_ids, last_idx


def find_closest_verse(transcription, surah_verses):
    """Return the closest verse text and its 1-based index."""
    norm_trans  = remove_harakat(transcription)
    norm_verses = [remove_harakat(v) for v in surah_verses]
    matches     = difflib.get_close_matches(norm_trans, norm_verses, n=1, cutoff=0.3)
    if matches:
        idx = norm_verses.index(matches[0])
        return surah_verses[idx], idx + 1   # 1-based ayah number
    return None, None


# Maximum audio duration fed to Whisper per chunk (seconds at 16kHz).
# Whisper degrades on very long inputs — attention spreads thin past ~15s,
# causing repetition loops and missed words on long ayahs.
MAX_WHISPER_SECONDS = 15
MAX_WHISPER_SAMPLES = MAX_WHISPER_SECONDS * 16000  # 240 000 samples

# Minimum RMS energy threshold.  Chunks whose RMS is below this are silent
# (or near-silent) and must not be sent to Whisper — Whisper hallucinates on
# silence, producing fake words that advance the session position.
SILENCE_RMS_THRESHOLD = 0.009


def is_silent(speech_array: np.ndarray) -> bool:
    """Return True if the chunk is too quiet to contain real speech."""
    rms = float(np.sqrt(np.mean(speech_array ** 2)))
    print(f"Audio RMS: {rms:.5f} (threshold {SILENCE_RMS_THRESHOLD})")
    return rms < SILENCE_RMS_THRESHOLD


def transcribe_audio_array(speech_array):
    """Run Whisper inference on a float32 16kHz mono array."""
    # Trim to the most recent MAX_WHISPER_SECONDS to keep attention focused.
    if len(speech_array) > MAX_WHISPER_SAMPLES:
        speech_array = speech_array[-MAX_WHISPER_SAMPLES:]

    input_features = processor.feature_extractor(
        speech_array,
        sampling_rate=16000,
        return_tensors="pt"
    ).input_features.to(DEVICE)

    with torch.no_grad():
        predicted_ids = model.generate(
            input_features=input_features,
            # Prevent repetition loops — the single biggest source of hallucination
            # on long ayahs where Whisper loses confidence and repeats tokens.
            no_repeat_ngram_size=3,
            # Do not condition each token on previously generated text; avoids
            # the model "completing" a familiar phrase rather than transcribing audio.
            condition_on_prev_tokens=False,
        )

    if DEVICE == "mps":
        torch.mps.empty_cache()
    elif DEVICE == "cuda":
        torch.cuda.empty_cache()

    return processor.tokenizer.decode(predicted_ids[0], skip_special_tokens=True)


def load_audio_from_bytes(audio_bytes, fmt="webm"):
    """Convert raw audio bytes → float32 16kHz mono numpy array."""
    buf = BytesIO(audio_bytes)
    segment = AudioSegment.from_file(buf, format=fmt)
    wav_buf = BytesIO()
    segment.export(wav_buf, format="wav")
    wav_buf.seek(0)
    speech_array, _ = librosa.load(
        wav_buf,
        sr=16000,
        mono=True,
        dtype=np.float32,
        res_type="soxr_hq",
    )
    return speech_array


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return "Whisper Real-time Transcription Server"


@app.route("/transcribe", methods=["POST"])
def transcribe_audio():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file    = request.files["audio"]
    speech_array  = load_audio_from_bytes(audio_file.read(), fmt="wav")
    transcription = transcribe_audio_array(speech_array)
    print(f"Transcription: {transcription}")
    return jsonify({"text": transcription})


# ── Socket.IO events ──────────────────────────────────────────────────────────

@socketio.on("connect")
def handle_connect():
    print("Client connected:", request.sid)
    emit("connect_message", {"message": "Connected successfully to server!"})


@socketio.on("disconnect")
def handle_disconnect():
    sid = request.sid
    session_state.pop(sid, None)
    print("Client disconnected:", sid)


@socketio.on("live_audio")
def handle_live_audio(data):
    if "audio" not in data or "surah" not in data:
        emit("live_transcription", {"error": "Missing audio or surah data"})
        return

    sid         = request.sid
    surah_name  = data["surah"]
    audio_chunk = data["audio"]
    print(f"Received audio for: {surah_name}")

    surah_verses, surah_words = load_surah_files(surah_name)
    if surah_verses is None:
        emit("live_transcription", {"error": f"Surah {surah_name} not found"})
        return

    # Resolve forward-search start position for this session.
    prev        = session_state.get(sid, {})
    start_index = 0 if prev.get("surah") != surah_name else prev.get("last_index", 0)

    try:
        # audio_chunk may arrive as bytes, bytearray, or a list of ints from Socket.IO.
        if isinstance(audio_chunk, (bytes, bytearray)):
            raw_bytes = bytes(audio_chunk)
        else:
            raw_bytes = bytes(bytearray(audio_chunk))
        speech_array = load_audio_from_bytes(raw_bytes)

        # Skip silent chunks entirely — Whisper hallucinates on silence and
        # would advance the session position without any real speech.
        if is_silent(speech_array):
            print("Silent chunk — skipping transcription.")
            return

        transcription = transcribe_audio_array(speech_array)
        print(f"Transcription: {transcription}")

        # Whisper sometimes returns an empty string on near-silent audio that
        # passed the energy gate.  Nothing useful to do with an empty transcript.
        if not transcription.strip():
            print("Empty transcription — skipping.")
            return

        mapped_text, mismatches, matched_word_ids, wrong_word_ids, last_idx = map_transcription_words(
            transcription, surah_words, surah_name, start_index=start_index
        )

        closest_verse, ayah_number = find_closest_verse(mapped_text, surah_verses)
        print(f"Closest verse: {closest_verse} (ayah {ayah_number})")

        surah_number  = int(surah_name.replace("surah_", ""))
        matched_ayah  = find_matched_ayah(surah_name, matched_word_ids)

        # Fallback: use verse-match ayah number if word matching didn't land
        if matched_ayah is None and ayah_number is not None:
            matched_ayah = {"sura": surah_number, "ayah": ayah_number}

        # Advance position word-by-word. The frontend resets its audio buffer
        # after every successful chunk so last_index is the only state needed.
        new_index = max(start_index, last_idx + 1)
        session_state[sid] = {"surah": surah_name, "last_index": new_index}
        print(f"Session {sid}: last_index → {new_index}")

        payload = {
            "text":             mapped_text,
            "closest_verse":    closest_verse or "",
            "mismatched_words": mismatches,
            "surah_name":       surah_name,
            "matched_word_ids": matched_word_ids,
            "wrong_word_ids":   wrong_word_ids,
            # Tell the frontend to reset its audio buffer after every chunk
            # so the next MediaRecorder starts with a fresh WebM header.
            "buffer_reset":     True,
        }
        if matched_ayah:
            payload["matched_ayah"] = matched_ayah

        emit("live_transcription", payload)

    except Exception as e:
        print(f"Error processing audio: {e}")
        emit("live_transcription", {"error": str(e)})


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5001, debug=False, use_reloader=False)
