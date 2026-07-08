/**
 * Automated HDD Storage Cleanup Task (30-Day Retention Policy)
 * 
 * Complies with:
 * Storage & I/O Control: Automatically scans the physical disk directory daily
 * and deletes video files older than 30 days to manage 1TB HDD storage limits.
 */

const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, 'uploads/videos');
const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

function cleanOldVideos() {
  console.log(`[Storage Cleanup] Starting scan of ${UPLOAD_DIR} for files older than ${RETENTION_DAYS} days...`);

  if (!fs.existsSync(UPLOAD_DIR)) {
    console.log(`[Storage Cleanup] Upload directory does not exist yet. Skipping.`);
    return;
  }

  const now = Date.now();
  let deletedCount = 0;
  let freedBytes = 0;

  fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) {
      console.error(`[Storage Cleanup] Error reading directory:`, err);
      return;
    }

    files.forEach((file) => {
      const filePath = path.join(UPLOAD_DIR, file);
      fs.stat(filePath, (statErr, stats) => {
        if (statErr) {
          console.error(`[Storage Cleanup] Error checking stat for ${file}:`, statErr);
          return;
        }

        if (stats.isFile()) {
          const fileAge = now - stats.mtimeMs;
          if (fileAge > RETENTION_MS) {
            fs.unlink(filePath, (unlinkErr) => {
              if (unlinkErr) {
                console.error(`[Storage Cleanup] Failed to delete ${file}:`, unlinkErr);
              } else {
                deletedCount++;
                freedBytes += stats.size;
                console.log(`[Storage Cleanup] Deleted expired video file: ${file} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
              }
            });
          }
        }
      });
    });

    setTimeout(() => {
      console.log(`[Storage Cleanup] Completed. Deleted ${deletedCount} files, freed ${(freedBytes / (1024 * 1024)).toFixed(2)} MB of HDD storage.`);
    }, 2000);
  });
}

// Execute immediately when run as a cron script
cleanOldVideos();

// If running as a daemon, run once every 24 hours (86,400,000 ms)
if (process.argv.includes('--daemon')) {
  console.log(`[Storage Cleanup] Running in daemon mode. Schedule: Every 24 hours.`);
  setInterval(cleanOldVideos, 24 * 60 * 60 * 1000);
}
