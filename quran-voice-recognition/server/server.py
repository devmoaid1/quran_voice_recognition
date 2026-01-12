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
from    rapidfuzz   import fuzz
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

# processor = WhisperProcessor.from_pretrained("openai/whisper-base")
# model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-base").to("cuda").half()
# forced_decoder_ids = processor.get_decoder_prompt_ids(language="arabic", task="transcribe")

processor = WhisperProcessor.from_pretrained("/content/drive/MyDrive/server/distil_whisper_large_test")
model = WhisperForConditionalGeneration.from_pretrained("/content/drive/MyDrive/server/distil_whisper_large_test/checkpoint-1500").to("cuda").half()
forced_decoder_ids = processor.get_decoder_prompt_ids(language="arabic", task="transcribe")

# Load ayah word ranges
with open('/content/drive/MyDrive/server/ayah_ranges.json', 'r', encoding='utf-8') as f:
    AYAH_DATA = json.load(f)


SURAH_STARTING_WORD_ID = {
    "surah_1": 1,  # الفاتحة
    "surah_2": 30,  # البقرة
    "surah_3": 6147,  # آل عمران
    "surah_4": 9628,  # النساء
    "surah_5": 13375,  # المائدة
    "surah_6": 16179,  # الأنعام
    "surah_7": 19229,  # الأعراف
    "surah_8": 22549,  # الأنفال
    "surah_9": 23783,  # التوبة
    "surah_10": 26281,  # يونس
    "surah_11": 28114,  # هود
    "surah_12": 30031,  # يوسف
    "surah_13": 31807,  # الرعد
    "surah_14": 32661,  # إبراهيم
    "surah_15": 33491,  # الحجر
    "surah_16": 34145,  # النحل
    "surah_17": 35989,  # الإسراء
    "surah_18": 37545,  # الكهف
    "surah_19": 39124,  # مريم
    "surah_20": 40085,  # طه
    "surah_21": 41420,  # الأنبياء
    "surah_22": 42589,  # الحج
    "surah_23": 43863,  # المؤمنون
    "surah_24": 44913,  # النور
    "surah_25": 46229,  # الفرقان
    "surah_26": 47122,  # الشعراء
    "surah_27": 48440,  # النمل
    "surah_28": 49591,  # القصص
    "surah_29": 51021,  # العنكبوت
    "surah_30": 51997,  # الروم
    "surah_31": 52814,  # لقمان
    "surah_32": 53360,  # السجدة
    "surah_33": 53732,  # الأحزاب
    "surah_34": 55019,  # سبإ
    "surah_35": 55902,  # فاطر
    "surah_36": 56677,  # يس
    "surah_37": 57402,  # الصافات
    "surah_38": 58263,  # ص
    "surah_39": 58996,  # الزمر
    "surah_40": 60168,  # غافر
    "surah_41": 61387,  # فصلت
    "surah_42": 62179,  # الشورى
    "surah_43": 63039,  # الزخرف
    "surah_44": 63869,  # الدخان
    "surah_45": 64215,  # الجاثية
    "surah_46": 64703,  # الأحقاف
    "surah_47": 65346,  # محمد
    "surah_48": 65885,  # الفتح
    "surah_49": 66445,  # الحجرات
    "surah_50": 66792,  # ق
    "surah_51": 67165,  # الذاريات
    "surah_52": 67525,  # الطور
    "surah_53": 67837,  # النجم
    "surah_54": 68197,  # القمر
    "surah_55": 68539,  # الرحمن
    "surah_56": 68890,  # الواقعة
    "surah_57": 69269,  # الحديد
    "surah_58": 69843,  # المجادلة
    "surah_59": 70315,  # الحشر
    "surah_60": 70760,  # الممتحنة
    "surah_61": 71108,  # الصف
    "surah_62": 71329,  # الجمعة
    "surah_63": 71504,  # المنافقون
    "surah_64": 71684,  # التغابن
    "surah_65": 71925,  # الطلاق
    "surah_66": 72212,  # التحريم
    "surah_67": 72461,  # الملك
    "surah_68": 72794,  # القلم
    "surah_69": 73094,  # الحاقة
    "surah_70": 73352,  # المعارج
    "surah_71": 73569,  # نوح
    "surah_72": 73795,  # الجن
    "surah_73": 74080,  # المزمل
    "surah_74": 74279,  # المدثر
    "surah_75": 74534,  # القيامة
    "surah_76": 74698,  # الإنسان
    "surah_77": 74941,  # المرسلات
    "surah_78": 75122,  # النبأ
    "surah_79": 75295,  # النازعات
    "surah_80": 75474,  # عبس
    "surah_81": 75607,  # التكوير
    "surah_82": 75711,  # الانفطار
    "surah_83": 75791,  # المطففين
    "surah_84": 75960,  # الانشقاق
    "surah_85": 76067,  # البروج
    "surah_86": 76176,  # الطارق
    "surah_87": 76237,  # الأعلى
    "surah_88": 76309,  # الغاشية
    "surah_89": 76401,  # الفجر
    "surah_90": 76538,  # البلد
    "surah_91": 76620,  # الشمس
    "surah_92": 76674,  # الليل
    "surah_93": 76745,  # الضحى
    "surah_94": 76785,  # الشرح
    "surah_95": 76812,  # التين
    "surah_96": 76846,  # العلق
    "surah_97": 76918,  # القدر
    "surah_98": 76948,  # البينة
    "surah_99": 77042,  # الزلزلة
    "surah_100": 77078,  # العاديات
    "surah_101": 77118,  # القارعة
    "surah_102": 77154,  # التكاثر
    "surah_103": 77182,  # العصر
    "surah_104": 77196,  # الهمزة
    "surah_105": 77229,  # الفيل
    "surah_106": 77252,  # قريش
    "surah_107": 77269,  # الماعون
    "surah_108": 77294,  # الكوثر
    "surah_109": 77304,  # الكافرون
    "surah_110": 77330,  # النصر
    "surah_111": 77349,  # المسد
    "surah_112": 77372,  # الإخلاص
    "surah_113": 77387,  # الفلق
    "surah_114": 77410,  # الناس
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

    print("🔥 live_audio event received")

    if 'audio' not in data or 'surah' not in data:
        emit('live_transcription', {'error': 'Missing audio or Surah data'})
        return

    surah_name = data['surah']

    # Convert ArrayBuffer → numpy float32
    pcm_bytes = data['audio']
    speech_array = np.frombuffer(pcm_bytes, dtype=np.float32)

    if speech_array.size < 16000:  # < 1 sec
        print("⚠️ Chunk too small, skipping")
        return

    print(f"🎧 Received audio samples: {speech_array.shape}")


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
            predicted_ids = model.generate(input_features=input_features, forced_decoder_ids=forced_decoder_ids)

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

        # Extract wrong word IDs from mismatches
        wrong_word_ids = []
        for wrong_word, correct_word in mismatches:
            try:
                index_in_quran = surah_words.index(correct_word)
                corrected_id = SURAH_STARTING_WORD_ID.get(surah_name, 1) + index_in_quran
                wrong_word_ids.append(str(corrected_id))
            except ValueError:
                continue

        print("Normalized Transcribed Words:", normalized_transcription_words)
        #print("Normalized Quran Words:", normalized_quran_words[:10])
        print("Matched Word IDs:", matched_word_ids, surah_name)
        print("Wrong Word IDs:", wrong_word_ids, surah_name)

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
                'matched_word_ids': matched_word_ids,
                'wrong_word_ids': wrong_word_ids  # ✅ Include this
            })
        else:
            print("Regex failed. Sending fallback emit.")
            # ✅ EMIT WITHOUT matched_ayah
            emit('live_transcription', {
                'text': mapped_transcription,
                'closest_verse': closest_verse,
                'mismatched_words': mismatches,
                'surah_name': surah_name,
                'matched_word_ids': matched_word_ids,
                'wrong_word_ids': wrong_word_ids  # ✅ Include this
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

    # Send the final transcription back to the client
    return jsonify({'text': transcription})

# if __name__ == '__main__':
#     # # Create the 'saved_audios' directory if it doesn't exist
#     # os.makedirs('saved_audios', exist_ok=True)
#     socketio.run(app,host='0.0.0.0',port=5000,debug=True, use_reloader=False)  # Disable the use of reloader
def run_server():
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=False)

# Run Flask server in a separate thread
server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()
