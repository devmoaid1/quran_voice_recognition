# import json
# import os
# from collections import defaultdict

# INPUT_JSON   = "data/hafs_smart_v8.json"
# AYAH_RANGES  = "ayah_ranges.json"
# OUTPUT_DIR   = "../public/fixed_updated_quran_pages"

# # Load data
# with open(INPUT_JSON, "r", encoding="utf-8") as f:
#     rows = json.load(f)
# with open(AYAH_RANGES, "r", encoding="utf-8") as f:
#     ayah_ranges = json.load(f)

# pages = defaultdict(lambda: {
#     "surah_number": [],
#     "pageData": [],
#     "wordData": {},
#     "ayahData": []
# })

# word_id = 1
# line_word_map = defaultdict(list)

# # Step 1: wordData + ayahData + surah_number
# for r in rows:
#     p     = int(r["page"])
#     s     = int(r["sura_no"])
#     a     = int(r["aya_no"])
#     j     = int(r["jozz"])
#     ls, le= int(r["line_start"]), int(r["line_end"])
#     txt   = r["aya_text"]

#     if s not in pages[p]["surah_number"]:
#         pages[p]["surah_number"].append(s)

#     ids = []
#     for w in txt.split():
#         pages[p]["wordData"][str(word_id)] = w
#         ids.append(word_id)
#         word_id += 1

#     pages[p]["ayahData"].append({
#         "surahID":    s,
#         "ayahID":     a,
#         "ayah_begin": ids[0],
#         "ayah_end":   ids[-1],
#         "jozz":       j
#     })

#     # ✅ Distribute words across lines to prevent duplication
#     lines_spanned = le - ls + 1
#     words_per_line = len(ids) // lines_spanned
#     remainder = len(ids) % lines_spanned
#     idx = 0
#     for i in range(lines_spanned):
#         count = words_per_line + (1 if i < remainder else 0)
#         chunk = ids[idx:idx+count]
#         line_word_map[(p, ls + i)].extend(chunk)
#         idx += count

# # Step 2: build initial pageData (only ayah lines)
# for (p, L), ids in sorted(line_word_map.items()):
#     if not ids: continue
#     pages[p]["pageData"].append({
#         "line_number": None,
#         "line_type":   "ayah",
#         "first_word_id": ids[0],
#         "last_word_id":  ids[-1],
#         "text":         None,
#         "is_centered": False
#     })

# # Step 3: insert surah_name + basmallah before Ayah 1
# for p, data in pages.items():
#     pd = data["pageData"]
#     for s in data["surah_number"]:
#         a1 = next((a for a in data["ayahData"] if a["surahID"] == s and a["ayahID"] == 1), None)
#         if not a1: continue
#         b = a1["ayah_begin"]
#         idx = next((i for i, line in enumerate(pd) if line["first_word_id"] == b), None)
#         if idx is None: continue

#         pd.insert(idx, {
#             "line_number": None,
#             "line_type": "surah_name",
#             "first_word_id": None,
#             "last_word_id": None,
#             "text": None,
#             "is_centered": True
#         })
#         idx += 1

#         if s not in [1, 9]:
#             pd.insert(idx, {
#                 "line_number": None,
#                 "line_type": "basmallah",
#                 "first_word_id": None,
#                 "last_word_id": None,
#                 "text": None,
#                 "is_centered": True
#             })

#     for i, line in enumerate(pd, start=1):
#         line["line_number"] = i

# # Step 4: Custom JSON formatter (no trailing commas)
# def custom_json_dump(data, file):
#     def serialize_entry(obj):
#         if isinstance(obj, dict):
#             return "{ " + ", ".join(f'"{k}": {json.dumps(v, ensure_ascii=False)}' for k, v in obj.items()) + " }"
#         return json.dumps(obj, ensure_ascii=False)

