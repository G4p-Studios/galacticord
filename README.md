# Galacticord

A fully featured General Purpose Discord bot built with Node.js and discord.js.

## Features
- **Moderation**: Warn, Kick, Ban, Timeout users.
- **Logging**: Log deleted messages and new member joins.
- **Music**: Play YouTube audio in voice channels.
- **Reaction Roles**: Self-assign roles via buttons.
- **Social Media**: YouTube upload notifications.
- **AI**: Describe images using Google Gemini.
- **TTS**: Auto-read messages from a specific text channel into a voice channel.

## Setup

1.  **Install Node.js** (v16.9.0 or higher).
2.  **Install FFmpeg**:
    *   Download from [ffmpeg.org](https://ffmpeg.org/download.html).
    *   Extract and add the `bin` folder to your System PATH.
3.  **Install Dependencies**:
    ```bash
    npm install
    ```
4.  **Configure Environment**:
    *   Open `.env`.
    *   Fill in the required values:
        *   `DISCORD_TOKEN`: Your bot token.
        *   `CLIENT_ID`: Your bot's application ID.
        *   `GUILD_ID`: (Optional) Your server ID for instant command updates during dev.
        *   `GEMINI_API_KEY`: Get one from [Google AI Studio](https://aistudio.google.com/).
        *   `LOG_CHANNEL_ID`: Channel ID for logs.
        *   `TTS_CHANNEL_ID`: Channel ID where messages are auto-read to VC.

## Running the Bot

```bash
npm start
```

## Commands
- `/ping`: Check latency.
- `/warn <user> <reason>`: Warn a user.
- `/kick`, `/ban`, `/timeout`: Standard moderation.
- `/play <url|query>`: Play music.
- `/stop`: Stop music.
- `/reactionrole <role> <description>`: Create a reaction role message.
- `/describe [image_attachment]`: AI image description.
- `/addyoutube <channel_id> <target_channel>`: Add a YouTube feed (ID must start with 'UC').

## Notes
- **Music** requires FFmpeg to be installed and in your PATH.
- **TTS** works by joining the voice channel of the user who sent the message in the TTS channel.
