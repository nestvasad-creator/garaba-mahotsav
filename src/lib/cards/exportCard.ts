'use client';

import { toPng, toJpeg } from 'html-to-image';

export interface CardExportOptions {
  fileName?: string;
  format?: 'png' | 'jpeg';
  quality?: number;
  pixelRatio?: number;
}

/**
 * Ensures all <img> elements inside a container are fully loaded and decoded.
 * Specifically checks that async QR code generation is completed and remote photos are decoded.
 */
export async function ensureImagesLoaded(container: HTMLElement): Promise<void> {
  // 1. If QR code is still generating asynchronously via QRCode.toDataURL, wait until complete
  const startTime = Date.now();
  while (Date.now() - startTime < 3000) {
    const hasGeneratingText = container.textContent?.includes('GENERATING');
    if (!hasGeneratingText) {
      break;
    }
    await new Promise((r) => setTimeout(r, 60));
  }

  // 2. Ensure all <img> elements are fully loaded and decoded
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth > 0) {
        return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        let finished = false;
        const onDone = () => {
          if (finished) return;
          finished = true;
          img.removeEventListener('load', onDone);
          img.removeEventListener('error', onDone);
          if (img.decode) {
            img.decode().then(resolve).catch(resolve);
          } else {
            resolve();
          }
        };
        img.addEventListener('load', onDone);
        img.addEventListener('error', onDone);
        // Safety timeout so it never hangs if an image fails to load
        setTimeout(onDone, 2500);
      });
    })
  );
}

/**
 * Exports a card DOM element and downloads it as a high-resolution PNG or JPEG file.
 * Perfect for saving cards locally so they can be printed later.
 */
export async function saveCardAsImage(
  element: HTMLElement,
  options: CardExportOptions = {}
): Promise<string> {
  const {
    fileName = 'CR80-ID-Card',
    format = 'png',
    quality = 0.98,
    pixelRatio = 3, // 3x scale renders 260x412 into crisp 780x1236px suitable for card printers
  } = options;

  const extension = format === 'jpeg' ? 'jpg' : 'png';
  const cleanFileName = fileName.toLowerCase().endsWith(`.${extension}`)
    ? fileName
    : `${fileName}.${extension}`;

  // Ensure all images are fully rendered into the DOM before capture
  await ensureImagesLoaded(element);

  const exportConfig = {
    quality,
    pixelRatio,
    skipFonts: true, // Prevents SecurityError: CSSStyleSheet.cssRules getter on cross-origin stylesheets
    cacheBust: true, // Prevents html-to-image internal global cache from reusing previous photos
    includeQueryParams: true, // Preserves query params so proxy URLs with different cards have distinct cache keys
    filter: (node: HTMLElement) => node.tagName !== 'SCRIPT' && node.tagName !== 'LINK',
    onImageErrorHandler: (err: any) => console.warn('Card export resource warning:', err),
  };

  let dataUrl: string;

  try {
    if (format === 'jpeg') {
      dataUrl = await toJpeg(element, exportConfig);
    } else {
      dataUrl = await toPng(element, exportConfig);
    }
  } catch (initialError) {
    console.warn('Initial html-to-image export failed, retrying with fallback options:', initialError);
    // Retry with basic options
    dataUrl = format === 'jpeg'
      ? await toJpeg(element, { quality, pixelRatio: 2, skipFonts: true, cacheBust: true, includeQueryParams: true })
      : await toPng(element, { quality, pixelRatio: 2, skipFonts: true, cacheBust: true, includeQueryParams: true });
  }

  // Trigger browser download
  const link = document.createElement('a');
  link.download = cleanFileName;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(dataUrl);

  return dataUrl;
}

/**
 * Renders a card element to a high-resolution 300 DPI PNG data URL,
 * ensuring all photos and QR codes are fully loaded.
 */
