import os
import re
import wave
import json
import torch
import difflib # Import difflib to compare strings
import librosa
import tempfile
import threading
import   numpy       as np
import soundfile     as sf  # Use soundfile to save audio
from   flask_cors   import CORS
from      io        import BytesIO
from     pydub      import AudioSegment
from    difflib     import SequenceMatcher
from flask_socketio import SocketIO, emit
from     flask      import Flask, request, jsonify
from  transformers  import WhisperProcessor, WhisperForConditionalGeneration

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
CORS(app,resources={r"/transcribe": {"origins": "*"}})


processor = WhisperProcessor.from_pretrained("distil_whisper_large_ama")
model = WhisperForConditionalGeneration.from_pretrained("distil_whisper_large_ama/checkpoint-1500")
model.to("cuda")
forced_decoder_ids = processor.get_decoder_prompt_ids(language="arabic", task="transcribe")

# Load ayah word ranges
with open('/content/drive/MyDrive/server/ayah_ranges.json', 'r', encoding='utf-8') as f:
    AYAH_DATA = json.load(f)

# Surah List
SURAH_LIST = {
    78: "سورة النبأ",
    79: "سورة النازعات",
    80: "سورة عبس",
    81: "سورة التكوير",
    82: "سورة الانفطار",
    83: "سورة المطففين",
    84: "سورة الانشقاق",
    85: "سورة البروج",
    86: "سورة الطارق",
    87: "سورة الأعلى",
    88: "سورة الغاشية",
    89: "سورة الفجر",
    90: "سورة البلد",
    91: "سورة الشمس",
    92: "سورة الليل",
    93: "سورة الضحى",
    94: "سورة الشرح",
    95: "سورة التين",
    96: "سورة العلق",
    97: "سورة القدر",
    98: "سورة البينة",
    99: "سورة الزلزلة",
    100: "سورة العاديات",
    101: "سورة القارعة",
    102: "سورة التكاثر",
    103: "سورة العصر",
    104: "سورة الهمزة",
    105: "سورة الفيل",
    106: "سورة قريش",
    107: "سورة الماعون",
    108: "سورة الكوثر",
    109: "سورة الكافرون",
    110: "سورة النصر",
    111: "سورة المسد",
    112: "سورة الإخلاص",
    113: "سورة الفلق",
    114: "سورة الناس",
}

SURAH_STARTING_WORD_ID = {
    "surah_1": 1,
    "surah_78": 1,
    "surah_79": 73,
    "surah_80": 1,
    "surah_81": 1,
    "surah_82": 1,
    "surah_83": 83,
    "surah_84": 10,
    "surah_85": 1,
    "surah_86": 1,
    "surah_87": 62,
    "surah_88": 16,
    "surah_89": 1,
    "surah_90": 29,
    "surah_91": 1,
    "surah_92": 55,
    "surah_93": 27,
    "surah_94": 67,
    "surah_95": 1,
    "surah_96": 35,
    "surah_97": 1,
    "surah_98": 31,
    "surah_99": 24,
    "surah_100": 60,
    "surah_101": 10,
    "surah_102": 46,
    "surah_103": 1,
    "surah_104": 15,
    "surah_105": 49,
    "surah_106": 1,
    "surah_107": 18,
    "surah_108": 43,
    "surah_109": 1,
    "surah_110": 27,
    "surah_111": 45,
    "surah_112": 1,
    "surah_113": 16,
    "surah_114": 39
}

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

def load_surah_files(surah_name):
    """Load the correct Surah's word and verse files."""
    # verse_file = os.path.join(SURAH_DATA_PATH, f"{surah_name}_verses.txt")
    # word_file = os.path.join(SURAH_DATA_PATH, f"{surah_name}_words.txt")

    # Construct file paths
    word_file = f"/content/drive/MyDrive/server/surahs_word_no_harakat/{surah_name}.txt"
    verse_file = f"/content/drive/MyDrive/server/surahs_versus_no_harakat/{surah_name}.txt"

    if not os.path.exists(verse_file) or not os.path.exists(word_file):
        print(f"Error: Missing files for Surah {surah_name}")
        return None, None

    with open(verse_file, "r", encoding="utf-8") as vf:
        surah_verses = vf.readlines()

    with open(word_file, "r", encoding="utf-8") as wf:
        surah_words = [line.strip() for line in wf.readlines()]

    return surah_verses, surah_words