#     for key, value in data.items():
#         file.write(f'{{\n  "{key}": {{\n')
#         last_key = list(value.keys())[-1]
#         for i, (k, v) in enumerate(value.items()):
#             is_last = (k == last_key)
#             if isinstance(v, list) and v and isinstance(v[0], dict):
#                 file.write(f'    "{k}": [\n')
#                 for j, item in enumerate(v):
#                     comma = "," if j < len(v) - 1 else ""
#                     file.write(f'      {serialize_entry(item)}{comma}\n')
#                 file.write(f'    ]{"," if not is_last else ""}\n')
#             else:
#                 dumped = json.dumps(v, ensure_ascii=False, indent=4)
#                 file.write(f'    "{k}": {dumped}{"\n" if is_last else ",\n"}')
#         file.write("  }\n}\n")

# # Step 5: Save output
# os.makedirs(OUTPUT_DIR, exist_ok=True)
# for p, data in pages.items():
#     out = {
#         str(p): {
#             "surah_number": data["surah_number"],
#             "pageData":     data["pageData"],
#             "ayahData":     data["ayahData"],
#             "wordData":     data["wordData"]
#         }
#     }
#     with open(f"{OUTPUT_DIR}/page_{p}_ayahs.json", "w", encoding="utf-8") as f:
#         custom_json_dump(out, f)

# print("✅ All pages saved — duplication fixed and surah lines inserted.")


######################################################################################################
############ Code to add a comment wiht the actual text in front of the actual index #################
# import json
# import os
# from collections import defaultdict

# INPUT_JSON   = "data/hafs_smart_v8.json"
# AYAH_RANGES  = "ayah_ranges.json"
# OUTPUT_DIR   = "../public/fixed_updated_quran_pages"

# # Load data
# with open(INPUT_JSON, "r", encoding="utf-8") as f:
#     rows = json.load(f)
# with open(AYAH_RANGES, "r", encoding="utf-8") as f:
#     ayah_ranges = json.load(f)

# pages = defaultdict(lambda: {
#     "surah_number": [],
#     "pageData": [],
#     "wordData": {},
#     "ayahData": []
# })

# word_id = 1
# line_word_map = defaultdict(list)
# emlaey_comments = {}

# # Step 1: wordData + ayahData + surah_number
# for r in rows:
#     p     = int(r["page"])
#     s     = int(r["sura_no"])
#     a     = int(r["aya_no"])
#     j     = int(r["jozz"])
#     ls, le= int(r["line_start"]), int(r["line_end"])
#     txt   = r["aya_text"]
#     emlaey_words = r["aya_text_emlaey"].split()
#     glyph_words = txt.split()

#     if s not in pages[p]["surah_number"]:
#         pages[p]["surah_number"].append(s)

#     ids = []
#     for i, w in enumerate(glyph_words):
#         pages[p]["wordData"][str(word_id)] = w
#         emlaey_comments[str(word_id)] = emlaey_words[i] if i < len(emlaey_words) else ""
#         ids.append(word_id)
#         word_id += 1

#     pages[p]["ayahData"].append({
#         "surahID":    s,
#         "ayahID":     a,
#         "ayah_begin": ids[0],
#         "ayah_end":   ids[-1],
#         "jozz":       j
#     })

#     # Distribute words across lines
#     lines_spanned = le - ls + 1
#     words_per_line = len(ids) // lines_spanned
#     remainder = len(ids) % lines_spanned
#     idx = 0
#     for i in range(lines_spanned):
#         count = words_per_line + (1 if i < remainder else 0)
#         chunk = ids[idx:idx+count]
#         line_word_map[(p, ls + i)].extend(chunk)
#         idx += count

# # Step 2: build initial pageData
# for (p, L), ids in sorted(line_word_map.items()):
#     if not ids: continue
#     pages[p]["pageData"].append({
#         "line_number": None,
#         "line_type":   "ayah",
#         "first_word_id": ids[0],
#         "last_word_id":  ids[-1],
#         "text":         None,
#         "is_centered": False
#     })

# # Step 3: insert surah_name and basmallah
# for p, data in pages.items():
#     pd = data["pageData"]
#     for s in data["surah_number"]:
#         a1 = next((a for a in data["ayahData"] if a["surahID"] == s and a["ayahID"] == 1), None)
#         if not a1: continue
#         b = a1["ayah_begin"]
#         idx = next((i for i, line in enumerate(pd) if line["first_word_id"] == b), None)
#         if idx is None: continue

