import { useEffect, useRef, useState } from 'react';
import { RocketLaunch, SpeakerHigh, SpeakerSlash, CornersOut, CornersIn } from '@phosphor-icons/react';

export function launchWarp() { window.dispatchEvent(new CustomEvent('orbit:warp', { detail: { duration: 2600 } })); }

export default function ExperienceDock({ paused = false }) {
  const [sound, setSound] = useState(false), [fullscreen, setFullscreen] = useState(false), [warping, setWarping] = useState(false);
  const audio = useRef(null), timer = useRef(null);
  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', change);
    return () => { document.removeEventListener('fullscreenchange', change); clearTimeout(timer.current); audio.current?.context.close(); };
  }, []);
  useEffect(() => {
    if (!audio.current) return;
    const { context, gain } = audio.current;
    gain.gain.setTargetAtTime(sound && !paused ? 0.055 : 0, context.currentTime, 0.5);
  }, [sound, paused]);
  const toggleSound = async () => {
    if (!audio.current) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      const context = new Context(), gain = context.createGain(), filter = context.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 750; gain.gain.value = 0;
      filter.connect(gain); gain.connect(context.destination);
      [110, 164.81, 220, 277.18, 329.63].forEach((frequency, index) => {
        const oscillator = context.createOscillator(), voice = context.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency; oscillator.detune.value = index % 2 ? 5 : -4;
        voice.gain.value = 0.16;
        oscillator.connect(voice); voice.connect(filter); oscillator.start();
      });
      audio.current = { context, gain };
    }
    try { await audio.current.context.resume(); setSound(value => !value); } catch { setSound(false); }
  };
  const warp = () => { if (paused || warping) return; launchWarp(); setWarping(true); timer.current = setTimeout(() => setWarping(false), 2700); };
  useEffect(() => {
    const key = event => { if (event.key.toLowerCase() === 'w' && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey && !event.target.closest('input, textarea, [contenteditable], dialog')) warp(); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  const toggleFullscreen = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* Browser owns fullscreen availability. */ } };
  return <div className="experience-dock" aria-label="体験コントロール">
    <button className={`dock-warp ${warping?'engaged':''}`} onClick={warp} disabled={paused || warping} aria-label="WARP: ワープ演出を起動"><RocketLaunch size={17}/><span>{warping?'WARPING':'WARP'}</span><kbd>W</kbd></button>
    <span className="dock-divider"/>
    <button onClick={toggleSound} aria-pressed={sound} aria-label={sound?'SOUND ON: 音をオフにする':'SOUND OFF: 音をオンにする'}>{sound?<SpeakerHigh size={16}/>:<SpeakerSlash size={16}/>}<span>{sound?'SOUND ON':'SOUND OFF'}</span></button>
    {document.fullscreenEnabled && <button className="dock-fullscreen" onClick={toggleFullscreen} aria-label={fullscreen?'全画面を終了':'全画面で見る'}>{fullscreen?<CornersIn size={17}/>:<CornersOut size={17}/>}</button>}
  </div>;
}