def remove_harakat(text):
    """Remove Harakat (Tashkeel) from Arabic text for better comparison."""
    harakat_pattern = re.compile(r'[\u064B-\u065F\u0610-\u061A]')
    return harakat_pattern.sub('', text)

def find_closest_word(transcription_word, words):
    """Find the closest matching word to the given transcription word."""
    best_match = None
    best_score = 0.0
    for word in words:
        similarity = difflib.SequenceMatcher(None, transcription_word, word).ratio()
        if similarity > best_score:
            best_score = similarity
            best_match = word
    print(f"Comparing '{transcription_word}' with '{best_match}' (score: {best_score})")  # Debugging
    return best_match if best_match else transcription_word

def map_transcription_words(transcription, words):
    """Map transcribed words to the closest Quranic words."""
    transcription_words = transcription.split()
    mismatches = []
    mapped_transcription = []

    normalized_words = [remove_harakat(word) for word in words]

    for word in transcription_words:
        closest_word = find_closest_word(word, normalized_words)

        if closest_word != word:
            original_word = words[normalized_words.index(closest_word)]
            mapped_transcription.append(f"({word}) {original_word}")
            mismatches.append((word, original_word))
        else:
            original_word = words[normalized_words.index(closest_word)]
            mapped_transcription.append(original_word)

    print(f"Mapped Transcription: {' '.join(mapped_transcription)}")  # Debugging
    print(f"Mismatches: {mismatches}")  # Debugging
    return ' '.join(mapped_transcription), mismatches

def compare_transcription_with_verses(transcription, surah_verses):
    """Find the closest Quranic verse to the transcribed text."""
    closest_verse = difflib.get_close_matches(transcription, surah_verses, n=1)
    return closest_verse[0] if closest_verse else "No close verse found"



def find_best_matching_window(trans_text, quran_words, starting_word_id, window_size=7):
    """Find best matching window of Quran words to transcription text."""
    best_score = 0
    best_window_start = None

    for start_idx in range(len(quran_words)):
        for end_idx in range(start_idx+1, min(start_idx+window_size+1, len(quran_words)+1)):
            phrase = " ".join(quran_words[start_idx:end_idx])
            score = SequenceMatcher(None, trans_text, phrase).ratio()
            if score > best_score:
                best_score = score
                best_window_start = (start_idx, end_idx)

    if best_window_start and best_score > 0.75:
        start_idx, end_idx = best_window_start
        matched_ids = [str(starting_word_id + idx) for idx in range(start_idx, end_idx)]
        return matched_ids
    else:
        return []


@socketio.on('connect')
def handle_connect():
    print("Client connected")
    # Emit a connection message to the client
    emit('connect_message', {'message': 'Connected successfully to server!'})

@socketio.on('disconnect')
def handle_disconnect():
    print("Client disconnected")

