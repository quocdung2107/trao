# Tự tổng hợp bản phối cho 3 giai điệu Giáng sinh thuộc phạm vi công cộng
# (Silent Night 1818, Jingle Bells 1857, We Wish You a Merry Christmas - dân ca Anh).
import numpy as np, subprocess, sys
SR = 44100
rng = np.random.default_rng(7)
NOTE = {'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
def hz(n):
    name, octv = n[:-1], int(n[-1]); semi = NOTE[name[0]] + (1 if '#' in name else 0) - (1 if name.endswith('b') and len(name)>1 else 0)
    return 440 * 2 ** ((semi + 12*(octv+1) - 69)/12)
def env_ad(n, a, decay):
    t = np.arange(n)/SR; e = np.exp(-t/decay); k = int(a*SR)
    if k: e[:k] *= np.linspace(0,1,k)
    return e
def bell(f, dur, amp=0.3):
    n = int((dur+1.6)*SR); t = np.arange(n)/SR; y = np.zeros(n)
    for p, a, d in [(1,1,0.9),(2,0.35,0.5),(3,0.12,0.3),(4.2,0.08,0.18),(5.4,0.04,0.12)]:
        y += a*np.sin(2*np.pi*f*p*t)*env_ad(n,0.003,d*(1.4 if f<500 else 1))
    return amp*y
def organ(f, dur, amp=0.18):
    n = int((dur+0.4)*SR); t = np.arange(n)/SR
    y = sum(a*np.sin(2*np.pi*f*p*t) for p,a in [(1,1),(2,0.5),(3,0.25),(4,0.12)])
    e = np.ones(n); a=int(0.06*SR); r=int(0.4*SR); e[:a]=np.linspace(0,1,a); e[-r:]*=np.linspace(1,0,r)
    vib = 1+0.002*np.sin(2*np.pi*5*t)
    return amp*y*e*vib
def pad(freqs, dur, amp=0.06):
    n = int((dur+0.8)*SR); t = np.arange(n)/SR; y=np.zeros(n)
    for f in freqs:
        for det in (-0.6,0.6):
            ff=f+det; y += np.sin(2*np.pi*ff*t)+0.3*np.sin(4*np.pi*ff*t)
    e=np.ones(n); a=int(0.4*SR); r=int(0.8*SR); e[:a]=np.linspace(0,1,a); e[-r:]*=np.linspace(1,0,r)
    return amp*y*e/len(freqs)
def pluck_bass(f, dur, amp=0.22):
    n=int((dur+0.3)*SR); t=np.arange(n)/SR
    y=np.sin(2*np.pi*f*t)+0.3*np.sin(4*np.pi*f*t)
    return amp*y*env_ad(n,0.005,0.45)
def chime(dur, amp=0.05):  # leng keng nhẹ
    n=int(0.5*SR); t=np.arange(n)/SR; f=2600+rng.random()*900
    return amp*np.sin(2*np.pi*f*t)*env_ad(n,0.001,0.08)
CH = {'C':['C3','E3','G3'],'F':['F3','A3','C4'],'G':['G2','B2','D3'],'G7':['G2','B2','F3'],'Am':['A2','C3','E3'],'D7':['D3','F#3','C4'],'Dm':['D3','F3','A3'],'Em':['E3','G3','B3']}
def mix(a,b):
    n=max(len(a),len(b)); o=np.zeros(n); o[:len(a)]+=a; o[:len(b)]+=b; return o
def place(buf, y, at):
    i=int(at*SR); j=min(len(buf), i+len(y)); buf[i:j]+=y[:j-i]
def reverb(x, secs=2.2, wet=0.28):
    n=int(secs*SR); ir=rng.standard_normal(n)*np.exp(-np.arange(n)/SR/(secs/5)); ir[0]=0; ir/=np.sqrt((ir**2).sum())
    L=len(x)+n; N=1<<int(np.ceil(np.log2(L)))
    w=np.fft.irfft(np.fft.rfft(x,N)*np.fft.rfft(ir,N),N)[:len(x)]
    return (1-wet)*x+wet*w*0.6
def render(name, bpm, melody, chords, lead, reps, extra=None):
    spb=60/bpm; total=sum(d for _,d in melody)*reps*spb+3
    buf=np.zeros(int(total*SR)+SR*3)
    t0=0.5
    for r in range(reps):
        t=t0
        for n,d in melody:
            if n!='R': place(buf, lead(hz(n), d*spb), t)
            t+=d*spb
        t=t0
        for c,d in chords:
            place(buf, pad([hz(x) for x in CH[c]], d*spb), t)
            if extra: extra(buf, c, d, t, spb)
            t+=d*spb
        t0=t
    end=int((t0+2.5)*SR); buf=buf[:end]
    buf=reverb(buf); buf/=np.max(np.abs(buf))*1.12
    f=int(2.0*SR); buf[-f:]*=np.linspace(1,0,f)
    pcm=(buf*32767).astype('<i2').tobytes()
    out=sys.argv[1]+f'/{name}.mp3'
    subprocess.run(['ffmpeg','-y','-loglevel','error','-f','s16le','-ar',str(SR),'-ac','1','-i','-','-codec:a','libmp3lame','-b:a','96k','-metadata',f'title={name}','-metadata','artist=TRAO','-metadata','comment=Ban phoi tu tong hop, giai dieu thuoc pham vi cong cong',out],input=pcm,check=True)
    print(out, round(len(buf)/SR,1),'s')

# Silent Night: organ + chuông, 3/4 chậm
sn=[('G4',1.5),('A4',.5),('G4',1),('E4',3),('G4',1.5),('A4',.5),('G4',1),('E4',3),('D5',2),('D5',1),('B4',3),('C5',2),('C5',1),('G4',3),
    ('A4',2),('A4',1),('C5',1.5),('B4',.5),('A4',1),('G4',1.5),('A4',.5),('G4',1),('E4',3),('A4',2),('A4',1),('C5',1.5),('B4',.5),('A4',1),('G4',1.5),('A4',.5),('G4',1),('E4',3),
    ('D5',2),('D5',1),('F5',1.5),('D5',.5),('B4',1),('C5',3),('E5',3),('C5',1),('G4',1),('E4',1),('G4',1.5),('F4',.5),('D4',1),('C4',3),('R',3)]
snc=[(c,3) for c in 'C C C C G G C C F F C C F F C C G G C C C G C C'.split()]
def sn_bass(buf,c,d,t,spb): place(buf, pluck_bass(hz(CH[c][0].replace('3','2') if '3' in CH[c][0] else CH[c][0]), d*spb, 0.12), t)
render('dem-thanh', 66, sn, snc, lambda f,d: mix(organ(f,d),bell(f*2,d,0.05)), 1, sn_bass)

# Jingle Bells (đoạn điệp khúc), hộp nhạc ấm + bass gảy + leng keng
jb=[('E4',1),('E4',1),('E4',2),('E4',1),('E4',1),('E4',2),('E4',1),('G4',1),('C4',1.5),('D4',.5),('E4',4),
    ('F4',1),('F4',1),('F4',1.5),('F4',.5),('F4',1),('E4',1),('E4',1),('E4',.5),('E4',.5),('E4',1),('D4',1),('D4',1),('E4',1),('D4',2),('G4',2),
    ('E4',1),('E4',1),('E4',2),('E4',1),('E4',1),('E4',2),('E4',1),('G4',1),('C4',1.5),('D4',.5),('E4',4),
    ('F4',1),('F4',1),('F4',1.5),('F4',.5),('F4',1),('E4',1),('E4',1),('E4',.5),('E4',.5),('G4',1),('G4',1),('F4',1),('D4',1),('C4',4)]
jb=[(n[:-1]+str(int(n[-1])+1),d) for n,d in jb]
jbc=[(c,4) for c in 'C C C C F C D7 G C C C C F C G7 C'.split()]
def jb_extra(buf,c,d,t,spb):
    root=hz(CH[c][0]); fifth=hz(CH[c][2])
    for k in range(int(d)):
        place(buf, pluck_bass(root if k%2==0 else fifth, spb*0.9, 0.16), t+k*spb)
        place(buf, chime(spb), t+k*spb+spb/2)
render('lo-suoi', 108, jb, jbc, lambda f,d: bell(f,d,0.26), 2, jb_extra)

# We Wish You a Merry Christmas, nhịp 3, sáng và rộn ràng
ww=[('G4',1),('C5',1),('C5',.5),('D5',.5),('C5',.5),('B4',.5),('A4',1),('A4',1),('A4',1),('D5',1),('D5',.5),('E5',.5),('D5',.5),('C5',.5),('B4',1),('G4',1),
    ('G4',1),('E5',1),('E5',.5),('F5',.5),('E5',.5),('D5',.5),('C5',1),('A4',1),('G4',.5),('G4',.5),('A4',1),('D5',1),('B4',1),('C5',2),
    ('G4',1),('C5',1),('C5',1),('C5',1),('B4',2),('B4',1),('C5',1),('B4',1),('A4',1),('G4',2),('D5',1),('E5',1),('D5',.5),('C5',.5),('G5',1),('G4',1),
    ('G4',.5),('G4',.5),('A4',1),('D5',1),('B4',1),('C5',2),('R',1)]
wwc=[('C',1),('F',3),('D7',3),('G',3),('Em',3),('F',3),('G7',3),('C',3),('C',3),('G',3),('G7',3),('C',3),('G7',3),('F',1),('G7',2),('C',3)]
def ww_extra(buf,c,d,t,spb):
    for k in range(int(round(d))):
        place(buf, pluck_bass(hz(CH[c][0]) if k==0 else hz(CH[c][2])/2, spb*0.9, 0.18 if k==0 else 0.1), t+k*spb)
render('gala', 120, ww, wwc, lambda f,d: mix(bell(f,d,0.22),organ(f,d,0.05)), 3, ww_extra)
