// utils/imageUtils.ts
export const drawMarkerOnImage = (base64Image: string, coords: { x: number; y: number }): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64Image;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }

            // Draw the original image
            ctx.drawImage(img, 0, 0);

            // Draw the marker
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, Math.max(10, img.width * 0.015), 0, 2 * Math.PI, false); // Radius is 1.5% of image width, or 10px min
            ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
            ctx.fill();
            ctx.lineWidth = Math.max(3, img.width * 0.005); // Line width is 0.5% of image width, or 3px min
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
            ctx.stroke();

            // Export the new image
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            const newBase64 = dataUrl.split(',')[1];
            resolve(newBase64);
        };

        img.onerror = (err) => {
            console.error("Failed to load image for drawing.", err);
            reject(new Error("Image failed to load in canvas."));
        };
    });
};
