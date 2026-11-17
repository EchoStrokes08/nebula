#!/usr/bin/env python3
"""Configura Groq desde las referencias del repo dotfiles sin imprimir credenciales."""
import json
import os
from pathlib import Path

root = Path(__file__).resolve().parents[1]
config = json.loads((Path.home() / 'dotfiles/zsh/.config/ia/nube.json').read_text())
provider = next(p for p in config['proveedores'] if p['nombre'] == 'groq')
key = next((Path.home() / '.local/share/brujula/claves' / name).read_text().strip()
           for name in provider['claves'] if (Path.home() / '.local/share/brujula/claves' / name).exists())
preferred = provider.get('preferido', ['openai/gpt-oss-120b'])
model = preferred[0] if isinstance(preferred, list) else preferred
fd = os.open(root / '.env.server.local', os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, 'w') as f:
    f.write(f'AI_PROVIDER=groq\nAI_BASE_URL={provider["url"]}\nAI_MODEL={model}\nAI_API_KEY={key}\n')
print('Groq configurado en .env.server.local (0600), fuera de Git y del bundle cliente.')
