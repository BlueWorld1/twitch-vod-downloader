import {spawnSync} from 'child_process';
import readlineSync from 'readline-sync';
import fetch from 'node-fetch'

const resolutions = {
    chunked: {res: "1920x1080", fps: 60},
    "1080p60": {res: "1920x1080", fps: 60},
    "720p60": {res: "1280x720", fps: 60},
    "480p30": {res: "854x480", fps: 30},
    "360p30": {res: "640x360", fps: 30},
    "160p30": {res: "284x160", fps: 30},
};

const fetchTwitchDataGQL = async (vodID) => {
    const resp = await fetch("https://gql.twitch.tv/gql", {
        method: 'POST',
        body: JSON.stringify({
            query: `query { video(id: "${vodID}") { broadcastType, createdAt, seekPreviewsURL, owner { login } }}`,
        }),
        headers: {
            'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
    });

    return resp.json();
};

const isValidQuality = async (url) => {
    const response = await fetch(url);
    return response.ok;
};

const fetchVodMetadataById = async (vodId) => {
    const data = await fetchTwitchDataGQL(vodId);

    if (!data) {
        throw new Error("Unable to retrieve Twitch API data");
    }

    const vodData = data.data.video;
    const channelData = vodData.owner;

    const currentURL = new URL(vodData.seekPreviewsURL);
    const domain = currentURL.host;
    const paths = currentURL.pathname.split("/");
    const vodSpecialID = paths[paths.findIndex((element) => element.includes("storyboards")) - 1];

    const videoUrls = [];

    const now = new Date("2023-02-10");
    const created = new Date(vodData.createdAt);
    const timeDifference = now.getTime() - created.getTime();
    const daysDifference = timeDifference / (1000 * 3600 * 24);
    const broadcastType = vodData.broadcastType.toLowerCase();

    for (const [resKey, resValue] of Object.entries(resolutions)) {
        let url;

        if (broadcastType === "highlight") {
            url = `https://${domain}/${vodSpecialID}/${resKey}/highlight-${vodId}.m3u8`;
        } else if (broadcastType === "upload" && daysDifference > 7) {
            url = `https://${domain}/${channelData.login}/${vodId}/${vodSpecialID}/${resKey}/index-dvr.m3u8`;
        } else {
            url = `https://${domain}/${vodSpecialID}/${resKey}/index-dvr.m3u8`;
        }

        if (url && (await isValidQuality(url))) {
            const quality = resKey === "chunked" ? resValue.res.split("x")[1] + "p" : resKey;
            const fps = resValue.fps;

            videoUrls.push({
                url,
                quality,
                fps,
                user: channelData.login
            });
        }
    }

    return videoUrls;
};

const extractTwitchVodIdFromUrl = (url) => {
    if (!url.startsWith("https://www.twitch.tv/videos/")) {
        throw new Error("Invalid Twitch URL");
    }
    return url.split("https://www.twitch.tv/videos/")[1].split("?")[0];
}

const selectVideoResolution = (vodMetadata) => {
    console.log("Available Qualities:");
    vodMetadata.forEach((metadata, index) => {
        console.log(`${index + 1}. ${metadata.quality} @ ${metadata.fps}`);
    });
    const selectedIndex = readlineSync.questionInt("Enter the number of the quality you want to use: ", {
        min: 1,
        max: vodMetadata.length
    });
    return vodMetadata[selectedIndex - 1];
};
const selectVideoFormat = () => {
    const formats = [
        'mp4',
        'mkv',
        'avi',
        'webm',
        'flv',
        'ogg'
    ];
    console.log("Available Formats:");
    formats.forEach((format, index) => {
        console.log(`${index + 1}. ${format}`);
    });
    const selectedIndex = readlineSync.questionInt("Enter the number of the format you want to use: ", {
        min: 1,
        max: formats.length
    });
    return formats[selectedIndex - 1];
};

const saveVodToDisk = (vodId, metadata, format) => {
    const filePath = `${metadata.user}_${vodId}.${format}`;
    const command = `youtube-dl --recode-video ${format} -o .\\VOD\\${filePath} ${metadata.url}`;

    const result = spawnSync(command, { stdio: 'inherit', shell: true });

    if (result.error) {
        throw result.error;
    }

    console.log('Download completed.');
};

const runTwitchVodDownloader = async () => {
    const twitchUrl = readlineSync.question("Enter the Twitch VOD URL (https://www.twitch.tv/videos/ID): ");
    const vodId = extractTwitchVodIdFromUrl(twitchUrl);

    const vodMetadata = await fetchVodMetadataById(vodId);
    const selectedMetadata = selectVideoResolution(vodMetadata);
    const selectedFormat = selectVideoFormat()

    saveVodToDisk(vodId, selectedMetadata, selectedFormat);
    return twitchUrl;
};

(async () => await runTwitchVodDownloader())();
