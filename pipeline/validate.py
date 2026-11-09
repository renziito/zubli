#!/usr/bin/env python3
"""Checks JSON shape and timing only, never claims text accuracy."""
import json,pathlib,sys
obj=json.loads(pathlib.Path(sys.argv[1]).read_text());segments=obj.get("segments",[])
if not obj.get("language") or not segments: raise SystemExit("Missing language or segments")
last=-1
for i,s in enumerate(segments):
 if not isinstance(s.get("text"),str) or not s["text"].strip(): raise SystemExit(f"Empty text in segment {i}")
 if not isinstance(s.get("start"),(int,float)) or not isinstance(s.get("end"),(int,float)) or s["end"]<=s["start"] or s["start"]<last: raise SystemExit(f"Invalid timing in segment {i}")
 last=s["start"]
 for w in s.get("words",[]):
  if w["end"]<=w["start"]: raise SystemExit(f"Invalid word timing in segment {i}")
print(f"Structural validation passed for {len(segments)} segments; human verification is still required.")
