const INITIAL = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);
const ROUND = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);
const rotateRight = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits));

export class IncrementalSha256 {
  private state = new Uint32Array(INITIAL);
  private pending = new Uint8Array(0);
  private bytes = 0;
  private complete = false;

  update(input: Uint8Array): this {
    if (this.complete) throw new Error('The fingerprint has already been finalized.');
    this.bytes += input.length;
    const joined = new Uint8Array(this.pending.length + input.length);
    joined.set(this.pending); joined.set(input, this.pending.length);
    let offset = 0;
    while (offset + 64 <= joined.length) { this.compress(joined.subarray(offset, offset + 64)); offset += 64; }
    this.pending = joined.slice(offset);
    return this;
  }

  digestHex(): string {
    if (this.complete) throw new Error('The fingerprint has already been finalized.');
    this.complete = true;
    const tailLength = Math.ceil((this.pending.length + 9) / 64) * 64;
    const tail = new Uint8Array(tailLength); tail.set(this.pending); tail[this.pending.length] = 0x80;
    const bitLength = BigInt(this.bytes) * 8n;
    const view = new DataView(tail.buffer);
    view.setUint32(tail.length - 8, Number((bitLength >> 32n) & 0xffffffffn), false);
    view.setUint32(tail.length - 4, Number(bitLength & 0xffffffffn), false);
    for (let offset = 0; offset < tail.length; offset += 64) this.compress(tail.subarray(offset, offset + 64));
    return Array.from(this.state, value => value.toString(16).padStart(8, '0')).join('');
  }

  private compress(block: Uint8Array): void {
    const words = new Uint32Array(64);
    const view = new DataView(block.buffer, block.byteOffset, block.byteLength);
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(i * 4, false);
    for (let i = 16; i < 64; i++) {
      const a = words[i - 15]; const b = words[i - 2];
      const s0 = rotateRight(a, 7) ^ rotateRight(a, 18) ^ (a >>> 3);
      const s1 = rotateRight(b, 17) ^ rotateRight(b, 19) ^ (b >>> 10);
      words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = this.state;
    for (let i = 0; i < 64; i++) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const t1 = (h + s1 + choice + ROUND[i] + words[i]) >>> 0;
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + majority) >>> 0;
      h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    const values = [a,b,c,d,e,f,g,h];
    for (let i = 0; i < 8; i++) this.state[i] = (this.state[i] + values[i]) >>> 0;
  }
}

export function fingerprintBytes(chunks: Uint8Array[]): string {
  const hash = new IncrementalSha256();
  chunks.forEach(chunk => hash.update(chunk));
  return `sha256-${hash.digestHex()}`;
}

export async function createVideoFingerprint(file: Blob, onProgress?: (progress: number) => void): Promise<string> {
  const reader = file.stream().getReader();
  const hash = new IncrementalSha256();
  let read = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    hash.update(value); read += value.length; onProgress?.(file.size ? read / file.size : 1);
  }
  return `sha256-${hash.digestHex()}`;
}
