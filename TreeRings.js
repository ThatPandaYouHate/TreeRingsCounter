// State
let canvas, ctx;
let canvasSlice, canvasPlot, ctxPlot;
let resultCanvas;
let points = [];
let img, imageData, imgCopy;
let sensitivity = 5;
const bandwidth = 100;
const maxImageDim = 1800;
let dotSize = 20;
let lineWidth = 10;

// Pan & zoom state
let scale = 1;
let isDragging = false;
let startX, startY, translateX = 0, translateY = 0;
let canvasDisplayWidth, canvasDisplayHeight;
let movePoint = -1;
let initialPinchDist = 0;
let initialPinchScale = 1;

// Analysis state
let meanGray = [];
let sliceImageData = null;
let autoAnalysis = null;     // { valleys, smoothed, spacing }
let manualAdds = [];         // ring positions added by user (column index)
let removedAuto = new Set(); // auto-detected rings removed by user (column index)
let auxCounts = [];          // ring counts from extra directions around the pith
let auxTimer = null;
const auxAngles = [-24, -12, 12, 24]; // degrees relative to the main line

// DOM references
const uploadContainer = document.getElementById('upload-container');
const instructionsBar = document.getElementById('instructions');
const canvasHost = document.getElementById('canvas-host');
const resultsSection = document.getElementById('results-section');
const ringCountEl = document.getElementById('ring-count');
const ringDetailEl = document.getElementById('ring-detail');
const sliceCanvasHost = document.getElementById('slice-canvas-host');
const plotContainer = document.getElementById('plot-container');
const sensitivitySlider = document.getElementById('sensitivity-slider');
const sensitivityValueEl = document.getElementById('sensitivity-value');
const resetBtn = document.getElementById('reset-btn');
const imageUpload = document.getElementById('imageUpload');

// --- Event wiring ---

imageUpload.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadImage(ev.target.result);
    reader.readAsDataURL(file);
});

sensitivitySlider.addEventListener('input', onSensitivityChange);
resetBtn.addEventListener('click', resetAnalysis);

// --- Core functions ---

function loadImage(src) {
    if (canvas) {
        canvas.parentElement?.parentElement?.remove();
        resetState();
    }
    resultsSection.style.display = 'none';

    img = new Image();
    img.src = src;
    img.onerror = () => {
        alert('Kunde inte ladda bilden. Försök med en annan fil.');
        uploadContainer.style.display = 'flex';
    };
    img.onload = function () {
        const container = document.createElement('div');
        container.className = 'canvas-container';
        const wrapper = document.createElement('div');
        wrapper.className = 'canvas-wrapper';

        canvas = document.createElement('canvas');
        // Skala ner stora foton — snabbare analys utan synbar precisionsförlust
        const fit = Math.min(1, maxImageDim / Math.max(img.width, img.height));
        const iw = Math.round(img.width * fit);
        const ih = Math.round(img.height * fit);
        dotSize = Math.max(10, Math.round(iw / 90));
        lineWidth = Math.max(4, Math.round(iw / 250));

        canvasDisplayWidth = window.innerWidth;
        const aspectRatio = ih / iw;
        canvasDisplayHeight = canvasDisplayWidth * aspectRatio;

        canvas.width = iw;
        canvas.height = ih;
        canvas.style.width = canvasDisplayWidth + 'px';
        canvas.style.height = canvasDisplayHeight + 'px';

        const maxH = window.innerHeight * 0.7;
        container.style.height = Math.min(canvasDisplayHeight, maxH) + 'px';

        wrapper.appendChild(canvas);
        container.appendChild(wrapper);
        canvasHost.appendChild(container);

        ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, iw, ih);

        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            d[i] = d[i + 1] = d[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
        imgCopy = ctx.getImageData(0, 0, canvas.width, canvas.height);

        setupInteractions(wrapper, container);
        uploadContainer.style.display = 'none';
        suggestLine();
    };
}

// Föreslå en linje från bildens mitt (där märgen oftast hamnar) ut mot kanten
function suggestLine() {
    const cx = Math.round(canvas.width / 2);
    const cy = Math.round(canvas.height / 2);
    const ex = Math.round(canvas.width * 0.96);
    points = [{ x: cx, y: cy }, { x: ex, y: cy }];
    drawLine();
    setInstruction('suggested');
}

