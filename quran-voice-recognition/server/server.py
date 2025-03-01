import os
import wave 
import torch 
import difflib # Import difflib to compare strings
import librosa 
import tempfile
import   numpy       as np
import soundfile     as sf  # Use soundfile to save audio 
from   flask_cors  import CORS
from     pydub     import AudioSegment
from     flask     import Flask, request, jsonify
from  transformers import WhisperProcessor, WhisperForConditionalGeneration
from io import BytesIO
from flask_socketio import SocketIO, emit

app = Flask(__name__) 

socketio = SocketIO(app, cors_allowed_origins="*")
# CORS(app,resources={r"/transcribe": {"origins": "*"}})


processor = WhisperProcessor.from_pretrained("distil_whisper_large_ama")
model = WhisperForConditionalGeneration.from_pretrained("distil_whisper_large_ama/checkpoint-1000")
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
        
def load_words(file_path):
    """Load words from a text file into a list."""
    with open(file_path, 'r', encoding='utf-8') as file:
        words = [line.strip() for line in file.readlines()]
    return words

def find_closest_word(transcription_word, words):
    """Find the closest matching word to the given transcription word."""
    best_match = None
    best_score = 0.0  # Similarity score, initialized to 0 (lower bound)

    for word in words:
        diff = difflib.SequenceMatcher(None, transcription_word, word)
        similarity = diff.ratio()

        if similarity > best_score:
            best_score = similarity
            best_match = word

    return best_match if best_match else transcription_word  # Return the best match or the original transcription
        

def map_transcription_words(transcription, words):
    """Map each word from transcription to the closest word in the word list."""
    transcription_words = transcription.split()
    mapped_transcription = [find_closest_word(word, words) for word in transcription_words]
    return ' '.join(mapped_transcription)


@socketio.on('live_audio')
def handle_live_audio(data):
    # Expecting 'audio' key in the data payload containing the raw binary audio chunk.
    if 'audio' not in data:
        emit('live_transcription', {'error': 'No audio data received'})
        return

    # Convert the incoming audio data (assumed to be binary) into a BytesIO object.
    audio_chunk = data['audio']
    audio_file = BytesIO(audio_chunk)
    
    # Convert to WAV in-memory using pydub.
    audio_segment = AudioSegment.from_file(audio_file)
    wav_buffer = BytesIO()
    audio_segment.export(wav_buffer, format="wav")
    wav_buffer.seek(0)
    
    # Load the audio using librosa.
    speech_array, original_sampling_rate = librosa.load(
        wav_buffer,
        sr=16000,          # Force target sample rate
        mono=True,          # Force mono conversion
        dtype=np.float32,   # Match training dtype
        res_type='soxr_hq'  # Use high-quality resampling
    )
    
    # Resample if necessary.
    target_sampling_rate = 16000
    if original_sampling_rate != target_sampling_rate:
        speech_array = librosa.resample(
            speech_array,
            orig_sr=original_sampling_rate,
            target_sr=target_sampling_rate,
            res_type="kaiser_best"
        )
    
    try:
        print("Extracting features and moving to CUDA for live audio...")
        input_features = processor.feature_extractor(
            speech_array, 
            sampling_rate=target_sampling_rate, 
            return_tensors="pt"
        ).input_features.to("cuda")
        print("Features exported to CUDA successfully for live audio.")
    except Exception as e:
        error_message = f"Error during feature extraction or CUDA transfer in live transcription: {e}"
        print(error_message)
        emit('live_transcription', {'error': error_message})
        return
    
    # Generate transcription.
    with torch.cuda.amp.autocast():
        predicted_ids = model.generate(input_features=input_features)
    torch.cuda.empty_cache()
    
    transcription = processor.tokenizer.decode(predicted_ids[0], skip_special_tokens=True)
    print(f'Live transcription: {transcription}')
    
    # Optionally, if you want to perform word mapping as in your /transcribe endpoint:
    word_file_path = 'words_ama.txt'
    words = load_words(word_file_path)
    final_transcription = map_transcription_words(transcription, words)
    print(f"Final live transcription: {final_transcription}")
    
    # Emit the transcription back to the client.
    emit('live_transcription', {'text': transcription})
        
@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400

    audio_file = request.files['audio']
    
    # Convert to WAV in-memory
    audio_segment = AudioSegment.from_file(audio_file)
    wav_buffer = BytesIO()
    audio_segment.export(wav_buffer, format="wav")
    wav_buffer.seek(0)
    
    speech_array, original_sampling_rate = librosa.load(
        wav_buffer,
        sr=16000,          # Force target sample rate
        mono=True,          # Force mono conversion
        dtype=np.float32,   # Match training dtype
        res_type='soxr_hq'  # Match libsndfile's resampling
    )        
    
   # Resample audio
    target_sampling_rate = 16000
    if original_sampling_rate != target_sampling_rate:
        speech_array = librosa.resample(speech_array, orig_sr=original_sampling_rate, target_sr=target_sampling_rate,res_type="kaiser_best")
    
    
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

    
    with torch.cuda.amp.autocast():
        predicted_ids = model.generate(input_features=input_features)

    torch.cuda.empty_cache()
    
    transcription = processor.tokenizer.decode(predicted_ids[0], skip_special_tokens=True)
    
    print(f'This is the original transcription : {transcription}')
    
#   Load the words from the new word file
    word_file_path = 'words_ama.txt'  # Replace this with the actual path to your word file
    words = load_words(word_file_path)

    # Map each word from the transcription to the closest word in the word file
    final_transcription = map_transcription_words(transcription, words)
    
    print(f"Final transcription: {final_transcription}")

    # Send the final transcription back to the client
    return jsonify({'text': transcription})
    



if __name__ == '__main__':
    # # Create the 'saved_audios' directory if it doesn't exist
    # os.makedirs('saved_audios', exist_ok=True)
    socketio.run(app,host='0.0.0.0',port=5000,debug=True, use_reloader=False)  # Disable the use of reloader