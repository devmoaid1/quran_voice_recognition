# alignment_engine.py
import re
from typing import List
from dataclasses import dataclass
from Levenshtein import distance as levenshtein_distance

# ================= NORMALIZATION =================

def normalize(text: str) -> str:
    text = re.sub(r'[\u064B-\u065F\u0670]', '', text)
    text = re.sub(r'[^\u0621-\u063A\u0641-\u064A\s]', '', text)
    text = text.replace('ٱ', 'ا').replace('ى', 'ي').replace('ة', 'ه')
    return text.strip()

def similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return 1.0 - levenshtein_distance(a, b) / max(len(a), len(b))

# ================= DATA =================

@dataclass
class Word:
    global_id: int
    sura: int
    ayah: int
    ayah_id: int
    text: str

# ================= ENGINE =================

class QuranAlignmentEngine:
    def __init__(self, quran_json: list):
        self.words: List[Word] = []
        self._build_index(quran_json)

    def _build_index(self, data):
        gid = 0
        for aya in data:
            words = normalize(aya["aya_text_emlaey"]).split()
            for w in words:
                self.words.append(
                    Word(
                        global_id=gid,
                        sura=aya["sura_no"],
                        ayah=aya["aya_no"],
                        ayah_id=aya["id"],
                        text=w
                    )
                )
                gid += 1

    def align(self, spoken_words: List[str], anchor: int):
        matches = []
        pos = anchor

        for sw in spoken_words:
            best = None
            best_score = 0.0

            for i in range(pos, min(pos + 20, len(self.words))):
                score = similarity(sw, self.words[i].text)
                if score > best_score:
                    best = self.words[i]
                    best_score = score

            if best and best_score >= 0.75:
                matches.append((sw, best, True))
                pos = best.global_id + 1
            else:
                matches.append((sw, None, False))

        return matches, pos
# ================= UTILITIES =================