function resetState() {
    points = [];
    movePoint = -1;
    meanGray = [];
    sliceImageData = null;
    autoAnalysis = null;
    manualAdds = [];
    removedAuto.clear();
    auxCounts = [];
    clearTimeout(auxTimer);
    if (canvasSlice) { canvasSlice.remove(); canvasSlice = null; }
    if (canvasPlot) { canvasPlot.remove(); canvasPlot = null; }
    ctxPlot = null;
    resultCanvas = null;
    scale = 1;
    translateX = 0;
    translateY = 0;
}

function resetAnalysis() {
    if (canvas) {
        canvas.parentElement?.parentElement?.remove();
    }
    canvas = null;
    ctx = null;
    img = null;
    imageData = null;
    imgCopy = null;

    points = [];
    movePoint = -1;
    meanGray = [];
    sliceImageData = null;
    autoAnalysis = null;
    manualAdds = [];
    removedAuto.clear();
    auxCounts = [];
    clearTimeout(auxTimer);
    if (canvasSlice) { canvasSlice.remove(); canvasSlice = null; }
    if (canvasPlot) { canvasPlot.remove(); canvasPlot = null; ctxPlot = null; }
    resultCanvas = null;
    scale = 1;
    translateX = 0;
    translateY = 0;

    resultsSection.style.display = 'none';
    ringCountEl.textContent = '\u2014';
    ringDetailEl.textContent = '\u2248 tr\u00e4dets \u00e5lder i \u00e5r';

    uploadContainer.style.display = 'flex';
    instructionsBar.style.display = 'none';
    instructionsBar.textContent = '';

    imageUpload.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setInstruction(step) {
    instructionsBar.style.display = 'block';
    const messages = {
        tap1: 'Tryck på bilden för att placera första punkten',
        tap2: 'Tryck för att placera andra punkten',
        suggested: 'Dra punkterna: den första till mitten (märgen), den andra till barken',
        done: 'Dra i punkterna för att justera — scrolla ner för resultat',
    };
    instructionsBar.textContent = messages[step] || '';
}

// --- Interaction setup ---

function getCanvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height),
    };
}

function hitTestPoints(cx, cy) {
    const hitRadius = dotSize * 3;
    for (let i = 0; i < points.length; i++) {
        if (Math.abs(cx - points[i].x) < hitRadius && Math.abs(cy - points[i].y) < hitRadius) {
            return i;
        }
    }
    return -1;
}

function addPoint(cx, cy) {
    if (points.length >= 2) return;
    points.push({ x: cx, y: cy });
    drawLine();
    setInstruction(points.length === 1 ? 'tap2' : 'done');
}

function setupInteractions(wrapper, container) {
    // --- Mouse ---
    wrapper.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        if (points.length === 2) {
            const c = getCanvasCoords(e.clientX, e.clientY);
            movePoint = hitTestPoints(c.x, c.y);
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        if (movePoint !== -1) {
            const c = getCanvasCoords(e.clientX, e.clientY);
            points[movePoint] = c;
            drawLine();
        } else {
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            constrainToBounds(container);
            applyTransform(wrapper);
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        const endX = e.clientX - translateX;
        const endY = e.clientY - translateY;
        if (Math.abs(endX - startX) < 5 && Math.abs(endY - startY) < 5) {
            const c = getCanvasCoords(e.clientX, e.clientY);
            addPoint(c.x, c.y);
        }
        movePoint = -1;
    });

    // --- Touch ---
    wrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            isDragging = false;
            initialPinchDist = pinchDistance(e.touches);
            initialPinchScale = scale;
            e.preventDefault();
            return;
        }
        e.preventDefault();
        isDragging = true;
        const t = e.touches[0];
        startX = t.clientX - translateX;
        startY = t.clientY - translateY;
        if (points.length === 2) {
            const c = getCanvasCoords(t.clientX, t.clientY);
            movePoint = hitTestPoints(c.x, c.y);
        }
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDist > 0) {
            e.preventDefault();
            const d = pinchDistance(e.touches);
            scale = Math.max(0.5, Math.min(5, initialPinchScale * (d / initialPinchDist)));
            constrainToBounds(container);
            applyTransform(wrapper);
            return;
        }
        if (!isDragging) return;
        e.preventDefault();
        const t = e.touches[0];
        if (movePoint !== -1) {
            const c = getCanvasCoords(t.clientX, t.clientY);
            points[movePoint] = c;
            drawLine();
        } else {
            translateX = t.clientX - startX;
            translateY = t.clientY - startY;
            constrainToBounds(container);
            applyTransform(wrapper);
        }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        if (initialPinchDist > 0 && e.touches.length < 2) {
            initialPinchDist = 0;
            return;
        }
        isDragging = false;
        if (e.changedTouches && e.changedTouches.length > 0) {
            const t = e.changedTouches[0];
            const endX = t.clientX - translateX;
            const endY = t.clientY - translateY;
            if (Math.abs(endX - startX) < 5 && Math.abs(endY - startY) < 5) {
                const c = getCanvasCoords(t.clientX, t.clientY);
                addPoint(c.x, c.y);
            }
        }
        movePoint = -1;
    });

    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        translateY -= e.deltaY;
        constrainToBounds(container);
        applyTransform(wrapper);
    }, { passive: false });
}

function pinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function constrainToBounds(container) {
    const cr = container.getBoundingClientRect();
    const sw = canvasDisplayWidth * scale;
    const sh = canvasDisplayHeight * scale;

    if (sw <= cr.width) {
        translateX = (cr.width - sw) / 2;
    } else {
        translateX = Math.min(0, Math.max(cr.width - sw, translateX));
    }
    if (sh <= cr.height) {
        translateY = (cr.height - sh) / 2;
    } else {
        translateY = Math.min(0, Math.max(cr.height - sh, translateY));
    }
}

function applyTransform(wrapper) {
    wrapper.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
}

// --- Drawing ---

function drawLine() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(imgCopy, 0, 0);

    for (const p of points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, dotSize, 0, 2 * Math.PI);
        ctx.fillStyle = '#FF0000';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, dotSize * 3, 0, 2 * Math.PI);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = '#FF0000';
        ctx.stroke();
    }

    if (points.length === 2) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = lineWidth;
        ctx.stroke();
        createSliceImage();
    }
}

// --- Slice extraction & analysis ---

function createSliceImage() {
    const x1 = points[0].x, y1 = points[0].y;
    const x2 = points[1].x, y2 = points[1].y;
    const dx = x2 - x1, dy = y2 - y1;
    const length = Math.round(Math.sqrt(dx * dx + dy * dy));
    if (length === 0) return;

    const norm = Math.sqrt(dx * dx + dy * dy);
    const perpx = -dy / norm;
    const perpy = dx / norm;

    if (!resultCanvas) resultCanvas = document.createElement('canvas');
    resultCanvas.width = length;
    resultCanvas.height = bandwidth;
    const rCtx = resultCanvas.getContext('2d');
    rCtx.clearRect(0, 0, length, bandwidth);
    const resultData = rCtx.createImageData(length, bandwidth);

    for (let i = 0; i < length; i++) {
        const bx = x1 + (dx * i / length);
        const by = y1 + (dy * i / length);
        for (let j = 0; j < bandwidth; j++) {
            const off = j - Math.floor(bandwidth / 2);
            const sx = Math.max(0, Math.min(Math.round(bx + perpx * off), canvas.width - 1));
            const sy = Math.max(0, Math.min(Math.round(by + perpy * off), canvas.height - 1));
            const si = (sy * canvas.width + sx) * 4;
            const ti = (j * length + i) * 4;
            resultData.data[ti]     = imgCopy.data[si];
            resultData.data[ti + 1] = imgCopy.data[si + 1];
            resultData.data[ti + 2] = imgCopy.data[si + 2];
            resultData.data[ti + 3] = imgCopy.data[si + 3];
        }
    }

    // Slice canvas
    if (!canvasSlice) {
        canvasSlice = document.createElement('canvas');
        sliceCanvasHost.appendChild(canvasSlice);
        canvasSlice.addEventListener('click', onSliceTap);
    }
    canvasSlice.width = length;
    canvasSlice.height = bandwidth;
    sliceImageData = resultData;
    canvasSlice.getContext('2d').putImageData(resultData, 0, 0);

    // Plot canvas
    if (!canvasPlot) {
        canvasPlot = document.createElement('canvas');
        canvasPlot.width = 600;
        canvasPlot.height = 300;
        plotContainer.appendChild(canvasPlot);
    }
    ctxPlot = canvasPlot.getContext('2d');

    // Compute mean grayscale per column
    meanGray = [];
    for (let i = 0; i < resultData.width; i++) {
        let sum = 0;
        for (let j = 0; j < resultData.height; j++) {
            sum += resultData.data[(j * resultData.width + i) * 4];
        }
        meanGray.push(sum / resultData.height);
    }

    // Linjen har ändrats — manuella justeringar gäller inte längre
    manualAdds = [];
    removedAuto.clear();
    runAnalysis();

    resultsSection.style.display = 'block';
}

