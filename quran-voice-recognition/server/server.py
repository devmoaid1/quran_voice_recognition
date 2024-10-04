from flask import Flask, request, jsonify
from pydub import AudioSegment
import os
import tempfile
from transformers import WhisperProcessor, WhisperForConditionalGeneration
import librosa
import numpy as np
import wave
import soundfile as sf  # Use soundfile to save audio 
from flask_cors import CORS
import torch
app = Flask(__name__) 
CORS(app)


processor = WhisperProcessor.from_pretrained("distil_whisper_large_ama")
model = WhisperForConditionalGeneration.from_pretrained("distil_whisper_large_ama/checkpoint-500")
model.to("cuda")
forced_decoder_ids = processor.get_decoder_prompt_ids(language="arabic", task="transcribe")

@app.route('/')
def index():
    return "Whisper Real-time Transcription Server" 

def save_wav_file(audio_data, filename, channels=1, rate=16000):
    """Save raw audio data as a WAV file."""
    with wave.open(filename, 'wb') as wav_file:
        wav_file.setnchannels(channels)  # Mono
        wav_file.setsampwidth(2)  # 16-bit samples
        wav_file.setframerate(rate)
        wav_file.writeframes(audio_data) 
        
@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400

    audio_file = request.files['audio']
    # Process the audio file (e.g., transcribe it)
    print(audio_file)
    
    # Load the audio file using pydub
    audio = AudioSegment.from_file(audio_file)
    
     # Save the audio file in a specified format (e.g., WAV)
    save_path =  'saved_audio.wav'
    audio.export(save_path, format='wav')
    # Load audio with librosa
    speech_array, original_sampling_rate = librosa.load(save_path, sr=None)
        
    print(speech_array)

    # Normalize audio levels
    speech_array = speech_array / np.max(np.abs(speech_array))

    # Ensure audio is single channel (mono)
    if speech_array.ndim > 1:
        speech_array = np.mean(speech_array, axis=1)

    # Convert audio to floating-point
    speech_array = speech_array.astype(np.float32)
    
    
    print(f"Is CUDA available: {torch.cuda.is_available()}")
    print(f"Number of CUDA devices: {torch.cuda.device_count()}")
    print(f"Current CUDA device: {torch.cuda.current_device()}")
    
   # Resample audio
    target_sampling_rate = 16000
    if original_sampling_rate != target_sampling_rate:
        speech_array = librosa.resample(speech_array, orig_sr=original_sampling_rate, target_sr=target_sampling_rate)
    
    
    try:
        print("Extracting features and moving to CUDA...")
        input_features = processor.feature_extractor(
            speech_array, 
            sampling_rate=target_sampling_rate, 
            return_tensors="pt"
        ).input_features.to("cuda")
        print("Features exported to CUDA successfully.")
    except Exception as e:
        print(f"Error during feature extraction or CUDA transfer: {e}")

    # You may add noise reduction here if needed
    print(f"Code reached this point = > {input_features}")
    
    with torch.cuda.amp.autocast():
        predicted_ids = model.generate(input_features=input_features)

    torch.cuda.empty_cache()

    # Decode token ids to text
    transcription = processor.tokenizer.decode(predicted_ids[0], skip_special_tokens=True)
    print(f"transcription is :{transcription}")
    print("connected")
    # Send the transcription back to the client
    return jsonify({'text': transcription})
    



if __name__ == '__main__':
    # # Create the 'saved_audios' directory if it doesn't exist
    # os.makedirs('saved_audios', exist_ok=True)
    app.run(debug=True, use_reloader=False)  # Disable the use of reloader