export async function renderCardToDataUrl(element: HTMLElement): Promise<string> {
  await ensureImagesLoaded(element);

  const exportConfig = {
    quality: 1,
    pixelRatio: 3,
    skipFonts: true,
    cacheBust: true,
    includeQueryParams: true,
    filter: (node: HTMLElement) => node.tagName !== 'SCRIPT' && node.tagName !== 'LINK',
    onImageErrorHandler: (err: any) => console.warn('Card export resource warning:', err),
  };

  try {
    return await toPng(element, exportConfig);
  } catch (err) {
    console.warn('Initial 3x capture failed, retrying at 2x ratio:', err);
    return await toPng(element, {
      quality: 0.98,
      pixelRatio: 2,
      skipFonts: true,
      cacheBust: true,
      includeQueryParams: true,
      filter: (node: HTMLElement) => node.tagName !== 'SCRIPT' && node.tagName !== 'LINK',
    });
  }
}

/**
 * Sends card PNG data URLs directly to the Windows print spooler via the server-side
 * /api/silent-print route (PowerShell mspaint /pt). No browser dialog is shown.
 * Returns success/failure status.
 */
export async function silentPrintCards(
  dataUrls: string[],
  printerName: string
): Promise<{ success: boolean; successCount: number; failCount: number; error?: string }> {
  try {
    const response = await fetch('/api/silent-print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrls, printerName }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        successCount: 0,
        failCount: dataUrls.length,
        error: `HTTP ${response.status}: ${text}`,
      };
    }

    const result = await response.json();
    return {
      success: result.success,
      successCount: result.successCount ?? 0,
      failCount: result.failCount ?? 0,
      error: result.success ? undefined : (result.message || result.error),
    };
  } catch (err: any) {
    console.warn('Silent print API call failed:', err);
    return { success: false, successCount: 0, failCount: dataUrls.length, error: err.message };
  }
}

/**
 * Sends a card element directly to the physical printer.
 * Tries silent printing via /api/silent-print first (no dialog).
 * Falls back to iframe.print() (shows dialog) only if the server route fails.
 * Formatted with exact CR80 dimensions (85.60mm x 53.98mm) — portrait, single-sided.
 */
