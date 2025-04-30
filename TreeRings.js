// Canvas and context variables
let canvas;
let ctx;
let points = [];
let img;
let imgCopy;
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
    
    // Put image data and save
    resultCtx.putImageData(resultData, 0, 0);
    
    // Convert to jpg and download
    const link = document.createElement('a');
    link.download = 'treeRingsTest.jpg';
    link.href = resultCanvas.toDataURL('image/jpeg');
    link.click();
    
    // Clean up
    canvas.removeEventListener('click', handleClick);
}

// Start the process
loadImage();
