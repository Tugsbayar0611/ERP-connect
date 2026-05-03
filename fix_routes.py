import sys

with open(r'a:\файл шилжүүлэв\projects\ERP-connect\server\routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('import { registerInventoryRoutes } from "./routes/inventory";\n', '')
content = content.replace('  registerInventoryRoutes(app);\n', '')

with open(r'a:\файл шилжүүлэв\projects\ERP-connect\server\routes.ts', 'w', encoding='utf-8') as f:
    f.write(content)
