/**
 * Client-side image optimization utility using HTML5 Canvas.
 * Resizes large images and compresses them to save network bandwidth and storage.
 */
export const optimizeImage = (
  file: File,
  maxDimension: number = 1920,
  quality: number = 0.82
): Promise<File> => {
  return new Promise((resolve, reject) => {
    // If not an image or if it's a GIF (to preserve animation), skip compression
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file); // fallback to original if canvas fails
        }

        // Draw and resize image on canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Prefer WebP or JPEG for compression
        const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            // If compressed blob is somehow larger than original, use original
            if (blob.size >= file.size && width === img.width && height === img.height) {
              return resolve(file);
            }

            const optimizedFile = new File([blob], file.name, {
              type: outputMime,
              lastModified: Date.now(),
            });
            resolve(optimizedFile);
          },
          outputMime,
          quality
        );
      };

      img.onerror = () => resolve(file);
      if (typeof readerEvent.target?.result === 'string') {
        img.src = readerEvent.target.result;
      } else {
        resolve(file);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file for optimization'));
    reader.readAsDataURL(file);
  });
};
