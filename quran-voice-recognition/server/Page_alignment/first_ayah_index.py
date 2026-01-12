import os
import json

# ✅ Updated path to your directory
DATA_DIR = '../public/NEW_fixed_quran_pages'

# Optional: Arabic Surah names as comments
SURAH_LIST = {
    1: "الفاتحة", 2: "البقرة", 3: "آل عمران", 4: "النساء", 5: "المائدة", 6: "الأنعام", 7: "الأعراف",
    8: "الأنفال", 9: "التوبة", 10: "يونس", 11: "هود", 12: "يوسف", 13: "الرعد", 14: "إبراهيم",
    15: "الحجر", 16: "النحل", 17: "الإسراء", 18: "الكهف", 19: "مريم", 20: "طه", 21: "الأنبياء",
    22: "الحج", 23: "المؤمنون", 24: "النور", 25: "الفرقان", 26: "الشعراء", 27: "النمل", 28: "القصص",
    29: "العنكبوت", 30: "الروم", 31: "لقمان", 32: "السجدة", 33: "الأحزاب", 34: "سبإ", 35: "فاطر",
    36: "يس", 37: "الصافات", 38: "ص", 39: "الزمر", 40: "غافر", 41: "فصلت", 42: "الشورى",
    43: "الزخرف", 44: "الدخان", 45: "الجاثية", 46: "الأحقاف", 47: "محمد", 48: "الفتح", 49: "الحجرات",
    50: "ق", 51: "الذاريات", 52: "الطور", 53: "النجم", 54: "القمر", 55: "الرحمن", 56: "الواقعة",
    57: "الحديد", 58: "المجادلة", 59: "الحشر", 60: "الممتحنة", 61: "الصف", 62: "الجمعة", 63: "المنافقون",
    64: "التغابن", 65: "الطلاق", 66: "التحريم", 67: "الملك", 68: "القلم", 69: "الحاقة", 70: "المعارج",
    71: "نوح", 72: "الجن", 73: "المزمل", 74: "المدثر", 75: "القيامة", 76: "الإنسان", 77: "المرسلات",
    78: "النبأ", 79: "النازعات", 80: "عبس", 81: "التكوير", 82: "الانفطار", 83: "المطففين",
    84: "الانشقاق", 85: "البروج", 86: "الطارق", 87: "الأعلى", 88: "الغاشية", 89: "الفجر", 90: "البلد",
    91: "الشمس", 92: "الليل", 93: "الضحى", 94: "الشرح", 95: "التين", 96: "العلق", 97: "القدر",
    98: "البينة", 99: "الزلزلة", 100: "العاديات", 101: "القارعة", 102: "التكاثر", 103: "العصر",
    104: "الهمزة", 105: "الفيل", 106: "قريش", 107: "الماعون", 108: "الكوثر", 109: "الكافرون",
    110: "النصر", 111: "المسد", 112: "الإخلاص", 113: "الفلق", 114: "الناس"
}

surah_start_words = {}

for page_num in range(1, 605):
    file_path = os.path.join(DATA_DIR, f"page_{page_num}_ayahs_updated.json")

    if not os.path.exists(file_path):
        continue

    with open(file_path, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
            page = data.get(str(page_num), {})
            ayah_data = page.get("ayahData", [])

            for ayah in ayah_data:
                if int(ayah.get("ayahID")) == 1:
                    surah_id = int(ayah.get("surahID"))
                    ayah_begin = int(ayah.get("ayah_begin"))
                    if surah_id not in surah_start_words:
                        surah_start_words[surah_id] = ayah_begin

        except Exception as e:
            print(f"Error reading page {page_num}: {e}")

# ✅ Final formatted output
print("\n# ✅ Surah starting word IDs\n")
for surah_id in range(1, 115):
    word_id = surah_start_words.get(surah_id)
    name = SURAH_LIST.get(surah_id, "")
    if word_id is not None:
        print(f'"surah_{surah_id}": {word_id},  # {name}')
    else:
        print(f'"surah_{surah_id}": null,  # {name} (Not found)')
