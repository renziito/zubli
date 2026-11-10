function decodeEntities(value) {
  const node = document.createElement("textarea");
  node.innerHTML = value;
  return node.value;
}

function parseTimestamp(value) {
  const parts = value.trim().replace(",", ".").split(":");
  const seconds = Number(parts.pop());
  const minutes = Number(parts.pop() || 0);
  const hours = Number(parts.pop() || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export function parseCaptions(text, format = "vtt") {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r/g, "");
  const blocks = normalized.split(/\n\s*\n/);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    const timeIndex = lines.findIndex(line => line.includes("-->"));
    if (timeIndex < 0) continue;
    const [startRaw, endRaw] = lines[timeIndex].split("-->").map(value => value.trim().split(" ")[0]);
    const start = parseTimestamp(startRaw);
    const end = parseTimestamp(endRaw);
    const content = lines.slice(timeIndex + 1)
      .filter(line => !/^\[(music|applause|laughter|noise)/i.test(line))
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
    const value = decodeEntities(content);
    if (value && end > start) cues.push({ start, end, text: value });
  }

  return cues.sort((a, b) => a.start - b.start);
}

export function makeExercises(cues, maxSeconds = 149) {
  const exercises = [];
  let current = null;

  for (const cue of cues) {
    const sentenceParts = cue.text.match(/[^.!?。！？]+[.!?。！？]?/g) || [cue.text];
    const totalDuration = cue.end - cue.start;
    let offset = cue.start;

    for (const part of sentenceParts) {
      const text = part.trim();
      if (!text) continue;
      const duration = totalDuration / sentenceParts.length;
      const start = offset;
      const end = Math.min(cue.end, offset + duration);
      offset = end;

      if (!current || end - current.start > maxSeconds || start - current.end > 2.5) {
        current = { start, end, text };
        exercises.push(current);
      } else {
        current.end = end;
        current.text += " " + text;
      }
    }
  }

  return exercises.filter(item => item.end > item.start && item.end - item.start < maxSeconds);
}
