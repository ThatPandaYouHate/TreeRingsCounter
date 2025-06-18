// Canvas and context variables
let canvas;
let canvasSlice;
let canvasPlot; 
let resultCanvas;
let ctx;
let ctxSlice;
let ctxPlot;
let points = [];
let img;
let imageData;
let imgCopy;
let windowSize = 4;
let prominence = 7;
const bandwidth = 100;
let scale = 1;
let isDragging = false;
let startX, startY, translateX = 0, translateY = 0;
let movePoint = -1;
let meanGray = [];
let dotSize = 20;
let lineWidth = 10;

// Setup file input listener
document.getElementById('imageUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            loadImage(event.target.result);
        };
        reader.readAsDataURL(file);
    }
});

// Load and setup image
function loadImage(imgSource) {
    // Hide the upload container after image is loaded
    
    
    // Clear previous canvas if it exists
    if (canvas) {
        canvas.remove();
        points = [];
    }

    img = new Image();
    img.src = imgSource;
    img.onload = function() {
        // Create container and wrapper
        const container = document.createElement('div');
        container.className = 'canvas-container';
        const wrapper = document.createElement('div');
        wrapper.className = 'canvas-wrapper';

        canvas = document.createElement('canvas');
        canvasDraw = document.createElement('canvas');
        const targetWidth = window.innerWidth * 0.9;
        const aspectRatio = img.height / img.width;
        const targetHeight = targetWidth * aspectRatio;
        console.log(aspectRatio);

        

        // Set canvas pixel size to image's natural size
        canvas.width = img.width;
        canvas.height = img.height;

        // Set canvas display size to fit the layout (CSS)
        canvas.style.width = targetWidth + 'px';
        canvas.style.height = targetHeight + 'px';
        
        // Create a canvas for drawing
        canvasDraw.width = targetWidth;
        canvasDraw.height = targetHeight;
        
        // Calculate container height based on canvas height, but never more than 70vh
        const maxContainerHeight = window.innerHeight * 0.7;
        const containerHeight = Math.min(targetHeight, maxContainerHeight);
        container.style.height = containerHeight + 'px';
        
        // Append elements
        wrapper.appendChild(canvas);
        //wrapper.appendChild(canvasDraw);
        container.appendChild(wrapper);
        document.body.appendChild(container);

        
        
        ctx = canvas.getContext('2d');
        ctxDraw = canvasDraw.getContext('2d');
        ctx.drawImage(img, 0, 0, img.width, img.height);
        
        // Convert to grayscale
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = data[i + 1] = data[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
        
        imgCopy = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Add event listeners for dragging and zooming
        setupInteractions(wrapper, container);
        
        console.log("remove upload container");
        document.getElementById('upload-container').style.display = 'none';
        
    };

    
}

function setupInteractions(wrapper, container) {
    // Mouse drag
    wrapper.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;

        if (points.length == 2) {
            movePoint = onPointClick(e);
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        if (movePoint != -1 ) {
            const wrapper = canvas.parentElement;
            const wrapperRect = wrapper.getBoundingClientRect();
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            
            points[movePoint].x = x;
            points[movePoint].y = y;
            drawLine();
        } else {
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;

            constrainToBounds(wrapper, container);
            updateTransform(wrapper);
        }
        
        // Constrain movement within bounds
        
    });

    document.addEventListener('mouseup', (e) => {
        isDragging = false;
        endX = e.clientX - translateX;
        endY = e.clientY - translateY;
        if (Math.abs(endX - startX) < 5 && Math.abs(endY - startY) < 5) {
            handleClick(e);
        }
        movePoint = -1;
    });

    // Touch events for mobile devices
    wrapper.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent default touch behavior
        isDragging = true;
        const touch = e.touches[0];
        startX = touch.clientX - translateX;
        startY = touch.clientY - translateY;

        if (points.length == 2) {
            movePoint = onPointClickTouch(e);
        }
    });

    document.addEventListener('touchmove', (e) => {
        e.preventDefault(); // Prevent default touch behavior
        if (!isDragging) return;
        if (movePoint != -1 ) {
            const wrapper = canvas.parentElement;
            const wrapperRect = wrapper.getBoundingClientRect();
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const touch = e.touches[0];
            const x = (touch.clientX - rect.left) * scaleX;
            const y = (touch.clientY - rect.top) * scaleY;
            
            points[movePoint].x = x;
            points[movePoint].y = y;
            drawLine();
        } else {
            const touch = e.touches[0];
            translateX = touch.clientX - startX;
            translateY = touch.clientY - startY;

            constrainToBounds(wrapper, container);
            updateTransform(wrapper);
        }
        
        // Constrain movement within bounds
        
    });

    document.addEventListener('touchend', (e) => {
        e.preventDefault(); // Prevent default touch behavior
        isDragging = false;
        if (e.changedTouches.length > 0) {
            const touch = e.changedTouches[0];
            endX = touch.clientX - translateX;
            endY = touch.clientY - translateY;
            if (Math.abs(endX - startX) < 5 && Math.abs(endY - startY) < 5) {
                handleClickTouch(e);
            }
        }
        movePoint = -1;
    });

    // Add wheel event listener
    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault(); // Prevent default scroll behavior
        
        // Move image up/down based on wheel direction
        translateY += e.deltaY;
        
        // Constrain movement within bounds
        constrainToBounds(wrapper, container);
        updateTransform(wrapper);
    }, { passive: false }); // Required for preventDefault() to work
}

