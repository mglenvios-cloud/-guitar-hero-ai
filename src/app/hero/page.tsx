"use client";

import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { Midi } from "@tonejs/midi";
import { Upload, Play, Music } from "lucide-react";

// Constantes del juego
const KEYS = ["a", "s", "d", "f"];
const LANE_COLORS = ["#ec4899", "#8b5cf6", "#14b8a6", "#eab308"];
const PITCHES = ["C4", "E4", "G4", "C5"]; 
const NOTE_SPEED = 0.4; // píxeles por milisegundo
const HIT_ZONE_Y = 500; 
const HIT_TOLERANCE = 60; 
const NOTE_RADIUS = 20;

type GameNote = {
  id: number;
  time: number; // ms
  lane: number;
  hit: boolean;
  missed: boolean;
};

type HitText = { text: string; color: string; life: number; x: number; y: number };
type Shockwave = { x: number; y: number; color: string; radius: number; life: number };

export default function MusicHeroMode() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'finished'>('idle');
  const [stats, setStats] = useState({ hits: 0, misses: 0, maxCombo: 0 });
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [songName, setSongName] = useState("Selecciona una canción...");
  const [currentSong, setCurrentSong] = useState<GameNote[]>([]);
  const [rawNotes, setRawNotes] = useState<any[]>([]);
  const [debugError, setDebugError] = useState<string | null>(null);

  const midiPart = useRef<Tone.Part | null>(null);
  const bgSynth = useRef<Tone.PolySynth | null>(null);

  const SONGS = [
    { name: "De Música Ligera (Soda Stereo)", path: "/midis/musica_ligera.mid" },
    { name: "Jijiji (Los Redondos)", path: "/midis/jijiji.mid" },
    { name: "Mil Horas (Los Abuelos)", path: "/midis/mil_horas.mid" },
    { name: "Arpegio Demo", path: "/cancion.mid" }
  ];

  // Referencias mutables para el Game Loop
  const gameState = useRef({
    startTime: 0,
    notes: [] as GameNote[],
    keysPressed: [false, false, false, false],
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    misses: 0,
    synth: null as Tone.PolySynth | null,
    particles: [] as { x: number; y: number; color: string; life: number; vx: number; vy: number }[],
    hitTexts: [] as HitText[],
    shockwaves: [] as Shockwave[],
  });

  useEffect(() => {
    bgSynth.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.2, release: 1 },
    }).toDestination();
    bgSynth.current.volume.value = -12;

    gameState.current.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 1 },
    }).toDestination();

    return () => {
      gameState.current.synth?.dispose();
      bgSynth.current?.dispose();
      midiPart.current?.dispose();
      Tone.Transport.stop();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const lane = KEYS.indexOf(e.key.toLowerCase());
      if (lane !== -1 && !gameState.current.keysPressed[lane]) {
        gameState.current.keysPressed[lane] = true;
        checkHit(lane);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const lane = KEYS.indexOf(e.key.toLowerCase());
      if (lane !== -1) {
        gameState.current.keysPressed[lane] = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isPlaying]);

  const parseMidiBuffer = (arrayBuffer: ArrayBuffer, name: string) => {
    try {
      setDebugError(null);
      // Fallback para diferentes formatos de importación
      const MidiConstructor = Midi || (Midi as any).default || (window as any).Midi;
      if (!MidiConstructor) {
        throw new Error("La clase Midi no está definida en la importación.");
      }
      const midi = new MidiConstructor(arrayBuffer);
      const track = midi.tracks.find((t: any) => t.notes.length > 0);
      
      if (!track) {
        setDebugError("El archivo MIDI no contiene notas.");
        return;
      }

      let minPitch = 127;
      let maxPitch = 0;
      track.notes.forEach(n => {
        if (n.midi < minPitch) minPitch = n.midi;
        if (n.midi > maxPitch) maxPitch = n.midi;
      });
      const pitchRange = Math.max(1, maxPitch - minPitch);

      const parsedNotes: GameNote[] = track.notes.map((note, index) => {
        let lane = Math.floor(((note.midi - minPitch) / pitchRange) * 4);
        if (lane > 3) lane = 3;
        if (lane < 0) lane = 0;

        return {
          id: index,
          time: note.time * 1000 + 3000, 
          lane: lane,
          hit: false,
          missed: false,
        };
      });

      parsedNotes.sort((a, b) => a.time - b.time);

      setCurrentSong(parsedNotes);
      setRawNotes(track.notes);
      setSongName(name);
    } catch (err: any) {
      console.error(err);
      setDebugError(`Error: ${err.message || String(err)}`);
    }
  };

  const loadSong = async (path: string, name: string) => {
    try {
      const response = await fetch(path);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        parseMidiBuffer(arrayBuffer, name);
      } else {
        setDebugError(`Fetch falló con status: ${response.status}`);
      }
    } catch (err: any) {
      setDebugError(`Fetch error: ${err.message}`);
    }
  };

  useEffect(() => {
    loadSong(SONGS[0].path, SONGS[0].name);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    parseMidiBuffer(arrayBuffer, file.name.replace(".mid", "").replace(".midi", ""));
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const checkHit = (lane: number) => {
    if (!isPlaying) return;

    const currentTime = performance.now() - gameState.current.startTime;
    const { notes } = gameState.current;

    let hitFound = false;
    // Buscar la nota más cercana en el carril
    let closestNote: GameNote | null = null;
    let minDiff = Infinity;

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      if (note.lane === lane && !note.hit && !note.missed) {
        const noteY = (currentTime - note.time) * NOTE_SPEED + HIT_ZONE_Y;
        const diff = Math.abs(noteY - HIT_ZONE_Y);
        
        if (diff <= HIT_TOLERANCE) {
          if (diff < minDiff) {
            minDiff = diff;
            closestNote = note;
          }
        }
      }
    }

    if (closestNote) {
      // HIT!
      closestNote.hit = true;
      hitFound = true;
      gameState.current.score += 10 * (Math.floor(gameState.current.combo / 10) + 1);
      gameState.current.combo += 1;
      gameState.current.hits += 1;
      if (gameState.current.combo > gameState.current.maxCombo) {
        gameState.current.maxCombo = gameState.current.combo;
      }
      setScore(gameState.current.score);
      setCombo(gameState.current.combo);

      gameState.current.synth?.triggerAttackRelease(PITCHES[lane], "8n");
      createParticles(lane);

      const canvas = canvasRef.current;
      if (canvas) {
          const laneWidth = canvas.width / 4;
          const x = lane * laneWidth + laneWidth / 2;
          
          let text = "¡BIEN!";
          let color = "#3b82f6"; // blue
          if (minDiff <= 20) {
              text = "¡PERFECTO!";
              color = "#f59e0b"; // yellow
              gameState.current.score += 5; // bonus
          } else if (minDiff >= 45) {
              text = "¡MEH!";
              color = "#94a3b8"; // gray
          }
          
          gameState.current.hitTexts.push({ text, color, life: 1, x, y: HIT_ZONE_Y - 40 });
          gameState.current.shockwaves.push({ x, y: HIT_ZONE_Y, color: LANE_COLORS[lane], radius: NOTE_RADIUS, life: 1 });
      }
    }

    if (!hitFound) {
      // Penalización opcional por tocar mal
      // gameState.current.combo = 0;
      // setCombo(0);
    }
  };

  const createParticles = (lane: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const laneWidth = canvas.width / 4;
    const x = lane * laneWidth + laneWidth / 2;
    
    for (let i = 0; i < 20; i++) {
      gameState.current.particles.push({
        x,
        y: HIT_ZONE_Y,
        color: LANE_COLORS[lane],
        life: 1,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15 - 5, 
      });
    }
  };

  const startGame = async () => {
    await Tone.start();
    setIsPlaying(true);
    setGameStatus('playing');
    gameState.current.startTime = performance.now();
    gameState.current.notes = JSON.parse(JSON.stringify(currentSong)); // Copia profunda
    gameState.current.score = 0;
    gameState.current.combo = 0;
    gameState.current.maxCombo = 0;
    gameState.current.hits = 0;
    gameState.current.misses = 0;
    gameState.current.particles = [];
    gameState.current.hitTexts = [];
    gameState.current.shockwaves = [];
    setScore(0);
    setCombo(0);
    
    try {
      // Preparar reproducción MIDI real
      if (midiPart.current) {
        midiPart.current.dispose();
      }
      
      const notesToPlay = rawNotes.map(n => ({
        time: n.time + 3, // +3 seconds delay to match UI notes (time * 1000 + 3000)
        note: n.name,
        duration: n.duration,
        velocity: n.velocity
      }));

      midiPart.current = new Tone.Part((time, value) => {
        bgSynth.current?.triggerAttackRelease(value.note, value.duration, time, value.velocity);
      }, notesToPlay).start(0);

      Tone.Transport.stop();
      Tone.Transport.position = 0;
      Tone.Transport.start(Tone.now());
    } catch (err: any) {
      setDebugError(`Error al iniciar MIDI: ${err.message}`);
    }
    
    requestAnimationFrame(gameLoop);
  };

  const stopGame = () => {
    setIsPlaying(false);
    setGameStatus('idle');
    Tone.Transport.stop();
    if (midiPart.current) {
        midiPart.current.dispose();
        midiPart.current = null;
    }
  };

  const gameLoop = () => {
    if (!gameState.current.startTime) return; 

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const currentTime = performance.now() - gameState.current.startTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const laneWidth = canvas.width / 4;

    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = gameState.current.keysPressed[i] ? "rgba(255, 255, 255, 0.1)" : "transparent";
      ctx.fillRect(i * laneWidth, 0, laneWidth, canvas.height);
      
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(i * laneWidth, 0);
      ctx.lineTo(i * laneWidth, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(i * laneWidth + laneWidth / 2, HIT_ZONE_Y, NOTE_RADIUS + 5, 0, Math.PI * 2);
      ctx.strokeStyle = LANE_COLORS[i];
      ctx.lineWidth = gameState.current.keysPressed[i] ? 4 : 2;
      ctx.stroke();
      
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "20px var(--font-inter)";
      ctx.textAlign = "center";
      ctx.fillText(KEYS[i].toUpperCase(), i * laneWidth + laneWidth / 2, HIT_ZONE_Y + 40);
    }

    gameState.current.notes.forEach((note) => {
      if (note.hit) return;

      const noteY = (currentTime - note.time) * NOTE_SPEED + HIT_ZONE_Y;

      if (noteY > canvas.height + NOTE_RADIUS && !note.missed) {
        note.missed = true;
        gameState.current.combo = 0;
        gameState.current.misses += 1;
        setCombo(0);
        
        const x = note.lane * laneWidth + laneWidth / 2;
        gameState.current.hitTexts.push({ text: "FALLO", color: "#ef4444", life: 1, x, y: canvas.height - 40 });
      }

      if (noteY > -NOTE_RADIUS && noteY < canvas.height + NOTE_RADIUS) {
        const x = note.lane * laneWidth + laneWidth / 2;
        
        ctx.beginPath();
        ctx.arc(x, noteY, NOTE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = LANE_COLORS[note.lane];
        ctx.fill();
        ctx.shadowBlur = 15;
        ctx.shadowColor = LANE_COLORS[note.lane];
        ctx.fill();
        ctx.shadowBlur = 0; 
      }
    });

    for (let i = gameState.current.particles.length - 1; i >= 0; i--) {
      const p = gameState.current.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
      
      if (p.life <= 0) {
        gameState.current.particles.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // Render shockwaves
    for (let i = gameState.current.shockwaves.length - 1; i >= 0; i--) {
        const sw = gameState.current.shockwaves[i];
        sw.radius += 8;
        sw.life -= 0.05;
        if (sw.life <= 0) {
            gameState.current.shockwaves.splice(i, 1);
            continue;
        }
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = sw.life;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    // Render hit texts
    for (let i = gameState.current.hitTexts.length - 1; i >= 0; i--) {
      const ht = gameState.current.hitTexts[i];
      ht.y -= 2;
      ht.life -= 0.03;
      if (ht.life <= 0) {
        gameState.current.hitTexts.splice(i, 1);
        continue;
      }
      ctx.fillStyle = ht.color;
      ctx.globalAlpha = ht.life;
      ctx.font = "bold 24px var(--font-inter)";
      ctx.textAlign = "center";
      ctx.shadowBlur = 10;
      ctx.shadowColor = ht.color;
      ctx.fillText(ht.text, ht.x, ht.y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
    }

    // Glow effect based on combo
    const glowIntensity = Math.min(gameState.current.combo / 50, 0.5);
    if (glowIntensity > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${glowIntensity * 0.1})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Verificamos el final de la canción
    const allPassed = gameState.current.notes.length > 0 && gameState.current.notes.every(n => n.hit || n.missed);
    const lastNote = gameState.current.notes[gameState.current.notes.length - 1];
    const timePassed = lastNote && currentTime > lastNote.time + 1000;
    
    if (allPassed && timePassed) {
       setIsPlaying(false);
       setGameStatus('finished');
       Tone.Transport.stop();
       setStats({
         hits: gameState.current.hits,
         misses: gameState.current.misses,
         maxCombo: gameState.current.maxCombo
       });
       gameState.current.startTime = 0;
       return;
    }

    try {
      if (gameState.current.startTime > 0) {
        requestAnimationFrame(gameLoop);
      }
    } catch (err: any) {
      setDebugError(`Error en gameLoop: ${err.message}`);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      requestAnimationFrame(gameLoop);
    } else {
      gameState.current.startTime = 0; 
    }
    return () => {
      gameState.current.startTime = 0;
    };
  }, [isPlaying]);

  return (
    <div className="flex-1 flex flex-col p-8 relative overflow-hidden">
      <div className="flex items-center justify-between mb-6 z-10">
        <div>
          <h1 className="text-3xl font-bold">Music Hero</h1>
          <p className="text-primary mt-1 font-medium flex items-center gap-2">
            <Music className="w-4 h-4" /> {songName}
          </p>
        </div>
        <div className="flex items-center gap-6">
          {gameStatus !== 'playing' ? (
            <>
              {gameStatus === 'idle' && (
                <select 
                  onChange={(e) => {
                    const song = SONGS[e.target.selectedIndex];
                    loadSong(song.path, song.name);
                  }}
                  className="px-4 py-2 border border-border bg-surface text-white rounded-xl text-sm outline-none focus:border-primary"
                >
                  {SONGS.map((s, i) => <option key={i} value={s.path}>{s.name}</option>)}
                </select>
              )}
              <input
                type="file"
                accept=".mid,.midi"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                id="midi-upload"
              />
              <label
                htmlFor="midi-upload"
                className="px-4 py-2 border border-border hover:bg-surface-hover rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Cargar MIDI
              </label>
              <button
                onClick={startGame}
                className="px-6 py-2 bg-primary hover:bg-primary/80 text-white rounded-xl font-bold transition-colors flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                {gameStatus === 'finished' ? 'REINTENTAR' : 'EMPEZAR'}
              </button>
            </>
          ) : (
            <button
              onClick={stopGame}
              className="px-6 py-2 border border-border bg-surface hover:bg-surface-hover text-white rounded-xl font-bold transition-colors"
            >
              DETENER
            </button>
          )}

          <div className="glass px-6 py-2 rounded-xl flex items-center gap-4 border border-border">
            <div className="text-sm">
              <span className="text-gray-400">Score:</span>
              <span className="ml-2 font-mono font-bold text-primary text-xl">
                {String(score).padStart(6, "0")}
              </span>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="text-sm">
              <span className="text-gray-400">Combo:</span>
              <span className={`ml-2 font-mono font-bold text-xl ${combo >= 10 ? 'text-secondary neon-text' : 'text-gray-300'}`}>
                x{combo}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="relative glass border border-border rounded-2xl overflow-hidden shadow-2xl">
          <canvas
            ref={canvasRef}
            width={400}
            height={600}
            className="block"
          />
          {!isPlaying && gameStatus === 'idle' && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center">
                <p className="text-xl font-medium text-gray-300 mb-2">
                  Presiona <span className="text-primary font-bold">EMPEZAR</span>
                </p>
                <p className="text-sm text-gray-500">
                  Elige una canción del menú o sube tu MIDI
                </p>
              </div>
            </div>
          )}
          {gameStatus === 'finished' && (
            <div className="absolute inset-0 bg-background/90 backdrop-blur-md flex items-center justify-center">
              <div className="text-center p-8 rounded-3xl border border-primary/30 bg-surface/50 shadow-2xl shadow-primary/20">
                <h2 className="text-4xl font-extrabold text-white mb-2">¡Canción Terminada!</h2>
                <div className="text-primary text-6xl font-black mb-8 neon-text">{score} <span className="text-2xl">pts</span></div>
                
                <div className="flex gap-8 justify-center mb-8">
                  <div className="text-center">
                    <p className="text-sm text-gray-400">Combo Máx.</p>
                    <p className="text-2xl font-bold text-white">x{stats.maxCombo}</p>
                  </div>
                  <div className="w-px h-12 bg-border" />
                  <div className="text-center">
                    <p className="text-sm text-gray-400">Precisión</p>
                    <p className="text-2xl font-bold text-white">
                      {Math.round((stats.hits / Math.max(1, stats.hits + stats.misses)) * 100)}%
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setGameStatus('idle')}
                  className="px-8 py-3 bg-white text-black hover:bg-gray-200 rounded-xl font-bold transition-colors"
                >
                  Volver al menú
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="text-center mt-6 text-gray-400">
        <p>Usa las teclas <strong className="text-white">A, S, D, F</strong></p>
        {debugError && (
          <div className="mt-4 p-4 bg-red-500/20 text-red-400 border border-red-500/50 rounded-xl text-sm break-all text-left">
            <strong>Error de depuración:</strong> {debugError}
          </div>
        )}
      </div>
    </div>
  );
}
