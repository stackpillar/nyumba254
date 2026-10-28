import re, sys

NEW = "hero-kenya-apartments.jpg"   # <- the new image name; change the extension here if you save it as .webp
P = "index.html"

s = open(P, encoding="utf-8").read()

if 'src="/' + NEW + '"' in s:
    sys.exit("Already applied. Nothing changed.")

block = re.compile(r'<div class="hero-illustration" aria-hidden="true">.*?</div>', re.S)
if not block.search(s):
    sys.exit("Could not find the hero images block in index.html. Nothing changed.")

new_block = (
    '<div class="hero-illustration" aria-hidden="true">\n'
    '    <img class="hero-slide active" src="/' + NEW + '" alt="" width="1672" height="941" decoding="async" fetchpriority="high"/>\n'
    '  </div>'
)
s = block.sub(lambda m: new_block, s, count=1)          # 4 rotating photos -> 1 photo

s = s.replace("https://nyumba254.com/hero-photo.jpg", "https://nyumba254.com/" + NEW)   # og:image + twitter:image

css = ".hero-slide { object-position: center 60%; }   /* shows balconies + entrance in the shorter hero */\n"
i = s.rindex("</style>")
s = s[:i] + css + s[i:]

open(P, "w", encoding="utf-8").write(s)
print("Done. Put", NEW, "next to index.html, then you can delete hero-photo.jpg, hero-photo-2.jpg, hero-photo-3.jpg, hero-photo-4.jpg")
