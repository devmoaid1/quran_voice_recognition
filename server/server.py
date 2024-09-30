from flask import Flask, request
from flask_socketio import SocketIO, emit
import os
import tempfile
from transformers import WhisperProcessor, WhisperForConditionalGeneration
import librosa

app = Flask(__name__) 

socketio = SocketIO(app, cors_allowed_origins="*")  # Enable WebSocket



@app.route('/')
def index():
    return "Whisper Real-time Transcription Server" 
if __name__ == '__main__':
    socketio.run(app, debug=True)