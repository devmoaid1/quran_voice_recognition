import cv2
import numpy as np
import sys  # Added missing import

# Adjust these values for bullet/bold text detection
# Tighter constraints
WIDTH_MIN = 60    # Increased from 50
WIDTH_MAX = 80    # Decreased from 90  
HEIGHT_MIN = 80   # Increased from 70
HEIGHT_MAX = 100  # Decreased from 105

def find_ayat(img_rgb):
    # Convert to grayscale and threshold to detect dark text
    img_gray = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(img_gray, 150, 255, cv2.THRESH_BINARY_INV)
    
    # Find contours (shapes) of bullet points/bold text
    # Changed to use cv2.findContours() return signature for OpenCV 3/4 compatibility
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    results = []
    selected_contours = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        
        # Filter for bullet-point-sized contours
        if WIDTH_MIN < w < WIDTH_MAX and HEIGHT_MIN < h < HEIGHT_MAX:
            results.append((x, y, w, h))
            selected_contours.append(contour)
    
    return results, selected_contours


def draw(img_rgb, contours, output):
    # Create a copy of the image to avoid modifying the original
    output_img = img_rgb.copy()
    for contour in contours:
        cv2.drawContours(output_img, [contour], -1, (240, 0, 159), 3)
    cv2.imwrite(output, output_img)


def main():
    if len(sys.argv) < 2:
        print("usage: " + sys.argv[0] + " image")
        sys.exit(1)

    filename = sys.argv[1]
    img_rgb = cv2.imread(filename)
    
    # Check if image was loaded successfully
    if img_rgb is None:
        print(f"Error: Could not load image {filename}")
        sys.exit(1)
        
    (ayat, contours) = find_ayat(img_rgb)
    
    if len(ayat) == 0:
        print("No markers found in the image")
    else:
        draw(img_rgb, contours, 'res.png')
        for i, ayah in enumerate(ayat, 1):
            (x, y, w, h) = ayah
            print(f"Marker {i} found at: ({x}, {y}) - {w}x{h}")


if __name__ == "__main__":
    main()