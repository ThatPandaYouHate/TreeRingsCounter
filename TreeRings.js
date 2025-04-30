// Canvas and context variables
let canvas;
let canvasSlice;
let canvasPlot;
let ctx;
let ctxSlice;
let ctxPlot;
let points = [];
let img;
let imgCopy;
let windowSize = 4;
let prominence = 7;
const bandwidth = 5;

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
    // Clear previous canvas if it exists
    if (canvas) {
        canvas.remove();
        points = [];
    }

    img = new Image();
    img.src = imgSource;
    img.onload = function() {
        canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        document.body.appendChild(canvas);
        
        ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Convert to grayscale
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {

            let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = data[i + 1] = data[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
        
        // Store grayscale copy
        imgCopy = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Add click listener
        canvas.addEventListener('click', handleClick);
    };
}

function handleClick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    points.push({x, y});
    
    // Draw circle at click point
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = 'red';
    ctx.fill();
    
    if (points.length === 2) {
        createSliceImage();
        // Draw line between points
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function createSliceImage() {
    const x1 = points[0].x;
    const y1 = points[0].y;
    const x2 = points[1].x;
    const y2 = points[1].y;
    
    // Calculate line length
    const length = Math.sqrt((x2 - x1)**2 + (y2 - y1)**2);
    
    // Create new canvas for result
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = length;
    resultCanvas.height = bandwidth;
    const resultCtx = resultCanvas.getContext('2d');
    
    // Calculate perpendicular vector
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthNorm = Math.sqrt(dx*dx + dy*dy);
    const perpx = -dy/lengthNorm;
    const perpy = dx/lengthNorm;
    
    // Get image data
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const resultData = resultCtx.createImageData(length, bandwidth);
    
    // For each pixel along the line
    for (let i = 0; i < length; i++) {
        // Calculate base position
        const x = x1 + (x2 - x1) * i / length;
        const y = y1 + (y2 - y1) * i / length;
        
        // Sample points across bandwidth
        for (let j = 0; j < bandwidth; j++) {
            const offset = j - Math.floor(bandwidth/2);
            let sampleX = Math.round(x + perpx * offset);
            let sampleY = Math.round(y + perpy * offset);
            
            // Ensure within bounds
            sampleX = Math.max(0, Math.min(sampleX, canvas.width-1));
            sampleY = Math.max(0, Math.min(sampleY, canvas.height-1));
            
            // Get pixel from source
            const sourceIndex = (sampleY * canvas.width + sampleX) * 4;
            const targetIndex = (j * Math.round(length) + i) * 4;
            
            // Copy pixel data
            resultData.data[targetIndex] = imgCopy.data[sourceIndex];
            resultData.data[targetIndex + 1] = imgCopy.data[sourceIndex+1];
            resultData.data[targetIndex + 2] = imgCopy.data[sourceIndex+2];
            resultData.data[targetIndex + 3] = imgCopy.data[sourceIndex+3];
        }
    }
    
    if (canvasSlice) {
        canvasSlice.remove();
    }

    canvasSlice = document.createElement('canvas');
    canvasSlice.width = length;
    canvasSlice.height = bandwidth;
    document.body.appendChild(canvasSlice);
        
    ctxSlice = canvasSlice.getContext('2d');
    ctxSlice.putImageData(resultData, 0, 0);

    plotResults(resultData);

    // Put image data and save
    //resultCtx.putImageData(resultData, 0, 0);
    
    // Convert to jpg and download
    //const link = document.createElement('a');
    //link.download = 'treeRingsTest.jpg';
    //link.href = resultCanvas.toDataURL('image/jpeg');
    //link.click();
    
    // Clean up
    canvas.removeEventListener('click', handleClick);
}

function plotResults(resultData) {
    if (canvasPlot) {
        canvasPlot.remove();
    }

    canvasPlot = document.createElement('canvas');
    canvasPlot.width = 500;
    canvasPlot.height = 400;
    document.body.appendChild(canvasPlot);

    ctxPlot = canvasPlot.getContext('2d');
    ctxPlot.putImageData(resultData, 0, 0);

    let meanGray = []

    for (let i = 0; i < resultData.width; i++) {
        let sumGray = 0;
        for (let j = 0; j < resultData.height; j++) {
            const index = (j * resultData.width + i) * 4;
            sumGray += resultData.data[index];
        }
        meanGray.push(sumGray / resultData.height);
    }
    console.log(meanGray);

    
    
    let smoothedGray = smoothData(meanGray, windowSize);

    let valleys = findValleysWithProminence(smoothedGray, prominence);
    console.log(valleys);

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
    ctxPlot.strokeStyle = '#0000FF';  // Blue for original data
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
    ctxPlot.strokeStyle = '#FF6600';  // Orange for smoothed data
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
    // Plot valleys as red dots
    ctxPlot.fillStyle = '#FF0000';
    for (let valley of valleys) {
        const x = padding + (valley.index * (canvasPlot.width - 2 * padding) / meanGray.length);
        const y = canvasPlot.height - padding - ((valley.value - minGray) / range * plotHeight);
        ctxPlot.beginPath();
        ctxPlot.arc(x, y, 3, 0, 2 * Math.PI);
        ctxPlot.fill();
    }

    // Draw dots on the original image at valley locations
    ctx.fillStyle = '#FF0000';
    for (let valley of valleys) {
        const x = points[0].x + (valley.index * (points[1].x - points[0].x) / meanGray.length);
        const y = points[0].y + (valley.index * (points[1].y - points[0].y) / meanGray.length);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
    }

    // Add valley count text
    const valleyText = document.createElement('p');
    valleyText.textContent = `Number of valleys detected: ${valleys.length}`;
    valleyText.style.textAlign = 'center';
    document.body.appendChild(valleyText);
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
