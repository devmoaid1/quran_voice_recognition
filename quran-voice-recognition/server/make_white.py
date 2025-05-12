# import sys

# from PIL import Image

# # this script adds a white background to an image
# if len(sys.argv) != 3:
#     print("usage: " + '../public/quran_pages/' + " [image] [output]")
#     sys.exit(1)

# img_dir = '../public/quran_pages/001.png'
# img = Image.open(img_dir).convert('RGBA')
# width, height = img.size
# bg = Image.new(img.mode, img.size, (255, 255, 255))
# i = Image.alpha_composite(bg, img)
# i.save('../public/quran_pages/001_U.png')

# from PIL import Image
# import os

# # Define input and output paths
# image_dir = os.path.join('..', 'public', 'quran_pages')
# input_path = os.path.join(image_dir, '003.png')
# output_path = os.path.join(image_dir, '003_U.png')

# # Open the image and add a white background
# img = Image.open(input_path).convert('RGBA')
# bg = Image.new(img.mode, img.size, (255, 255, 255))  # white background
# composited = Image.alpha_composite(bg, img)

# # Save the output
# composited.save(output_path)
# print(f"Image saved to: {output_path}")

from PIL import Image
import os

# Define paths
base_dir = r"E:\Alqirat\quran_voice_recognition\quran-voice-recognition\public"
input_folder = os.path.join(base_dir, "quran_pages")
output_folder = os.path.join(base_dir, "quran_pages_new")

# Create output directory if it doesn't exist
os.makedirs(output_folder, exist_ok=True)

# Loop over all PNG files in the input directory
for filename in os.listdir(input_folder):
    if filename.lower().endswith(".png"):
        input_path = os.path.join(input_folder, filename)
        output_path = os.path.join(output_folder, filename)

        # Open the image and add a white background
        img = Image.open(input_path).convert('RGBA')
        bg = Image.new(img.mode, img.size, (255, 255, 255))  # white background
        composited = Image.alpha_composite(bg, img)

        # Save the output image
        composited.save(output_path)
        print(f"Saved: {output_path}")

