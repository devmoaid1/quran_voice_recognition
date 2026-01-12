# asr.py
import torch
import numpy as np
from transformers import WhisperProcessor, WhisperForConditionalGeneration

# ===== LOAD MODEL ONCE =====
PROCESSOR_PATH = "/content/drive/MyDrive/server/distil_whisper_large_test"
MODEL_PATH = "/content/drive/MyDrive/server/distil_whisper_large_test/checkpoint-1500"

processor = WhisperProcessor.from_pretrained(PROCESSOR_PATH)
model = WhisperForConditionalGeneration.from_pretrained(
    MODEL_PATH
).to("cuda").half()

forced_decoder_ids = processor.get_decoder_prompt_ids(
    language="arabic", task="transcribe"
)

def transcribe(audio_np: np.ndarray) -> str:
    """
    audio_np: float32 mono, 16kHz
    """
    input_features = processor.feature_extractor(
        audio_np,
        sampling_rate=16000,
        return_tensors="pt"
    ).input_features.to("cuda")

    with torch.amp.autocast(device_type="cuda"):
        predicted_ids = model.generate(
            input_features=input_features,
            forced_decoder_ids=forced_decoder_ids
        )

    text = processor.tokenizer.decode(
        predicted_ids[0],
        skip_special_tokens=True
    )

    torch.cuda.empty_cache()
    return text.strip()
# ==========================