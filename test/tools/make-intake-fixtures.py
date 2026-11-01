# Makes the small made-up files in test/fixtures/intake/: nothing in them comes from a real student.
# Only needed to remake them, since they're kept in the repo. Needs: pip install pillow pillow-heif pypdf, and ffmpeg.
# Run from the repo root: python test/tools/make-intake-fixtures.py
import io, os, subprocess
from PIL import Image, ImageDraw
import pillow_heif
from pypdf import PdfWriter

OUT = 'test/fixtures/intake'
os.makedirs(OUT, exist_ok=True)

# A picture you can tell the way up of: red across the top, blue down the bottom. 200 wide, 100 high.
def picture():
    im = Image.new('RGB', (200, 100), (255, 255, 255))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 199, 49), fill=(220, 30, 30))
    d.rectangle((0, 50, 199, 99), fill=(30, 30, 220))
    return im

picture().save(OUT + '/photo.jpg', quality=90)   # no EXIF: the test writes each orientation into it

# An iPhone-style photo: stored as the camera saw it, sideways, with a note that it should be turned.
pillow_heif.register_heif_opener()
turned = picture().transpose(Image.Transpose.ROTATE_90)   # 100 wide, 200 high, red on the left
exif = Image.Exif(); exif[0x0112] = 6
turned.save(OUT + '/photo.heic', quality=60, exif=exif.tobytes())
picture().save(OUT + '/plain.heic', quality=60)

# PDFs with a password. One needs it to open; the other opens but says it's locked against changes.
def locked(user, owner, name):
    w = PdfWriter(); w.add_blank_page(width=612, height=792)
    w.encrypt(user_password=user, owner_password=owner, algorithm='RC4-128')
    w.add_metadata({'/Producer': 'gs-test'})
    w.write(OUT + '/' + name)
locked('secret', 'secret', 'locked.pdf')
locked('', 'owner', 'owner-locked.pdf')

# Recordings: a tone, and a color for the picture.
def ff(*args): subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-y', *args], check=True)
tone = ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.5']
pic = ['-f', 'lavfi', '-i', 'color=c=green:s=64x64:d=0.5:r=10']
ff(*tone, '-b:a', '32k', OUT + '/tone.mp3')
ff(*tone, '-c:a', 'aac', '-b:a', '32k', OUT + '/tone.m4a')
ff(*pic, *tone, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '32k', '-shortest', OUT + '/clip.mp4')
ff(*pic, *tone, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '32k', '-shortest', OUT + '/clip.mov')
ff(*tone, '-c:a', 'aac', '-b:a', '32k', '-f', 'mov', OUT + '/sound-only.mov')
