import re
import os
import json
from collections import OrderedDict

def get_surah_for_page(page_num):
    """Returns list of surah numbers that appear on the given page"""
    surah_pages = {
        1: 1, 2: 2, 3: 50, 4: 77, 5: 106, 6: 128, 7: 151, 8: 177, 9: 187, 10: 208,
        11: 221, 12: 235, 13: 249, 14: 255, 15: 262, 16: 267, 17: 282, 18: 293, 19: 305, 20: 312,
        21: 322, 22: 332, 23: 342, 24: 350, 25: 359, 26: 367, 27: 377, 28: 385, 29: 396, 30: 404,
        31: 411, 32: 415, 33: 418, 34: 428, 35: 434, 36: 440, 37: 446, 38: 453, 39: 458, 40: 467,
        41: 477, 42: 483, 43: 489, 44: 496, 45: 499, 46: 502, 47: 507, 48: 511, 49: 515, 50: 518,
        51: 520, 52: 523, 53: 526, 54: 528, 55: 531, 56: 534, 57: 537, 58: 542, 59: 545, 60: 549,
        61: 551, 62: 553, 63: 554, 64: 556, 65: 558, 66: 560, 67: 562, 68: 564, 69: 566, 70: 568,
        71: 570, 72: 572, 73: 574, 74: 575, 75: 577, 76: 578, 77: 580, 78: 582, 79: 583, 80: 585,
        81: 586, 82: 587, 83: 587, 84: 589, 85: 590, 86: 591, 87: 591, 88: 592, 89: 593, 90: 594,
        91: 595, 92: 595, 93: 596, 94: 596, 95: 597, 96: 597, 97: 598, 98: 598, 99: 599, 100: 599,
        101: 600, 102: 600, 103: 601, 104: 601, 105: 601, 106: 602, 107: 602, 108: 602, 109: 603, 110: 603,
        111: 603, 112: 604, 113: 604, 114: 604
    }
    
    # Create page-to-surah mapping
    surahs_on_page = []
    for surah, start_page in surah_pages.items():
        next_surah_start = 605  # Default beyond last page
        if surah + 1 in surah_pages:
            next_surah_start = surah_pages[surah + 1]
        
        if start_page <= page_num < next_surah_start:
            surahs_on_page.append(surah)
    
    return surahs_on_page

def parse_page_file(file_path, page_number, surah_number):
    pageData = []
    wordData = OrderedDict()
    current_word_id = 1
    line_number = 1

    if not isinstance(surah_number, list):
        surah_number = [surah_number]

    # Add initial surah name line
    pageData.append({
        "line_number": line_number,
        "line_type": "surah_name",
        "is_centered": True,
        "first_word_id": None,
        "last_word_id": None
    })
    line_number += 1

    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            if "|" not in line or ":" not in line:
                continue

            meta, text = line.strip().split(":", 1)
            _, ayah_num = map(str.strip, meta.strip().split("|"))
            words = re.findall(r'\S+', text.strip())

            first_id = current_word_id
            for word in words:
                wordData[str(current_word_id)] = word
                current_word_id += 1

            wordData[str(current_word_id)] = ayah_num
            current_word_id += 1

            last_id = current_word_id - 1

            pageData.append({
                "line_number": line_number,
                "line_type": "ayah",
                "is_centered": True,
                "first_word_id": first_id,
                "last_word_id": last_id
            })
            line_number += 1

    # Format output exactly as specified
    formatted_pageData = [f'    {json.dumps(line, ensure_ascii=False)}' for line in pageData]
    
    word_items = [f'"{k}": {json.dumps(v, ensure_ascii=False)}' for k, v in wordData.items()]
    grouped_wordData = ["    " + ", ".join(word_items[i:i+4]) for i in range(0, len(word_items), 4)]
    
    result = (
        f'"{page_number}": {{\n'
        f'  "surah_number": {json.dumps(surah_number)},\n'
        f'  "pageData": [\n{",\n".join(formatted_pageData)}\n  ],\n'
        f'  "wordData": {{\n{",\n".join(grouped_wordData)}\n  }}\n'
        '}'
    )
    
    return result

def process_all_pages(input_dir, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    
    # Get all text files sorted by page number
    input_files = sorted(
        [f for f in os.listdir(input_dir) if f.startswith('page_') and f.endswith('.txt')],
        key=lambda x: int(re.search(r'page_(\d+)_', x).group(1)))
    
    all_pages_output = []
    
    for filename in input_files:
        try:
            page_num = int(re.search(r'page_(\d+)_', filename).group(1))
            surah_numbers = get_surah_for_page(page_num)
            file_path = os.path.join(input_dir, filename)
            
            page_output = parse_page_file(file_path, page_num, surah_numbers)
            all_pages_output.append(page_output)
            
            # Save individual page file
            output_path = os.path.join(output_dir, f'page_{page_num}_ayahs.json')
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write('{\n' + page_output + '\n}')
            
            print(f"Processed page {page_num} (surahs: {surah_numbers})")
            
        except Exception as e:
            print(f"Error processing {filename}: {str(e)}")
    
    # Save complete Quran file
    complete_output_path = os.path.join(output_dir, 'complete_quran.json')
    with open(complete_output_path, 'w', encoding='utf-8') as f:
        f.write('{\n' + ',\n'.join(all_pages_output) + '\n}')
    
    print(f"\nComplete Quran data saved to {complete_output_path}")

# Configuration
input_directory = r"E:\Alqirat\quran_voice_recognition\quran-voice-recognition\public\quran_page_ayah_txt"
output_directory = r"E:\Alqirat\quran_voice_recognition\quran-voice-recognition\public\Page_structure_new"

# Run the processing
process_all_pages(input_directory, output_directory)