#         pd.insert(idx, {
#             "line_number": None,
#             "line_type": "surah_name",
#             "first_word_id": None,
#             "last_word_id": None,
#             "text": None,
#             "is_centered": True
#         })
#         idx += 1

#         if s not in [1, 9]:
#             pd.insert(idx, {
#                 "line_number": None,
#                 "line_type": "basmallah",
#                 "first_word_id": None,
#                 "last_word_id": None,
#                 "text": None,
#                 "is_centered": True
#             })

#     for i, line in enumerate(pd, start=1):
#         line["line_number"] = i

# def custom_json_dump(data, file, emlaey_comments):
#     def serialize_entry(obj):
#         if isinstance(obj, dict):
#             return "{ " + ", ".join(f'"{k}": {json.dumps(v, ensure_ascii=False)}' for k, v in obj.items()) + " }"
#         return json.dumps(obj, ensure_ascii=False)

#     for key, value in data.items():
#         file.write(f'{{\n  "{key}": {{\n')
#         last_key = list(value.keys())[-1]
#         for i, (k, v) in enumerate(value.items()):
#             is_last = (k == last_key)
#             if k == "wordData":
#                 file.write(f'    "{k}": {{\n')
#                 word_keys = list(v.keys())
#                 for j, wid in enumerate(word_keys):
#                     is_last_word = (j == len(word_keys) - 1)
#                     word_val = json.dumps(v[wid], ensure_ascii=False)
#                     comma = "," if not is_last_word else ""
#                     comment = f' // "emlaey": "{emlaey_comments.get(wid, "")}"'
#                     file.write(f'      "{wid}": {word_val}{comma}{comment}\n')
#                 file.write(f'    }}{"," if not is_last else ""}\n')
#             elif isinstance(v, list) and v and isinstance(v[0], dict):
#                 file.write(f'    "{k}": [\n')
#                 for j, item in enumerate(v):
#                     comma = "," if j < len(v) - 1 else ""
#                     file.write(f'      {serialize_entry(item)}{comma}\n')
#                 file.write(f'    ]{"," if not is_last else ""}\n')
#             else:
#                 dumped = json.dumps(v, ensure_ascii=False, indent=4)
#                 file.write(f'    "{k}": {dumped}{"\n" if is_last else ",\n"}')
#         file.write("  }\n}\n")


# # Step 5: Save all pages
# os.makedirs(OUTPUT_DIR, exist_ok=True)
# for p, data in pages.items():
#     out = {
#         str(p): {
#             "surah_number": data["surah_number"],
#             "pageData":     data["pageData"],
#             "ayahData":     data["ayahData"],
#             "wordData":     data["wordData"]
#         }
#     }
#     with open(f"{OUTPUT_DIR}/page_{p}_ayahs.json", "w", encoding="utf-8") as f:
#         custom_json_dump(out, f, emlaey_comments)

# print("✅ All pages saved — with emlaey comments.")

import json
import os
from collections import defaultdict

INPUT_JSON   = "data/hafs_smart_v8.json"
AYAH_RANGES  = "ayah_ranges.json"
OUTPUT_DIR   = "../public/fixed_updated_quran_pages"

# Load data
with open(INPUT_JSON, "r", encoding="utf-8") as f:
    rows = json.load(f)
with open(AYAH_RANGES, "r", encoding="utf-8") as f:
    ayah_ranges = json.load(f)

pages = defaultdict(lambda: {
    "surah_number": [],
    "pageData": [],
    "wordData": {},
    "ayahData": []
})

word_id = 1
line_word_map = defaultdict(list)

