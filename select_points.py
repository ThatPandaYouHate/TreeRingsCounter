import cv2
import numpy as np

def mouse_callback(event, x, y, flags, param):
    global points, img_copy
    
    if event == cv2.EVENT_LBUTTONDOWN:
        if len(points) < 2:
            points.append((x, y))
            # Rita en cirkel där användaren klickade
            cv2.circle(img_copy, (x, y), 5, (0, 255, 0), -1)
            cv2.imshow('Image', img_copy)
            
            if len(points) == 2:
                # När vi har två punkter, skapa linjen
                create_slice_image()

def create_slice_image():
    x1, y1 = points[0]
    x2, y2 = points[1]
    
    # Calculate line length
    length = int(np.sqrt((x2 - x1)**2 + (y2 - y1)**2))
    
    # Create empty image for result, now using bandwidth instead of fixed 10
    result = np.zeros((bandwidth, length), dtype=np.uint8)
    
    # Calculate perpendicular vector for bandwidth
    dx = x2 - x1
    dy = y2 - y1
    # Normalize and rotate 90 degrees
    length_norm = np.sqrt(dx*dx + dy*dy)
    perpx = -dy/length_norm
    perpy = dx/length_norm
    
    # For each pixel along the line
    for i in range(length):
        # Calculate base position
        x = x1 + (x2 - x1) * i / length
        y = y1 + (y2 - y1) * i / length
        
        # Sample points across the bandwidth
        for j in range(bandwidth):
            # Calculate offset from center line
            offset = j - bandwidth//2
            sample_x = int(x + perpx * offset)
            sample_y = int(y + perpy * offset)
            
            # Ensure we stay within image bounds
            sample_x = max(0, min(sample_x, img.shape[1]-1))
            sample_y = max(0, min(sample_y, img.shape[0]-1))
            
            result[j, i] = img[sample_y, sample_x]
    
    cv2.imwrite('treeRingsTest.jpg', result)
    print("Bild sparad som treeRingsTest.jpg")
    cv2.destroyAllWindows()
    exit()

# Läs in originalbilden
img = cv2.imread('realTreeRingsFull.png')
img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)  # Convert to grayscale
img_copy = img.copy()
points = []
bandwidth = 5  # You can adjust this value to change the width of the slice

# Skapa fönster och sätt upp mushantering
cv2.namedWindow('Image')
cv2.setMouseCallback('Image', mouse_callback)

# Visa bilden och vänta på användarinput
while True:
    cv2.imshow('Image', img_copy)
    key = cv2.waitKey(1) & 0xFF
    
    # Avsluta om användaren trycker 'q' eller ESC
    if key == ord('q') or key == 27:
        break
    # Börja om om användaren trycker 'r'
    elif key == ord('r'):
        img_copy = img.copy()
        points = []

cv2.destroyAllWindows() 