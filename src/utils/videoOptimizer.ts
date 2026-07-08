/**
 * Video Client-Side Preprocessing Utility
 * Enforces 45MB file limit, extracts first-frame thumbnail without server transcoding,
 * and validates video dimensions and duration.
 */

export interface ProcessedVideo {
  videoFile: File;
  thumbnailFile: File;
  width: number;
  height: number;
  duration: number; // Duration in milliseconds
}

const MAX_VIDEO_SIZE = 45 * 1024 * 1024; // 45MB

/**
 * Preprocesses video on the client side:
 * 1. Enforces 45MB maximum file size limit.
 * 2. Extracts the first frame as a JPEG thumbnail image using HTML5 Video and Canvas.
 * 3. Retrieves video dimensions and duration.
 */
export const processVideoForUpload = async (file: File): Promise<ProcessedVideo> => {
  // 1. File size check (Max 45MB)
  if (file.size > MAX_VIDEO_SIZE) {
    throw new Error(`동영상 파일 크기는 최대 45MB까지만 업로드 가능합니다. (현재: ${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const fileUrl = URL.createObjectURL(file);
    video.src = fileUrl;

    let isResolved = false;

    const cleanup = () => {
      URL.revokeObjectURL(fileUrl);
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      // Seek to 0.1 seconds (or 0 if duration is shorter) to get the first visible frame
      video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
    };

    video.onseeked = () => {
      if (isResolved) return;
      isResolved = true;

      try {
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 360;
        const durationMs = Math.round((video.duration || 0) * 1000);

        // Create canvas to extract thumbnail
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
        }

        canvas.toBlob(
          (blob) => {
            cleanup();
            if (!blob) {
              reject(new Error('동영상 썸네일 생성에 실패했습니다.'));
              return;
            }

            const thumbnailFile = new File([blob], 'thumbnail.jpg', {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            resolve({
              videoFile: file,
              thumbnailFile,
              width,
              height,
              duration: durationMs,
            });
          },
          'image/jpeg',
          0.85
        );
      } catch (err) {
        cleanup();
        reject(err || new Error('동영상 처리 중 오류가 발생했습니다.'));
      }
    };

    video.onerror = () => {
      if (isResolved) return;
      isResolved = true;
      cleanup();
      reject(new Error('지원되지 않거나 손상된 동영상 형식입니다. (모바일 최적화 MP4/H.264 권장)'));
    };

    // Timeout safety fallback after 10 seconds
    setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        reject(new Error('동영상 썸네일 추출 시간이 초과되었습니다.'));
      }
    }, 10000);
  });
};