# Step 1: Build wordData and ayahData
for r in rows:
    p     = int(r["page"])
    s     = int(r["sura_no"])
    a     = int(r["aya_no"])
    j     = int(r["jozz"])
    ls, le= int(r["line_start"]), int(r["line_end"])
    txt   = r["aya_text"]
    emlaey_words = r["aya_text_emlaey"].split()
    glyph_words = txt.split()

    if s not in pages[p]["surah_number"]:
        pages[p]["surah_number"].append(s)

    ids = []
    for i, w in enumerate(glyph_words):
        pages[p]["wordData"][str(word_id)] = {
            "glyph": w,
            "emlaey": emlaey_words[i] if i < len(emlaey_words) else ""
        }
        ids.append(word_id)
        word_id += 1

    pages[p]["ayahData"].append({
        "surahID":    s,
        "ayahID":     a,
        "ayah_begin": ids[0],
        "ayah_end":   ids[-1],
        "jozz":       j
    })

    # Distribute words across lines
    lines_spanned = le - ls + 1
    words_per_line = len(ids) // lines_spanned
    remainder = len(ids) % lines_spanned
    idx = 0
    for i in range(lines_spanned):
        count = words_per_line + (1 if i < remainder else 0)
        chunk = ids[idx:idx+count]
        line_word_map[(p, ls + i)].extend(chunk)
        idx += count

# Step 2: Build initial pageData
for (p, L), ids in sorted(line_word_map.items()):
    if not ids: continue
    pages[p]["pageData"].append({
        "line_number": None,
        "line_type":   "ayah",
        "first_word_id": ids[0],
        "last_word_id":  ids[-1],
        "text":         None,
        "is_centered": False
    })

# Step 3: Insert surah name and basmallah
for p, data in pages.items():
    pd = data["pageData"]
    for s in data["surah_number"]:
        a1 = next((a for a in data["ayahData"] if a["surahID"] == s and a["ayahID"] == 1), None)
        if not a1: continue
        b = a1["ayah_begin"]
        idx = next((i for i, line in enumerate(pd) if line["first_word_id"] == b), None)
        if idx is None: continue

        pd.insert(idx, {
            "line_number": None,
            "line_type": "surah_name",
            "first_word_id": None,
            "last_word_id": None,
            "text": None,
            "is_centered": True
        })
        idx += 1

        if s not in [1, 9]:  # skip for surah Fatiha and Tawbah
            pd.insert(idx, {
                "line_number": None,
                "line_type": "basmallah",
                "first_word_id": None,
                "last_word_id": None,
                "text": None,
                "is_centered": True
            })

    for i, line in enumerate(pd, start=1):
        line["line_number"] = i

# Step 4: Custom JSON writer
def custom_json_dump(data, file):
    def serialize_entry(obj):
        if isinstance(obj, dict):
            return "{ " + ", ".join(f'"{k}": {json.dumps(v, ensure_ascii=False)}' for k, v in obj.items()) + " }"
        return json.dumps(obj, ensure_ascii=False)

    for key, value in data.items():
        file.write(f'{{\n  "{key}": {{\n')
        last_key = list(value.keys())[-1]
        for i, (k, v) in enumerate(value.items()):
            is_last = (k == last_key)
            if isinstance(v, list) and v and isinstance(v[0], dict):
                file.write(f'    "{k}": [\n')
                for j, item in enumerate(v):
                    comma = "," if j < len(v) - 1 else ""
                    file.write(f'      {serialize_entry(item)}{comma}\n')
                file.write(f'    ]{"," if not is_last else ""}\n')
            else:
                dumped = json.dumps(v, ensure_ascii=False, indent=4)
                file.write(f'    "{k}": {dumped}{"\n" if is_last else ",\n"}')
        file.write("  }\n}\n")

# Step 5: Save all output files
os.makedirs(OUTPUT_DIR, exist_ok=True)
for p, data in pages.items():
    out = {
        str(p): {
            "surah_number": data["surah_number"],
            "pageData":     data["pageData"],
            "ayahData":     data["ayahData"],
            "wordData":     data["wordData"]
        }
    }
    with open(f"{OUTPUT_DIR}/page_{p}_ayahs.json", "w", encoding="utf-8") as f:
        custom_json_dump(out, f)

print("✅ All pages saved — with structured glyph + emlaey in wordData.")
