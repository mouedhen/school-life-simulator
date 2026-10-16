import re, glob
def engine():
    # src/engine/*.js are pieces of one script (see src/engine/README.md): pasted in name order inside one function
    parts=[open(f,encoding='utf8').read() for f in sorted(glob.glob('src/engine/*.js'))]
    return '(function () {\n' + '\n'.join(parts) + '})();\n'
d='src/'
css=open(d+'style.css').read()+open(d+'journal.css').read(); data=open(d+'data.js').read(); eng=engine(); app=open(d+'app.js').read(); talk=open(d+'talk.js').read(); i18n=open(d+'i18n.js').read(); import os; frx=open(d+'fr.js').read() if os.path.exists(d+'fr.js') else ''
html=f'''<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>School Life Simulator</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Patrick+Hand&family=Dancing+Script:wght@500;700&display=swap" rel="stylesheet">
<style>{css}</style>
<div id="root"></div>
<script>{data}</script>
<script>{talk}</script>
<script>{frx}</script>
<script>{i18n}</script>
<script>{eng}</script>
<script>{app}</script>
'''
open('dist/index.html','w').write(html)
print(len(html))
