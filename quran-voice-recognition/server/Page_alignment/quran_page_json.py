import json
from pathlib import Path

# Base paths
project_root = Path(__file__).resolve().parent.parent  # Move up from server/
data_path = project_root / "public"
pages_path = data_path / "quran_pages_json"
output_path_txt = data_path / "quran_page_ayah_txt"
output_path_txt_new = data_path / "quran_page_ayah_txt_new"
output_path_json = data_path / "quran_page_ayah_json"

# Ensure output directory exists
output_path_txt.mkdir(exist_ok=True)
output_path_json.mkdir(exist_ok=True)

# Load Quran Uthmani text
quran_txt_path = data_path / "quran-uthmani.txt"
with open(quran_txt_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Build ayah lookup from text file
ayah_lookup = {}
for line in lines:
    parts = line.strip().split("|", 2)
    if len(parts) == 3:
        surah, ayah, text = parts
        ayah_lookup[f"{surah}|{ayah}"] = text

# Process each page file
for page_file in pages_path.glob("page_*.json"):
    with open(page_file, "r", encoding="utf-8") as f:
        page_data = json.load(f)

    page_number = page_data["page"]
    ayahs = page_data["ayahs"]

    txt_lines = []
    txt_lines_new = []
    json_ayahs = []

    for entry in ayahs:
        surah = entry["sura"]
        ayah = entry["ayah"]
        key = f"{surah}|{ayah}"
        text = ayah_lookup.get(key, "[MISSING]")
        txt_lines.append(f"{key}: {text}")
        txt_lines_new.append(f"{text}")
        json_ayahs.append({"sura": surah, "ayah": ayah, "text": text})

    # Write TXT file
    txt_output = output_path_txt / f"page_{page_number}_ayahs.txt"
    with open(txt_output, "w", encoding="utf-8") as f:
         f.write("\n".join(txt_lines))
        

    # Write TXT file
    txt_output = output_path_txt_new / f"page_{page_number}_ayahs.txt"
    with open(txt_output, "w", encoding="utf-8") as f:
        f.write("\n".join(txt_lines_new))

    # Write JSON file
    json_output = output_path_json / f"page_{page_number}_ayahs.json"
    with open(json_output, "w", encoding="utf-8") as f:
        json.dump({str(page_number): json_ayahs}, f, ensure_ascii=False, indent=2)

    print(f"✅ Generated files for page {page_number}")
