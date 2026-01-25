export function keyFromChunk(cx: number, cy: number, cz: number) {
  return `${cx},${cy},${cz}`;
}

export function chunkFromWorld(x: number, y: number, z: number, chunkSize = 16) {
  const cx = Math.floor(x / chunkSize);
  const cy = Math.floor(y / chunkSize);
  const cz = Math.floor(z / chunkSize);
  return { cx, cy, cz, key: keyFromChunk(cx, cy, cz) };
}
