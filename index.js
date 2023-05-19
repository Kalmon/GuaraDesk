var P2PT = require("p2pt");
const fs = require('fs');
const process = require('process');
var ls = require('local-storage');
const imgThumbnail = require('image-thumbnail');
let imgOptions = { percentage: 25, responseType: 'base64' }
var MD5 = require('md5');
const { spawn } = require('node:child_process');
if (ls("dir") == null) {
    ls("dir", __dirname);
}

var aux = new Object();
aux['chunks'] = new Object();



log = msg => {
    if (typeof msg == 'object') {
        console.log((JSON && JSON.stringify ? JSON.stringify(msg, undefined, 2) : msg));
    } else {
        console.log(msg);
    }
}

// Find public WebTorrent tracker URLs here : https://github.com/ngosang/trackerslist/blob/master/trackers_all_ws.txt
var trackersAnnounceURLs = [
    "wss://tracker.openwebtorrent.com",
    "wss://tracker.btorrent.xyz"
]

// This 'myApp' is called identifier and should be unique to your app
var p2pt = new P2PT(trackersAnnounceURLs, 'guara-hos-files')

// If a tracker connection was successful
p2pt.on('trackerconnect', (tracker, stats) => {
    //log('Connected to tracker : ' + tracker.announceUrl)
    //log('Tracker stats : ' + JSON.stringify(stats))
    //log('')
});

p2pt.on('peerconnect', (peer) => {
    //console.log('PEER-CONNECT', peer)
})

// If a new peer, send message
p2pt.on('peerconnect', (peer) => {
    log('New Peer ! : ' + peer.id + '. Sending Hi')
    p2pt.send(peer, {
        opc: "host",
        data: true
    });
})

// If message received from peer
p2pt.on('msg', async (peer, msg) => {
    if (msg['opc'] == 'ls') {
        sys.clearTemporario();
        //Lista diretorio
        if (msg['data'] == null) {
            msg['data'] = __dirname + "\\";
        }
        let files = fs.readdirSync(msg['data']),
            filesSize = new Array();
        for (let cont = 0; cont < files.length; cont++) {
            filesSize.push({
                name: files[cont],
                isDir: fs.lstatSync(msg['data'] + '\\' + files[cont]).isDirectory(),
                size: fs.lstatSync(msg['data'] + '\\' + files[cont]).isDirectory() ? 0 : fs.statSync(msg['data'] + '\\' + files[cont]).size,
                thumbnail: await getThumbnail(`${msg['data']}${files[cont]}`)
            });
        }
        p2pt.send(peer, {
            opc: msg['opc'],
            data: {
                dir: msg['data'],
                files: filesSize
            }
        });
    } else if (msg['opc'] == 'mkdir') {
        //Criar diretorio
        if (!fs.existsSync(`${msg['data']['dir']}${msg['data']['newFolder']}`)) {
            fs.mkdirSync(`${msg['data']['dir']}${msg['data']['newFolder']}`);
        }

    } else if (msg['opc'] == 'getFile') {
        //Obter arquivo
        let reader = fs.readFileSync(msg['data'], { encoding: "base64" });
        try {
            p2pt.send(peer, {
                opc: "getFile",
                data: {
                    name: msg['data'],
                    base64: reader
                }
            });
        } catch (error) {
            sys.errLog(error);
        }
    } else if (msg['opc'] == 'dirUpdate') {
        //Atualizar path
        ls("dir", msg['data']);

    } else if (msg['opc'] == 'mv') {
        //Renomear arquivo

    } else if (msg['opc'] == 'addFile') {
        //Adicionar arquivo

    } else if (msg['opc'] == 'getThumb') {
        //obter icone do arquivo

    } else if (msg['opc'] == 'writeFile') {
        //obter icone do arquivo
        console.log("arquivos recebidos!");
        fs.writeFileSync(`${msg['data']['dir']}${msg['data']['name']}`, msg['data']['base64'], { encoding: "base64" });
        //Remover thumbnail anterior caso tenha...
        try {
            fs.unlinkSync(`./temp/${MD5(`${msg['data']['dir']}${msg['data']['name']}`)}`);
        } catch (error) {
            //Arquivo não existe, fodasi
        }
    } else if (msg['opc'] == 'deletFiles') {
        for (let cont = 0; cont < msg['data'].length; cont++) {
            if (fs.lstatSync(msg['data'][cont]).isDirectory()) {
                fs.rmSync(msg['data'][cont], { recursive: true, force: true });
            } else {
                fs.unlinkSync(msg['data'][cont]);
            }
        }
    }

    //Evitar promissas
    return peer.respond('Bye');
});