function runAnalysis() {
    if (!ctxPlot || meanGray.length < 10) return;
    autoAnalysis = analyzeProfile(meanGray, sensitivity);
    // Extra riktningar är dyra — räkna om dem först när linjen legat stilla en stund
    auxCounts = [];
    clearTimeout(auxTimer);
    auxTimer = setTimeout(runAuxAnalysis, 300);
    drawPlot(meanGray, autoAnalysis.smoothed, mergedValleys());
}

// Analysera fler riktningar från första punkten (märgen) — medianen av
// räkningarna är robust mot sprickor och kvistar längs en enskild linje
function runAuxAnalysis() {
    auxCounts = [];
    if (!autoAnalysis || points.length !== 2 || !canvas) return;
    const x1 = points[0].x, y1 = points[0].y;
    const dx = points[1].x - x1, dy = points[1].y - y1;
    const len = Math.hypot(dx, dy);
    const theta = Math.atan2(dy, dx);

    for (const deg of auxAngles) {
        const a = theta + deg * Math.PI / 180;
        const ux = Math.cos(a), uy = Math.sin(a);
        // Klipp linjen mot bildkanten
        let t = len;
        if (ux > 0) t = Math.min(t, (canvas.width - 1 - x1) / ux);
        else if (ux < 0) t = Math.min(t, -x1 / ux);
        if (uy > 0) t = Math.min(t, (canvas.height - 1 - y1) / uy);
        else if (uy < 0) t = Math.min(t, -y1 / uy);
        if (t < len * 0.5) continue; // för avklippt för att vara jämförbar

        const prof = extractProfile(x1, y1, x1 + ux * t, y1 + uy * t, 40);
        if (prof.length < 10) continue;
        auxCounts.push(analyzeProfile(prof, sensitivity).valleys.length);
    }
    updateRingCount();
}

// Medelgråskala per kolumn längs en linje, utan att bygga någon bildremsa
function extractProfile(x1, y1, x2, y2, band) {
    const dx = x2 - x1, dy = y2 - y1;
    const norm = Math.hypot(dx, dy);
    const length = Math.round(norm);
    if (!length) return [];
    const perpx = -dy / norm, perpy = dx / norm;
    const prof = [];
    for (let i = 0; i < length; i++) {
        const bx = x1 + dx * i / length;
        const by = y1 + dy * i / length;
        let sum = 0;
        for (let j = 0; j < band; j++) {
            const off = j - Math.floor(band / 2);
            const sx = Math.max(0, Math.min(Math.round(bx + perpx * off), canvas.width - 1));
            const sy = Math.max(0, Math.min(Math.round(by + perpy * off), canvas.height - 1));
            sum += imgCopy.data[(sy * canvas.width + sx) * 4];
        }
        prof.push(sum / band);
    }
    return prof;
}

// Stora talet: medianen av alla riktningar — eller användarens egen räkning
// så fort hen har justerat manuellt
function updateRingCount() {
    if (!autoAnalysis) return;
    const hasManual = manualAdds.length > 0 || removedAuto.size > 0;
    const counts = [autoAnalysis.valleys.length, ...auxCounts].sort((a, b) => a - b);
    if (hasManual || counts.length < 3) {
        ringCountEl.textContent = mergedValleys().length;
        ringDetailEl.textContent = hasManual
            ? 'Manuellt justerad — ≈ trädets ålder i år'
            : '≈ trädets ålder i år';
    } else {
        ringCountEl.textContent = counts[Math.floor(counts.length / 2)];
        ringDetailEl.textContent = `Median av ${counts.length} riktningar: ${counts.join(' · ')}`;
    }
}

function mergedValleys() {
    if (!autoAnalysis) return [];
    const list = autoAnalysis.valleys
        .filter(v => !removedAuto.has(v.index))
        .map(v => ({ index: v.index, value: v.value, manual: false }));
    for (const idx of manualAdds) {
        list.push({ index: idx, value: autoAnalysis.smoothed[idx], manual: true });
    }
    list.sort((a, b) => a.index - b.index);
    return list;
}

