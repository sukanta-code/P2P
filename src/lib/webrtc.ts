import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

export const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function minifySdp(sdp: string) {
  return sdp.split('\r\n').filter(line => {
    if (!line) return false;
    if (line.startsWith('a=extmap:')) return false;
    if (line.startsWith('a=rtcp-fb:')) return false;
    if (line.startsWith('a=fmtp:')) return false;
    if (line.startsWith('a=ice-options:')) return false;
    if (line.startsWith('b=')) return false;
    if (line.startsWith('a=msid-semantic:')) return false;
    return true;
  }).join('\r\n');
}

export function encodeSdp(obj: any): string {
  const copy = JSON.parse(JSON.stringify(obj));
  if (copy.sdp) copy.sdp = minifySdp(copy.sdp);
  return compressToEncodedURIComponent(JSON.stringify(copy));
}

export function decodeSdp(str: string): any {
  const raw = decompressFromEncodedURIComponent(str.trim());
  if (!raw) throw new Error('Decompression failed');
  return JSON.parse(raw);
}
