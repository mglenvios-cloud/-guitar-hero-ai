"use client";

import { useState, useEffect, useRef } from "react";
import * as Tone from "tone";
import { Play, Square, Circle, Sliders, Volume2, Mic2, Sparkles, VolumeX, Piano, X, Disc, AudioWaveform, Music, Mic, Save } from "lucide-react";

type TrackState = {
  id: number;
  name: string;
  volume: number; // -60 to 0 db
  pan: number; // -1 to 1
  mute: boolean;
  solo: boolean;
  channel?: Tone.Channel;
  synth?: any; // Tone.Synth | Tone.MembraneSynth | Tone.MetalSynth | Tone.PolySynth
  sequence?: Tone.Sequence;
  hasEffect?: boolean;
};

type Toast = {
  id: number;
  message: string;
};

const PIANO_KEYS = [
  { note: "C4", key: "a", type: "white" },
  { note: "C#4", key: "w", type: "black" },
  { note: "D4", key: "s", type: "white" },
  { note: "D#4", key: "e", type: "black" },
  { note: "E4", key: "d", type: "white" },
  { note: "F4", key: "f", type: "white" },
  { note: "F#4", key: "t", type: "black" },
  { note: "G4", key: "g", type: "white" },
  { note: "G#4", key: "y", type: "black" },
  { note: "A4", key: "h", type: "white" },
  { note: "A#4", key: "u", type: "black" },
  { note: "B4", key: "j", type: "white" },
  { note: "C5", key: "k", type: "white" },
];

