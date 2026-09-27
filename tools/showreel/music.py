"""The showreel's soundtrack, synthesized from nothing: 120 BPM in A minor, 45 seconds,
with every hit placed on an event in index.html. Writes out/music.wav (stereo, 44.1 kHz).
Only numpy is needed."""
import os, wave
import numpy as np

SR = 44100
DUR = 45.0
N = int(SR * DUR)
T = np.arange(N) / SR
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)
send = np.zeros(N)  # reverb bus (mono)

BEAT = 0.5
def hz(note):  # 'A3', 'C#4'
    names = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2}
    n, o = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((names[n] + (o - 4) * 12) / 12)

def add(sig, t0, gain=1.0, pan=0.0, rev=0.0):
    i = int(round(t0 * SR))
    if i >= N: return
    if i < 0: sig = sig[-i:]; i = 0
    sig = sig[: N - i]
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * gain * l * 1.414
    R[i:i + len(sig)] += sig * gain * r * 1.414
    if rev: send[i:i + len(sig)] += sig * gain * rev

def env_exp(n, decay):
    return np.exp(-np.arange(n) / SR / decay)

def fft_filter(x, lo=None, hi=None, order=2):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    H = np.ones_like(f)
    if hi: H *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo: H *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    return np.fft.irfft(X * H, len(x))

def noise(sec): return rng.standard_normal(int(sec * SR))

# ---------- instruments ----------
def kick(big=False):
    n = int((1.6 if big else .45) * SR); t = np.arange(n) / SR
    f = 42 + 120 * np.exp(-t / .035) + (0 if not big else 30 * np.exp(-t / .2))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / (.6 if big else .22))
    s += .3 * fft_filter(noise(n / SR), lo=2000) * np.exp(-t / .004)
    return np.tanh(s * 1.6)

def clap():
    n = int(.3 * SR); t = np.arange(n) / SR
    e = np.zeros(n)
    for k, d in enumerate([0, .011, .022]):
        i = int(d * SR); e[i:] += np.exp(-(t[: n - i]) / (.006 if k < 2 else .09))
    return fft_filter(noise(.3), lo=900, hi=3200) * e

def hat(open_=False):
    n = int((.22 if open_ else .05) * SR)
    return fft_filter(noise(n / SR), lo=7000, order=3) * env_exp(n, .07 if open_ else .012)

def tone(freq, sec, decay, wave_='sine', harm=0.0):
    n = int(sec * SR); t = np.arange(n) / SR
    if wave_ == 'tri':
        s = 2 / np.pi * np.arcsin(np.sin(2 * np.pi * freq * t))
    else:
        s = np.sin(2 * np.pi * freq * t)
    if harm: s += harm * np.sin(4 * np.pi * freq * t)
    a = np.minimum(1, t / .003)
    return s * a * np.exp(-t / decay)

def saw_voice(freq, n, harmonics=14, detune=0.0):
    t = np.arange(n) / SR
    s = np.zeros(n)
    for k in range(1, harmonics + 1):
        if freq * k > 9000: break
        s += np.sin(2 * np.pi * freq * (1 + detune) * k * t) / k
    return s

def whoosh(center, width=.7, up=True, gain=.18):
    n = int(width * SR)
    x = noise(width); out = np.zeros(n); blk = 1024
    for b in range(0, n, blk):
        p = b / n
        fc = 300 * (40 ** (p if up else 1 - p))
        seg = x[b:b + blk]
        out[b:b + blk] = fft_filter(seg, lo=fc * .5, hi=fc * 2)
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    add(out * e, center - width * .6, gain, pan=-.3, rev=.2)
    add(out[::-1] * e, center - width * .6, gain * .7, pan=.3, rev=.2)

def riser(t0, t1, gain=.22):
    sec = t1 - t0; n = int(sec * SR); x = noise(sec); out = np.zeros(n); blk = 1024
    for b in range(0, n, blk):
        p = b / n; fc = 200 * (60 ** (p ** 1.6))
        out[b:b + blk] = fft_filter(x[b:b + blk], lo=fc * .6, hi=fc * 1.6)
    t = np.arange(n) / SR
    f = 110 * (8 ** ((t / sec) ** 2))
    sweep = np.sin(2 * np.pi * np.cumsum(f) / SR) * .35
    e = (t / sec) ** 2.2
    add((out + sweep) * e, t0, gain, rev=.3)

def impact(t0, gain=1.0):
    add(kick(big=True), t0, .9 * gain)
    n = int(1.8 * SR)
    add(fft_filter(noise(1.8), hi=2500) * env_exp(n, .35), t0, .35 * gain, rev=.8)
    n2 = int(3.0 * SR); t = np.arange(n2) / SR
    add(np.sin(2 * np.pi * 36 * t) * np.exp(-t / 1.1) * np.minimum(1, t / .01), t0, .5 * gain)

