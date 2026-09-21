#!/usr/bin/env python3
"""Usage: python3 apply_pin_patch.py YOUR-FILE.html   (edits in place, saves YOUR-FILE.html.bak)"""
import sys, os, shutil
path = sys.argv[1]
if not os.path.exists(path) and os.path.exists(path + '.html'): path += '.html'
src = open(path, encoding='utf-8').read(); bad = []
def rep(o, n, name):
    global src
    if src.count(o) != 1: bad.append(name); return
    src = src.replace(o, n)

rep('<div class="pin-status" id="pin-status"></div>',
    '<div class="pin-status" id="pin-status"></div><div id="pin-warn" role="note" hidden style="margin-top:10px;padding:11px 13px;border-radius:10px;background:#FFF7E6;border:1px solid #F3D9A0;color:#7a4f00;font-size:12.5px;line-height:1.55"><strong>Check your pin.</strong> It marks the spot on the map and buyers will see it on your listing. If you are not at the property right now, drag the pin to the exact spot or tap "Remove pin".</div>', 'warn html')
rep("$('clear-pin').hidden=!S.pin;", "$('clear-pin').hidden=!S.pin;if($('pin-warn'))$('pin-warn').hidden=!S.pin;", 'pinText')
rep("if(map)map.setView([lat,lng],16);", "setPin(lat,lng,16);", 'auto pin')
rep("""toast(`Filled ${[area||cands[0],nkCountyLabel(county)].filter(Boolean).join(', ')}. Please check it. Tap "Pin exact location here" if you're at the property.`,'success')""",
    """toast(`Filled ${[area||cands[0],nkCountyLabel(county)].filter(Boolean).join(', ')} and pinned your location. Drag the pin if you are not at the property.`,'success')""", 'toast')
if bad:
    print('NOT WRITTEN. Not found exactly once:'); [print(' -', b) for b in bad]; sys.exit(1)
shutil.copyfile(path, path + '.bak2'); open(path, 'w', encoding='utf-8').write(src)
print('OK, updated', path, '(backup:', path + '.bak2)')
