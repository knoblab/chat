/**
 * Video Streaming Upload Service (Node.js & Busboy)
 * 
 * Complies with:
 * 1. No Server Transcoding (FFmpeg forbidden to prevent CPU overload).
 * 2. Memory Optimization: Direct streaming pipeline from incoming network stream to HDD file.
 * 3. In-Memory Buffer Limit: Set to max 1MB to prevent OOM (Out of Memory) errors.
 * 4. File Size Limit: Enforces strict 45MB limit for video files.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const Busboy = require('busboy');

const UPLOAD_DIR = path.join(__dirname, 'uploads/videos');
const MAX_FILE_SIZE = 45 * 1024 * 1024; // 45MB Limit
const HIGH_WATER_MARK = 1024 * 1024; // 1MB In-Memory Buffer Limit for Stream

// Ensure physical upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/api/upload/video') {
    let busboy;
    try {
      // Configure busboy with strict limits and 1MB memory buffer threshold
      busboy = Busboy({
        headers: req.headers,
        limits: {
          fileSize: MAX_FILE_SIZE,
          files: 2, // Video + Thumbnail
        },
        highWaterMark: HIGH_WATER_MARK,
      });
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid multipart/form-data request' }));
    }

    const uploadedFiles = [];
    let uploadError = null;

    busboy.on('file', (fieldname, fileStream, info) => {
      const { filename, encoding, mimeType } = info;

      // Validate MIME type (must be video or image thumbnail)
      if (!mimeType.startsWith('video/') && !mimeType.startsWith('image/')) {
        uploadError = 'Invalid file type. Only video and thumbnail images are allowed.';
        fileStream.resume(); // Drain stream
        return;
      }

      // Generate secure unique filename
      const safeFilename = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${path.basename(filename)}`;
      const savePath = path.join(UPLOAD_DIR, safeFilename);

      // Create WriteStream with 1MB highWaterMark to prevent RAM spikes (Direct HDD Write Pipeline)
      const writeStream = fs.createWriteStream(savePath, {
        highWaterMark: HIGH_WATER_MARK,
      });

      fileStream.on('limit', () => {
        uploadError = `File size exceeds maximum allowed limit of 45MB.`;
        fileStream.unpipe(writeStream);
        writeStream.destroy();
        fs.unlink(savePath, () => {}); // Delete partial file from HDD
      });

      fileStream.pipe(writeStream);

      writeStream.on('finish', () => {
        if (!uploadError) {
          uploadedFiles.push({
            fieldname,
            filename: safeFilename,
            url: `/media/videos/${safeFilename}`,
            mimeType,
          });
        }
      });

      writeStream.on('error', (err) => {
        uploadError = 'Disk write error occurred during streaming upload.';
        fileStream.unpipe(writeStream);
        fs.unlink(savePath, () => {});
      });
    });

    busboy.on('finish', () => {
      if (uploadError) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: uploadError }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, files: uploadedFiles }));
    });

    busboy.on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Server streaming pipeline error' }));
    });

    req.pipe(busboy);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`[Video Upload Service] Running on port ${PORT} with 1MB RAM stream limit and 45MB file cap.`);
});
