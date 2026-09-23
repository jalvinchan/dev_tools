#!/usr/bin/env python3
"""Generate toolbar PNG icons without third-party deps."""
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons")


def write_png(path, w, h, rgba):
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw.extend(rgba[y * w * 4 : (y + 1) * w * 4])

    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
        f.write(chunk(b"IEND", b""))


def draw(size):
    px = bytearray([0] * (size * size * 4))
    bg = (36, 41, 46, 255)
    fg = (246, 248, 250, 255)
    accent = (47, 129, 247, 255)

    def put(x, y, c):
        if 0 <= x < size and 0 <= y < size:
            i = (y * size + x) * 4
            px[i : i + 4] = bytes(c)

    def fill_pixel(x, y, c, scale):
        for dy in range(scale):
            for dx in range(scale):
                put(x * scale + dx, y * scale + dy, c)

    # Draw on a 16x16 grid, then scale up so 16/32/48/128 stay sharp.
    grid = 16
    scale = size // grid
    rad = 3
    for y in range(grid):
        for x in range(grid):
            dx = min(x, grid - 1 - x)
            dy = min(y, grid - 1 - y)
            if dx < rad and dy < rad and (rad - 1 - dx) ** 2 + (rad - 1 - dy) ** 2 > (rad - 1) ** 2:
                continue
            fill_pixel(x, y, bg, scale)

    # Left chevron "<"
    left = [(3, 8), (4, 7), (5, 6), (4, 9), (5, 10), (6, 5), (6, 11)]
    for x, y in left:
        fill_pixel(x, y, fg, scale)
    fill_pixel(4, 8, fg, scale)
    fill_pixel(5, 7, fg, scale)
    fill_pixel(5, 9, fg, scale)

    # Slash
    for i, y in enumerate(range(4, 12)):
        fill_pixel(10 - i // 2, y, accent, scale)
        fill_pixel(9 - i // 2, y, accent, scale)

    # Right chevron ">"
    fill_pixel(11, 6, fg, scale)
    fill_pixel(12, 7, fg, scale)
    fill_pixel(13, 8, fg, scale)
    fill_pixel(12, 9, fg, scale)
    fill_pixel(11, 10, fg, scale)
    fill_pixel(10, 5, fg, scale)
    fill_pixel(10, 11, fg, scale)
    return px


def main():
    os.makedirs(OUT, exist_ok=True)
    for size in (16, 32, 48, 128):
        write_png(os.path.join(OUT, "icon%d.png" % size), size, size, draw(size))


if __name__ == "__main__":
    main()
