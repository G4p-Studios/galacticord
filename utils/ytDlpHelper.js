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
    }
    return new YTDlpWrap(binaryPath);
}

module.exports = { ensureYtDlp, binaryPath };