@socketio.on('live_audio')
def handle_live_audio(data):
    if 'audio' not in data or 'surah' not in data:
        emit('live_transcription', {'error': 'Missing audio or Surah data'})
        return

    surah_name = data['surah']
    audio_chunk = data['audio']
    print(f"Received audio for Surah: {surah_name}")

    surah_verses, surah_words = load_surah_files(surah_name)
    if surah_verses is None or surah_words is None:
        emit('live_transcription', {'error': f'Surah {surah_name} not found'})
        return

    audio_file = BytesIO(audio_chunk)

    try:
        audio_segment = AudioSegment.from_file(audio_file, format="ogg")
        wav_buffer = BytesIO()
        audio_segment.export(wav_buffer, format="wav")
        wav_buffer.seek(0)

        speech_array, _ = librosa.load(
            wav_buffer,
            sr=16000,
            mono=True,
            dtype=np.float32,
            res_type='soxr_hq'
        )

        input_features = processor.feature_extractor(
            speech_array,
            sampling_rate=16000,
            return_tensors="pt"
        ).input_features.to("cuda")

        with torch.amp.autocast(device_type="cuda"):
            predicted_ids = model.generate(input_features=input_features)

        torch.cuda.empty_cache()
        transcription = processor.tokenizer.decode(predicted_ids[0], skip_special_tokens=True)
        print(f'Live Transcription: {transcription}')

        mapped_transcription, mismatches = map_transcription_words(transcription, surah_words)
        closest_verse = compare_transcription_with_verses(mapped_transcription, surah_verses)
        print("Mapped Transcription:", mapped_transcription)
        print("Closest Verse:", closest_verse)

        starting_word_id = SURAH_STARTING_WORD_ID.get(surah_name, 1)

        matched_word_ids = []

        # Prepare: Skip ayah numbers from surah_words
        filtered_quran_words = []
        real_word_positions = []

        for idx, word in enumerate(surah_words):
            if not word.strip().isdigit():
                filtered_quran_words.append(remove_harakat(word))
                real_word_positions.append(idx)  # Real index inside original list

        normalized_transcription_words = [remove_harakat(w) for w in transcription.split()]

        # Match transcription words
        used_indices = set()
        last_used_index = -1  # Track last matched word index

        for trans_word in normalized_transcription_words:
            best_match_idx = None
            best_score = 0.0

            # Start search from next word after last matched
            for i in range(last_used_index + 1, len(filtered_quran_words)):
                if i in used_indices:
                    continue
                score = difflib.SequenceMatcher(None, trans_word, filtered_quran_words[i]).ratio()
                if score > best_score:
                    best_score = score
                    best_match_idx = i

            # fallback to full scan if no match in forward search
            if best_match_idx is None or best_score < 0.8:
                for i in range(len(filtered_quran_words)):
                    if i in used_indices:
                        continue
                    score = difflib.SequenceMatcher(None, trans_word, filtered_quran_words[i]).ratio()
                    if score > best_score:
                        best_score = score
                        best_match_idx = i

            if best_match_idx is not None and best_score > 0.8:
                used_indices.add(best_match_idx)
                last_used_index = best_match_idx
                true_idx = real_word_positions[best_match_idx]
                corrected_word_id = SURAH_STARTING_WORD_ID.get(surah_name, 1) + true_idx
                matched_word_ids.append(str(corrected_word_id))

        print("Normalized Transcribed Words:", normalized_transcription_words)
        #print("Normalized Quran Words:", normalized_quran_words[:10])
        print("Matched Word IDs:", matched_word_ids, surah_name)


        match = re.match(r"(\d+)\|(\d+)\|(.*)", closest_verse.strip())
        if match:
            matched_sura, matched_ayah, _ = int(match.group(1)), int(match.group(2)), match.group(3)
            # ✅ EMIT WITH matched_ayah
            emit('live_transcription', {
                'text': mapped_transcription,
                'closest_verse': closest_verse,
                'mismatched_words': mismatches,
                'surah_name': surah_name,
                'matched_ayah': {
                    'sura': matched_sura,
                    'ayah': matched_ayah
                },
                'matched_word_ids': matched_word_ids
            })
        else:
            print("Regex failed. Sending fallback emit.")
            # ✅ EMIT WITHOUT matched_ayah
            emit('live_transcription', {
                'text': mapped_transcription,
                'closest_verse': closest_verse,
                'mismatched_words': mismatches,
                'surah_name': surah_name,
                'matched_word_ids': matched_word_ids
            })

    except Exception as e:
        print(f"Error processing audio: {e}")
        emit('live_transcription', {'error': f'Error processing audio: {e}'})




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

    # with torch.cuda.amp.autocast():
    with torch.amp.autocast(device_type="cuda"):
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