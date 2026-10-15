import json,glob
m={}
for f in sorted(glob.glob('tr/out_*.json')): m.update(json.load(open(f)))
open('src/fr.js','w').write('globalThis.FRX='+json.dumps(m,ensure_ascii=False,separators=(',',':'))+';\n')
print(len(m))
