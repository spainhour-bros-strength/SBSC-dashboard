/* SBSC Dashboard — file storage for program PDFs.
   PDFs are too large for localStorage, so they live in this browser's IndexedDB
   (hundreds of MB available). Like everything else, they never go into the repo,
   and they are included in Settings → Download backup. */
window.SB = window.SB || {};

(function (SB) {
  const DB_NAME = 'sbsc_files', STORE = 'files';
  let dbp = null;

  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('This browser cannot store files.'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction(STORE, mode);
      const st = t.objectStore(STORE);
      const req = fn(st);
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Storage full — remove old PDFs or free up space.'));
    });
  }

  const put = (id, blob) => tx('readwrite', st => st.put(blob, id));
  const get = id => tx('readonly', st => st.get(id));
  const del = id => tx('readwrite', st => st.delete(id));
  const keys = () => tx('readonly', st => st.getAllKeys());
  const clear = () => tx('readwrite', st => st.clear());

  const blobToDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  async function dataURLToBlob(url) { return (await fetch(url)).blob(); }

  // Object URLs for displaying stored files (thumbnails, viewer), cached per id
  const urlCache = new Map();
  async function url(id) {
    if (urlCache.has(id)) return urlCache.get(id);
    const b = await get(id);
    if (!b) return null;
    const u = URL.createObjectURL(b);
    urlCache.set(id, u);
    return u;
  }
  function forget(id) { if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); } }

  // ---------- PDF helpers (pdf.js is loaded only when first needed) ----------
  let pdfjsP = null;
  function pdfjs() {
    if (pdfjsP) return pdfjsP;
    pdfjsP = new Promise((resolve, reject) => {
      if (window.pdfjsLib) return resolve(window.pdfjsLib);
      const s = document.createElement('script');
      s.src = 'pdf.min.js';
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      s.onerror = () => reject(new Error('PDF preview library failed to load'));
      document.head.appendChild(s);
    });
    return pdfjsP;
  }

  // Returns { pages, thumb (Blob|null) } — never throws; a failed preview just means no thumbnail
  async function inspectPDF(file) {
    try {
      const lib = await pdfjs();
      const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const page = await doc.getPage(1);
      const vp0 = page.getViewport({ scale: 1 });
      const scale = 640 / Math.max(vp0.width, vp0.height);
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const thumb = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.82));
      const pages = doc.numPages;
      doc.destroy();
      return { pages, thumb, landscape: vp0.width > vp0.height };
    } catch (e) {
      console.warn('PDF preview failed', e);
      return { pages: null, thumb: null, landscape: null };
    }
  }

  // Store a PDF + its cover thumbnail; returns the metadata saved on the program
  async function savePDF(file) {
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) throw new Error(`${file.name} is not a PDF`);
    if (navigator.storage && navigator.storage.persist) { try { await navigator.storage.persist(); } catch (e) { } }
    const id = SB.store.uid('pdf');
    const info = await inspectPDF(file);
    await put(id, file);
    if (info.thumb) await put(id + ':thumb', info.thumb);
    return { id, name: file.name, size: file.size, pages: info.pages, landscape: info.landscape, hasThumb: !!info.thumb, uploadedAt: new Date().toISOString() };
  }
  async function removePDF(meta) {
    if (!meta) return;
    await del(meta.id); await del(meta.id + ':thumb');
    forget(meta.id); forget(meta.id + ':thumb');
  }
  async function copyPDF(meta) {
    const b = await get(meta.id);
    if (!b) return null;
    const id = SB.store.uid('pdf');
    await put(id, b);
    const t = await get(meta.id + ':thumb');
    if (t) await put(id + ':thumb', t);
    return Object.assign({}, meta, { id });
  }

  // ---------- Backup ----------
  async function exportAll() {
    const out = {};
    for (const k of await keys()) { const b = await get(k); if (b) out[k] = await blobToDataURL(b); }
    return out;
  }
  async function importAll(map) {
    await clear(); urlCache.forEach(u => URL.revokeObjectURL(u)); urlCache.clear();
    for (const [k, v] of Object.entries(map || {})) await put(k, await dataURLToBlob(v));
  }
  async function usage() {
    let bytes = 0;
    for (const k of await keys()) { const b = await get(k); if (b) bytes += b.size; }
    return bytes;
  }

  const fmtSize = b => b == null ? '' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

  SB.files = { put, get, del, keys, clear, url, savePDF, removePDF, copyPDF, exportAll, importAll, usage, fmtSize };
})(window.SB);
