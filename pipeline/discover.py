#!/usr/bin/env python3
"""Find metadata only. Never downloads YouTube media or captions."""
import os, json, re, pathlib, datetime, requests

key = os.environ.get("YOUTUBE_API_KEY")
if not key:
    raise SystemExit("Missing YOUTUBE_API_KEY secret")

api = "https://www.googleapis.com/youtube/v3"
languages = {"en": "English", "es": "Spanish", "fr": "French", "de": "German", "it": "Italian", "ja": "Japanese"}
outdir = pathlib.Path("pipeline/discovered")
outdir.mkdir(parents=True, exist_ok=True)

def duration(value):
    match = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", value or "")
    if not match:
        return 0
    return int(match.group(1) or 0) * 3600 + int(match.group(2) or 0) * 60 + int(match.group(3) or 0)

for code, name in languages.items():
    response = requests.get(
        api + "/search",
        params={
            "part": "snippet",
            "type": "video",
            "videoCaption": "closedCaption",
            "videoEmbeddable": "true",
            "videoDuration": "short",
            "maxResults": 50,
            "q": name + " conversation",
            "key": key,
        },
        timeout=30,
    )
    response.raise_for_status()
    ids = [
        item["id"]["videoId"]
        for item in response.json().get("items", [])
        if item.get("id", {}).get("videoId")
    ]
    rows = []
    if ids:
        details = requests.get(
            api + "/videos",
            params={
                "part": "contentDetails,status,snippet",
                "id": ",".join(ids),
                "key": key,
            },
            timeout=30,
        )
        details.raise_for_status()
        for video in details.json().get("items", []):
            seconds = duration(video.get("contentDetails", {}).get("duration"))
            if (
                0 < seconds < 150
                and video.get("status", {}).get("embeddable")
                and video.get("contentDetails", {}).get("caption") == "true"
            ):
                rows.append({
                    "video_id": video["id"],
                    "language": code,
                    "title": video["snippet"]["title"],
                    "channel": video["snippet"]["channelTitle"],
                    "duration_seconds": seconds,
                    "transcription_status": "requires_authorized_reference",
                    "discovered_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                })
    (outdir / (code + ".json")).write_text(json.dumps(rows, ensure_ascii=False, indent=2))

print("Metadata discovery complete; only clips under 150 seconds; no captions or audio accessed.")
