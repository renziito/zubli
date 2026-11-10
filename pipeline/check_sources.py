#!/usr/bin/env python3
"""Daily availability check for ZUBLI's public discovery providers."""
import json, datetime, pathlib, requests
checks = {
 "internet_archive": "https://archive.org/advancedsearch.php?q=mediatype%3Amovies&rows=1&output=json",
 "wikimedia_commons": "https://commons.wikimedia.org/w/api.php?action=query&meta=siteinfo&format=json",
 "peertube_diode": "https://diode.zone/api/v1/config",
 "peertube_tilvids": "https://tilvids.com/api/v1/config",
 "peertube_tv": "https://peertube.tv/api/v1/config",
 "peertube_blender": "https://video.blender.org/api/v1/config"
}
result={"checked_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"sources":{}}
for name,url in checks.items():
 try:
  response=requests.get(url,timeout=20,headers={"User-Agent":"ZUBLI-source-health/1.0"})
  result["sources"][name]={"available":response.ok,"http_status":response.status_code}
 except requests.RequestException as exc:
  result["sources"][name]={"available":False,"error":str(exc)[:240]}
path=pathlib.Path("catalog/source-health.json")
path.parent.mkdir(parents=True,exist_ok=True)
path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
print(json.dumps(result,indent=2))
