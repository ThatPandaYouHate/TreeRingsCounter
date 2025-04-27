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
    
    # Beräkna längden av linjen
    length = int(np.sqrt((x2 - x1)**2 + (y2 - y1)**2))
    
    # Skapa en tom bild för resultatet
    result = np.zeros((10, length), dtype=np.uint8)
    
    # För varje pixel längs linjen
    for i in range(length):
        # Beräkna position
        x = int(x1 + (x2 - x1) * i / length)
        y = int(y1 + (y2 - y1) * i / length)
        
        # Kopiera pixelvärdet till alla 10 rader
        for j in range(10):
            result[j, i] = img[y, x]
    
    # Spara resultatet
    cv2.imwrite('treeRingsTest.jpg', result)
    print("Bild sparad som treeRingsTest.jpg")
    cv2.destroyAllWindows()
    exit()  # Exit the program after saving the image

# Läs in originalbilden
img = cv2.imread('realTreeRingsFull.png')
img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)  # Convert to grayscale
img_copy = img.copy()
points = []

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