// Tryck på snittbilden: nära en markering tar bort den, annars läggs en ny till
function onSliceTap(e) {
    if (!autoAnalysis) return;
    const rect = canvasSlice.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (canvasSlice.width / rect.width));
    if (x < 0 || x >= meanGray.length) return;

    const tol = Math.max(8, Math.round(canvasSlice.width * 0.015));
    let nearest = null;
    for (const v of mergedValleys()) {
        const d = Math.abs(v.index - x);
        if (d <= tol && (!nearest || d < Math.abs(nearest.index - x))) nearest = v;
    }
    if (nearest) {
        if (nearest.manual) {
            manualAdds = manualAdds.filter(i => i !== nearest.index);
        } else {
            removedAuto.add(nearest.index);
        }
    } else {
        manualAdds.push(x);
    }
    drawPlot(meanGray, autoAnalysis.smoothed, mergedValleys());
}

// --- Plotting ---

function drawPlot(raw, smoothed, valleys) {
    ctxPlot.clearRect(0, 0, canvasPlot.width, canvasPlot.height);

    const minVal = Math.min(...raw);
    const maxVal = Math.max(...raw);
    const range = maxVal - minVal || 1;

    const pad = 20;
    const ph = canvasPlot.height - 2 * pad;
    const pw = canvasPlot.width - 2 * pad;

    const xOf = (i, len) => pad + (i * pw / len);
    const yOf = (v) => canvasPlot.height - pad - ((v - minVal) / range * ph);

    // Axes
    ctxPlot.beginPath();
    ctxPlot.strokeStyle = '#ccc';
    ctxPlot.lineWidth = 1;
    ctxPlot.moveTo(pad, pad);
    ctxPlot.lineTo(pad, canvasPlot.height - pad);
    ctxPlot.lineTo(canvasPlot.width - pad, canvasPlot.height - pad);
    ctxPlot.stroke();

    // Raw data
    ctxPlot.beginPath();
    ctxPlot.strokeStyle = '#c0c0c0';
    ctxPlot.lineWidth = 1;
    for (let i = 0; i < raw.length; i++) {
        const x = xOf(i, raw.length), y = yOf(raw[i]);
        i === 0 ? ctxPlot.moveTo(x, y) : ctxPlot.lineTo(x, y);
    }
    ctxPlot.stroke();

    // Smoothed data
    ctxPlot.beginPath();
    ctxPlot.strokeStyle = '#4CAF50';
    ctxPlot.lineWidth = 2;
    for (let i = 0; i < smoothed.length; i++) {
        const x = xOf(i, smoothed.length), y = yOf(smoothed[i]);
        i === 0 ? ctxPlot.moveTo(x, y) : ctxPlot.lineTo(x, y);
    }
    ctxPlot.stroke();

    // Valley dots on plot
    for (const v of valleys) {
        ctxPlot.fillStyle = v.manual ? '#2979ff' : '#ff3b30';
        ctxPlot.beginPath();
        ctxPlot.arc(xOf(v.index, raw.length), yOf(v.value), 4, 0, 2 * Math.PI);
        ctxPlot.fill();
    }

    // Valley markers on sliced strip (samma kolumnindex som profilen)
    if (canvasSlice && sliceImageData) {
        const sCtx = canvasSlice.getContext('2d');
        sCtx.putImageData(sliceImageData, 0, 0);
        const midY = Math.floor(bandwidth / 2);
        const r = Math.max(5, Math.min(14, Math.floor(bandwidth / 10)));
        for (const v of valleys) {
            sCtx.fillStyle = v.manual ? '#2979ff' : '#ff3b30';
            sCtx.beginPath();
            sCtx.arc(v.index, midY, r, 0, 2 * Math.PI);
            sCtx.fill();
        }
    }

    // Update ring count
    updateRingCount();

    // Redraw image with valley markers
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(imgCopy, 0, 0);

    for (const p of points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, dotSize, 0, 2 * Math.PI);
        ctx.fillStyle = '#FF0000';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, dotSize * 3, 0, 2 * Math.PI);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = '#FF0000';
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    const dxLine = points[1].x - points[0].x;
    const dyLine = points[1].y - points[0].y;
    for (const v of valleys) {
        const t = v.index / raw.length;
        ctx.fillStyle = v.manual ? '#2979ff' : '#ff3b30';
        ctx.beginPath();
        ctx.arc(points[0].x + t * dxLine, points[0].y + t * dyLine, dotSize * 0.5, 0, 2 * Math.PI);
        ctx.fill();
    }
}

