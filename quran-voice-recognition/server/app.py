# app.py
import json
import numpy as np
import librosa
from flask_socketio import SocketIO, emit
from flask import Flask, request
from io import BytesIO
from pydub import AudioSegment
from flask_cors import CORS
import threading

from asr import transcribe
from alignment_engine import QuranAlignmentEngine, normalize
from session import SessionManager


# ================= LOAD QURAN =================

with open("/content/drive/MyDrive/server/hafs_smart_v8.json", "r", encoding="utf-8") as f:
    QURAN_DATA = json.load(f)

engine = QuranAlignmentEngine(QURAN_DATA)
sessions = SessionManager()


# ================= FLASK =================

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
CORS(app)


@app.route("/")
def index():
    return "Quran Real-time Alignment Server"


# ================= SOCKET EVENTS =================

@socketio.on("connect")
def handle_connect():
    print("Client connected")
    emit("connect_message", {"message": "Connected successfully"})


@socketio.on("disconnect")
def handle_disconnect():
    print("Client disconnected")


@socketio.on("live_audio")
def handle_live_audio(data):
    sid = request.sid

    audio_bytes = data.get("audio")
    if not audio_bytes:
        emit("live_transcription", {"error": "No audio received"})
        return

    # Decode audio
    audio = AudioSegment.from_file(BytesIO(audio_bytes), format="ogg")
    wav = BytesIO()
    audio.export(wav, format="wav")
    wav.seek(0)

    audio_np, _ = librosa.load(
        wav,
        sr=16000,
        mono=True,
        dtype=np.float32
    )

    # ===== ASR =====
    text = transcribe(audio_np)
    if not text:
        return

    spoken_words = normalize(text).split()

    # ===== SESSION =====
    session = sessions.get(sid)

    # ===== ALIGNMENT =====
    matches, new_pos = engine.align(spoken_words, session.word_pos)
    sessions.update(sid, new_pos)

    matched_word_ids = []
    wrong_word_ids = []
    matched_ayah = None

    for _, qword, ok in matches:
        if not qword:
            continue

        wid = str(qword.global_id)

        if ok:
            matched_word_ids.append(wid)
            matched_ayah = {
                "sura": qword.sura,
                "ayah": qword.ayah
            }
        else:
            wrong_word_ids.append(wid)

    emit("live_transcription", {
        "text": text,
        "matched_word_ids": matched_word_ids,
        "wrong_word_ids": wrong_word_ids,
        "matched_ayah": matched_ayah
    })


# ================= RUN =================

def run_server():
    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=True,
        use_reloader=False
    )


server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()
