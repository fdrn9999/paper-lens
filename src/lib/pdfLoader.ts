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

/**
 * Load pdfjs-dist from CDN to avoid webpack chunking issues.
 * Uses v3.11.174 UMD build which exposes window.pdfjsLib.
 */
export function loadPdfjs(): Promise<PdfjsLib> {
  if (pdfjsPromise) return pdfjsPromise;

  pdfjsPromise = new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const lib = window.pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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
