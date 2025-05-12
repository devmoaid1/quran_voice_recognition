import json
import os

# Load ayah ranges
with open('./ayah_ranges.json', 'r', encoding='utf-8') as f:
    ayah_ranges = json.load(f)

# Folders
input_folder = '../public/Page_structure_new'
output_folder = '../public/updated_quran_pages'
os.makedirs(output_folder, exist_ok=True)

# Pages to process
for page_num in range(582, 605):
    filename = f'page_{page_num}_ayahs.json'
    input_file = os.path.join(input_folder, filename)
    output_file = os.path.join(output_folder, filename)

    if not os.path.exists(input_file):
        print(f"⚠️ Skipping: {filename} not found.")
        continue

    with open(input_file, 'r', encoding='utf-8') as f:
        page_data = json.load(f)

    page_str = str(page_num)
    page_info = page_data[page_str]

    # Step 1: Clean and reindex wordData
    original_words = page_info['wordData']
    cleaned_words = [
        word for word in original_words.values()
        if word not in {'بِسْمِ', 'ٱللَّهِ', 'ٱلرَّحْمَـٰنِ', 'ٱلرَّحِيمِ'} and not word.isdigit()
    ]
    new_word_data = {str(i+1): word for i, word in enumerate(cleaned_words)}

    word_map = {}
    i = 1
    for old_index in sorted(original_words, key=lambda x: int(x)):
        word = original_words[old_index]
        if word not in {'بِسْمِ', 'ٱللَّهِ', 'ٱلرَّحْمَـٰنِ', 'ٱلرَّحِيمِ'} and not word.isdigit():
            word_map[int(old_index)] = i
            i += 1

    # Step 2: Update pageData
    new_page_data = []
    for line in page_info['pageData']:
        if line['line_type'] == 'surah_name':
            new_page_data.append({**line})
            new_page_data.append({
                "line_number": None,
                "line_type": "basmallah",
                "is_centered": True,
                "first_word_id": None,
                "last_word_id": None
            })
        else:
            new_page_data.append({
                **line,
                "first_word_id": word_map.get(line['first_word_id'], None),
                "last_word_id": word_map.get(line['last_word_id'], None)
            })

    for idx, line in enumerate(new_page_data, start=1):
        line['line_number'] = idx

    # Step 3: ayahData
    new_ayah_data = []
    current_index = 1
    for surah_num in page_info['surah_number']:
        for ayah in ayah_ranges.get(f"surah_{surah_num}", []):
            begin = ayah['ayah_begin']
            end = ayah['ayah_end']
            ayah_length = end - begin + 1
            new_ayah_data.append({
                "surahID": surah_num,
                "ayahID": ayah['ayahID'],
                "ayah_begin": current_index,
                "ayah_end": current_index + ayah_length - 1
            })
            current_index += ayah_length

    updated_page = {
        page_str: {
            "surah_number": page_info['surah_number'],
            "pageData": new_page_data,
            "ayahData": new_ayah_data,
            "wordData": new_word_data
        }
    }

    # Final formatting: pretty JSON with compact array objects
    def custom_json_dump(data, file):
        def serialize_entry(obj):
            if isinstance(obj, dict):
                return "{ " + ", ".join(f'"{k}": {json.dumps(v, ensure_ascii=False)}' for k, v in obj.items()) + " }"
            return json.dumps(obj, ensure_ascii=False)

        for key, value in data.items():
            file.write(f'{{\n  "{key}": {{\n')
            for k, v in value.items():
                if isinstance(v, list) and v and isinstance(v[0], dict):
                    file.write(f'    "{k}": [\n')
                    for item in v:
                        file.write(f'      {serialize_entry(item)},\n')
                    file.write(f'    ],\n')
                else:
                    dumped = json.dumps(v, ensure_ascii=False, indent=4)
                    file.write(f'    "{k}": {dumped},\n')
            file.write("  }\n}\n")

    # Save output
    with open(output_file, 'w', encoding='utf-8') as f:
        custom_json_dump(updated_page, f)

    print(f"✅ Processed page {page_num} → {output_file}")
