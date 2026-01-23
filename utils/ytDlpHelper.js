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
        console.log('[System] yt-dlp downloaded successfully.');
    }
    return new YTDlpWrap(binaryPath);
}

module.exports = { ensureYtDlp, binaryPath };
