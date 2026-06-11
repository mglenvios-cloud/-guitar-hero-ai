import fs from 'fs';
import pkg from '@tonejs/midi';
const { Midi } = pkg;

if (!fs.existsSync('public/midis')) {
  fs.mkdirSync('public/midis', { recursive: true });
}

// Helper to create simple mono riffs
function createRiff(filename, notesArr, bpm = 120) {
  const midi = new Midi();
  midi.header.setTempo(bpm);
  const track = midi.addTrack();
  
  let currentTime = 0;
  for (const n of notesArr) {
    if (n.pitch) {
      track.addNote({
        midi: n.pitch,
        time: currentTime,
        duration: n.duration
      });
    }
    currentTime += n.duration;
  }
  
  fs.writeFileSync(`public/midis/${filename}.mid`, Buffer.from(midi.toArray()));
  console.log(`Creado ${filename}.mid`);
}

// 1. De Música Ligera (Soda Stereo) - Intro pattern (B - G - D - A)
const ligeraNotes = [];
for(let i = 0; i < 4; i++) {
  ligeraNotes.push({ pitch: 59, duration: 0.25 });
  ligeraNotes.push({ pitch: 59, duration: 0.25 });
  ligeraNotes.push({ pitch: 59, duration: 0.5 });
  ligeraNotes.push({ pitch: 55, duration: 0.25 });
  ligeraNotes.push({ pitch: 55, duration: 0.75 });
  ligeraNotes.push({ pitch: 62, duration: 0.25 });
  ligeraNotes.push({ pitch: 62, duration: 0.25 });
  ligeraNotes.push({ pitch: 62, duration: 0.5 });
  ligeraNotes.push({ pitch: 57, duration: 0.25 });
  ligeraNotes.push({ pitch: 57, duration: 0.75 });
}
createRiff('musica_ligera', ligeraNotes, 130);

// 2. Jijiji (Los Redondos) - Intro Guitar Riff (Simplified)
const jijijiNotes = [];
for(let i=0; i<4; i++) {
  jijijiNotes.push({ pitch: 64, duration: 0.25 }); 
  jijijiNotes.push({ pitch: 67, duration: 0.25 }); 
  jijijiNotes.push({ pitch: 69, duration: 0.25 }); 
  jijijiNotes.push({ pitch: 67, duration: 0.25 }); 
  jijijiNotes.push({ pitch: 64, duration: 0.25 }); 
  jijijiNotes.push({ pitch: 62, duration: 0.25 }); 
  jijijiNotes.push({ pitch: 64, duration: 0.5 });  
}
createRiff('jijiji', jijijiNotes, 145);

// 3. Mil Horas (Los Abuelos) - Synth intro
const milHorasNotes = [];
for(let i=0; i<4; i++) {
  milHorasNotes.push({ pitch: 69, duration: 0.25 }); 
  milHorasNotes.push({ pitch: 72, duration: 0.25 }); 
  milHorasNotes.push({ pitch: 76, duration: 0.25 }); 
  milHorasNotes.push({ pitch: null, duration: 0.25 }); 
  milHorasNotes.push({ pitch: 74, duration: 0.25 }); 
  milHorasNotes.push({ pitch: 72, duration: 0.25 }); 
  milHorasNotes.push({ pitch: 71, duration: 0.5 });  
}
createRiff('mil_horas', milHorasNotes, 110);

console.log("Rock Argentino MIDIs generados con éxito.");
