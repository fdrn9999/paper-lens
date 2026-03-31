'use client';

import { useEffect, useRef, useState, useCallback, memo } from 'react';
import useStore from '@/store/useStore';
import type { PageTextContent, ExtractedTextItem } from '@/lib/types';
import { loadPdfjs } from '@/lib/pdfLoader';
import type { PdfjsDocument, PdfjsViewport, PdfjsTextItem } from '@/lib/pdfLoader';
// Pretext-inspired: canvas measureText for precise char-level positioning
// (pretext's measurement module isn't exported, so we inline the technique)

export default memo(function PDFViewer() {
  // === Page-mode refs ===
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement | null>(null);
  const textLayerDivRef = useRef<HTMLDivElement | null>(null);
  const pageDataRef = useRef<{ viewport: PdfjsViewport; textItems: PdfjsTextItem[]; wrapper: HTMLDivElement } | null>(null);
  const renderTaskRef = useRef(0);
  const pdfDocRef = useRef<PdfjsDocument | null>(null);

  const [pdfDoc, setPdfDoc] = useState<PdfjsDocument | null>(null);
  const [renderingCanvas, setRenderingCanvas] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState(false);

  const pdfData = useStore((s) => s.pdfData);
  const currentPage = useStore((s) => s.currentPage);
  const scale = useStore((s) => s.scale);
  const searchResults = useStore((s) => s.searchResults);
  const currentResultIndex = useStore((s) => s.currentResultIndex);
  const setTotalPages = useStore((s) => s.setTotalPages);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const totalPages = useStore((s) => s.totalPages);
  const setPageTextContents = useStore((s) => s.setPageTextContents);
  const setIsLoadingPdf = useStore((s) => s.setIsLoadingPdf);
  const setSelectedText = useStore((s) => s.setSelectedText);
  const setScale = useStore((s) => s.setScale);
  const setIsExtracting = useStore((s) => s.setIsExtracting);
  const setFitScale = useStore((s) => s.setFitScale);
  const translate = useStore((s) => s.translate);
  const selectedText = useStore((s) => s.selectedText);
  const showTranslation = useStore((s) => s.showTranslation);
  const reset = useStore((s) => s.reset);
  const viewerMode = useStore((s) => s.viewerMode);
  const activeKeywords = useStore((s) => s.activeKeywords);
  const keywords = useStore((s) => s.keywords);

  const [floatingBtn, setFloatingBtn] = useState<{ x: number; y: number } | null>(null);
  const scrollStartRef = useRef<number | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleTranslateClick = useCallback(() => {
    if (selectedText) {
      translate(selectedText);
      setFloatingBtn(null);
      // Delay removeAllRanges so translate's state update lands first
      setTimeout(() => window.getSelection()?.removeAllRanges(), 50);
    }
  }, [selectedText, translate]);

  // === Scroll-mode state & refs ===
  const [pageDims, setPageDims] = useState<{ w: number; h: number }[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const renderedScrollPagesRef = useRef<Set<number>>(new Set());
  const fromObserverRef = useRef(false);
  const currentPageRef = useRef(currentPage);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  const searchResultsRef = useRef(searchResults);
  useEffect(() => { searchResultsRef.current = searchResults; }, [searchResults]);
  const activeKeywordsRef = useRef(activeKeywords);
  useEffect(() => { activeKeywordsRef.current = activeKeywords; }, [activeKeywords]);
  const keywordsRef = useRef(keywords);
  useEffect(() => { keywordsRef.current = keywords; }, [keywords]);
  const scrollScaleRef = useRef(scale);
  useEffect(() => { scrollScaleRef.current = scale; }, [scale]);

  // ===== Effect 1: Load PDF document =====
  useEffect(() => {
    if (!pdfData) {
      setPdfDoc(null);
      setPdfLoadError(false);
      return;
    }
    let cancelled = false;
    setPdfLoadError(false);
    (async () => {
      try {
        const pdfjsLib = await loadPdfjs();
        const doc = await pdfjsLib.getDocument({ data: pdfData.slice(0) }).promise;
        if (cancelled) { doc.destroy?.(); return; }
        pdfDocRef.current = doc;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setIsLoadingPdf(false);
      } catch {
        if (!cancelled) { setPdfLoadError(true); setIsLoadingPdf(false); }
      }
    })();
    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy?.();
        pdfDocRef.current = null;
      }
    };
  }, [pdfData, setTotalPages, setIsLoadingPdf]);

  // ===== Auto fit-to-width on load and resize =====
  useEffect(() => {
    if (!pdfDoc) return;
    const container = viewerMode === 'scroll'
      ? scrollContainerRef.current
      : canvasContainerRef.current?.parentElement;
    if (!container) return;

    let resizeTimer: ReturnType<typeof setTimeout>;

    const fitToWidth = async () => {
      try {
        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const containerWidth = container.clientWidth;
        if (containerWidth > 0 && viewport.width > 0) {
          const fitScale = Math.min((containerWidth - 32) / viewport.width, 2.5);
          setScale(Math.max(0.5, fitScale));
          setFitScale(Math.max(0.5, fitScale));
        }
      } catch { /* ignore */ }
    };

    fitToWidth();

    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitToWidth, 300);
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
    };
  }, [pdfDoc, setScale, setFitScale, viewerMode]);

  // ===== Pinch-to-zoom for mobile/tablet =====
  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
    setFloatingBtn(null);
  }, [scale]);

  useEffect(() => {
    const container = viewerMode === 'scroll'
      ? scrollContainerRef.current
      : canvasContainerRef.current?.parentElement;
    if (!container || !pdfDoc) return;

    let pinchStart: { dist: number; scale: number } | null = null;
    let pendingScale: number | null = null;

    const getTouchDist = (t: TouchList) => Math.hypot(
      t[0].clientX - t[1].clientX,
      t[0].clientY - t[1].clientY
    );

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStart = { dist: getTouchDist(e.touches), scale: scaleRef.current };
        pendingScale = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStart) {
        e.preventDefault();
        const ratio = getTouchDist(e.touches) / pinchStart.dist;
        const clampedRatio = Math.max(0.5 / pinchStart.scale, Math.min(3.0 / pinchStart.scale, ratio));
        pendingScale = pinchStart.scale * clampedRatio;
        // Instant visual feedback via CSS transform (page mode only)
        if (viewerMode === 'page') {
          const wrapper = canvasContainerRef.current?.firstElementChild as HTMLElement | null;
          if (wrapper) {
            wrapper.style.transformOrigin = '50% 50%';
            wrapper.style.transform = `scale(${clampedRatio})`;
          }
        }
      }
    };

    const onTouchEnd = () => {
      if (viewerMode === 'page') {
        const wrapper = canvasContainerRef.current?.firstElementChild as HTMLElement | null;
        if (wrapper) {
          wrapper.style.transition = 'transform 0.15s ease-out';
          wrapper.style.transform = '';
          wrapper.style.transformOrigin = '';
          setTimeout(() => { if (wrapper) wrapper.style.transition = ''; }, 160);
        }
      }
      if (pendingScale !== null) {
        setScale(pendingScale);
        pendingScale = null;
      }
      pinchStart = null;
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [pdfDoc, setScale, viewerMode]);

  // ===== Effect 2: Progressive text extraction (non-blocking) =====
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    setIsExtracting(true);
    (async () => {
      try {
        const allPages: PageTextContent[] = [];
        for (let p = 1; p <= pdfDoc.numPages; p++) {
          if (cancelled) return;
          const page = await pdfDoc.getPage(p);
          const tc = await page.getTextContent();
          const items: ExtractedTextItem[] = [];
          let idx = 0;
          for (const it of tc.items) {
            if ('str' in it && it.str && it.str.trim()) {
              items.push({
                text: it.str, page: p, itemIndex: idx,
                transform: it.transform, width: it.width, height: it.height,
              });
            }
            if ('str' in it) idx++;
          }
          allPages.push({ page: p, items, fullText: items.map((i) => i.text).join(' ') });
          if (p % 5 === 0) setPageTextContents([...allPages]);
          await new Promise((r) => setTimeout(r, 0));
        }
        if (!cancelled) {
          setPageTextContents(allPages);
          setIsExtracting(false);
        }
      } catch (err) {
        if (!cancelled && process.env.NODE_ENV !== 'production') console.error('Text extraction error:', err);
      }
    })();
    return () => { cancelled = true; setIsExtracting(false); };
  }, [pdfDoc, setPageTextContents, setIsExtracting]);

  // ===== Effect 3: Render canvas + pdfjs TextLayer (PAGE MODE) =====
  useEffect(() => {
    if (viewerMode !== 'page') return;
    if (!pdfDoc || !canvasContainerRef.current) return;
    setPageReady(false);
    const taskId = ++renderTaskRef.current;

    (async () => {
      setRenderingCanvas(true);
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        if (taskId !== renderTaskRef.current || !canvasContainerRef.current) return;

        const container = canvasContainerRef.current;

        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
          position: relative;
          width: ${viewport.width}px;
          height: ${viewport.height}px;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.10);
          flex-shrink: 0;
        `;

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.cssText = 'display: block; width: 100%; height: 100%;';
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
        wrapper.appendChild(canvas);
        if (taskId !== renderTaskRef.current) return;

        const textContent = await page.getTextContent();
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';

        const measureCanvas = document.createElement('canvas');
        const measureCtx = measureCanvas.getContext('2d');

        let strIdx = 0;
        for (const item of textContent.items) {
          if (!('str' in item)) continue;
          if (item.str) {
            const tx = item.transform;
            const fontSize = Math.sqrt(tx[0] ** 2 + tx[1] ** 2) * scale;
            const rawHeight = item.height > 0 ? item.height : Math.sqrt(tx[0] ** 2 + tx[1] ** 2);
            const spanHeight = rawHeight * scale * 0.85;
            const x = tx[4] * scale;
            const y = viewport.height - tx[5] * scale - spanHeight;

            const expectedWidth = item.width * scale;
            let scaleXStyle = '';
            if (measureCtx && expectedWidth > 0 && item.str.length > 0) {
              measureCtx.font = `${fontSize}px sans-serif`;
              const actualWidth = measureCtx.measureText(item.str).width;
              if (actualWidth > 0) {
                const sx = expectedWidth / actualWidth;
                if (Math.abs(sx - 1) > 0.02) {
                  scaleXStyle = `transform:scaleX(${sx.toFixed(4)});`;
                }
              }
            }

            const span = document.createElement('span');
            span.textContent = item.str;
            span.dataset.itemIndex = String(strIdx);
            span.style.cssText = `left:${x}px;top:${y}px;font-size:${fontSize}px;font-family:sans-serif;height:${spanHeight}px;line-height:${spanHeight}px;${scaleXStyle}`;
            textLayerDiv.appendChild(span);
          }
          strIdx++;
        }
        wrapper.appendChild(textLayerDiv);

        const strItems = textContent.items.filter((it) => 'str' in it);

        const hlDiv = document.createElement('div');
        hlDiv.className = 'pdf-highlight-layer';
        wrapper.appendChild(hlDiv);

        highlightLayerRef.current = hlDiv;
        textLayerDivRef.current = textLayerDiv;
        pageDataRef.current = { viewport, textItems: strItems, wrapper };

        if (taskId !== renderTaskRef.current) return;
        const oldChildren = Array.from(container.children);
        container.appendChild(wrapper);
        for (const child of oldChildren) container.removeChild(child);

        setPageReady(true);
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') console.error('PDF page render error:', err);
      } finally {
        if (taskId === renderTaskRef.current) setRenderingCanvas(false);
      }
    })();
  }, [pdfDoc, currentPage, scale, viewerMode]);

  // ===== Effect 4a: Create highlight divs (PAGE MODE) =====
  const prevResultsKeyRef = useRef('');
  useEffect(() => {
    if (viewerMode !== 'page') return;
    if (!pageReady) return;
    const hl = highlightLayerRef.current;
    const pd = pageDataRef.current;
    if (!hl || !pd) return;

    const pageResults = searchResults.filter((r) => r.page === currentPage);
    const resultsKey = pageResults.map((r) => r.id).join(',');

    if (resultsKey === prevResultsKeyRef.current && hl.childElementCount > 0) return;
    prevResultsKeyRef.current = resultsKey;

    while (hl.firstChild) hl.removeChild(hl.firstChild);
    if (pageResults.length === 0) return;

    const textLayer = textLayerDivRef.current;
    for (const result of pageResults) {
      const spanList = result.spans || [{ itemIndex: result.itemIndex, charStart: result.charStart, charEnd: result.charEnd }];

      for (const hlSpan of spanList) {
        const span = textLayer?.querySelector(`[data-item-index="${hlSpan.itemIndex}"]`) as HTMLElement | null;
        if (!span) continue;

        const r = computeHighlightRect(span, pd.wrapper, hlSpan.charStart, hlSpan.charEnd);
        const div = document.createElement('div');
        div.className = 'highlight-mark';
        div.dataset.resultId = result.id;
        const vInset = Math.max(r.height * 0.12, 1);
        const bgStyle = result.termColor ? `background-color:${result.termColor}66;` : '';
        div.style.cssText = `left:${r.left}px;top:${r.top + vInset}px;width:${Math.max(r.width, 8)}px;height:${Math.max(r.height - vInset * 2, 4)}px;${bgStyle}`;
        hl.appendChild(div);
      }
    }
  }, [pageReady, searchResults, currentPage, scale, viewerMode]);

  // ===== Effect 4b: Toggle current highlight class (PAGE MODE) =====
  useEffect(() => {
    if (viewerMode !== 'page') return;
    if (!pageReady) return;
    const hl = highlightLayerRef.current;
    if (!hl) return;

    const currentId = searchResults[currentResultIndex]?.id;
    const marks = hl.querySelectorAll('.highlight-mark');
    let scrolled = false;

    marks.forEach((mark) => {
      const el = mark as HTMLElement;
      if (el.dataset.resultId === currentId) {
        el.classList.add('current');
        // Override inline background-color so CSS .current orange shows through
        el.dataset.origBg = el.style.backgroundColor || '';
        el.style.backgroundColor = '';
        if (!scrolled) {
          scrolled = true;
          requestAnimationFrame(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          });
        }
      } else {
        el.classList.remove('current');
        el.style.backgroundColor = el.dataset.origBg ?? '';
        delete el.dataset.origBg;
      }
    });
  }, [currentResultIndex, searchResults, pageReady, viewerMode]);

  // ===================================================================
  // ===== SCROLL MODE EFFECTS =====
  // ===================================================================

  // Compute base page dimensions (scale=1), computed once per PDF
  useEffect(() => {
    if (viewerMode !== 'scroll' || !pdfDoc) { setPageDims([]); return; }
    let cancelled = false;
    (async () => {
      const dims: { w: number; h: number }[] = [];
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        if (cancelled) return;
        const page = await pdfDoc.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        dims.push({ w: vp.width, h: vp.height });
      }
      if (!cancelled) setPageDims(dims);
    })();
    return () => { cancelled = true; };
  }, [viewerMode, pdfDoc]);

  /** Shared canvas context for text measurement (pretext-inspired technique:
   *  use canvas measureText instead of DOM measurement for precision). */
  const hlMeasureCtx = useRef<CanvasRenderingContext2D | null>(null);
  if (!hlMeasureCtx.current && typeof document !== 'undefined') {
    hlMeasureCtx.current = document.createElement('canvas').getContext('2d');
  }

  /** Compute highlight rect using span's CSS coords + canvas measureText.
   *  - Position: span's own CSS left/top (exact PDF coordinates)
   *  - Dimensions: canvas measureText for char-level precision
   *  - ScaleX: applied to convert font metrics to visual width */
  function computeHighlightRect(
    span: HTMLElement,
    _wrapper: HTMLElement,
    charStart: number,
    charEnd: number,
  ): { left: number; top: number; width: number; height: number } {
    const text = span.textContent || '';
    const spanLeft = parseFloat(span.style.left) || 0;
    const spanTop = parseFloat(span.style.top) || 0;
    const spanH = parseFloat(span.style.height) || parseFloat(span.style.lineHeight) || 14;

    const font = `${span.style.fontSize} ${span.style.fontFamily || 'sans-serif'}`;
    const scaleXMatch = span.style.transform?.match(/scaleX\(([^)]+)\)/);
    const scaleX = scaleXMatch ? parseFloat(scaleXMatch[1]) : 1;

    const ctx = hlMeasureCtx.current;
    if (ctx && text.length > 0) {
      ctx.font = font;
      const startW = charStart > 0 ? ctx.measureText(text.slice(0, charStart)).width : 0;
      const matchW = ctx.measureText(text.slice(charStart, charEnd)).width;
      return {
        left: spanLeft + startW * scaleX,
        top: spanTop,
        width: matchW * scaleX,
        height: spanH,
      };
    }

    // Last resort: proportional
    const spanRect = span.getBoundingClientRect();
    const startRatio = charStart / Math.max(text.length, 1);
    const widthRatio = (charEnd - charStart) / Math.max(text.length, 1);
    return {
      left: spanLeft + spanRect.width * startRatio,
      top: spanTop,
      width: spanRect.width * widthRatio,
      height: spanH,
    };
  }

  // Helper: render highlights for a single page in scroll mode
  const updateScrollHighlightsForPage = useCallback((pageNum: number) => {
    const wrapper = scrollContainerRef.current?.querySelector(`[data-page="${pageNum}"]`) as HTMLElement;
    if (!wrapper) return;
    const hlLayer = wrapper.querySelector('.pdf-highlight-layer') as HTMLElement;
    const textLayer = wrapper.querySelector('.textLayer') as HTMLElement;
    if (!hlLayer || !textLayer) return;

    while (hlLayer.firstChild) hlLayer.removeChild(hlLayer.firstChild);

    const results = searchResultsRef.current;
    const pageResults = results.filter((r) => r.page === pageNum);
    if (pageResults.length === 0) return;

    for (const result of pageResults) {
      const spanList = result.spans || [{ itemIndex: result.itemIndex, charStart: result.charStart, charEnd: result.charEnd }];
      for (const hlSpan of spanList) {
        const span = textLayer.querySelector(`[data-item-index="${hlSpan.itemIndex}"]`) as HTMLElement;
        if (!span) continue;

        const r = computeHighlightRect(span, wrapper, hlSpan.charStart, hlSpan.charEnd);
        const div = document.createElement('div');
        div.className = 'highlight-mark';
        div.dataset.resultId = result.id;
        const vInset = Math.max(r.height * 0.12, 1);
        const bgStyle = result.termColor ? `background-color:${result.termColor}66;` : '';
        div.style.cssText = `left:${r.left}px;top:${r.top + vInset}px;width:${Math.max(r.width, 8)}px;height:${Math.max(r.height - vInset * 2, 4)}px;${bgStyle}`;
        hlLayer.appendChild(div);
      }
    }
  }, []);

  // Helper: render keyword highlights on a wrapper element (shared by both modes)
  const renderKeywordHighlightsOnWrapper = useCallback((wrapper: HTMLElement, textLayer: HTMLElement) => {
    // Remove existing keyword highlights
    const existing = wrapper.querySelector('.pdf-keyword-highlight-layer');
    if (existing) existing.remove();

    const active = activeKeywordsRef.current;
    const kws = keywordsRef.current;
    if (!active || active.length === 0 || !kws) return;

    const activeSet = new Set(active);
    const colorMap = new Map<string, string>();
    for (const kw of kws) {
      if (activeSet.has(kw.term)) colorMap.set(kw.term.toLowerCase(), kw.color);
    }
    if (colorMap.size === 0) return;

    const kwLayer = document.createElement('div');
    kwLayer.className = 'pdf-keyword-highlight-layer';
    kwLayer.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:1;';

    const spans = textLayer.querySelectorAll('span[data-item-index]');
    const tokenRe = /[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu;

    spans.forEach((spanEl) => {
      const span = spanEl as HTMLElement;
      const text = span.textContent || '';
      if (!text) return;
      const textLower = text.toLowerCase();

      for (const [term, color] of colorMap) {
        if (term.includes(' ')) {
          // Multi-word: use word-boundary regex for whole-phrase matching
          const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const mwRe = new RegExp('\\b' + escaped + '\\b', 'gi');
          let mwMatch;
          while ((mwMatch = mwRe.exec(text)) !== null) {
            createKwMark(span, wrapper, mwMatch.index, mwMatch.index + mwMatch[0].length, color, kwLayer);
          }
        } else {
          tokenRe.lastIndex = 0;
          let m;
          while ((m = tokenRe.exec(text)) !== null) {
            if (m[0].toLowerCase() === term) {
              createKwMark(span, wrapper, m.index, m.index + m[0].length, color, kwLayer);
            }
          }
        }
      }
    });

    if (kwLayer.childElementCount > 0) wrapper.appendChild(kwLayer);
  }, []);

  function createKwMark(
    span: HTMLElement, wrapper: HTMLElement,
    charStart: number, charEnd: number,
    color: string, layer: HTMLElement,
  ) {
    const r = computeHighlightRect(span, wrapper, charStart, charEnd);
    const div = document.createElement('div');
    div.className = 'highlight-mark keyword';
    const vInset = Math.max(r.height * 0.12, 1);
    div.style.cssText = `left:${r.left}px;top:${r.top + vInset}px;width:${Math.max(r.width, 4)}px;height:${Math.max(r.height - vInset * 2, 4)}px;background-color:${color}40;border-bottom:2px solid ${color};`;
    layer.appendChild(div);
  }

  // ===== Effect 4c: Keyword highlights (PAGE MODE) =====
  useEffect(() => {
    if (viewerMode !== 'page') return;
    if (!pageReady) return;
    const pd = pageDataRef.current;
    const textLayer = textLayerDivRef.current;
    if (!pd || !textLayer) return;
    renderKeywordHighlightsOnWrapper(pd.wrapper, textLayer);
  }, [viewerMode, pageReady, activeKeywords, keywords, scale, currentPage, renderKeywordHighlightsOnWrapper]);

  // Render a single page in scroll mode (imperative, uses refs for latest values)
  const renderScrollPageRef = useRef<(pageNum: number) => Promise<void>>(async () => {});
  renderScrollPageRef.current = async (pageNum: number) => {
    const doc = pdfDocRef.current;
    const s = scrollScaleRef.current;
    if (!doc || renderedScrollPagesRef.current.has(pageNum)) return;

    const wrapper = scrollContainerRef.current?.querySelector(`[data-page="${pageNum}"]`) as HTMLElement;
    if (!wrapper) return;

    renderedScrollPagesRef.current.add(pageNum);

    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: s });

      while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.cssText = 'display:block;width:100%;height:100%;';
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;

      if (!renderedScrollPagesRef.current.has(pageNum)) return;
      wrapper.appendChild(canvas);

      // Text layer
      const textContent = await page.getTextContent();
      const textLayerDiv = document.createElement('div');
      textLayerDiv.className = 'textLayer';

      const measureCanvas = document.createElement('canvas');
      const measureCtx = measureCanvas.getContext('2d');
      let strIdx = 0;
      for (const item of textContent.items) {
        if (!('str' in item)) continue;
        if (item.str) {
          const tx = item.transform;
          const fontSize = Math.sqrt(tx[0] ** 2 + tx[1] ** 2) * s;
          const rawHeight = item.height > 0 ? item.height : Math.sqrt(tx[0] ** 2 + tx[1] ** 2);
          const spanHeight = rawHeight * s * 0.85;
          const x = tx[4] * s;
          const y = viewport.height - tx[5] * s - spanHeight;
          let scaleXStyle = '';
          const expectedWidth = item.width * s;
          if (measureCtx && expectedWidth > 0 && item.str.length > 0) {
            measureCtx.font = `${fontSize}px sans-serif`;
            const actualWidth = measureCtx.measureText(item.str).width;
            if (actualWidth > 0) {
              const sx = expectedWidth / actualWidth;
              if (Math.abs(sx - 1) > 0.02) scaleXStyle = `transform:scaleX(${sx.toFixed(4)});`;
            }
          }
          const span = document.createElement('span');
          span.textContent = item.str;
          span.dataset.itemIndex = String(strIdx);
          span.style.cssText = `left:${x}px;top:${y}px;font-size:${fontSize}px;font-family:sans-serif;height:${spanHeight}px;line-height:${spanHeight}px;${scaleXStyle}`;
          textLayerDiv.appendChild(span);
        }
        strIdx++;
      }
      wrapper.appendChild(textLayerDiv);

      // Highlight layer
      const hlDiv = document.createElement('div');
      hlDiv.className = 'pdf-highlight-layer';
      wrapper.appendChild(hlDiv);

      updateScrollHighlightsForPage(pageNum);

      // Also render keyword highlights for this page
      const kwTextLayer = wrapper.querySelector('.textLayer') as HTMLElement;
      if (kwTextLayer) renderKeywordHighlightsOnWrapper(wrapper, kwTextLayer);
    } catch {
      renderedScrollPagesRef.current.delete(pageNum);
    }
  };

  // IntersectionObserver: detect visible pages and trigger rendering
  useEffect(() => {
    if (viewerMode !== 'scroll' || pageDims.length === 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const pageEls = container.querySelectorAll('[data-page]');
    if (pageEls.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestPage = -1;
        let bestRatio = 0;
        for (const entry of entries) {
          const pageNum = parseInt((entry.target as HTMLElement).dataset.page || '0');
          if (entry.isIntersecting) {
            if (entry.intersectionRatio > bestRatio) {
              bestRatio = entry.intersectionRatio;
              bestPage = pageNum;
            }
            // Render this page and neighbors
            for (let offset = -2; offset <= 2; offset++) {
              const neighbor = pageNum + offset;
              if (neighbor >= 1 && neighbor <= pageDims.length) {
                renderScrollPageRef.current?.(neighbor);
              }
            }
          }
          // Clean up far-away pages to save memory
          if (!entry.isIntersecting && renderedScrollPagesRef.current.has(pageNum)) {
            const dist = Math.abs(pageNum - currentPageRef.current);
            if (dist > 4) {
              const wrapper = entry.target as HTMLElement;
              while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);
              renderedScrollPagesRef.current.delete(pageNum);
            }
          }
        }
        if (bestPage > 0 && bestPage !== currentPageRef.current) {
          fromObserverRef.current = true;
          setCurrentPage(bestPage);
          requestAnimationFrame(() => { fromObserverRef.current = false; });
        }
      },
      { root: container, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    );

    pageEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [viewerMode, pageDims, setCurrentPage]);

  // Re-render all pages on scale change in scroll mode
  useEffect(() => {
    if (viewerMode !== 'scroll' || !pdfDoc || pageDims.length === 0) return;
    // Clear all rendered pages
    renderedScrollPagesRef.current.forEach((pageNum) => {
      const wrapper = scrollContainerRef.current?.querySelector(`[data-page="${pageNum}"]`) as HTMLElement;
      if (wrapper) while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);
    });
    renderedScrollPagesRef.current.clear();

    // Render pages near current page
    const cp = currentPageRef.current;
    for (let i = Math.max(1, cp - 2); i <= Math.min(pageDims.length, cp + 2); i++) {
      renderScrollPageRef.current?.(i);
    }
  }, [viewerMode, pdfDoc, scale, pageDims]);

  // Scroll to page when currentPage changes programmatically (not from observer)
  useEffect(() => {
    if (viewerMode !== 'scroll') return;
    if (fromObserverRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const pageEl = container.querySelector(`[data-page="${currentPage}"]`) as HTMLElement;
    if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [viewerMode, currentPage]);

  // Update highlights on search results change in scroll mode
  useEffect(() => {
    if (viewerMode !== 'scroll') return;
    renderedScrollPagesRef.current.forEach((pageNum) => {
      updateScrollHighlightsForPage(pageNum);
    });
  }, [viewerMode, searchResults, updateScrollHighlightsForPage]);

  // Toggle current highlight class in scroll mode
  useEffect(() => {
    if (viewerMode !== 'scroll') return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const currentId = searchResults[currentResultIndex]?.id;
    const marks = container.querySelectorAll('.highlight-mark');
    let scrolled = false;
    marks.forEach((mark) => {
      const el = mark as HTMLElement;
      if (el.dataset.resultId === currentId) {
        el.classList.add('current');
        el.dataset.origBg = el.style.backgroundColor || '';
        el.style.backgroundColor = '';
        if (!scrolled) {
          scrolled = true;
          requestAnimationFrame(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          });
        }
      } else {
        el.classList.remove('current');
        el.style.backgroundColor = el.dataset.origBg ?? '';
        delete el.dataset.origBg;
      }
    });
  }, [viewerMode, currentResultIndex, searchResults]);

  // Update keyword highlights in scroll mode
  useEffect(() => {
    if (viewerMode !== 'scroll') return;
    const container = scrollContainerRef.current;
    if (!container) return;
    renderedScrollPagesRef.current.forEach((pageNum) => {
      const wrapper = container.querySelector(`[data-page="${pageNum}"]`) as HTMLElement;
      const textLayer = wrapper?.querySelector('.textLayer') as HTMLElement;
      if (wrapper && textLayer) renderKeywordHighlightsOnWrapper(wrapper, textLayer);
    });
  }, [viewerMode, activeKeywords, keywords, renderKeywordHighlightsOnWrapper]);

  // ===================================================================
  // ===== TEXT SELECTION (shared, mode-aware) =====
  // ===================================================================

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  /** Clean up PDF text selection: collapse excessive whitespace from span gaps */
  const cleanSelectionText = useCallback((raw: string): string => {
    return raw
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]*\n[ \t]*/g, ' ')   // join broken lines
      .replace(/ {2,}/g, ' ')             // collapse multiple spaces
      .replace(/^\s+|\s+$/g, '');
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Don't dismiss floating button if clicking on it
    const target = e.target as HTMLElement;
    if (target.closest('[aria-label="선택한 텍스트 번역"]')) return;

    // Ignore micro-drags (< 5px) that aren't intentional selections
    const down = mouseDownPosRef.current;
    if (down) {
      const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      mouseDownPosRef.current = null;
      if (dist < 5) { setFloatingBtn(null); return; }
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { setFloatingBtn(null); return; }
    const text = cleanSelectionText(sel.toString());
    const anchor = sel.anchorNode;
    const contentContainer = viewerMode === 'scroll'
      ? scrollContainerRef.current
      : canvasContainerRef.current;

    if (text && text.length > 0 && anchor && contentContainer?.contains(anchor)) {
      setSelectedText(text);
      const x = Math.min(Math.max(e.clientX - 35, 10), window.innerWidth - 90);
      // Below if room, above if near bottom
      const belowY = e.clientY + 10;
      const aboveY = e.clientY - 50;
      const y = belowY < window.innerHeight - 60 ? belowY : Math.max(10, aboveY);
      setFloatingBtn({ x, y });
      const scrollContainer = viewerMode === 'scroll'
        ? scrollContainerRef.current
        : contentContainer?.parentElement;
      if (scrollContainer) {
        scrollStartRef.current = scrollContainer.scrollTop;
      }
    } else {
      setFloatingBtn(null);
      scrollStartRef.current = null;
    }
  }, [setSelectedText, viewerMode, cleanSelectionText]);

  // Mobile text selection (selectionchange)
  useEffect(() => {
    const container = viewerMode === 'scroll'
      ? scrollContainerRef.current
      : canvasContainerRef.current;
    if (!container) return;

    // Track touch movement to distinguish scroll from selection
    let touchMoved = false;
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchMoved = false;
      touchStartY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const dy = Math.abs((e.touches[0]?.clientY ?? 0) - touchStartY);
      if (dy > 10) touchMoved = true;
    };
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });

    /** Clean up PDF text selection: collapse excessive whitespace from span gaps */
    const cleanText = (raw: string): string =>
      raw.replace(/\r\n/g, '\n').replace(/[ \t]*\n[ \t]*/g, ' ').replace(/ {2,}/g, ' ').replace(/^\s+|\s+$/g, '');

    let selDebounce: ReturnType<typeof setTimeout> | null = null;
    const handleSelectionChange = () => {
      if (selDebounce) clearTimeout(selDebounce);
      selDebounce = setTimeout(() => {
        // Skip if user was scrolling, not selecting
        if (touchMoved) return;

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || !sel.toString().trim()) {
          // Don't clear selectedText if translation is in progress/shown
          if (!useStore.getState().showTranslation) {
            setSelectedText('');
          }
          return;
        }
        const trimmed = cleanText(sel.toString());
        if (trimmed.length < 2) return; // ignore single-char accidental taps
        const anchor = sel.anchorNode;
        if (trimmed && anchor && container.contains(anchor)) {
          setSelectedText(trimmed);
          const range = sel.getRangeAt(0);
          const rangeRect = range.getBoundingClientRect();
          const x = Math.min(Math.max(rangeRect.left, 10), window.innerWidth - 90);
          // Below if room, above if near bottom
          const belowY = rangeRect.bottom + 8;
          const aboveY = rangeRect.top - 50;
          const y = belowY < window.innerHeight - 60 ? belowY : Math.max(10, aboveY);
          setFloatingBtn({ x, y });
          const scrollContainer = viewerMode === 'scroll'
            ? scrollContainerRef.current
            : container.parentElement;
          if (scrollContainer) {
            scrollStartRef.current = scrollContainer.scrollTop;
          }
        }
      }, 100);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      if (selDebounce) clearTimeout(selDebounce);
    };
  }, [pdfDoc, setSelectedText, viewerMode]);

  // Dismiss floating button on scroll when selection leaves viewport
  useEffect(() => {
    const scrollContainer = viewerMode === 'scroll'
      ? scrollContainerRef.current
      : canvasContainerRef.current?.parentElement;
    const contentContainer = viewerMode === 'scroll'
      ? scrollContainerRef.current
      : canvasContainerRef.current;
    if (!scrollContainer) return;
    const handleScroll = () => {
      if (scrollStartRef.current === null) return;
      const scrollDist = Math.abs(scrollContainer.scrollTop - scrollStartRef.current);
      if (scrollDist < 30) return; // Allow small scrolls without dismissing
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (text && text.length > 0 && sel?.rangeCount && contentContainer?.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        const rangeRect = range.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        if (rangeRect.bottom < containerRect.top || rangeRect.top > containerRect.bottom) {
          setFloatingBtn(null);
          scrollStartRef.current = null;
        }
      } else {
        setFloatingBtn(null);
        scrollStartRef.current = null;
      }
    };
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [pdfDoc, viewerMode]);

  // ===================================================================
  // ===== RENDER =====
  // ===================================================================

  if (!pdfData) return null;

  if (!pdfDoc && !pdfLoadError) {
    return (
      <div className="h-full bg-gray-200 flex items-center justify-center">
        <div className="w-full max-w-2xl mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-full mb-4" />
            <div className="h-4 bg-gray-200 rounded w-5/6 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-full mb-4" />
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-6" />
            <div className="h-4 bg-gray-200 rounded w-full mb-4" />
            <div className="h-4 bg-gray-200 rounded w-4/5 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-full mb-4" />
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">PDF 문서를 준비하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (pdfLoadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center bg-gray-100">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-lg font-semibold text-gray-800">PDF를 열 수 없습니다</h2>
        <p className="text-sm text-gray-500">파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.</p>
        <button
          onClick={reset}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          다른 파일 열기
        </button>
      </div>
    );
  }

  // Floating translate button near selection (works on all devices)
  const floatingBtnEl = floatingBtn && selectedText && !showTranslation && (
    <div
      className="fixed z-50 animate-in fade-in"
      style={{ left: `${floatingBtn.x}px`, top: `${floatingBtn.y}px` }}
    >
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleTranslateClick}
        aria-label="선택한 텍스트 번역"
        className="px-3.5 py-2.5 bg-blue-600 text-white text-sm rounded-lg shadow-lg
                   hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
        번역
      </button>
    </div>
  );

  // === Scroll mode ===
  if (viewerMode === 'scroll') {
    return (
      <div
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        className="overflow-auto h-full bg-gray-200 relative"
      >
        {pageDims.map((dim, i) => (
          <div
            key={i + 1}
            data-page={i + 1}
            style={{
              position: 'relative',
              width: `${dim.w * scale}px`,
              minWidth: `${Math.min(280, dim.w * scale)}px`,
              height: `${dim.h * scale}px`,
              margin: '1px auto',
              background: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          />
        ))}
        {floatingBtnEl}

      </div>
    );
  }

  // === Page mode ===
  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className="overflow-auto h-full bg-gray-200 relative flex items-start justify-center"
    >
      <div ref={canvasContainerRef} />
      {floatingBtnEl}
      {renderingCanvas && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-20">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg shadow">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span className="text-sm text-gray-600">페이지 렌더링 중...</span>
          </div>
        </div>
      )}
    </div>
  );
});
