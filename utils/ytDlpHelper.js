const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const fs = require('fs');

const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const binaryPath = path.join(__dirname, '..', binaryName);

// Ensure the binary exists
async function ensureYtDlp() {
    // Force a fresh download if the binary is older than 1 hour to ensure it's latest
    const forceUpdate = fs.existsSync(binaryPath) && (Date.now() - fs.statSync(binaryPath).mtimeMs > 3600000);

    if (!fs.existsSync(binaryPath) || forceUpdate) {
        if (forceUpdate) console.log('[System] yt-dlp is more than 1 hour old. Updating to latest...');
        else console.log('[System] Downloading yt-dlp binary...');
        
        await YTDlpWrap.downloadFromGithub(binaryPath);
        if (process.platform !== 'win32') {
            fs.chmodSync(binaryPath, '755');
        }
        console.log('[System] yt-dlp is now at the latest version.');
    }
    return new YTDlpWrap(binaryPath);
}

module.exports = { ensureYtDlp, binaryPath };
