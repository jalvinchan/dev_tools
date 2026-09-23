#!/usr/bin/env python3
"""Download vendor files listed in vendor/lock.json."""
import json
import os
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENDOR = os.path.join(ROOT, "vendor")
LOCK = os.path.join(VENDOR, "lock.json")


def main():
    with open(LOCK, encoding="utf-8") as f:
        lock = json.load(f)
    for lib in lock["libraries"]:
        dest = os.path.join(VENDOR, lib["file"])
        print("GET %s -> %s" % (lib["url"], dest))
        req = urllib.request.Request(lib["url"], headers={"User-Agent": "dev_tools-vendor-sync"})
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
        with open(dest, "wb") as out:
            out.write(data)
        print("  %d bytes (%s %s)" % (len(data), lib["name"], lib["version"]))


if __name__ == "__main__":
    main()
