const fs = require('fs');
const https = require('https');
const { map } = require('lodash');

const config = require('./config.json');

const messagesPerRequest = 50; // 50 is maximum
const jsonData = [];

const saveJsonData = () => {
    fs.writeFileSync(`messages-${config.channel}.json`, JSON.stringify(jsonData));
}

const savePrintAndExit = (message, exitCode) => {
    saveJsonData();
    console.log(message);
    process.exit(exitCode);
}

const channelRequest = (channel, token, before) => {
    return new Promise(async resolve => {
        let path = `/api/v8/channels/${channel}/messages?limit=${messagesPerRequest}`;

        if (before) {
            path += `&before=${before}`;
        }

        console.log(path);

        const req = https.request({
            host: "discord.com",
            path: path,
            headers: {
                'Content-Type': 'application/json',
                "Authorization": token
            },
        }, res => {
            const code = res.statusCode;

            if (code !== 200) {
                savePrintAndExit("Request failed! Exit.", 1);
            }

            const body = [];

            res.on('data', data => {
                body.push(data);
            });

            res.on('end', () => {
                resolve(body.join(''));
            });
        });

        req.on('error', err => {
            console.error(err);
        });

        req.end();
    });
}

setTimeout(async () => {
    let maxRequestsLoops = config.maxMessages / messagesPerRequest;
    let lastMessageId = undefined;

    while (maxRequestsLoops > 0) {
        let response = await channelRequest(config.channel, config.token, lastMessageId);

        try {
            response = JSON.parse(response);
        } catch (err) {
            savePrintAndExit(err, 1);
        }

        if (response.length < 1) {
            savePrintAndExit("No more response data", 0);
        }

        const cleanData = map(response, data => ({
            id: data.id,
            author: {
                id: data.author.id,
                username: data.author.username
            },
            timestamp: data.timestamp,
            message: data.content
        }));

        jsonData.push(...cleanData);

        const newLastMessageId = cleanData[cleanData.length - 1].id;

        if (newLastMessageId === lastMessageId) {
            break;
        } else {
            lastMessageId = newLastMessageId;
        }

        maxRequestsLoops--;
    }

    savePrintAndExit(`Max defined messages (${config.maxMessages}) exported`, 0);
}, 1);
