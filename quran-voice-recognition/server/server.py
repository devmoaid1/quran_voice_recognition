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


def map_transcription_words(transcription, surah_words, surah_name):
    """Fuzzy-match each transcribed word to its Quran equivalent.
    Returns (mapped_text, mismatches, matched_word_ids).
    """
    trans_words   = transcription.split()
    norm_quran    = [remove_harakat(w) for w in surah_words]
    starting_id   = SURAH_STARTING_WORD_ID.get(surah_name, 1)

    # Filter out digit-only entries (ayah markers)
    filtered_words    = []
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
    last_idx         = -1

    for tw in trans_words:
        tw_norm      = remove_harakat(tw)
        best_idx     = None
        best_score   = 0.0

        # Forward search first
        for i in range(last_idx + 1, len(filtered_words)):
            if i in used_indices:
                continue
            score = SequenceMatcher(None, tw_norm, filtered_words[i]).ratio()
            if score > best_score:
                best_score = score
                best_idx   = i

        # Fallback: full scan
        if best_idx is None or best_score < 0.8:
            for i in range(len(filtered_words)):
                if i in used_indices:
                    continue
                score = SequenceMatcher(None, tw_norm, filtered_words[i]).ratio()
                if score > best_score:
                    best_score = score
                    best_idx   = i

        if best_idx is not None and best_score > 0.8:
            # Good match — word was recognised and located in the surah.
            used_indices.add(best_idx)
            last_idx       = best_idx
            real_idx       = filtered_positions[best_idx]
            original_word  = surah_words[real_idx]
            global_word_id = starting_id + real_idx
            matched_word_ids.append(str(global_word_id))

            if remove_harakat(original_word) != tw_norm:
                mapped.append(f"({tw}) {original_word}")
                mismatches.append((tw, original_word))
                wrong_word_ids.append(str(global_word_id))
            else:
                mapped.append(original_word)
        else:
            # No match above threshold — the user said a word that doesn't resemble
            # anything in the surah at this score.  We know positionally this should
            # be the word right after the last matched one, so flag that expected word
            # as wrong (substitution error).
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

    return " ".join(mapped), mismatches, matched_word_ids, wrong_word_ids


def find_closest_verse(transcription, surah_verses):
    """Return the closest verse text and its 1-based index."""
    norm_trans  = remove_harakat(transcription)
    norm_verses = [remove_harakat(v) for v in surah_verses]
    matches     = difflib.get_close_matches(norm_trans, norm_verses, n=1, cutoff=0.3)
    if matches:
        idx = norm_verses.index(matches[0])
        return surah_verses[idx], idx + 1   # 1-based ayah number
    return None, None


def transcribe_audio_array(speech_array):
    """Run Whisper inference on a float32 16kHz mono array."""
    input_features = processor.feature_extractor(
        speech_array,
        sampling_rate=16000,
        return_tensors="pt"
    ).input_features.to(DEVICE)

    with torch.no_grad():
        predicted_ids = model.generate(input_features=input_features)

    if DEVICE == "mps":
        torch.mps.empty_cache()
    elif DEVICE == "cuda":
        torch.cuda.empty_cache()

    return processor.tokenizer.decode(predicted_ids[0], skip_special_tokens=True)


def load_audio_from_bytes(audio_bytes, fmt="ogg"):
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
    print("Client disconnected:", request.sid)


@socketio.on("live_audio")
def handle_live_audio(data):
    if "audio" not in data or "surah" not in data:
        emit("live_transcription", {"error": "Missing audio or surah data"})
        return

    surah_name  = data["surah"]
    audio_chunk = data["audio"]
    print(f"Received audio for: {surah_name}")

    surah_verses, surah_words = load_surah_files(surah_name)
    if surah_verses is None:
        emit("live_transcription", {"error": f"Surah {surah_name} not found"})
        return

    try:
        speech_array  = load_audio_from_bytes(bytes(audio_chunk))
        transcription = transcribe_audio_array(speech_array)
        print(f"Transcription: {transcription}")

        mapped_text, mismatches, matched_word_ids, wrong_word_ids = map_transcription_words(
            transcription, surah_words, surah_name
        )

        closest_verse, ayah_number = find_closest_verse(mapped_text, surah_verses)
        print(f"Closest verse: {closest_verse} (ayah {ayah_number})")

        surah_number  = int(surah_name.replace("surah_", ""))
        matched_ayah  = find_matched_ayah(surah_name, matched_word_ids)

        # Fallback: use verse-match ayah number if word matching didn't land
        if matched_ayah is None and ayah_number is not None:
            matched_ayah = {"sura": surah_number, "ayah": ayah_number}

        payload = {
            "text":            mapped_text,
            "closest_verse":   closest_verse or "",
            "mismatched_words": mismatches,
            "surah_name":      surah_name,
            "matched_word_ids": matched_word_ids,
            "wrong_word_ids":  wrong_word_ids,
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