function onPointClick(e) {
    const wrapper = canvas.parentElement;
    const wrapperRect = wrapper.getBoundingClientRect();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (Math.abs(x - points[0].x) < dotSize && Math.abs(y - points[0].y) < dotSize) {
        return 0;
    }
    if (Math.abs(x - points[1].x) < dotSize && Math.abs(y - points[1].y) < dotSize) {
        return 1;
    }
    return -1;
}

function onPointClickTouch(e) {
    const wrapper = canvas.parentElement;
    const wrapperRect = wrapper.getBoundingClientRect();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
    if (Math.abs(x - points[0].x) < dotSize && Math.abs(y - points[0].y) < dotSize) {
        return 0;
    }
    if (Math.abs(x - points[1].x) < dotSize && Math.abs(y - points[1].y) < dotSize) {
        return 1;
    }
    return -1;
}

function constrainToBounds(wrapper, container) {
    const containerRect = container.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();

    // Calculate bounds
    const minX = containerRect.width - wrapperRect.width * scale;
    const minY = containerRect.height - wrapperRect.height * scale;

    // Constrain X
    if (wrapperRect.width * scale <= containerRect.width) {
        // If scaled image is smaller than container, center it
        translateX = (containerRect.width - wrapperRect.width * scale) / 2;
    } else {
        // Otherwise, keep it within bounds
        translateX = Math.min(0, Math.max(minX, translateX));
    }

    // Constrain Y
    if (wrapperRect.height * scale <= containerRect.height) {
        // If scaled image is smaller than container, center it
        translateY = (containerRect.height - wrapperRect.height * scale) / 2;
    } else {
        // Otherwise, keep it within bounds
        translateY = Math.min(0, Math.max(minY, translateY));
    }
}

function updateTransform(wrapper) {
    wrapper.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
}

function handleClick(event) {
    if (points.length == 2) {
        return;
    }

    // Get the wrapper element (parent of canvas)
    const wrapper = canvas.parentElement;
    const wrapperRect = wrapper.getBoundingClientRect();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    points.push({x, y});
    drawLine();
}

function handleClickTouch(event) {
    if (points.length == 2) {
        return;
    }

    // Get the wrapper element (parent of canvas)
    const wrapper = canvas.parentElement;
    const wrapperRect = wrapper.getBoundingClientRect();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = event.changedTouches[0];
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
    points.push({x, y});
    drawLine();
}

function drawLine() {
    // Clear the drawing canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(imageData, 0, 0);
    for (let i = 0; i < points.length; i++) {
        ctx.beginPath();
        ctx.arc(points[i].x, points[i].y, dotSize, 0, 2 * Math.PI);
        ctx.fillStyle = 'red';
        ctx.fill();
    }

    if (points.length == 2) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = lineWidth;
        ctx.stroke();
        createSliceImage();
    }
}


