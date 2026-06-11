import fs from 'fs';
import pkg from '@tonejs/midi';
const { Midi } = pkg;

const midi = new Midi();
// Add a track
const track = midi.addTrack();

// Some simple notes (C major arpeggio up and down x 4)
const pitches = [60, 64, 67, 72, 76, 72, 67, 64]; 
let time = 0;

for (let loop = 0; loop < 4; loop++) {
  for (let i = 0; i < pitches.length; i++) {
    track.addNote({
      midi: pitches[i],
      time: time,
      duration: 0.2
    });
    time += 0.25;
  }
}

// Add a final chord
track.addNote({ midi: 60, time: time, duration: 1 });
track.addNote({ midi: 64, time: time, duration: 1 });
track.addNote({ midi: 67, time: time, duration: 1 });
track.addNote({ midi: 72, time: time, duration: 1 });

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

fs.writeFileSync('public/cancion.mid', Buffer.from(midi.toArray()));
console.log('MIDI file created successfully at public/cancion.mid');
