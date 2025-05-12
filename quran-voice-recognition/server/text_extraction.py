import os
import cv2
import json
import pytesseract
import numpy as np

# Set the Tesseract executable path
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# ✅ Path to the single image you want to process
single_image_path = r'E:\Alqirat\quran_voice_recognition\quran-voice-recognition\public\quran_pages\000.png'  # update this path to your image

# Initialize a dictionary to store extracted data
extracted_data = {}

# Make sure the file exists
if os.path.isfile(single_image_path) and single_image_path.lower().endswith(('.png', '.jpg', '.jpeg')):
    # Read the image
    image = cv2.imread(single_image_path)

    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Define black color range
    lower_black = np.array([0, 0, 0])
    upper_black = np.array([5, 5, 5])

    # Create mask for black boxes
    mask_black = cv2.inRange(image, lower_black, upper_black)

    # Find contours of black areas
    contours_black, _ = cv2.findContours(mask_black, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    black_texts = []
    for contour in contours_black:
        x, y, w, h = cv2.boundingRect(contour)
        roi = gray[y:y + h, x:x + w]
        text = pytesseract.image_to_string(roi, lang='ara')  # You can set 'lang' to Arabic if installed
        if text.strip():
            print("Black Box:", text)
            black_texts.append({'extracted_text': text.strip()})

    # Store result under the filename
    image_filename = os.path.basename(single_image_path)
    extracted_data[image_filename] = {
        'black': black_texts
    }

    # Save to JSON
    output_json_path = 'extracted_text.json'
    with open(output_json_path, 'w', encoding='utf-8') as json_file:
        json.dump(extracted_data, json_file, ensure_ascii=False, indent=4)

    print("Image has been processed.")
    print(f"Extracted data saved to '{output_json_path}'")

else:
    print(f"❌ File not found or invalid image type: {single_image_path}")