function createSliceImage() {
    const x1 = points[0].x;
    const y1 = points[0].y;
    const x2 = points[1].x;
    const y2 = points[1].y;
    
    // Calculate line length based on canvas coordinates
    const length = Math.round(Math.sqrt((x2 - x1)**2 + (y2 - y1)**2));
    let resultCtx;

    if (resultCanvas) {
        resultCtx = resultCanvas.getContext('2d');
        resultCtx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
        resultCanvas = document.createElement('canvas');
        resultCanvas.width = length;
        resultCanvas.height = bandwidth;
        resultCtx = resultCanvas.getContext('2d');
    }
    
    // Calculate perpendicular vector (normalized)
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthNorm = Math.sqrt(dx*dx + dy*dy);
    const perpx = -dy/lengthNorm;
    const perpy = dx/lengthNorm;
   
    
    // Get image data from the scaled canvas
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const resultData = resultCtx.createImageData(length, bandwidth);
    
    // For each pixel along the line
    for (let i = 0; i < length; i++) {
        // Calculate base position
        const x = x1 + (dx * i / length);
        const y = y1 + (dy * i / length);
        
        // Sample points across bandwidth
        for (let j = 0; j < bandwidth; j++) {
            const offset = j - Math.floor(bandwidth/2);
            let sampleX = Math.round(x + perpx * offset);
            let sampleY = Math.round(y + perpy * offset);
            
            // Ensure within bounds of the scaled canvas
            sampleX = Math.max(0, Math.min(sampleX, canvas.width-1));
            sampleY = Math.max(0, Math.min(sampleY, canvas.height-1));
            
            // Get pixel from source (using scaled coordinates)
            const sourceIndex = (sampleY * canvas.width + sampleX) * 4;
            const targetIndex = (j * length + i) * 4;            
            // Copy pixel data
            resultData.data[targetIndex] = imgCopy.data[sourceIndex];
            resultData.data[targetIndex + 1] = imgCopy.data[sourceIndex+1];
            resultData.data[targetIndex + 2] = imgCopy.data[sourceIndex+2];
            resultData.data[targetIndex + 3] = imgCopy.data[sourceIndex+3];
        }
    }


    if (canvasSlice) {
        const ctxSlice = canvasSlice.getContext('2d');
        ctxSlice.clearRect(0, 0, canvas.width, canvas.height);
        canvasSlice.width = length;
        canvasSlice.height = bandwidth;
        ctxSlice.putImageData(resultData, 0, 0);
    } else {
        canvasSlice = document.createElement('canvas');
        canvasSlice.width = length;
        canvasSlice.height = bandwidth;
        document.body.appendChild(canvasSlice);
        const ctxSlice = canvasSlice.getContext('2d');
        ctxSlice.putImageData(resultData, 0, 0);
    }

    // --- Scale the displayed slice to fit 10vh in height, and scale width accordingly ---
    const targetDisplayHeight = window.innerHeight * 0.025;
    const scaleFactor = targetDisplayHeight / bandwidth;
    canvasSlice.style.height = targetDisplayHeight + 'px';
    canvasSlice.style.width = (length * scaleFactor) + 'px';

    plotResults(resultData);
}

