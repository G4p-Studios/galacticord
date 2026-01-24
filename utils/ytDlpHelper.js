const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const fs = require('fs');

const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const binaryPath = path.join(__dirname, '..', binaryName);

// Ensure the binary exists
async function ensureYtDlp() {
    if (!fs.existsSync(binaryPath)) {
        console.log('[System] Downloading yt-dlp binary...');
        await YTDlpWrap.downloadFromGithub(binaryPath);
        if (process.platform !== 'win32') {
            fs.chmodSync(binaryPath, '755');
        }
        console.log('[System] yt-dlp downloaded successfully and permissions set.');
    } else {
        // Check for updates if the file is older than 24 hours
        const stats = fs.statSync(binaryPath);
        const mtime = new Date(stats.mtime).getTime();
        const now = new Date().getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (now - mtime > twentyFourHours) {
            console.log('[System] Checking for yt-dlp updates...');
            try {
                await YTDlpWrap.downloadFromGithub(binaryPath);
                console.log('[System] yt-dlp updated to the latest version.');
            } catch (e) {
                console.error('[System] Failed to update yt-dlp, using existing version:', e.message);
            }
        }
    }
    return new YTDlpWrap(binaryPath);
}

module.exports = { ensureYtDlp, binaryPath };
