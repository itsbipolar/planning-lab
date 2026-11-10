"""Find where the real speech starts and ends in each narration clip, and what was said.

Voice models sometimes add stray sounds before the first word or after the last (a breath, a moan, a garbled
syllable). This transcribes each clip with Vosk (offline speech recognition, Apache-2.0), finds the first and
last recognised words that belong to the card's spoken line, and writes voice/cuts.json: {card: {start, end,
heard, expected}}. The shell keeps only [start, end] of each clip. Run it after new clips are generated:

  uv venv .asr && uv pip install --python .asr/bin/python vosk==0.3.45
  # model: https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip, unzipped anywhere
  node reels/shell/tools/lines.mjs reels/history-45 > /tmp/lines.json
  .asr/bin/python -I reels/shell/tools/align.py <model dir> reels/history-45/voice /tmp/lines.json
"""
import json, os, re, subprocess, sys, tempfile, wave
from vosk import Model, KaldiRecognizer, SetLogLevel

SetLogLevel(-1)
model_dir, voice_dir, lines_file = sys.argv[1:4]
lines = json.load(open(lines_file))  # {card id: spoken line, as words}
model = Model(model_dir)
GAP = 0.25  # seconds; stray sounds in these clips sit 0.39 s or more from the speech
norm = lambda s: re.sub(r"[^a-z' ]", ' ', s.lower().replace('-', ' ')).split()

def recognise(path):
    tmp = tempfile.mktemp(suffix='.wav')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', path, '-ac', '1', '-ar', '16000', '-sample_fmt', 's16', tmp], check=True)
    wf, rec, words = wave.open(tmp, 'rb'), KaldiRecognizer(model, 16000), []
    rec.SetWords(True)
    while (data := wf.readframes(4000)):
        if rec.AcceptWaveform(data): words += json.loads(rec.Result()).get('result', [])
    words += json.loads(rec.FinalResult()).get('result', [])
    os.remove(tmp)
    return words

cuts = {}
for card, line in lines.items():
    exp = norm(line)
    words = recognise(os.path.join(voice_dir, f'{card}.wav'))
    first = next(i for i, w in enumerate(words) if w['word'] in exp[:3])
    last = max(i for i, w in enumerate(words) if w['word'] in exp[-3:])
    # A misheard real word runs on from its neighbour; a stray sound sits behind a pause. Extend over short gaps.
    while first > 0 and words[first]['start'] - words[first - 1]['end'] < GAP: first -= 1
    while last < len(words) - 1 and words[last + 1]['start'] - words[last]['end'] < GAP: last += 1
    cuts[card] = {'start': round(words[first]['start'], 3), 'end': round(words[last]['end'], 3),
                  'heard': ' '.join(w['word'] for w in words[first:last + 1]),
                  'dropped': ' '.join(w['word'] for w in words[:first] + words[last + 1:]),
                  'expected': line}
json.dump(cuts, open(os.path.join(voice_dir, 'cuts.json'), 'w'), indent=2)
print(json.dumps(cuts, indent=1))
