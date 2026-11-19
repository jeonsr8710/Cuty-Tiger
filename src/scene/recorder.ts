export interface CanvasRecorderCallbacks {
  onStart?: () => void;
  onStop?: (fileName: string) => void;
  onError?: (message: string) => void;
}

const PREFERRED_MIME_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
];

function selectSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  for (const mime of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return undefined;
}

function buildFileName(mimeType: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const ext = mimeType.toLowerCase().includes('mp4') ? 'mp4' : 'webm';
  return `tiger-cycling-${stamp}.${ext}`;
}

export class CanvasVideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private active = false;

  public isRecording(): boolean {
    return this.active;
  }

  public start(
    canvas: HTMLCanvasElement,
    callbacks?: CanvasRecorderCallbacks,
    fps = 30,
  ): boolean {
    if (this.active) return true;

    if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      callbacks?.onError?.('현재 브라우저에서 캔버스 영상 녹화(MediaRecorder)를 지원하지 않습니다.');
      return false;
    }

    try {
      const stream = canvas.captureStream(fps);
      const mimeType = selectSupportedMimeType();
      const options: MediaRecorderOptions = {
        videoBitsPerSecond: 6_000_000,
        ...(mimeType ? { mimeType } : {}),
      };

      const recorder = new MediaRecorder(stream, options);
      this.stream = stream;
      this.mediaRecorder = recorder;
      this.chunks = [];
      this.active = true;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        this.cleanupTracks();
        this.active = false;
        callbacks?.onError?.('영상 녹화 중 오류가 발생했습니다.');
      };

      recorder.onstop = () => {
        const finalMime = recorder.mimeType || mimeType || 'video/webm';
        const blob = new Blob(this.chunks, { type: finalMime });
        this.chunks = [];
        this.cleanupTracks();
        this.active = false;

        if (blob.size === 0) {
          callbacks?.onError?.('녹화된 영상 데이터가 비어 있습니다.');
          return;
        }

        const fileName = buildFileName(finalMime);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1500);

        callbacks?.onStop?.(fileName);
      };

      recorder.start(250);
      callbacks?.onStart?.();
      return true;
    } catch (err) {
      this.cleanupTracks();
      this.active = false;
      const msg =
        err instanceof Error ? err.message : '영상 녹화를 시작할 수 없습니다.';
      callbacks?.onError?.(msg);
      return false;
    }
  }

  public stop(): void {
    if (!this.active || !this.mediaRecorder) return;
    if (this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  public dispose(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.ondataavailable = null;
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.onerror = null;
      this.mediaRecorder.stop();
    }
    this.cleanupTracks();
    this.chunks = [];
    this.active = false;
  }

  private cleanupTracks(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    this.mediaRecorder = null;
  }
}
