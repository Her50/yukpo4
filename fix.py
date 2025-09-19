import re

with open("frontend/src/lib/paymentClient.ts", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("import { API_BASE_URL } from 
\@/config/api\';\nimport { API_BASE_URL } from \@/config/api\';", "import { API_BASE_URL } from \@/config/api\';")
content = re.sub(r"\$\{API_BASE_URL\}", r"\`\${API_BASE_URL}\`", content)
content = re.sub(r"Bearer ,", r"\`Bearer \${token}\`", content)
content = re.sub(r"limit=&offset=", r"limit=\${limit}&offset=\${offset}", content)
content = re.sub(r"status/", r"status/\${paymentId}", content)

with open("frontend/src/lib/paymentClient.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("Fichier corrigé")