def blip(t0, freq, gain=.16, pan=0.0, decay=.18):
    add(tone(freq, decay * 5, decay, 'sine', harm=.25), t0, gain, pan, rev=.5)

def tick(t0, gain=.12, freq=2400):
    add(tone(freq, .05, .008) + .5 * tone(freq * 1.5, .05, .005), t0, gain, rev=.1)

def thunk(t0, gain=.35):
    n = int(.25 * SR); t = np.arange(n) / SR
    f = 90 + 200 * np.exp(-t / .02)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .07)
    add(s, t0, gain, rev=.25)
    add(fft_filter(noise(.05), lo=1500, hi=5000) * env_exp(int(.05 * SR), .008), t0, gain * .5)

# ---------- harmony ----------
PROG = [['A3', 'C4', 'E4', 'B4'], ['F3', 'A3', 'C4', 'E4'], ['C4', 'E4', 'G4', 'D5'], ['G3', 'B3', 'D4', 'A4']]
ROOT = ['A1', 'F1', 'C2', 'G1']
def chord_at(t): return (int(t // 2) - 2) % 4

# ---------- arrangement ----------
GROOVE = (4.0, 36.5)
END = 40.5

# sidechain envelope from the kick pattern
duck = np.ones(N)
for b in np.arange(GROOVE[0], GROOVE[1], BEAT):
    i = int(b * SR); n = int(.4 * SR)
    seg = 1 - .65 * np.exp(-np.arange(n) / SR / .09)
    duck[i:i + n] = np.minimum(duck[i:i + n], seg[: N - i])

# pad: one bar per chord, soft attack, lowpassed, ducked
pad = np.zeros(N)
for bar in range(0, 23):
    t0 = bar * 2.0
    if t0 >= END: break
    notes = PROG[chord_at(t0)]
    n = int(2.4 * SR); t = np.arange(n) / SR
    v = np.zeros(n)
    for note in notes:
        f = hz(note)
        v += saw_voice(f, n, detune=.003) + saw_voice(f, n, detune=-.004)
    e = np.minimum(1, t / .25) * np.minimum(1, (2.4 - t) / .4)
    i = int(t0 * SR); seg = (v * e)[: N - i]
    pad[i:i + len(seg)] += seg
pad = fft_filter(pad, hi=1400, order=2)
lift = np.clip((T - 0) / 4, .25, 1.0)  # pad swells in over the intro
pad *= lift * duck
# final chord, held
n = int((DUR - END) * SR); t = np.arange(n) / SR
fin = np.zeros(n)
for note in ['A2', 'E3', 'A3', 'C4', 'E4', 'B4']:
    fin += saw_voice(hz(note), n, detune=.003) + saw_voice(hz(note), n, detune=-.003)
fin = fft_filter(fin, hi=2200) * np.minimum(1, t / .02) * np.exp(-t / 3.5) * np.minimum(1, (DUR - END - t) / 1.2)
padL = pad.copy(); i = int(END * SR); padL[i:] = 0
L += padL * .11; R += padL * .11; send += padL * .05
add(fin, END, .12, rev=.5)

# drums
for b in np.arange(GROOVE[0], GROOVE[1], BEAT):
    add(kick(), b, .78)
    beat_in_bar = round((b % 2) / BEAT)
    if beat_in_bar in (1, 3) and b >= 9: add(clap(), b, .45, pan=.05, rev=.35)
    add(hat(open_=True), b + .25, .16 if b >= 9 else .08, pan=.25)
    if b >= 12.5:
        for k in (0, .125, .375):
            add(hat(), b + k, .07, pan=-.3)

# bass: eighth notes on the root, octave jump on the offbeat
for e8 in np.arange(GROOVE[0], GROOVE[1], .25):
    root = hz(ROOT[chord_at(e8)])
    f = root * (2 if round((e8 % .5) / .25) == 1 else 1)
    n = int(.24 * SR); t = np.arange(n) / SR
    s = np.tanh(2.2 * (np.sin(2 * np.pi * f * t) + .3 * np.sin(4 * np.pi * f * t))) * np.exp(-t / .16) * np.minimum(1, t / .004)
    add(fft_filter(s, hi=1200), e8, .2)

# arpeggio from the score onward
for s16 in np.arange(12.5, GROOVE[1], .125):
    notes = PROG[chord_at(s16)]
    k = int(round((s16 - 12.5) / .125))
    note = notes[[0, 1, 2, 3, 2, 1][k % 6]]
    f = hz(note) * 2
    add(tone(f, .3, .07, 'tri'), s16, .085, pan=.45 if k % 2 else -.45, rev=.45)

# ---------- events, in step with index.html ----------
# intro: the clock ticks, strikes 07:30, the command types
for k, tt in enumerate(np.arange(.25, 2.0, .25)):
    tick(tt, .10 if k % 2 else .16, 1900 if k % 2 else 2500)
impact(2.0, .7)
add(tone(hz('A5'), 2.5, .6, 'sine', .2), 2.0, .12, rev=.8)
for k in range(14): tick(2.15 + k / 22, .05, 3200)
for k in range(33): tick(2.9 + k / 60, .03, 3600)
riser(2.4, 4.0, .18)

# cuts
for c in [4, 9, 12.5, 19, 24, 30, 36.5, 38.5]:
    whoosh(c, .6, gain=.14)
for c in [4, 12.5, 24, 30]:
    n = int(1.6 * SR)
    add(fft_filter(noise(1.6), lo=5000) * env_exp(n, .45), c, .09, rev=.4)  # crash

# scan: chips light up as the line passes
for k, tt in enumerate(np.arange(4.6, 8.3, .125)):
    blip(tt, hz(['A5', 'C6', 'E6', 'G6'][k % 4]), .035, pan=-.8 + 1.6 * (tt - 4.6) / 3.7, decay=.05)
# the cut: a falling count, then fourteen cards pop
n = int(1.3 * SR); t = np.arange(n) / SR
f = 1800 * (0.08 ** (t / 1.3))
add(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, t / .05) * (1 - t / 1.3), 10.0, .06, rev=.4)
penta = ['A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7']
for i in range(14):
    blip(11.4 + i * .035 + .12, hz(penta[i % 7]), .05, pan=-.7 + 1.4 * (i % 7) / 6, decay=.08)
# score: each reason lands on the ring
for i, at in enumerate([13.3 + j * .5 for j in range(6)]):
    blip(at + .45, hz(['A5', 'C6', 'D6', 'E6', 'G6', 'A6'][i]), .13, decay=.2)
for note in ['A5', 'E6', 'A6', 'C7']:
    add(tone(hz(note), 2.0, .5, 'sine', .15), 16.15, .07, rev=.8)
# today: decisions land
for at in (21.0, 22.5): blip(at, hz('E6'), .12, decay=.12); tick(at, .08)
thunk(21.75, .2)
# pipeline: three drops, then the offer
for at in (26.0, 26.9, 27.8): tick(at, .1, 1500)
for at in (26.6, 27.5): thunk(at, .3)
thunk(28.4, .4)
for i, note in enumerate(['A6', 'C7', 'E7', 'A7']):
    blip(28.4 + i * .05, hz(note), .06, pan=(-.5 + i / 3), decay=.25)
# MCP: typing, the connect chime, three tool calls, the reply
for k in range(38): tick(30.45 + k / 42, .045, 3000 + (k % 3) * 300)
blip(31.45, hz('E6'), .1, decay=.3); blip(31.52, hz('A6'), .1, decay=.4)
for k in range(44): tick(31.45 + k * .016, .02, 4200)
for k in range(36): tick(31.95 + k / 44, .045, 3000 + (k % 3) * 300)
for at in (33.1, 33.5, 33.9): blip(at, hz('A5'), .08, decay=.1); blip(at + .35, hz('E6'), .06, decay=.1)
blip(35.35, hz('C6'), .08, decay=.3)
# stops before send: the drums fall away, one soft stop
thunk(37.4, .3)
add(tone(hz('A2'), 2.0, .8), 37.4, .12)
# local-first: rise into the end card, with a snare roll
riser(38.5, 40.5, .22)
for k, tt in enumerate(np.arange(39.5, 40.5, .0625)):
    add(clap(), tt, .08 + .25 * (k / 16) ** 2, rev=.3)
for k in range(14): tick(38.7 + k * .065, .03, 2600)
# the end card
impact(END, 1.0)
for k in range(27): tick(42.1 + k / 40, .04, 3000 + (k % 3) * 300)
add(tone(hz('E6'), 2.0, .8, 'sine', .1), 41.3, .05, rev=.9)

# ---------- reverb ----------
ir_n = int(2.2 * SR)
ir = rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / SR / .55)
ir = fft_filter(ir, hi=5000); ir /= np.sqrt(np.sum(ir ** 2))
m = len(send) + ir_n
wet = np.fft.irfft(np.fft.rfft(send, m) * np.fft.rfft(ir, m), m)[:N]
wetR = np.roll(wet, int(.013 * SR))
L += wet * .5; R += wetR * .5

# ---------- master ----------
fade = np.minimum(1, (DUR - T) / .6)
L *= fade; R *= fade
peak = max(np.abs(L).max(), np.abs(R).max())
L = np.tanh(L / peak * 1.25) ; R = np.tanh(R / peak * 1.25)
peak = max(np.abs(L).max(), np.abs(R).max())
L *= .89 / peak; R *= .89 / peak
out = np.empty(2 * N, dtype=np.int16)
out[0::2] = (L * 32767).astype(np.int16); out[1::2] = (R * 32767).astype(np.int16)
os.makedirs(os.path.join(os.path.dirname(__file__), 'out'), exist_ok=True)
path = os.path.join(os.path.dirname(__file__), 'out', 'music.wav')
with wave.open(path, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('wrote', path)
