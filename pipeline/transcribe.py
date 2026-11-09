#!/usr/bin/env python3
"""Transcribe only explicitly authorized local audio; never fetches URLs."""
import argparse,json,pathlib
from faster_whisper import WhisperModel
p=argparse.ArgumentParser();p.add_argument("--input",required=True);p.add_argument("--language",required=True);p.add_argument("--output",required=True);p.add_argument("--model",default="tiny");a=p.parse_args()
src=pathlib.Path(a.input)
if not src.is_file(): raise SystemExit("Authorized audio file not found: "+str(src))
model=WhisperModel(a.model,device="cpu",compute_type="int8")
segments,info=model.transcribe(str(src),language=a.language,word_timestamps=True,vad_filter=True)
rows=[]
for s in segments:
 rows.append({"start":s.start,"end":s.end,"text":s.text.strip(),"words":[{"start":w.start,"end":w.end,"text":w.word.strip()} for w in (s.words or [])]})
out=pathlib.Path(a.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps({"language":info.language,"segments":rows,"verification_status":"draft_requires_human_review"},ensure_ascii=False,indent=2))
