#!/usr/bin/env python3
"""Find metadata only. Never downloads YouTube media or captions."""
import os,json,re,pathlib,datetime,requests
key=os.environ.get("YOUTUBE_API_KEY")
if not key: raise SystemExit("Missing YOUTUBE_API_KEY secret")
api="https://www.googleapis.com/youtube/v3"
languages={"en":"English","es":"Spanish","fr":"French","de":"German","it":"Italian","ja":"Japanese"}
outdir=pathlib.Path("pipeline/discovered");outdir.mkdir(parents=True,exist_ok=True)
def duration(value):
 m=re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?",value or "")
 return int(m.group(1) or 0)*3600+int(m.group(2) or 0)*60+int(m.group(3) or 0) if m else 0
for code,name in languages.items():
 r=requests.get(api+"/search",params={"part":"snippet","type":"video","videoCaption":"closedCaption","videoEmbeddable":"true","maxResults":25,"q":name+" conversation","key":key},timeout=30);r.raise_for_status()
 ids=[x["id"]["videoId"] for x in r.json().get("items",[]) if x.get("id",{}).get("videoId")]
 rows=[]
 if ids:
  d=requests.get(api+"/videos",params={"part":"contentDetails,status,snippet","id":",".join(ids),"key":key},timeout=30);d.raise_for_status()
  for v in d.json().get("items",[]):
   sec=duration(v.get("contentDetails",{}).get("duration"))
   if 60<=sec<=120 and v.get("status",{}).get("embeddable") and v.get("contentDetails",{}).get("caption")=="true":
    rows.append({"video_id":v["id"],"language":code,"title":v["snippet"]["title"],"channel":v["snippet"]["channelTitle"],"duration_seconds":sec,"transcription_status":"requires_authorized_reference","discovered_at":datetime.datetime.now(datetime.timezone.utc).isoformat()})
 (outdir/(code+".json")).write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print("Metadata discovery complete; no captions or audio accessed.")
