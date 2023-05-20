# twitch-vod-downloader
This script is based on https://github.com/besuper/TwitchNoSub.
-  The TwitchNoSub has the logic to convert the twitch playlist into a fake playlist fetching the VOD from cloudfront.net (check `fakePlaylist` in function `getM3U8`)
-  Instead of spoofing the fetch function of our browser when we try to access a twitch VOD (this works great with the twitch web player), I've defined a function `getM3U8` and then I did re-use this fake playlist to download it locally using youtube-dl and ffmpeg.
The fetch spooding is originally done here: https://github.com/besuper/TwitchNoSub/blob/master/src/patch_amazonworker.js#L40

So it's basically just using 3 projects to create this script: 

- [TwitchNoSub](https://github.com/besuper/TwitchNoSub)
- [Youtube-dl](https://github.com/ytdl-org/youtube-dl)
- [ffmpeg](https://github.com/FFmpeg/FFmpeg)

## Installation
- Clone this repository
- install dependencies (npm install)
- make sure you have youtube-dl installed
  - On my side, I use the window binary (.exe) directly downloaded from https://github.com/ytdl-org/youtube-dl/releases and I placed it in the same folder of this project.
  - If you want to install it globally in your system, it should also works fine.
  - I did not try linux and osx, but youtube-dl binary is also available for theses systems.
  - What is important is that `const command = ...` in the function `saveVodToDisk` reference the right binary in your local installation.

- make sure you have ffmpeg installed
  - You can find ffmpeg binary here: https://ffmpeg.org/download.html
  - ffmpeg is a dependency of youtube-dl. If the command `youtube-dl` run without error, that means your ffmpeg installation is working fine.

At the end, you should have theses files in your folder
- node_module
- ffmpeg.exe
- main.js
- package.json
- package-lock.json
- youtube-dl.exe

If it's not the case, make sure youtube-dl and ffmpeg are installed and available in your $PATH, and adapt `const command = ...` in the function `saveVodToDisk`

## How to use
Simply run the main.js file using node.js

The programme will ask you a twitch VOD URL

If the URL is valid and the playlist can be retrieved, you can select the VOD quality

After selecting the quality, the download will start and the file will be saved in `.\VOD\VodId.mp4`

## Additionnal information
This is a side project just for myself and I share it to anyone that want to use it, but there is no support or update garanteed.
You can take the code and do whatever you want with it.
Original credit goes to https://github.com/besuper/TwitchNoSub
I have 0 knowledge on video stream/encoding/decoding... so probably there is many things that can be improved


## Improvment
- Create a bundle file instead of using npm install
- Add some feature to compress the downloaded video file
