import { EXPORT_LIMITS } from "./spritesheet";
export type ExportFile = { name: string; bytes: Uint8Array; mime: string };

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit=0; bit<8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
export function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

/** ZIP32, stored entries: PNG already compresses its image data. No paths or ZIP64. */
export function createFrameArchive(files: ExportFile[]): Uint8Array {
  if (!files.length || files.length > 258) throw new Error("Número de archivos ZIP inválido.");
  const names = files.map(file => new TextEncoder().encode(file.name));
  if (new Set(files.map(f=>f.name.toLowerCase())).size !== files.length || files.some((f,i) => !/^[a-zA-Z0-9_.-]+$/.test(f.name) || names[i].length > 255)) throw new Error("Nombres ZIP inválidos o repetidos.");
  const size = files.reduce((sum,f,i)=>sum + 76 + names[i].length * 2 + f.bytes.length,22);
  if (size > EXPORT_LIMITS.archiveBytes) throw new Error("El ZIP supera 64 MiB. Exporta una animación más pequeña.");
  const bytes = new Uint8Array(size), view = new DataView(bytes.buffer);
  let offset=0;
  const entries: {offset:number;crc:number}[]=[];
  files.forEach((file,i)=>{
    const name=names[i], crc=crc32(file.bytes); entries.push({offset,crc});
    view.setUint32(offset,0x04034b50,true); view.setUint16(offset+4,20,true); view.setUint16(offset+12,33,true);
    view.setUint32(offset+14,crc,true); view.setUint32(offset+18,file.bytes.length,true); view.setUint32(offset+22,file.bytes.length,true); view.setUint16(offset+26,name.length,true);
    bytes.set(name,offset+30); bytes.set(file.bytes,offset+30+name.length); offset+=30+name.length+file.bytes.length;
  });
  const central=offset;
  files.forEach((file,i)=>{
    const name=names[i], entry=entries[i];
    view.setUint32(offset,0x02014b50,true); view.setUint16(offset+4,20,true); view.setUint16(offset+6,20,true); view.setUint16(offset+14,33,true);
    view.setUint32(offset+16,entry.crc,true); view.setUint32(offset+20,file.bytes.length,true); view.setUint32(offset+24,file.bytes.length,true); view.setUint16(offset+28,name.length,true); view.setUint32(offset+42,entry.offset,true);
    bytes.set(name,offset+46); offset+=46+name.length;
  });
  view.setUint32(offset,0x06054b50,true); view.setUint16(offset+8,files.length,true); view.setUint16(offset+10,files.length,true); view.setUint32(offset+12,offset-central,true); view.setUint32(offset+16,central,true);
  return bytes;
}