export default function StudioMode() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [timecode, setTimecode] = useState("0:00:000");
  const [tracks, setTracks] = useState<TrackState[]>([
    { id: 1, name: "Kick (AI Bass)", volume: -6, pan: 0, mute: false, solo: false },
    { id: 2, name: "HiHat", volume: -12, pan: 0.5, mute: false, solo: false },
    { id: 3, name: "Synth Lead", volume: -10, pan: -0.5, mute: false, solo: false },
    { id: 4, name: "Arp", volume: -12, pan: 0, mute: false, solo: false },
  ]);
  
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [synthType, setSynthType] = useState<"classic" | "minimoog" | "fm" | "8bit">("classic");
  
  const [mastered, setMastered] = useState(false);
  const masterNodes = useRef<any[]>([]);
  const [vocalInterval, setVocalInterval] = useState<any>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const recorder = useRef<any>(null);

  const initialized = useRef(false);
  const pianoSynth = useRef<any>(null);

  const addToast = (message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const setupPianoSynth = async (type: string) => {
    if (pianoSynth.current) {
      pianoSynth.current.dispose();
    }
    
    await Tone.start();
    const dest = Tone.getDestination();

    switch(type) {
      case "minimoog":
        // Simulated Moog: Sawtooth + Lowpass filter
        pianoSynth.current = new Tone.PolySynth(Tone.MonoSynth, {
          oscillator: { type: "sawtooth" },
          filter: { Q: 2, type: "lowpass", rolloff: -24 },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 1 },
          filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 2, baseFrequency: 200, octaves: 4 }
        }).connect(dest);
        break;
      case "fm":
        pianoSynth.current = new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 3,
          modulationIndex: 10,
          oscillator: { type: "sine" },
          envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 1.5 },
          modulation: { type: "square" },
          modulationEnvelope: { attack: 0.02, decay: 0.1, sustain: 0, release: 0.5 }
        }).connect(dest);
        break;
      case "8bit":
        pianoSynth.current = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "square" },
          envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.1 }
        }).connect(dest);
        break;
      case "classic":
      default:
        pianoSynth.current = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "triangle" },
          envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 1 }
        }).connect(dest);
        break;
    }
    pianoSynth.current.volume.value = -8;
  };

  useEffect(() => {
    setupPianoSynth(synthType);
  }, [synthType]);

  // Keyboard mapping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const keyMap = PIANO_KEYS.find((k) => k.key === e.key.toLowerCase());
      if (keyMap) {
        setActiveKeys((prev) => new Set(prev).add(keyMap.note));
        pianoSynth.current?.triggerAttack(keyMap.note);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const keyMap = PIANO_KEYS.find((k) => k.key === e.key.toLowerCase());
      if (keyMap) {
        setActiveKeys((prev) => {
          const next = new Set(prev);
          next.delete(keyMap.note);
          return next;
        });
        pianoSynth.current?.triggerRelease(keyMap.note);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Inicializar motor de audio
  const initAudio = async () => {
    if (initialized.current) return;
    await Tone.start();
    
    const newTracks = [...tracks];

    // Track 1: Kick
    const kickChannel = new Tone.Channel(-6, 0).toDestination();
    const kickSynth = new Tone.MembraneSynth().connect(kickChannel);
    const kickSeq = new Tone.Sequence((time, note) => {
      if (note) kickSynth.triggerAttackRelease(note, "8n", time);
    }, ["C1", null, "C1", null, "C1", null, "C1", null], "8n").start(0);

    newTracks[0].channel = kickChannel;
    newTracks[0].synth = kickSynth;
    newTracks[0].sequence = kickSeq;

    // Track 2: HiHat
    const hatChannel = new Tone.Channel(-12, 0.5).toDestination();
    const hatSynth = new Tone.MetalSynth({ envelope: { decay: 0.1 } }).connect(hatChannel);
    const hatSeq = new Tone.Sequence((time) => {
      hatSynth.triggerAttackRelease("32n", time);
    }, ["8n", "8n", "8n", "8n", "8n", "8n", "8n", "8n"], "8n").start(0);

    newTracks[1].channel = hatChannel;
    newTracks[1].synth = hatSynth;
    newTracks[1].sequence = hatSeq;

    // Track 3: Synth Lead
    const leadChannel = new Tone.Channel(-10, -0.5).toDestination();
    const leadSynth = new Tone.Synth({ oscillator: { type: "sawtooth" } }).connect(leadChannel);
    const leadSeq = new Tone.Sequence((time, note) => {
      if (note) leadSynth.triggerAttackRelease(note, "8n", time);
    }, [null, "E4", null, "G4", "A4", null, "G4", null], "8n").start(0);

    newTracks[2].channel = leadChannel;
    newTracks[2].synth = leadSynth;
    newTracks[2].sequence = leadSeq;

    // Track 4: Arp
    const arpChannel = new Tone.Channel(-12, 0).toDestination();
    const arpSynth = new Tone.Synth({ oscillator: { type: "square" } }).connect(arpChannel);
    const arpSeq = new Tone.Sequence((time, note) => {
      if (note) arpSynth.triggerAttackRelease(note, "16n", time);
    }, ["C4", "E4", "G4", "C5", "G4", "E4"], "16n").start(0);

    newTracks[3].channel = arpChannel;
    newTracks[3].synth = arpSynth;
    newTracks[3].sequence = arpSeq;

    setTracks(newTracks);
    Tone.Transport.bpm.value = 120;
    initialized.current = true;
    addToast("Audio Engine Inicializado.");
  };

  useEffect(() => {
    return () => {
      Tone.Transport.stop();
      tracks.forEach(t => {
        t.synth?.dispose();
        if ((t as any).extraSynths) {
            (t as any).extraSynths.forEach((s: any) => s.dispose());
        }
        t.channel?.dispose();
        t.sequence?.dispose();
      });
      pianoSynth.current?.dispose();
      masterNodes.current.forEach(n => n.dispose());
      if (vocalInterval !== null) {
          Tone.Transport.clear(vocalInterval);
      }
      recorder.current?.dispose();
    };
  }, []);

  // Update timecode visual
  useEffect(() => {
    let animationFrame: number;
    const updateTime = () => {
      if (Tone.Transport.state === "started") {
        const time = Tone.Transport.seconds;
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        const ms = Math.floor((time % 1) * 1000);
        setTimecode(`${mins}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(3, '0')}`);
      }
      animationFrame = requestAnimationFrame(updateTime);
    };
    if (isPlaying) updateTime();
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying]);

  const togglePlay = async () => {
    await initAudio();
    if (isPlaying) {
      Tone.Transport.pause();
      setIsPlaying(false);
    } else {
      Tone.Transport.start();
      setIsPlaying(true);
    }
  };

  const stopPlayback = () => {
    Tone.Transport.stop();
    setIsPlaying(false);
    setTimecode("0:00:000");
  };

  const applyAIEffect = async (trackIndex: number) => {
    await initAudio();
    const track = tracks[trackIndex];
    if (!track.channel) return;
    
    if (track.hasEffect) {
      addToast(`Efecto ya aplicado a ${track.name}`);
      return;
    }

    // AI simula añadir Reverb o Delay al azar para mejorar mezcla
    const isReverb = Math.random() > 0.5;
    if (isReverb) {
      const reverb = new Tone.Reverb({ decay: 2, wet: 0.5 }).toDestination();
      track.channel.connect(reverb);
      addToast(`[Auto Mix AI] Aplicado Reverb Espacial a ${track.name}`);
    } else {
      const delay = new Tone.PingPongDelay("8n", 0.3).toDestination();
      track.channel.connect(delay);
      addToast(`[Auto Mix AI] Aplicado PingPong Delay a ${track.name}`);
    }
    
    // Auto pan and volume tweak
    track.channel.volume.value -= 2;
    track.channel.pan.value = (Math.random() - 0.5) * 0.8;
    
    const newTracks = [...tracks];
    newTracks[trackIndex].hasEffect = true;
    newTracks[trackIndex].volume = track.channel.volume.value;
    setTracks(newTracks);
  };

  const addAiTrack = async () => {
    await initAudio();
    const id = tracks.length + 1;
    const notes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", null, null];
    
    const randomSequence = [];
    for(let i=0; i<8; i++) {
      randomSequence.push(notes[Math.floor(Math.random() * notes.length)]);
    }

    const channel = new Tone.Channel(-10, (Math.random() - 0.5)).toDestination();
    // Usa un sintetizador Poly con el tono seleccionado en el teclado
    let synth;
    if (synthType === "fm") {
      synth = new Tone.PolySynth(Tone.FMSynth).connect(channel);
    } else if (synthType === "minimoog") {
      synth = new Tone.PolySynth(Tone.MonoSynth, { oscillator: { type: "sawtooth" } }).connect(channel);
    } else {
      synth = new Tone.PolySynth(Tone.Synth).connect(channel);
    }

    const seq = new Tone.Sequence((time, note) => {
      if (note) synth.triggerAttackRelease(note, "8n", time);
    }, randomSequence, "8n").start(0);

    const newTrack: TrackState = {
      id,
      name: `AI Gen ${synthType.toUpperCase()}`,
      volume: -10,
      pan: channel.pan.value,
      mute: false,
      solo: false,
      channel,
      synth,
      sequence: seq
    };

    setTracks([...tracks, newTrack]);
    addToast(`Pista generada por IA añadida (${synthType})`);
  };

  const addAiDrumTrack = async () => {
    await initAudio();
    const id = tracks.length + 1;
    
    const channel = new Tone.Channel(-6, 0).toDestination();
    
    const kick = new Tone.MembraneSynth().connect(channel);
    const snare = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
    }).connect(channel);
    const hihat = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5
    }).connect(channel);

    const steps = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const seq = new Tone.Sequence((time, step) => {
        if (step === 0 || step === 8 || (step === 14 && Math.random() > 0.7)) {
            kick.triggerAttackRelease("C1", "8n", time);
        }
        if (step === 4 || step === 12) {
            snare.triggerAttackRelease("16n", time);
        }
        if (step % 2 === 0 || Math.random() > 0.85) {
            hihat.triggerAttackRelease("32n", time, 0.3);
        }
    }, steps, "16n").start(0);

    const newTrack: TrackState = {
      id,
      name: "AI Drum Groove",
      volume: -6,
      pan: 0,
      mute: false,
      solo: false,
      channel,
      synth: kick,
      sequence: seq
    };
    
    (newTrack as any).extraSynths = [snare, hihat];

    setTracks([...tracks, newTrack]);
    addToast("Pista de batería generada por IA añadida");
  };

  const addAiChordsTrack = async () => {
    await initAudio();
    const id = tracks.length + 1;
    const channel = new Tone.Channel(-12, 0).toDestination();
    
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.5, decay: 0.5, sustain: 0.8, release: 2 }
    }).connect(channel);

    const chords = [
        ["C4", "E4", "G4"], 
        ["G3", "B3", "D4"], 
        ["A3", "C4", "E4"], 
        ["F3", "A3", "C4"]
    ];
    
    const seq = new Tone.Sequence((time, step) => {
        const chord = chords[step % chords.length];
        synth.triggerAttackRelease(chord, "2n", time);
    }, [0, 1, 2, 3], "1m").start(0); 

    const newTrack: TrackState = {
      id,
      name: "AI Chords (I-V-vi-IV)",
      volume: -12,
      pan: 0,
      mute: false,
      solo: false,
      channel,
      synth,
      sequence: seq
    };

    setTracks([...tracks, newTrack]);
    addToast("Pista de Acordes de IA añadida");
  };

  const toggleMastering = async () => {
    await initAudio();
    if (mastered) {
      masterNodes.current.forEach(n => n.dispose());
      masterNodes.current = [];
      setMastered(false);
      addToast("AI Mastering Desactivado");
    } else {
      const comp = new Tone.Compressor(-20, 3);
      const eq = new Tone.EQ3(2, 0, 1);
      const limiter = new Tone.Limiter(-2);
      Tone.getDestination().chain(comp, eq, limiter);
      masterNodes.current = [comp, eq, limiter];
      setMastered(true);
      addToast("AI Mastering Activado: Mezcla optimizada globalmente");
    }
  };

  const toggleAiVocals = async () => {
    await initAudio();
    if (vocalInterval !== null) {
      Tone.Transport.clear(vocalInterval);
      setVocalInterval(null);
      addToast("AI Vocals Desactivado");
    } else {
      const phrases = ["Digital mind", "System online", "Feel the rhythm", "Make some noise", "Artificial intelligence"];
      let step = 0;
      
      const id = Tone.Transport.scheduleRepeat((time) => {
        if (step % 2 === 0) { 
          const phrase = phrases[Math.floor(Math.random() * phrases.length)];
          const utterance = new SpeechSynthesisUtterance(phrase);
          utterance.rate = 1.2;
          utterance.pitch = 0.5 + Math.random() * 1.5;
          
          const voices = window.speechSynthesis.getVoices();
          const enVoice = voices.find(v => v.lang.includes("en") && (v.name.includes("Google") || v.name.includes("Zira")));
          if (enVoice) utterance.voice = enVoice;
          
          window.speechSynthesis.speak(utterance);
        }
        step++;
      }, "1m");
      
      setVocalInterval(id);
      addToast("AI Vocals Activado: Voces robóticas en camino");
    }
  };

  const toggleRecording = async () => {
    await initAudio();
    if (isRecording) {
      if (recorder.current) {
        const recording = await recorder.current.stop();
        const url = URL.createObjectURL(recording);
        const anchor = document.createElement("a");
        anchor.download = "mi-cancion-ai.webm";
        anchor.href = url;
        anchor.click();
        addToast("Grabación guardada con éxito");
      }
      setIsRecording(false);
    } else {
      if (!recorder.current) {
        recorder.current = new Tone.Recorder();
        Tone.getDestination().connect(recorder.current);
      }
      recorder.current.start();
      setIsRecording(true);
      addToast("Grabando... Reproduce tus pistas o toca el piano");
    }
  };

  const handleVolume = (index: number, val: number) => {
    const newTracks = [...tracks];
    newTracks[index].volume = val;
    if (newTracks[index].channel) {
      newTracks[index].channel!.volume.value = val;
    }
    setTracks(newTracks);
  };

  const toggleMute = (index: number) => {
    const newTracks = [...tracks];
    newTracks[index].mute = !newTracks[index].mute;
    if (newTracks[index].channel) {
      newTracks[index].channel!.mute = newTracks[index].mute;
    }
    setTracks(newTracks);
  };

  const toggleSolo = (index: number) => {
    const newTracks = [...tracks];
    newTracks[index].solo = !newTracks[index].solo;
    if (newTracks[index].channel) {
      newTracks[index].channel!.solo = newTracks[index].solo;
    }
    setTracks(newTracks);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Toasts */}
      <div className="absolute top-20 right-8 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className="bg-primary text-white px-4 py-3 rounded-lg shadow-xl border border-primary/50 flex items-center gap-3 animate-in fade-in slide-in-from-right">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="glass h-16 border-b border-border flex items-center px-6 justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-hover text-red-500 transition-colors">
            <Circle className="w-5 h-5 fill-current" />
          </button>
          <button 
            onClick={stopPlayback}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-hover text-gray-400 transition-colors"
          >
            <Square className="w-5 h-5 fill-current" />
          </button>
          <button 
            onClick={togglePlay}
            className={`w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-hover transition-colors ${isPlaying ? 'text-green-400 neon-text' : 'text-green-600'}`}
          >
            <Play className="w-5 h-5 fill-current" />
          </button>
          <div className="w-px h-8 bg-border mx-2" />
          <div className="flex flex-col">
            <span className="text-[10px] text-primary/80 font-mono tracking-widest">TIMECODE</span>
            <span className="text-sm font-mono font-bold text-white tracking-wider">{timecode}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleMastering} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${mastered ? 'bg-purple-600 text-white' : 'border border-purple-600 text-purple-400 hover:bg-purple-600/10'}`}>
            <AudioWaveform className="w-4 h-4" /> AI Master
          </button>
          <div className="w-px h-6 bg-border mx-1" />
          <button onClick={toggleAiVocals} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${vocalInterval !== null ? 'bg-blue-600 text-white' : 'border border-blue-600 text-blue-400 hover:bg-blue-600/10'}`}>
            <Mic className="w-4 h-4" /> AI Vocals
          </button>
          <button onClick={addAiChordsTrack} className="px-4 py-2 border border-green-500 text-green-400 hover:bg-green-500/10 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Music className="w-4 h-4" /> Add Chords
          </button>
          <button onClick={addAiDrumTrack} className="px-4 py-2 border border-primary text-primary hover:bg-primary/10 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Disc className="w-4 h-4" /> Add Drums
          </button>
          <button onClick={addAiTrack} className="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Mic2 className="w-4 h-4" /> Add Melody
          </button>
          <div className="w-px h-6 bg-border mx-1" />
          <button 
            onClick={toggleRecording} 
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 
              ${isRecording ? 'bg-red-600 text-white animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.6)]' : 'bg-surface border border-red-500/50 text-red-500 hover:bg-red-500/10'}`}
          >
            <Save className="w-4 h-4" /> {isRecording ? 'Stop & Export' : 'Record Audio'}
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Track Headers (Mixer) */}
        <div className="w-80 border-r border-border bg-surface overflow-y-auto z-10 shadow-2xl flex-shrink-0">
          {tracks.map((track, i) => (
            <div key={track.id} className="h-32 border-b border-border p-4 flex flex-col justify-between bg-surface/50 hover:bg-surface-hover transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-200">{track.name}</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => toggleMute(i)}
                    className={`w-7 h-7 flex items-center justify-center text-xs rounded transition-colors font-bold ${track.mute ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-surface border border-border text-gray-400 hover:text-white'}`}
                  >
                    M
                  </button>
                  <button 
                    onClick={() => toggleSolo(i)}
                    className={`w-7 h-7 flex items-center justify-center text-xs rounded transition-colors font-bold ${track.solo ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' : 'bg-surface border border-border text-gray-400 hover:text-white'}`}
                  >
                    S
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <Volume2 className="w-4 h-4 text-gray-500 shrink-0" />
                <input 
                  type="range" 
                  min="-60" 
                  max="0" 
                  value={track.volume}
                  onChange={(e) => handleVolume(i, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className="text-xs font-mono w-8 text-right text-gray-400">{Math.round(track.volume)}</span>
              </div>
              
              <div className="flex items-center justify-between mt-2">
                <button 
                  onClick={() => applyAIEffect(i)}
                  disabled={track.hasEffect}
                  className={`flex items-center gap-1.5 text-[10px] uppercase font-bold transition-colors px-2 py-1 rounded
                    ${track.hasEffect ? 'text-gray-500 bg-gray-800 cursor-not-allowed' : 'text-accent hover:text-accent/80 bg-accent/10'}`}
                >
                  <Sparkles className="w-3 h-3" /> Auto Mix AI
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="flex-1 bg-background relative overflow-auto">
          <div className="absolute inset-0" style={{ 
            backgroundImage: "linear-gradient(to right, var(--color-border) 1px, transparent 1px)", 
            backgroundSize: "120px 100%" 
          }}>
            {tracks.map((track, i) => (
              <div key={`timeline-${track.id}`} className="absolute w-full h-32 border-b border-border/30" style={{ top: i * 128 }}>
                <div className={`absolute top-4 bottom-4 left-[20px] w-[800px] rounded-md border backdrop-blur-sm flex items-center px-4 shadow-lg overflow-hidden
                  ${i === 0 ? 'bg-primary/20 border-primary/50 text-primary' : ''}
                  ${i === 1 ? 'bg-secondary/20 border-secondary/50 text-secondary' : ''}
                  ${i === 2 ? 'bg-accent/20 border-accent/50 text-accent' : ''}
                  ${i >= 3 ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-500' : ''}
                `}>
                  <div className="absolute inset-0 flex items-center gap-1 px-2 opacity-50">
                    {[...Array(100)].map((_, j) => (
                      <div key={j} className="w-1.5 bg-current rounded-full" style={{ height: `${Math.random() * 80 + 10}%` }} />
                    ))}
                  </div>
                  <span className="relative z-10 text-xs font-bold bg-background/50 px-2 py-1 rounded">{track.name} Loop</span>
                </div>
              </div>
            ))}
            
            {/* Playhead */}
            {isPlaying && (
              <div className="absolute top-0 bottom-0 w-px bg-red-500 z-50 shadow-[0_0_10px_rgba(239,68,68,1)]" 
                   style={{ left: `calc(20px + ${Tone.Transport.seconds * 60}px)` }}>
                <div className="absolute -top-1 -translate-x-1/2 w-3 h-3 rotate-45 bg-red-500" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Piano Virtual Panel */}
      <div className="h-64 glass border-t border-border shrink-0 flex flex-col z-20">
        <div className="h-12 border-b border-border flex items-center px-6 justify-between bg-surface/50">
          <div className="flex items-center gap-2">
            <Piano className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-bold text-gray-200">Virtual Keyboard</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 font-medium">SYNTH ENGINE:</span>
            <select 
              value={synthType}
              onChange={(e: any) => setSynthType(e.target.value)}
              className="px-3 py-1 bg-background border border-border rounded text-sm text-white outline-none focus:border-primary"
            >
              <option value="classic">Classic Piano</option>
              <option value="minimoog">Minimoog Lead</option>
              <option value="fm">FM Electric</option>
              <option value="8bit">8-Bit Chiptune</option>
            </select>
          </div>
        </div>

        {/* The Keys */}
        <div className="flex-1 flex relative justify-center items-end pb-4 bg-[#111] overflow-hidden">
          <div className="flex relative h-[90%] w-[512px]"> {/* 8 white keys * 64px = 512px */}
            {PIANO_KEYS.map((k, i) => {
              const isBlack = k.type === "black";
              const isActive = activeKeys.has(k.note);
              
              // Count how many white keys come before this key to calculate left offset for black keys
              const whiteKeysBefore = PIANO_KEYS.slice(0, i).filter(key => key.type === "white").length;
              const leftOffset = whiteKeysBefore * 64 - 24; // 64px width per white key, 24px half-width of black key

              if (isBlack) {
                return (
                  <div 
                    key={k.note}
                    onMouseDown={() => {
                      pianoSynth.current?.triggerAttack(k.note);
                      setActiveKeys(prev => new Set(prev).add(k.note));
                    }}
                    onMouseUp={() => {
                      pianoSynth.current?.triggerRelease(k.note);
                      setActiveKeys(prev => { const n = new Set(prev); n.delete(k.note); return n; });
                    }}
                    onMouseLeave={() => {
                      if (activeKeys.has(k.note)) {
                        pianoSynth.current?.triggerRelease(k.note);
                        setActiveKeys(prev => { const n = new Set(prev); n.delete(k.note); return n; });
                      }
                    }}
                    className={`absolute w-12 h-2/3 bg-black z-10 border border-gray-800 rounded-b-md cursor-pointer transition-colors flex flex-col justify-end pb-4 items-center select-none
                      ${isActive ? 'bg-primary shadow-[0_0_15px_rgba(236,72,153,0.8)]' : ''}`}
                    style={{ left: `${leftOffset}px` }} 
                  >
                    <span className="text-[10px] text-gray-500 uppercase">{k.key}</span>
                  </div>
                );
              }

              return (
                <div 
                  key={k.note}
                  onMouseDown={() => {
                    pianoSynth.current?.triggerAttack(k.note);
                    setActiveKeys(prev => new Set(prev).add(k.note));
                  }}
                  onMouseUp={() => {
                    pianoSynth.current?.triggerRelease(k.note);
                    setActiveKeys(prev => { const n = new Set(prev); n.delete(k.note); return n; });
                  }}
                  onMouseLeave={() => {
                    if (activeKeys.has(k.note)) {
                      pianoSynth.current?.triggerRelease(k.note);
                      setActiveKeys(prev => { const n = new Set(prev); n.delete(k.note); return n; });
                    }
                  }}
                  className={`w-16 h-full bg-white border border-gray-300 rounded-b-lg cursor-pointer transition-colors flex flex-col justify-end pb-4 items-center select-none z-0
                    ${isActive ? 'bg-primary shadow-[0_0_20px_rgba(236,72,153,0.5)] border-primary' : ''}`}
                >
                  <span className={`text-xs font-bold uppercase ${isActive ? 'text-white' : 'text-gray-400'}`}>{k.key}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
