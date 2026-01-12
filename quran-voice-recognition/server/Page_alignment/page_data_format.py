import os
import json

def process_page_text(file_path, surah_name='سورة'):
    page_data = []

    with open(file_path, 'r', encoding='utf-8') as f:
        lines = [line.strip() for line in f if line.strip()]

    # Check for Basmala
    basmala = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ'
    has_basmala = any(basmala in line for line in lines)

    line_number = 1

    if has_basmala:
        # Add surah name (placeholder)
        page_data.append({
            "line_number": line_number,
            "line_type": "surah_name",
            "is_centered": True,
            "text": surah_name
        })
        line_number += 1

        # Add Basmala line
        page_data.append({
            "line_number": line_number,
            "line_type": "ayah",
            "is_centered": True,
            "text": f"{basmala} ۞"
        })
        line_number += 1

    # Add ayah lines
    for line in lines:
        page_data.append({
            "line_number": line_number,
            "line_type": "ayah",
            "is_centered": True,
            "text": line
        })
        line_number += 1

    return page_data

def process_all_pages(folder_path):
    all_pages = {}

    for filename in sorted(os.listdir(folder_path)):
        if filename.startswith('page_') and filename.endswith('_ayahs.txt'):
            page_number = int(filename.split('_')[1])
            file_path = os.path.join(folder_path, filename)

            page_data = process_page_text(file_path)
            all_pages[page_number] = page_data

    return all_pages

def export_page_data_as_js_format(folder_path, output_file=None):
    all_pages = process_all_pages(folder_path)
    output_lines = []
    
    output_lines.append("{")  # Start the dictionary

    for idx, page_number in enumerate(sorted(all_pages.keys())):
        page_data = all_pages[page_number]
        # surah_number = page_to_surah_map.get(page_number, 1)  # Default to 1 if not found

        # Write page entry
        line_prefix = f"  {page_number}: {{\n"
        # line_prefix += f"    surah_number: {surah_number},\n"
        line_prefix += f"    pageData: {json.dumps(page_data, ensure_ascii=False, indent=6)}\n"
        line_prefix += "  }" + ("," if idx < len(all_pages) - 1 else "")
        output_lines.append(line_prefix)

    output_lines.append("}")  # End dictionary

    final_output = "\n".join(output_lines)

    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(final_output)
        print(f"✅ Exported to {output_file}")
    else:
        print(final_output)


export_page_data_as_js_format('E:\Alqirat\quran_voice_recognition\quran-voice-recognition\public\quran_page_ayah_txt_new', output_file='formatted_pages.js')
