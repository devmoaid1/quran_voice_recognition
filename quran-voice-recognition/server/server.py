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

app = Flask(__name__) 
CORS(app,resources={r"/transcribe": {"origins": "*"}})


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
        
@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400

    audio_file = request.files['audio']
    # Process the audio file (e.g., transcribe it)
    
    # Load the audio file using pydub
    audio = AudioSegment.from_file(audio_file)
    
     # Save the audio file in a specified format (e.g., WAV)
    save_path =  'saved_audio.wav'
    audio.export(save_path, format='wav')
    # Load audio with librosa
    speech_array, original_sampling_rate = librosa.load(save_path, sr=None)
        

    # Normalize audio levels
    speech_array = speech_array / np.max(np.abs(speech_array))

    # Ensure audio is single channel (mono)
    if speech_array.ndim > 1:
        speech_array = np.mean(speech_array, axis=1)

    # Convert audio to floating-point
    speech_array = speech_array.astype(np.float32)
    
    
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

    
    with torch.cuda.amp.autocast():
        predicted_ids = model.generate(input_features=input_features)

    torch.cuda.empty_cache()
    
    transcription = processor.tokenizer.decode(predicted_ids[0], skip_special_tokens=True)
    
    print(f'This is the original transcription : {transcription}')
    
  # Load the words from the new word file
    word_file_path = 'words_ama.txt'  # Replace this with the actual path to your word file
    words = load_words(word_file_path)

    # Map each word from the transcription to the closest word in the word file
    final_transcription = map_transcription_words(transcription, words)
    
    print(f"Final transcription: {final_transcription}")

    # Send the final transcription back to the client
    return jsonify({'text': final_transcription})
    



if __name__ == '__main__':
    # # Create the 'saved_audios' directory if it doesn't exist
    # os.makedirs('saved_audios', exist_ok=True)
    app.run(host='0.0.0.0',port=5000,debug=True, use_reloader=False)  # Disable the use of reloader