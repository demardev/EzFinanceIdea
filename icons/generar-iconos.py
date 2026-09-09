#!/usr/bin/env python3
"""Genera los PNG del icono de la app. Sin dependencias: solo zlib y struct.

   Diseño monocromo: tres barras ascendentes blancas sobre fondo casi negro,
   el mismo trazo que el icono de Resumen. Sin texto, para que se lea a 60px.

   Uso:  python3 icons/generar-iconos.py
"""

import struct
import zlib
from pathlib import Path

FONDO = (11, 11, 12)        # --bg del tema oscuro
TRAZO = (250, 250, 250)     # --fg del tema oscuro
MUESTRAS = 4                # submuestreo por lado, para los bordes suaves

# Barras como fracción del lienzo: (centro x, alto)
BARRAS = [(0.315, 0.26), (0.500, 0.40), (0.685, 0.54)]
BASE = 0.760                # dónde se apoyan
ANCHO_BARRA = 0.115


def distancia_a_segmento(px, py, x1, y1, x2, y2):
    """Distancia de un punto al segmento, para dibujar cápsulas."""
    dx, dy = x2 - x1, y2 - y1
    largo = dx * dx + dy * dy
    t = 0.0 if largo == 0 else max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / largo))
    cx, cy = x1 + t * dx, y1 + t * dy
    return ((px - cx) ** 2 + (py - cy) ** 2) ** 0.5


def dentro(px, py):
    """¿El punto (en fracciones 0..1) cae dentro de alguna barra?"""
    radio = ANCHO_BARRA / 2
    for centro, alto in BARRAS:
        arriba = BASE - alto + radio
        abajo = BASE - radio
        if distancia_a_segmento(px, py, centro, arriba, centro, abajo) <= radio:
            return True
    return False


def cobertura(x, y, lado):
    """Cuánto del píxel cubre el trazo, con submuestreo."""
    dentro_total = 0
    paso = 1.0 / MUESTRAS
    for sy in range(MUESTRAS):
        for sx in range(MUESTRAS):
            px = (x + (sx + 0.5) * paso) / lado
            py = (y + (sy + 0.5) * paso) / lado
            if dentro(px, py):
                dentro_total += 1
    return dentro_total / (MUESTRAS * MUESTRAS)


def pixeles(lado):
    filas = []
    for y in range(lado):
        fila = bytearray(b'\x00')          # byte de filtro: sin filtro
        for x in range(lado):
            c = cobertura(x, y, lado)
            for i in range(3):
                fila.append(round(FONDO[i] + (TRAZO[i] - FONDO[i]) * c))
        filas.append(bytes(fila))
    return b''.join(filas)


def trozo(tipo, datos):
    return (struct.pack('>I', len(datos)) + tipo + datos
            + struct.pack('>I', zlib.crc32(tipo + datos) & 0xffffffff))


def escribir_png(ruta, lado):
    crudo = pixeles(lado)
    png = (b'\x89PNG\r\n\x1a\n'
           + trozo(b'IHDR', struct.pack('>IIBBBBB', lado, lado, 8, 2, 0, 0, 0))
           + trozo(b'IDAT', zlib.compress(crudo, 9))
           + trozo(b'IEND', b''))
    ruta.write_bytes(png)
    print(f'{ruta.name}: {lado}x{lado}, {len(png):,} bytes')


if __name__ == '__main__':
    carpeta = Path(__file__).parent
    for lado in (180, 192, 512):
        escribir_png(carpeta / f'icono-{lado}.png', lado)