//Falta
async function sendChunk(peer, base64) {

}

async function getThumbnail(File) {
    return await new Promise(async (resolv, reject) => {
        if (!fs.lstatSync(File).isDirectory()) {
            if (fs.existsSync(`temp\\${MD5(File)}`)) {
                resolv(fs.readFileSync(`temp\\${MD5(File)}`, { encoding: 'utf8' }));
            } else {
                let exten = File.split(".")[File.split(".").length - 1]
                if (['png', 'jpeg', 'jpg'].includes(exten)) {
                    let base64Thumb = await imgThumbnail(File, imgOptions);
                    fs.writeFileSync(`temp\\${MD5(File)}`, base64Thumb);
                    resolv(base64Thumb);
                } else if (['mp4'].includes(exten)) {
                    var ls;
                    if (process.platform == "win32") {
                        ls = spawn('./bin/ffmpeg-win64/bin/ffmpeg.exe', ['-i', File, '-ss', '00:00:01.000', '-vframes', '1', `./temp/${MD5(File)}.jpeg`]);
                    } else if (process.arch == "arm64") {
                        ls = spawn('./bin/ffmpeg-linuxarm64/bin/ffmpeg', ['-i', File, '-ss', '00:00:01.000', '-vframes', '1', `./temp/${MD5(File)}.jpeg`]);
                    }
                    ls.stdout.on('data', (data) => {
                        //console.log(`stdout: ${data}`);
                    });

                    ls.stderr.on('data', (data) => {
                        //console.error(`stderr: ${data}`);
                        //resolv(null);
                        //sys.errLog(data);
                    });

                    ls.on('close', async (code) => {
                        try {
                            console.log("FFMPEG finalizado...");
                            //Criar thumbnail e deletar imagem grande
                            let base64Thumb = await imgThumbnail(`./temp/${MD5(File)}.jpeg`, imgOptions);
                            fs.writeFileSync(`./temp/${MD5(File)}`, base64Thumb);
                            try {
                                fs.unlinkSync(`./temp/${MD5(File)}.jpeg`);
                            } catch (error) {
                                console.log(error);
                            }
                            console.log(`child process exited with code ${code}`);
                            resolv(base64Thumb);
                        } catch (error) {
                            sys.errLog(error);
                            resolv(null);
                        }

                    });
                }

            }
        }
        resolv(null);
    })

}

log('P2PT started. My peer id : ' + p2pt._peerId)

var sys = {
    errLog: (Err) => {
        Err = {
            data: sys.dataAtualFormatada(),
            Erro: Err
        }
        fs.writeFileSync("./logErros.txt", JSON.stringify(Err));
    },
    dataAtualFormatada: () => {
        var data = new Date(),
            dia = data.getDate().toString(),
            diaF = (dia.length == 1) ? '0' + dia : dia,
            mes = (data.getMonth() + 1).toString(), //+1 pois no getMonth Janeiro começa com zero.
            mesF = (mes.length == 1) ? '0' + mes : mes,
            anoF = data.getFullYear();
        return diaF + "/" + mesF + "/" + anoF;
    },
    clearTemporario: () => {
        fs.readdir("./temp/", (err, files) => {
            files.forEach(file => {
                fs.stat("./temp/"+file, function (err, stat) {
                    let endTime, now;
                    if (err) {
                        return console.error(err);
                    }
                    now = new Date().getTime();
                    //console.log(stat.mtimeMs);
                    endTime = new Date(stat.mtimeMs).getTime() + 18000000;
                    if (now > endTime) {
                        //console.log(file);
                        fs.unlinkSync(`./temp/${file}`);
                    }
                });
            });
        });
    }
}

p2pt.start();
setInterval(() => {
    //p2pt.requestMorePeers();
}, 5000);