function plotResults(resultData) {
    // Get the sidebar element
    const sidebar = document.getElementById('sidebar');
    let container;

    if (!canvasPlot) {
        // Create a container for plot and controls
        container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'start';
        container.style.gap = '10px';
        container.style.padding = '20px 0';
        // Remove any previous plot container in sidebar
        const oldContainer = sidebar.querySelector('.plot-sidebar-container');
        if (oldContainer) oldContainer.remove();
        container.className = 'plot-sidebar-container';
        sidebar.appendChild(container);

        // Create canvas and add to container
        canvasPlot = document.createElement('canvas');
        canvasPlot.width = 500;
        canvasPlot.height = 400;
        container.appendChild(canvasPlot);

        // Create controls div
        const controls = document.createElement('div');
        controls.style.padding = '20px 0 0 0';
        container.appendChild(controls);

        // Add window size slider
        const windowSliderContainer = document.createElement('div');
        windowSliderContainer.className = 'slider-container';
        const windowLabel = document.createElement('label');
        windowLabel.textContent = 'Window Size';
        windowLabel.className = 'slider-label';
        windowSliderContainer.appendChild(windowLabel);
        const windowSliderRow = document.createElement('div');
        windowSliderRow.className = 'slider-row';
        const windowValue = document.createElement('span');
        windowValue.textContent = windowSize;
        windowValue.className = 'slider-value';
        const windowInput = document.createElement('input');
        windowInput.type = 'range';
        windowInput.min = '2';
        windowInput.max = '20';
        windowInput.value = windowSize;
        windowInput.step = '1';
        windowSliderRow.appendChild(windowValue);
        windowSliderRow.appendChild(windowInput);
        windowSliderContainer.appendChild(windowSliderRow);
        controls.appendChild(windowSliderContainer);
        controls.appendChild(document.createElement('br'));

        // Add prominence slider
        const promSliderContainer = document.createElement('div');
        promSliderContainer.className = 'slider-container';
        const promLabel = document.createElement('label');
        promLabel.textContent = 'Prominence';
        promLabel.className = 'slider-label';
        promSliderContainer.appendChild(promLabel);
        const promSliderRow = document.createElement('div');
        promSliderRow.className = 'slider-row';
        const promValue = document.createElement('span');
        promValue.textContent = prominence;
        promValue.className = 'slider-value';
        const promInput = document.createElement('input');
        promInput.type = 'range';
        promInput.min = '1';
        promInput.max = '50';
        promInput.value = prominence;
        promInput.step = '1';
        promSliderRow.appendChild(promValue);
        promSliderRow.appendChild(promInput);
        promSliderContainer.appendChild(promSliderRow);
        controls.appendChild(promSliderContainer);

        // Update function
        const updatePlot = () => {
            windowSize = parseInt(windowInput.value);
            prominence = parseInt(promInput.value);
            windowValue.textContent = windowSize;
            promValue.textContent = prominence;

            // Recalculate smoothed data and valleys
            let smoothedGray = smoothData(meanGray, windowSize);
            let valleys = findValleysWithProminence(smoothedGray, prominence);

            // Redraw plot
            drawPlot(meanGray, smoothedGray, valleys);
        };

        windowInput.addEventListener('input', updatePlot);
        promInput.addEventListener('input', updatePlot);
    } else {
        // If already created, just get the container
        container = sidebar.querySelector('.plot-sidebar-container');
    }

    ctxPlot = canvasPlot.getContext('2d');

    // Calculate initial values
    meanGray = [];
    for (let i = 0; i < resultData.width; i++) {
        let sumGray = 0;
        for (let j = 0; j < resultData.height; j++) {
            const index = (j * resultData.width + i) * 4;
            sumGray += resultData.data[index];
        }
        meanGray.push(sumGray / resultData.height);
    }

    let smoothedGray = smoothData(meanGray, windowSize);
    let valleys = findValleysWithProminence(smoothedGray, prominence);

    // Separate drawing function
    function drawPlot(meanGray, smoothedGray, valleys) {
        // Clear previous plot
        ctxPlot.clearRect(0, 0, canvasPlot.width, canvasPlot.height);

        // Find min and max values for scaling
        const minGray = Math.min(...meanGray);
        const maxGray = Math.max(...meanGray);
        const range = maxGray - minGray;

        // Plot settings
        const padding = 20;
        const plotHeight = canvasPlot.height - (2 * padding);

        // Draw axes
        ctxPlot.beginPath();
        ctxPlot.strokeStyle = '#000';
        ctxPlot.moveTo(padding, padding);
        ctxPlot.lineTo(padding, canvasPlot.height - padding);
        ctxPlot.lineTo(canvasPlot.width - padding, canvasPlot.height - padding);
        ctxPlot.stroke();

        // Plot the original data
        ctxPlot.beginPath();
        ctxPlot.strokeStyle = '#000000';
        for (let i = 0; i < meanGray.length; i++) {
            const x = padding + (i * (canvasPlot.width - 2 * padding) / meanGray.length);
            const y = canvasPlot.height - padding - ((meanGray[i] - minGray) / range * plotHeight);
            if (i === 0) {
                ctxPlot.moveTo(x, y);
            } else {
                ctxPlot.lineTo(x, y);
            }
        }
        ctxPlot.stroke();

        // Plot the smoothed data
        ctxPlot.beginPath();
        ctxPlot.strokeStyle = '#00FFFF';
        for (let i = 0; i < smoothedGray.length; i++) {
            const x = padding + (i * (canvasPlot.width - 2 * padding) / smoothedGray.length);
            const y = canvasPlot.height - padding - ((smoothedGray[i] - minGray) / range * plotHeight);
            if (i === 0) {
                ctxPlot.moveTo(x, y);
            } else {
                ctxPlot.lineTo(x, y);
            }
        }
        ctxPlot.stroke();

        // Draw valleys
        ctxPlot.fillStyle = '#FF0000';
        for (let valley of valleys) {
            const x = padding + (valley.index * (canvasPlot.width - 2 * padding) / meanGray.length);
            const y = canvasPlot.height - padding - ((valley.value - minGray) / range * plotHeight);
            ctxPlot.beginPath();
            ctxPlot.arc(x, y, 3, 0, 2 * Math.PI);
            ctxPlot.fill();
        }

        // Update valley points on the original image
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(imgCopy, 0, 0);
        
        // Redraw the original points and line
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, dotSize, 0, 2 * Math.PI);
        ctx.arc(points[1].x, points[1].y, dotSize, 0, 2 * Math.PI);
        ctx.fillStyle = '#FF0000';
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        // Draw valley points on original image
        ctx.fillStyle = '#FF0000';
        for (let valley of valleys) {
            const x = points[0].x + (valley.index * (points[1].x - points[0].x) / meanGray.length);
            const y = points[0].y + (valley.index * (points[1].y - points[0].y) / meanGray.length);
            ctx.beginPath();
            ctx.arc(x, y, dotSize*0.5, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Update valley count
        let oldValleyText = document.body.querySelector('.valley-count');
        if (oldValleyText) oldValleyText.remove();
        const valleyText = document.createElement('p');
        valleyText.className = 'valley-count';
        valleyText.textContent = `${valleys.length}`;
        document.body.appendChild(valleyText);
    }

    // Initial draw
    drawPlot(meanGray, smoothedGray, valleys);
}

function findValleysWithProminence(data, minProminence = 0) {
    const valleys = [];
  
    for (let i = 1; i < data.length - 1; i++) {
      const current = data[i];
      const prev = data[i - 1];
      const next = data[i + 1];
  
      // Check for local minimum
      if (current < prev && current < next) {
        // Look left
        let leftMax = prev;
        for (let j = i - 2; j >= 0 && data[j] > current; j--) {
          if (data[j] > leftMax) leftMax = data[j];
        }
  
        // Look right
        let rightMax = next;
        for (let j = i + 2; j < data.length && data[j] > current; j++) {
          if (data[j] > rightMax) rightMax = data[j];
        }
  
        // Calculate prominence
        const prominence = Math.min(leftMax - current, rightMax - current);
  
        if (prominence >= minProminence) {
          valleys.push({ index: i, value: current, prominence });
        }
      }
    }
  
    return valleys;
  }

  function smoothData(data, windowSize = 5) {
    // Apply moving average smoothing
    let smoothedGray = [];
    
    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;
        
        // Calculate average of surrounding points
        for (let j = Math.max(0, i - Math.floor(windowSize/2)); 
             j <= Math.min(data.length - 1, i + Math.floor(windowSize/2)); j++) {
            sum += data[j];
            count++;
        }
        
        smoothedGray.push(sum / count);
    }

    return smoothedGray;
}
// Start the process
loadImage();
