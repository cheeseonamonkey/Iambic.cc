import fs from "node:fs";
import path from "node:path";

const [, , input, output="assets/pronunciations.bin"] = process.argv;
if(!input){console.error("usage: node scripts/build-lexicon.mjs <cmudict.dict> [output.bin]");process.exit(2)}

const text=fs.readFileSync(input,"utf8");
const byWord=new Map();
for(const rawLine of text.split(/\r?\n/)){
  const line=rawLine.replace(/\s+#.*$/," ").trim();if(!line||line.startsWith(";;;"))continue;
  const m=line.match(/^(\S+)\s+(.+)$/);if(!m)continue;
  const key=m[1].replace(/\(\d+\)$/," ").trim().replace(/^'+/,"").toUpperCase();
  if(!key||byWord.has(key))continue;
  const phones=m[2].trim().split(/\s+/).filter(Boolean);
  if(phones.length)byWord.set(key,phones)
}
const entries=[...byWord].sort((a,b)=>a[0].localeCompare(b[0],"en"));
const tokens=[...new Set(entries.flatMap(([,p])=>p))].sort();
if(tokens.length>255)throw new Error(`too many phoneme tokens: ${tokens.length}`);
const tokenId=new Map(tokens.map((t,i)=>[t,i]));
const recordChunks=[],offsets=[0];let recordBytes=0;
for(const [word,phones] of entries){
  const wb=Buffer.from(word,"utf8");if(wb.length>255||phones.length>255)continue;
  const r=Buffer.allocUnsafe(2+wb.length+phones.length);r[0]=wb.length;r[1]=phones.length;wb.copy(r,2);
  phones.forEach((p,i)=>r[2+wb.length+i]=tokenId.get(p));
  recordChunks.push(r);recordBytes+=r.length;offsets.push(recordBytes)
}
const headerParts=[Buffer.from("IAMBLX1\0","latin1")];
const count=Buffer.allocUnsafe(4);count.writeUInt32LE(recordChunks.length);headerParts.push(count,Buffer.from([tokens.length]));
for(const t of tokens){const b=Buffer.from(t);headerParts.push(Buffer.from([b.length]),b)}
const offsetBuffer=Buffer.allocUnsafe(offsets.length*4);offsets.forEach((v,i)=>offsetBuffer.writeUInt32LE(v,i*4));
const out=Buffer.concat([...headerParts,offsetBuffer,...recordChunks]);
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,out);
console.log(`wrote ${recordChunks.length.toLocaleString()} entries, ${tokens.length} phoneme tokens, ${(out.length/1024/1024).toFixed(2)} MiB -> ${output}`);
