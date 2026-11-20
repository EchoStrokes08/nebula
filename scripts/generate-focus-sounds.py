#!/usr/bin/env python3
"""Genera los sonidos de fondo del modo Enfoque (originales, sin licencias de terceros).

    python3 scripts/generate-focus-sounds.py   ->  assets/sounds/*.ogg (Opus, bucles de 60 s)

Cada pista se funde consigo misma en los extremos para que el bucle no tenga corte.
"""
import os
import subprocess
import tempfile
import wave

import numpy as np

RATE = 48000
SECONDS = 60
FADE = 3  # segundos de fundido cruzado en el bucle
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')
rng = np.random.default_rng(20261120)


def loop(x: np.ndarray) -> np.ndarray:
    """Funde el final sobre el principio: la pista empieza donde termina."""
    n = FADE * RATE
    body, tail = x[:-n], x[-n:]
    ramp = np.linspace(0, 1, n)
    body[:n] = body[:n] * ramp + tail * (1 - ramp)
    return body


def normalize(x: np.ndarray, peak=0.6) -> np.ndarray:
    x = x - x.mean()
    return x / np.max(np.abs(x)) * peak


def lowpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    a = np.exp(-2 * np.pi * cutoff / RATE)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):  # filtro de un polo; suficiente y sin dependencias
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def brown(n: int) -> np.ndarray:
    white = rng.standard_normal(n)
    y = np.cumsum(white)
    # Fuga lenta: evita la deriva del paseo aleatorio sin perder el grave.
    y -= lowpass(y, 0.5)
    return normalize(y, 0.55)


def rain(n: int) -> np.ndarray:
    hiss = rng.standard_normal(n)
    bed = hiss - lowpass(hiss, 400)            # siseo agudo de la lluvia
    bed = lowpass(bed, 6000) * 0.5 + lowpass(hiss, 900) * 0.35
    drops = np.zeros(n)
    t = np.arange(int(0.012 * RATE))
    for start in rng.integers(0, n - len(t), size=SECONDS * 140):
        f = rng.uniform(1800, 5200)
        drops[start:start + len(t)] += np.sin(2 * np.pi * f * t / RATE) * np.exp(-t / (0.0025 * RATE)) * rng.uniform(0.05, 0.35)
    swell = 0.85 + 0.15 * np.sin(np.linspace(0, 2 * np.pi * 3, n))  # intensidad que respira
    return normalize((bed + drops) * swell, 0.5)


def write(name: str, x: np.ndarray) -> None:
    os.makedirs(OUT, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        path = tmp.name
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes((x * 32767).astype('<i2').tobytes())
    target = os.path.join(OUT, f'{name}.ogg')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-c:a', 'libopus', '-b:a', '48k', target], check=True)
    os.unlink(path)
    print(target, os.path.getsize(target) // 1024, 'KB')


n = (SECONDS + FADE) * RATE
write('ruido-marron', loop(brown(n)))
write('lluvia', loop(rain(n)))
