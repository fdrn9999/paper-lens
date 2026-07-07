/** Minimal type definitions for pdfjs-dist loaded from CDN */
export interface PdfjsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (params: { data: Uint8Array }) => { promise: Promise<PdfjsDocument> };
}

export interface PdfjsDocument {
  numPages: number;
  getPage: (num: number) => Promise<PdfjsPage>;
  destroy?: () => void;
}

export interface PdfjsPage {
  getViewport: (params: { scale: number }) => PdfjsViewport;
  getTextContent: () => Promise<PdfjsTextContent>;
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: PdfjsViewport }) => { promise: Promise<void> };
}

export interface PdfjsViewport {
  width: number;
  height: number;
}

export interface PdfjsTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

export interface PdfjsTextContent {
  items: PdfjsTextItem[];
}

declare global {
  interface Window {
    pdfjsLib?: PdfjsLib;
  }
}

let pdfjsPromise: Promise<PdfjsLib> | null = null;

const PDFJS_VERSION = '3.11.174';
const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
// SRI hash for pdf.min.js, verified by hashing the cdnjs file directly (sha512).
// This pins the main script — the code that runs in the page context — against a
// CDN compromise. The worker is loaded by pdf.js via GlobalWorkerOptions.workerSrc
// (a Worker URL), which cannot carry an integrity attribute, so it is not pinned here.
const PDFJS_MAIN_SRI = 'sha512-q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ==';

/**
 * Load pdfjs-dist from CDN to avoid webpack chunking issues.
 * Uses the v3.11.174 UMD build which exposes window.pdfjsLib.
 */
export function loadPdfjs(): Promise<PdfjsLib> {
  if (pdfjsPromise) return pdfjsPromise;

  pdfjsPromise = new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }

    const script = document.createElement('script');
    script.src = `${PDFJS_BASE}/pdf.min.js`;
    script.integrity = PDFJS_MAIN_SRI;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      const lib = window.pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
        resolve(lib);
      } else {
        pdfjsPromise = null;
        reject(new Error('pdfjsLib not available after script load'));
      }
    };
    script.onerror = () => {
      pdfjsPromise = null;
      reject(new Error('Failed to load pdf.js from CDN'));
    };
    document.head.appendChild(script);
  });

  return pdfjsPromise;
}