export async function printCardDirectly(
  element: HTMLElement,
  printerName?: string
): Promise<{ usedSilent: boolean }> {
  // 0. Ensure all card assets/photos are fully decoded in DOM
  await ensureImagesLoaded(element);

  // 1. Capture card at high resolution (300 DPI equivalent)
  let dataUrl: string;
  try {
    dataUrl = await toPng(element, {
      quality: 1,
      pixelRatio: 3,
      skipFonts: true,
      cacheBust: true,
      includeQueryParams: true,
      filter: (node: HTMLElement) => node.tagName !== 'SCRIPT' && node.tagName !== 'LINK',
      onImageErrorHandler: (err: any) => console.warn('Card print resource warning:', err),
    });
  } catch (err) {
    console.warn('First render failed, retrying with fallback resolution:', err);
    dataUrl = await toPng(element, {
      quality: 0.98,
      pixelRatio: 2,
      skipFonts: true,
      cacheBust: true,
      includeQueryParams: true,
      filter: (node: HTMLElement) => node.tagName !== 'SCRIPT' && node.tagName !== 'LINK',
      onImageErrorHandler: (fallbackErr: any) => console.warn('Card fallback warning:', fallbackErr),
    });
  }

  // 2. Open system print dialog via isolated iframe
  const existingIframe = document.getElementById('cr80-isolated-print-frame');
  if (existingIframe) {
    try { existingIframe.remove(); } catch (_) {}
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'cr80-isolated-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '10px';
  iframe.style.height = '10px';
  iframe.style.opacity = '0.01';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = 'none';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.error('Failed to access isolated print frame document');
    return { usedSilent: false };
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print CR80 ID Card</title>
        <style>
          @page {
            size: 53.98mm 85.60mm portrait;
            margin: 0mm;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: 53.98mm;
            height: 85.60mm;
            overflow: hidden;
            background: #ffffff;
          }
          .card-box {
            width: 53.98mm;
            height: 85.60mm;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }
          img {
            width: 53.98mm;
            height: 85.60mm;
            object-fit: fill;
            display: block;
          }
        </style>
      </head>
      <body>
        <div class="card-box">
          <img id="print-card-img" src="${dataUrl}" alt="ID Card" />
        </div>
      </body>
    </html>
  `);
  doc.close();

  await new Promise((resolve) => {
    const img = doc.getElementById('print-card-img') as HTMLImageElement;
    if (img && !img.complete) {
      img.onload = () => setTimeout(resolve, 150);
      img.onerror = () => resolve(null);
    } else {
      setTimeout(resolve, 300);
    }
  });

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  return { usedSilent: false };
}

/**
 * Sends multiple cards to the physical printer in a single continuous multi-page print job.
 * Tries silent printing via /api/silent-print first (no browser dialog).
 * Falls back to iframe.print() only if the server route is unavailable.
 * Each card is a distinct page at exact CR80 dimensions (53.98mm x 85.60mm), portrait, single-sided.
 */
export async function printBatchCardsDirectly(
  cardDataUrls: string[],
  printerName?: string
): Promise<{ usedSilent: boolean }> {
  if (cardDataUrls.length === 0) return { usedSilent: false };

  // 1. Try silent print via server API route (no browser dialog)
  if (printerName) {
    const silentResult = await silentPrintCards(cardDataUrls, printerName);
    if (silentResult.success) {
      console.info(
        `[CR80Print] Silent batch print succeeded: ${silentResult.successCount} card(s) on ${printerName}`
      );
      return { usedSilent: true };
    }
    console.warn(
      `[CR80Print] Silent batch print failed (${silentResult.error}), falling back to dialog for ${cardDataUrls.length} card(s)...`
    );
  }

  // 2. Fallback: iframe multi-page print (shows system dialog once)
  const existingIframe = document.getElementById('cr80-isolated-print-frame');
  if (existingIframe) {
    try { existingIframe.remove(); } catch (_) {}
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'cr80-isolated-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.left = '0';
  iframe.style.top = '0';
  iframe.style.width = '100vw';
  iframe.style.height = '100vh';
  iframe.style.opacity = '0.001';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = 'none';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.error('Failed to access isolated print frame document');
    return { usedSilent: false };
  }

  const pagesHtml = cardDataUrls
    .map(
      (url, index) => `
        <div class="card-page">
          <img class="card-img" src="${url}" alt="ID Card ${index + 1}" />
        </div>
      `
    )
    .join('\n');

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Batch Print CR80 Cards (${cardDataUrls.length} Cards)</title>
        <style>
          @page {
            size: 53.98mm 85.60mm portrait;
            margin: 0mm;
          }
          *, *:before, *:after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 53.98mm !important;
            background: #ffffff !important;
          }
          .card-page {
            display: block !important;
            position: relative !important;
            width: 53.98mm !important;
            height: 85.60mm !important;
            page-break-before: auto !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            break-before: auto !important;
            break-after: page !important;
            break-inside: avoid !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .card-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .card-img {
            display: block !important;
            width: 53.98mm !important;
            height: 85.60mm !important;
            max-width: 53.98mm !important;
            max-height: 85.60mm !important;
            margin: 0 !important;
            padding: 0 !important;
            object-fit: fill !important;
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
    </html>
  `);
  doc.close();

  // Wait for all images in the iframe to fully load and decode
  const imgs = Array.from(doc.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        const onFinish = () => {
          img.removeEventListener('load', onFinish);
          img.removeEventListener('error', onFinish);
          resolve(null);
        };
        img.addEventListener('load', onFinish);
        img.addEventListener('error', onFinish);
        setTimeout(onFinish, 3000);
      });
    })
  );

  await new Promise((r) => setTimeout(r, 400));

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  return { usedSilent: false };
}
