import cv2
import numpy as np
import matplotlib.pyplot as plt
from scipy.signal import find_peaks

# Read the image
img = cv2.imread('treeRingsTest.jpg')

# Convert to grayscale if image is color
if len(img.shape) == 3:
    img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Calculate mean of each column
column_means = np.mean(img, axis=0)

# Convert to list and round to 2 decimal places
means_list = [round(x, 2) for x in column_means.tolist()]
print("Column means:", means_list)
print(len(means_list))

# Calculate the mean of all intensities
total_mid = (np.max(means_list)+np.min(means_list))/2

# Find valleys (invert the signal to find peaks)
valleys, _ = find_peaks(-np.array(means_list), prominence=1)  # Adjust prominence as needed

# Filter valleys to only include those below the mean
significant_valleys = [v for v in valleys if means_list[v] < total_mid]

# Plot with valley points marked and mean line
plt.figure(figsize=(12, 6))
plt.plot(means_list)
plt.axhline(y=total_mid, color='r', linestyle='--', label='Mean Intensity')
plt.plot(significant_valleys, [means_list[j] for j in significant_valleys], "rv", 
         label=f'Significant Valleys (n={len(significant_valleys)})')
plt.title('Tree Ring Intensity Profile')
plt.xlabel('Pixel Position')
plt.ylabel('Average Intensity')
plt.grid(True)
plt.legend()
plt.show()

print(f"Number of significant tree rings detected: {len(significant_valleys)}")

#31 rings detected
