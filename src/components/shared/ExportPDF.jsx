'use client';

import { useState } from "react";

function loadHtml2Canvas() {
  return new Promise(function(resolve, reject) {
    if (window.html2canvas) { resolve(window.html2canvas); return; }
    var s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s.onload = function() { resolve(window.html2canvas); };
    s.onerror = function() { reject(new Error("Failed to load html2canvas")); };
    document.head.appendChild(s);
  });
}

// Minimal PDF writer: produces a valid PDF from a canvas element.
// Uses only browser-native APIs — no CDN, no script injection.
function canvasToPdfBlob(canvas, title, subtitle, isDark) {
  const W = 595, H = 842, M = 28; // A4 points, margin

  // Header colours
  const hBg  = isDark ? "0.08 0.08 0.08" : "0.96 0.96 0.97";
  const hFg  = isDark ? "0.88 0.88 0.88" : "0.10 0.10 0.10";
  const pgBg = isDark ? "0.03 0.03 0.03" : "0.94 0.94 0.95";

  // Scale canvas image to fit page width
  const imgW = W - M * 2;
  const imgH = Math.round((canvas.height / canvas.width) * imgW);
  const contentY = 68; // below header

  // --- Encode canvas as JPEG (smaller than PNG) ---
  const imgDataUrl = canvas.toDataURL("image/jpeg", 0.88);
  const b64 = imgDataUrl.split(",")[1];
  // Decode base64 to binary string
  const bin = atob(b64);
  const imgBytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) imgBytes[i] = bin.charCodeAt(i);

  const ts = new Date().toLocaleString();
  const safeTitle   = (title   || "Analysis").replace(/[()\\]/g, " ");
  const safeSubtitle= (subtitle|| "Market Predictor").replace(/[()\\]/g, " ");

  // Determine if we need multiple pages
  const availH = H - contentY - M;
  const pages = Math.ceil(imgH / availH);

  // Build PDF objects
  const objs = [];
  const push = (s) => objs.push(s);

  // Object 1: catalog
  push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);

  // Object 2: pages (filled later once we know page count)
  const pagesRef = [];
  for (let p = 0; p < pages; p++) pagesRef.push(`${4 + p * 2} 0 R`);
  push(`2 0 obj\n<< /Type /Pages /Kids [${pagesRef.join(" ")}] /Count ${pages} >>\nendobj`);

  // Object 3: font
  push(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`);

  // Object 4+: image XObject
  const imgObjIdx = 4 + pages * 2;
  const imgLen = imgBytes.length;

  // Page objects (4, 6, 8...)
  for (let p = 0; p < pages; p++) {
    const pageObjIdx = 4 + p * 2;
    const streamObjIdx = 5 + p * 2;
    const sliceY = p * availH;  // in PDF points from top of image
    const sliceH = Math.min(availH, imgH - sliceY);
    const yOnPage = p === 0 ? contentY : M;
    const drawH   = sliceH;
    const drawY   = H - yOnPage - drawH; // PDF coords from bottom

    // Clip and draw the image slice
    // We use a Do operator inside a q/Q save block with a clipping rect
    const stream = [
      // Background
      `${pgBg} rg`,
      `0 0 ${W} ${H} re f`,
      // Header bar (page 0 only)
      ...(p === 0 ? [
        `${hBg} rg`,
        `0 ${H - 56} ${W} 56 re f`,
        `0.39 0.40 0.95 RG`,
        `0.6 w`,
        `0 ${H - 56} m ${W} ${H - 56} l S`,
        // Logo dot
        `0.00 0.83 0.67 rg`,
        `BT /F1 10 Tf ${M} ${H - 22} Td (Market Predictor) Tj ET`,
        `${hFg} rg`,
        `BT /F1 13 Tf ${M} ${H - 17} Td (${safeTitle}) Tj ET`,
        `0.55 0.55 0.55 rg`,
        `BT /F1 7 Tf ${M} ${H - 28} Td (${safeSubtitle}) Tj ET`,
        `BT /F1 7 Tf ${W - M - 180} ${H - 17} Td (Generated: ${ts}) Tj ET`,
        `BT /F1 6 Tf ${W - M - 180} ${H - 28} Td (Educational purposes only) Tj ET`,
      ] : []),
      // Clip region then draw image
      `q`,
      `${imgW} 0 0 ${drawH} ${M} ${drawY} cm`,
      // For slices > page 0, offset the image vertically
      ...(p > 0 ? [`1 0 0 1 0 ${-sliceY / imgH} cm`] : [`1 0 0 1 0 ${-(imgH - drawH - sliceY) / imgH} cm`]),
      `/Im1 Do`,
      `Q`,
      // Footer
      `0.60 0.60 0.60 rg`,
      `${M} ${H - 56} m ${W - M} ${H - 56} l S`,
      `0.50 0.50 0.50 rg`,
      `BT /F1 6 Tf ${M} 8 Td (Market Predictor - AI-powered - Educational use only) Tj ET`,
      `BT /F1 6 Tf ${W - M - 50} 8 Td (Page ${p + 1} of ${pages}) Tj ET`,
    ].join("\n");

    push(`${pageObjIdx} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}]\n   /Resources << /Font << /F1 3 0 R >> /XObject << /Im1 ${imgObjIdx} 0 R >> >>\n   /Contents ${streamObjIdx} 0 R\n>>\nendobj`);

    const streamBytes = new TextEncoder().encode(stream);
    push(`${streamObjIdx} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream\nendobj`);
  }

  // Image XObject
  push(`${imgObjIdx} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height}\n   /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgLen}\n>>\nstream`);

  // Build byte array
  const enc = new TextEncoder();
  const parts = [];
  const offsets = [];
  let offset = 0;

  const addText = (s) => {
    const b = enc.encode(s + "\n");
    parts.push(b);
    offset += b.length;
  };

  addText("%PDF-1.4");
  addText("%\xFF\xFF\xFF\xFF");

  for (let i = 0; i < objs.length; i++) {
    offsets.push(offset);
    if (i === objs.length - 1) {
      // Last obj is the image — needs binary body
      addText(objs[i]);
      parts.push(imgBytes);
      offset += imgBytes.length;
      addText("\nendstream\nendobj");
    } else {
      addText(objs[i]);
    }
  }

  // xref table
  const xrefOffset = offset;
  const xrefCount = objs.length + 1;
  let xref = `xref\n0 ${xrefCount}\n0000000000 65535 f \n`;
  for (const o of offsets) xref += String(o).padStart(10, "0") + " 00000 n \n";
  addText(xref);
  addText(`trailer\n<< /Size ${xrefCount} /Root 1 0 R >>`);
  addText(`startxref\n${xrefOffset}\n%%EOF`);

  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const buf = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of parts) { buf.set(p, pos); pos += p.length; }
  return new Blob([buf], { type: "application/pdf" });
}

// Capture a DOM element to canvas using html2canvas
async function captureElementToCanvas(el, isDark) {
  const h2c = await loadHtml2Canvas();
  return h2c(el, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: isDark ? "#080808" : "#f0f2f5",
    logging: false,
    removeContainer: true,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });
}

async function exportSectionToPDF({ elementId, filename, title, subtitle, theme }) {
  const el = document.getElementById(elementId);
  if (!el) { alert("Nothing to export yet — load data or run a prediction first."); return; }
  const isDark = theme === "dark";
  // Scroll element into view and expand any overflow so html2canvas captures everything
  el.scrollIntoView({ behavior: "instant", block: "start" });
  const prevOverflow = el.style.overflow;
  const prevHeight = el.style.height;
  el.style.overflow = "visible";
  el.style.height = "auto";
  await new Promise(function(r) { setTimeout(r, 120); }); // let reflow settle
  const canvas = await captureElementToCanvas(el, isDark);
  el.style.overflow = prevOverflow;
  el.style.height = prevHeight;
  const blob = canvasToPdfBlob(canvas, title, subtitle, isDark);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 5000);
}

function ExportPDFButton({ elementId, filename, title, subtitle, theme, label }) {
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try { await exportSectionToPDF({ elementId, filename, title, subtitle, theme }); }
    catch(e) { alert("Export failed: " + (e.message || "Unknown error")); }
    setExporting(false);
  };
  return (
    <button onClick={handleExport} disabled={exporting} title="Export to PDF"
      style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 13px", borderRadius:8,
        border:"1px solid rgba(239,68,68,0.35)", background:exporting?"rgba(239,68,68,0.06)":"rgba(239,68,68,0.08)",
        color:"#f87171", fontSize:"clamp(9px,1.8vw,10px)", fontFamily:"monospace", fontWeight:700,
        cursor:exporting?"not-allowed":"pointer", transition:"all 0.2s", flexShrink:0, opacity:exporting?0.7:1 }}>
      {exporting ? "⟳ Exporting..." : (label || "⬇ Export PDF")}
    </button>
  );
}

export { ExportPDFButton, exportSectionToPDF };
