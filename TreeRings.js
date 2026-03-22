// State
let canvas, ctx;
let canvasSlice, canvasPlot, ctxPlot;
let resultCanvas;
let points = [];
let img, imageData, imgCopy;
let windowSize = 4;
let prominence = 7;
const bandwidth = 100;
const dotSize = 20;
const lineWidth = 10;

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

// DOM references
const uploadContainer = document.getElementById('upload-container');
const instructionsBar = document.getElementById('instructions');
const canvasHost = document.getElementById('canvas-host');
const resultsSection = document.getElementById('results-section');
const ringCountEl = document.getElementById('ring-count');
const sliceContainer = document.getElementById('slice-container');
const plotContainer = document.getElementById('plot-container');
const windowSlider = document.getElementById('window-slider');
const windowValueEl = document.getElementById('window-value');
const prominenceSlider = document.getElementById('prominence-slider');
const prominenceValueEl = document.getElementById('prominence-value');
const resetBtn = document.getElementById('reset-btn');

// --- Event wiring ---

document.getElementById('imageUpload').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadImage(ev.target.result);
    reader.readAsDataURL(file);
});

windowSlider.addEventListener('input', onSliderChange);
prominenceSlider.addEventListener('input', onSliderChange);
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
        canvasDisplayWidth = window.innerWidth;
        const aspectRatio = img.height / img.width;
        canvasDisplayHeight = canvasDisplayWidth * aspectRatio;

        canvas.width = img.width;
        canvas.height = img.height;
        canvas.style.width = canvasDisplayWidth + 'px';
        canvas.style.height = canvasDisplayHeight + 'px';

        const maxH = window.innerHeight * 0.7;
        container.style.height = Math.min(canvasDisplayHeight, maxH) + 'px';

        wrapper.appendChild(canvas);
        container.appendChild(wrapper);
        canvasHost.appendChild(container);

        ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, img.width, img.height);

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
        setInstruction('tap1');
    };
}

function resetState() {
    points = [];
    movePoint = -1;
    meanGray = [];
    canvasSlice = null;
    canvasPlot = null;
    ctxPlot = null;
    resultCanvas = null;
    scale = 1;
    translateX = 0;
    translateY = 0;
}

function resetAnalysis() {
    points = [];
    movePoint = -1;
    meanGray = [];

    if (ctx && imgCopy) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(imgCopy, 0, 0);
    }
    resultsSection.style.display = 'none';
    ringCountEl.textContent = '\u2014';

    // Remove dynamically created canvases from their containers
    if (canvasSlice) { canvasSlice.remove(); canvasSlice = null; }
    if (canvasPlot) { canvasPlot.remove(); canvasPlot = null; ctxPlot = null; }
    resultCanvas = null;

    setInstruction('tap1');
}

function setInstruction(step) {
    instructionsBar.style.display = 'block';
    const messages = {
        tap1: 'Tryck på bilden för att placera första punkten',
        tap2: 'Tryck för att placera andra punkten',
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
        sliceContainer.appendChild(canvasSlice);
    }
    canvasSlice.width = length;
    canvasSlice.height = bandwidth;
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

    const smoothed = smoothData(meanGray, windowSize);
    const valleys = findValleysWithProminence(smoothed, prominence);
    drawPlot(meanGray, smoothed, valleys);

    resultsSection.style.display = 'block';
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
    ctxPlot.fillStyle = '#ff3b30';
    for (const v of valleys) {
        ctxPlot.beginPath();
        ctxPlot.arc(xOf(v.index, raw.length), yOf(v.value), 4, 0, 2 * Math.PI);
        ctxPlot.fill();
    }

    // Update ring count
    ringCountEl.textContent = valleys.length;

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

    ctx.fillStyle = '#ff3b30';
    const dxLine = points[1].x - points[0].x;
    const dyLine = points[1].y - points[0].y;
    for (const v of valleys) {
        const t = v.index / raw.length;
        ctx.beginPath();
        ctx.arc(points[0].x + t * dxLine, points[0].y + t * dyLine, dotSize * 0.5, 0, 2 * Math.PI);
        ctx.fill();
    }
}

function onSliderChange() {
    windowSize = parseInt(windowSlider.value);
    prominence = parseInt(prominenceSlider.value);
    windowValueEl.textContent = windowSize;
    prominenceValueEl.textContent = prominence;
    if (meanGray.length > 0 && ctxPlot) {
        const smoothed = smoothData(meanGray, windowSize);
        const valleys = findValleysWithProminence(smoothed, prominence);
        drawPlot(meanGray, smoothed, valleys);
    }
}

// --- Signal processing ---

function findValleysWithProminence(data, minProm) {
    const valleys = [];
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
