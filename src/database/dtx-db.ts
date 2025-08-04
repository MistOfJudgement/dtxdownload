import { IDtxChart } from '../types';
import * as fs from 'fs';
import * as path from 'path';

let db: IDtxChart[] = [];

// Try to load existing database
try {
  const dbPath = path.join(__dirname, '../../db.json');
  if (fs.existsSync(dbPath)) {
    const dbData = fs.readFileSync(dbPath, 'utf8');
    db = JSON.parse(dbData) as IDtxChart[];
  }
} catch (err) {
  // eslint-disable-next-line no-console
  console.log('No db.json found or error loading database');
}

export function getSongsInRange(low: number, high: number): IDtxChart[] {
  return db.filter(song =>
    song.difficulties.some(difficulty => difficulty >= low && difficulty <= high)
  );
}

export function getAllSongs(): IDtxChart[] {
  return [...db];
}

export function addSong(song: IDtxChart): void {
  db.push(song);
}

export function saveDatabaseToFile(filePath = '../../db.json'): void {
  const fullPath = path.join(__dirname, filePath);
  fs.writeFileSync(fullPath, JSON.stringify(db, null, 2));
}

export { db };
