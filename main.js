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
            query: `query { video(id: "${vodID}") { broadcastType, createdAt, seekPreviewsURL, owner { login }, title }}`,
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
    const owner = vodData.owner.login;
    const title = vodData.title;

    const currentURL = new URL(vodData.seekPreviewsURL);
    const domain = currentURL.host;
    const paths = currentURL.pathname.split("/");
    const vodSpecialID = paths[paths.findIndex((element) => element.includes("storyboards")) - 1];

    const now = new Date("2023-02-10");
    const created = new Date(vodData.createdAt);
    const timeDifference = now.getTime() - created.getTime();
    const daysDifference = timeDifference / (1000 * 3600 * 24);
    const broadcastType = vodData.broadcastType.toLowerCase();

    const videoUrls = Object.entries(resolutions).map(async ([resKey, resValue]) => {
        const url = broadcastType === "highlight"
            ? `https://${domain}/${vodSpecialID}/${resKey}/highlight-${vodId}.m3u8`
            : (broadcastType === "upload" && daysDifference > 7)
                ? `https://${domain}/${owner}/${vodId}/${vodSpecialID}/${resKey}/index-dvr.m3u8`
                : `https://${domain}/${vodSpecialID}/${resKey}/index-dvr.m3u8`;

        const isValid = await isValidQuality(url);

        if (isValid) {
            const quality = resKey === "chunked" ? resValue.res.split("x")[1] + "p" : resKey;
            const fps = resValue.fps;

            return {
                url,
                quality,
                fps
            };
        }
    });

    const validVideoUrls = await Promise.all(videoUrls);
    return {
        owner,
        title,
        videos: validVideoUrls.filter(Boolean)
    };
};


const extractTwitchVodIdFromUrl = (url) => {
    if (!url.startsWith("https://www.twitch.tv/videos/")) {
        throw new Error("Invalid Twitch URL");
    }
    return url.split("https://www.twitch.tv/videos/")[1].split("?")[0];
}

const selectVideoResolution = (videos) => {
    console.log("Available Qualities:");
    videos.forEach((metadata, index) => {
        console.log(`${index + 1}. ${metadata.quality} @ ${metadata.fps}`);
    });
    const selectedIndex = readlineSync.questionInt("Enter the number of the quality you want to use: ", {
        min: 1,
        max: videos.length
    });
    return videos[selectedIndex - 1];
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

const saveVodToDisk = (vodId, metadata, vod, format) => {
    const filePath = `${metadata.owner.replaceAll(
        " ",
        "_"
    )}_${metadata.title.replaceAll(" ", "_")}.mp4`;
    const command = `youtube-dl --recode-video ${format} -o .\\VOD\\${filePath} ${vod.url}`;

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
    console.log(`You want to download: 
    ${vodMetadata.title} from ${vodMetadata.owner}
    Please select the quality and the format to start the download.`)
    const selectedVod = selectVideoResolution(vodMetadata.videos);
    const selectedFormat = selectVideoFormat()

    saveVodToDisk(vodId, vodMetadata, selectedVod, selectedFormat);
    return twitchUrl;
};

(async () => await runTwitchVodDownloader())();
