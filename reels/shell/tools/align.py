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
import json, math, os, re, struct, subprocess, sys, tempfile, wave
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
    # How loud the clip's last 60 ms are: a clip the voice model cut off mid-word still sounds at its very end.
    wf.rewind(); n = wf.getnframes(); wf.setpos(max(0, n - 960)); tail = wf.readframes(960)
    s = struct.unpack('<%dh' % (len(tail) // 2), tail)
    tail_db = 20 * math.log10(math.sqrt(sum(x * x for x in s) / max(1, len(s))) / 32768 + 1e-9)
    os.remove(tmp)
    return words, n / 16000, tail_db

cuts = {}
for card, line in lines.items():
    exp = norm(line)
    words, length, tail_db = recognise(os.path.join(voice_dir, f'{card}.wav'))
    # A recognised word matches an expected one if they are equal, or one holds the other ("posed" in "proposed").
    like = lambda a, b: a == b or (min(len(a), len(b)) >= 4 and (a in b or b in a))
    hit = lambda w, pool: any(like(w['word'], e) for e in pool)
    # The line starts at two expected words in a row (a stray sound can contain a common word like "the"),
    # and ends at the last pair in a row; a one-word line falls back to a single match.
    pairs = [i for i in range(len(words) - 1) if hit(words[i], exp[:3]) and hit(words[i + 1], exp[:4])]
    first = pairs[0] if pairs else next(i for i, w in enumerate(words) if hit(w, exp[:3]))
    tails = [i for i in range(1, len(words)) if hit(words[i], exp[-3:]) and hit(words[i - 1], exp[-4:])]
    last = tails[-1] if tails else max(i for i, w in enumerate(words) if hit(w, exp[-3:]))
    # A misheard real word runs on from its neighbour; a stray sound sits behind a pause. Extend over short gaps.
    while first > 0 and words[first]['start'] - words[first - 1]['end'] < GAP: first -= 1
    while last < len(words) - 1 and words[last + 1]['start'] - words[last]['end'] < GAP: last += 1
    cuts[card] = {'start': round(words[first]['start'], 3), 'end': round(words[last]['end'], 3),
                  'heard': ' '.join(w['word'] for w in words[first:last + 1]),
                  'dropped': ' '.join(w['word'] for w in words[:first] + words[last + 1:]),
                  'expected': line,
                  # Cut off: the speech runs to the end of the file and is still sounding there (a clean clip ends near -90 dB).
                  'cut_off': length - words[last]['end'] < 0.15 and tail_db > -60, 'tail_db': round(tail_db, 1)}
json.dump(cuts, open(os.path.join(voice_dir, 'cuts.json'), 'w'), indent=2)
for card, c in cuts.items():
    if c['cut_off']: print(f'CUT OFF: {card} ends mid-word ({c["tail_db"]} dB at the end of the file); generate it again', file=sys.stderr)
print(json.dumps(cuts, indent=1))
