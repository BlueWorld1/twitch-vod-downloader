import fetch from 'node-fetch';
import { spawnSync } from 'child_process';
import readlineSync from 'readline-sync';

const resolutions = {
    "160p30": { res: "284x160", fps: 30 },
    "360p30": { res: "640x360", fps: 30 },
    "480p30": { res: "854x480", fps: 30 },
    "720p60": { res: "1280x720", fps: 60 },
    "1080p60": { res: "1920x1080", fps: 60 },
    chunked: { res: "1920x1080", fps: 60 },
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

const createServingID = () => {
    const w = "0123456789abcdefghijklmnopqrstuvwxyz";
    const id = Array.from({ length: 32 }, () => w[Math.floor(Math.random() * w.length)]).join("");
    return id;
};

const isValidQuality = async (url) => {
    const response = await fetch(url);
    return response.ok;
};

const getM3U8 = async (vodId) => {
    const data = await fetchTwitchDataGQL(vodId);

    if (!data) {
        throw new Error("Unable to retrieve Twitch API data");
    }

    const vodData = data.data.video;
    const channelData = vodData.owner;

    const sortedResolutions = Object.keys(resolutions).reverse();
    const orderedResolutions = sortedResolutions.reduce((obj, key) => {
        obj[key] = resolutions[key];
        return obj;
    }, {});

    const currentURL = new URL(vodData.seekPreviewsURL);
    const domain = currentURL.host;
    const paths = currentURL.pathname.split("/");
    const vodSpecialID = paths[paths.findIndex((element) => element.includes("storyboards")) - 1];

    let fakePlaylist = `#EXTM3U
#EXT-X-TWITCH-INFO:ORIGIN="s3",B="false",REGION="EU",USER-IP="127.0.0.1",SERVING-ID="${createServingID()}",CLUSTER="cloudfront_vod",USER-COUNTRY="BE",MANIFEST-CLUSTER="cloudfront_vod"`;

    const now = new Date("2023-02-10");
    const created = new Date(vodData.createdAt);
    const timeDifference = now.getTime() - created.getTime();
    const daysDifference = timeDifference / (1000 * 3600 * 24);
    const broadcastType = vodData.broadcastType.toLowerCase();
    let startQuality = 8534030;

    for (const [resKey, resValue] of Object.entries(orderedResolutions)) {
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
            const enabled = resKey === "chunked" ? "YES" : "NO";
            const fps = resValue.fps;

            fakePlaylist += `
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="${quality}",NAME="${quality}",AUTOSELECT=${enabled},DEFAULT=${enabled}
#EXT-X-STREAM-INF:BANDWIDTH=${startQuality},CODECS="avc1.64002A,mp4a.40.2",RESOLUTION=${resValue.res},VIDEO="${quality}",FRAME-RATE=${fps}
${url}`;

            startQuality -= 100;
        }
    }

    return fakePlaylist;
};

const extractTwitchVodIdFromUrl = (url) => {
    if (!url.startsWith("https://www.twitch.tv/videos/")) {
        throw new Error("Invalid Twitch URL");
    }
    return url.split("https://www.twitch.tv/videos/")[1].split("?")[0];
}

const extractVideoUrlsFromM3U8 = (m3u8Content) => {
    const regex = /^https:\/\/.*$/gm;
    return m3u8Content.match(regex) || [];
};

const generateQualityNames = (urls) => urls.map(url => {
    const key = Object.keys(resolutions).find(res => url.includes(res));
    const { res, fps } = resolutions[key];
    return `${res}@${fps}`;
});

const selectVideoResolution = (videoUrls) => {
    console.log("Available Qualities:");
    generateQualityNames(videoUrls).forEach((url, index) => {
        console.log(`${index + 1}. ${url}`);
    });

    const selectedIndex = readlineSync.questionInt("Enter the number of the URL to use: ", { min: 1, max: videoUrls.length });

    return videoUrls[selectedIndex - 1];
};

const saveVodToDisk = (vodId, videoUrl) => {
    const filePath = vodId + '.mp4';
    const command = `.\\youtube-dl.exe -o .\\VOD\\${filePath} ${videoUrl}`;

    const result = spawnSync(command, { stdio: 'inherit', shell: true });

    if (result.error) {
        throw result.error;
    }

    console.log('Download completed.');
};

const getVodUrls = async (vodId) => {
    try {
        const m3u8Content = await getM3U8(vodId);
        const videoUrls = extractVideoUrlsFromM3U8(m3u8Content);

        if (videoUrls.length === 0) {
            throw new Error("No valid URLs found in the M3U8 file.");
        }
        return videoUrls;

    } catch (error) {
        console.error('An error occurred during the download:', error.message);
    }
};

const runTwitchVodDownloader = async () => {
    const twitchUrl = readlineSync.question("Enter the Twitch VOD URL (https://www.twitch.tv/videos/ID): ");
    const vodId = extractTwitchVodIdFromUrl(twitchUrl);
    const vodUrls = await getVodUrls(vodId);
    const selectedVideoResolutionUrl = selectVideoResolution(vodUrls);
    saveVodToDisk(vodId, selectedVideoResolutionUrl);
};

runTwitchVodDownloader();