function onSensitivityChange() {
    sensitivity = parseInt(sensitivitySlider.value);
    sensitivityValueEl.textContent = sensitivity;
    manualAdds = [];
    removedAuto.clear();
    runAnalysis();
}

// --- Signal processing ---

// Hela analysen: ljusutjämning (detrend) + automatisk parameterskattning.
// Mörka band (sommarved) blir dalar i gråskaleprofilen — en dal per årsring.
function analyzeProfile(profile, sens) {
    // 1. Grov detrend för att kunna skatta ringavståndet
    const sm0 = smoothData(profile, 3);
    const det0 = detrendSignal(sm0, Math.max(31, Math.floor(profile.length / 10)));
    const spacing = estimateSpacing(det0) || 20;

    // 2. Utjämning och baslinje anpassade till ringavståndet
    const win = Math.max(3, Math.floor(spacing / 5));
    const smoothed = smoothData(profile, win);
    const det = detrendSignal(smoothed, Math.max(31, spacing * 4));

    // 3. Tröskel relativt brusnivån; känsligheten skalar den
    const noise = madNoise(det);
    const minProm = Math.max(0.8, (12 / sens) * noise);
    const minDist = Math.max(2, Math.round(spacing * 0.35));

    const valleys = findValleysWithProminence(det, minProm, minDist)
        .map(v => ({ index: v.index, value: smoothed[v.index], prominence: v.prominence }));
    return { valleys, smoothed, spacing };
}

// Tar bort långsamma ljusvariationer (skuggor, ojämn belysning)
function detrendSignal(data, win) {
    const base = smoothData(data, win);
    return data.map((d, i) => d - base[i]);
}

// Dominerande ringavstånd via autokorrelation
function estimateSpacing(det) {
    const n = det.length;
    if (n < 20) return null;
    const mean = det.reduce((a, b) => a + b, 0) / n;
    const c = det.map(v => v - mean);
    let variance = 0;
    for (const x of c) variance += x * x;
    variance = variance / n || 1;

    const maxLag = Math.min(Math.floor(n / 3), 200);
    const ac = [];
    for (let lag = 1; lag < maxLag; lag++) {
        let s = 0;
        for (let i = 0; i < n - lag; i++) s += c[i] * c[i + lag];
        ac.push((s / (n - lag)) / variance);
    }
    for (let i = 2; i < ac.length - 1; i++) {
        if (ac[i] > ac[i - 1] && ac[i] > ac[i + 1] && ac[i] > 0.05) return i + 1;
    }
    return null;
}

// Brusnivå: median av absoluta skillnader mellan grannvärden
function madNoise(det) {
    const diffs = [];
    for (let i = 0; i < det.length - 1; i++) diffs.push(Math.abs(det[i + 1] - det[i]));
    diffs.sort((a, b) => a - b);
    return diffs[Math.floor(diffs.length / 2)] || 0.5;
}

function findValleysWithProminence(data, minProm, minDist) {
    let valleys = [];
    for (let i = 1; i < data.length - 1; i++) {
        if (data[i] >= data[i - 1] || data[i] >= data[i + 1]) continue;
        let leftMax = data[i - 1];
        for (let j = i - 2; j >= 0 && data[j] > data[i]; j--) {
            if (data[j] > leftMax) leftMax = data[j];
        }
        let rightMax = data[i + 1];
        for (let j = i + 2; j < data.length && data[j] > data[i]; j++) {
            if (data[j] > rightMax) rightMax = data[j];
        }
        const prom = Math.min(leftMax - data[i], rightMax - data[i]);
        if (prom >= minProm) {
            valleys.push({ index: i, value: data[i], prominence: prom });
        }
    }
    // Vid för tätt liggande dalar behålls den mest framträdande
    if (minDist > 1 && valleys.length > 1) {
        const byProm = [...valleys].sort((a, b) => b.prominence - a.prominence);
        const kept = [];
        for (const v of byProm) {
            if (kept.every(k => Math.abs(v.index - k.index) >= minDist)) kept.push(v);
        }
        valleys = kept.sort((a, b) => a.index - b.index);
    }
    return valleys;
}

function smoothData(data, win) {
    const result = [];
    const half = Math.floor(win / 2);
    for (let i = 0; i < data.length; i++) {
        let sum = 0, count = 0;
        const lo = Math.max(0, i - half);
        const hi = Math.min(data.length - 1, i + half);
        for (let j = lo; j <= hi; j++) { sum += data[j]; count++; }
        result.push(sum / count);
    }
    return result;
}
