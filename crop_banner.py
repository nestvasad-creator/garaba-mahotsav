from PIL import Image

img = Image.open('Untitled 1.png')
# Crop left banner: x: 30 to 140, y: 190 to 950
banner = img.crop((30, 190, 140, 950))
banner.save('full_guj_banner.png')
print("Saved full_guj_banner.png size:", banner.size)
