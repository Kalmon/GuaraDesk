var P2PT = require("p2pt");
const fs = require('fs');
const process = require('process');
const imgThumbnail = require('image-thumbnail');
let imgOptions = { percentage: 25, responseType: 'base64' }
const { spawn } = require('node:child_process');


var aux = new Object();
aux['chunks'] = new Object();
aux['MAX_DIFF_KEY'] = 3;

//Config ID and password
aux['config'] = JSON.parse(fs.readFileSync("config.json", { encoding: "utf8" }));
if (aux['config']['key'] == "") {
    aux['config']['key'] = [...Array(aux['MAX_DIFF_KEY'])].map(() => {
        let key = "000" + randomIntFromInterval(0, 9999);
        key = (key).slice(key.length - 4, key.length)
        return key;
    })
    fs.writeFileSync("config.json", JSON.stringify(aux['config']));
}

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
console.log(`'${aux['config']['key'].join("")}#${aux['config']['password']}'`);
console.log(MD5(`${aux['config']['key'].join("")}#${aux['config']['password']}`));
// This 'myApp' is called identifier and should be unique to your app
var p2pt = new P2PT(trackersAnnounceURLs, MD5(`${aux['config']['key'].join("")}#${aux['config']['password']}`))

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
            msg['data'] = __dirname + "/";
            msg['data'] = (msg['data']).split("\\").join("/")
        }
        console.log(`LS: ${msg['data']}`);
        let files = fs.readdirSync(msg['data']),
            filesSize = new Array();
        for (let cont = 0; cont < files.length; cont++) {
            filesSize.push({
                name: files[cont],
                isDir: fs.lstatSync(msg['data'] + '/' + files[cont]).isDirectory(),
                size: fs.lstatSync(msg['data'] + '/' + files[cont]).isDirectory() ? 0 : fs.statSync(msg['data'] + '/' + files[cont]).size,
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
        } else {
            p2pt.send(peer, {
                opc: "alert",
                data: {
                    type: "warning",
                    msg: "Folder already exists with that name!"
                }
            });
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
            sys.log("Usuario desconectou durante envio...");
        }
    } else if (msg['opc'] == 'filesCopMov') {

        for (let cont = 0, fileDest; cont < msg['data']['files'].length; cont++) {
            fileDest = msg['data']['files'][cont].split("/");
            //Is a folder? /media/files/
            if (fileDest[fileDest.length - 1] == "") {
                fileDest = fileDest[fileDest.length - 2]; //Name dir
            } else {
                fileDest = fileDest[fileDest.length - 1]; //Name file
            }

            try {
                //FALSE = Move, TRUE= Copy
                if (msg['data']['type']) {
                    fs.copyFile(msg['data']['files'][cont], `${msg['data']['dir']}${fileDest}`, (err) => {
                        if (err) throw err;
                        console.log('source.txt was copied to destination.txt');
                    });
                } else {
                    //If msg['data']['rename']==null? Então vamos mover : renomar
                    fs.rename(msg['data']['files'][cont], `${msg['data']['dir']}${msg['data']['rename'] == undefined ? fileDest : msg['data']['rename']}`, function (err) {
                        if (err) throw err
                        console.log('Successfully renamed - AKA moved!')
                    })
                }
            } catch (error) {
                p2pt.send(peer, {
                    opc: "alert",
                    data: {
                        type: "warning",
                        msg: error
                    }
                });
            }


        };


    } else if (msg['opc'] == 'getImgVideoEdit') {
        //obter icone do arquivo
        p2pt.send(peer, {
            opc: "getImgVideoEdit",
            data: {
                file: msg['data']['file'],
                base64: await getThumbnail(msg['data']['file'], true)
            }
        });

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
    } else if (msg['opc'] == 'zipFD') {
        var zip7;
        if (process.platform == "win32") {
            zip7 = spawn('./bin/7zip/7za.exe', ['a', '-t7z', `${msg['data']['dir']}${msg['data']['zip7name']}.7z`].concat(msg['data']['files']));
        } else if (process.arch == "arm64") {
            zip7 = spawn('./bin/7zip/7za-arm64', ['a', '-t7z', `${msg['data']['dir']}${msg['data']['zip7name']}.7z`].concat(msg['data']['files']));
        }
        zip7.stdout.on('data', (data) => {
            //console.log(`stdout: ${data}`);
        });

        zip7.stderr.on('data', (dataerr) => {
            //console.error(`stderr: ${data}`);
            //resolv(null);
            //sys.errLog(data);
            p2pt.send(peer, {
                opc: "alert",
                data: {
                    type: "warning",
                    msg: dataerr
                }
            });
        });

        zip7.on('close', async (code) => {
            try {
                console.log("7za finalizado...");
                p2pt.send(peer, {
                    opc: "alert",
                    data: {
                        type: "success",
                        msg: "Successfully compressed file!"
                    }
                });
            } catch (error) {
                sys.errLog(error);
            }

        });
    } else if (msg['opc'] == 'cropVideo') {
        //obter icone do arquivo
        cropVideo(msg['data']['file'], msg['data']['size']).then(res => {
            if (res.res) {
                p2pt.send(peer, {
                    opc: "alert",
                    data: {
                        type: "success",
                        msg: "Your video has been resized!"
                    }
                });
            } else {
                p2pt.send(peer, {
                    opc: "alert",
                    data: {
                        type: "warning",
                        msg: res.msg
                    }
                });
            }
        });


    }

    //Evitar promissas
    return peer.respond('Bye');
});

//Falta
async function sendChunk(peer, base64) {

}
async function cropVideo(File, data) {
    console.log(data);
    return new Promise((resol, reject) => {
        let output = File.split("/");
        output[output.length - 1] = "resiz_" + output[output.length - 1];
        output = output.join("/");
        if (process.platform == "win32") {
            ls = spawn('./bin/ffmpeg-win64/bin/ffmpeg.exe', ['-y','-i', File, '-vf', `crop=${data.w}:${data.h}:${data.x}:${data.y}`, `${output}`]);
        } else if (process.arch == "arm64") {
            ls = spawn('./bin/ffmpeg-linuxarm64/bin/ffmpeg', ['-y','-i', File, '-vf', `crop=${data.w}:${data.h}:${data.x}:${data.y}`, `${output}`]);
        }
        ls.stdout.on('data', (data) => {
            //console.log(`stdout: ${data}`);
        });

        ls.stderr.on('data', (data) => {
            //console.error(`stderr: ${data}`);
            //resolv(null);
            //sys.errLog(data);
            //resol({ res: true, msg: data });
        });

        ls.on('close', async (code) => {
            resol({ res: true });
        });
    });
}

async function getThumbnail(File, qualityFull = false) {
    return await new Promise(async (resolv, reject) => {
        if (!fs.lstatSync(File).isDirectory()) {
            if (fs.existsSync(`temp/${MD5(File)}`) && qualityFull==false) {
                resolv(fs.readFileSync(`temp/${MD5(File)}`, { encoding: 'utf8' }));
            } else {
                let exten = File.split(".")[File.split(".").length - 1]
                if (['png', 'jpeg', 'jpg'].includes(exten)) {
                    let base64Thumb = await imgThumbnail(File, imgOptions);
                    fs.writeFileSync(`temp/${MD5(File)}`, base64Thumb);
                    resolv(base64Thumb);
                } else if (['mp4'].includes(exten)) {
                    var ls;
                    if (process.platform == "win32") {
                        ls = spawn('./bin/ffmpeg-win64/bin/ffmpeg.exe', ['-y','-i', File, '-ss', '00:00:01.000', '-vframes', '1', `./temp/${MD5(File)}.jpeg`]);
                    } else if (process.arch == "arm64") {
                        ls = spawn('./bin/ffmpeg-linuxarm64/bin/ffmpeg', ['-y','-i', File, '-ss', '00:00:01.000', '-vframes', '1', `./temp/${MD5(File)}.jpeg`]);
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
                            let base64Thumb;
                            //Image video full
                            if (qualityFull) {
                                base64Thumb = fs.readFileSync(`./temp/${MD5(File)}.jpeg`, { encoding: "base64" });
                                
                            } else {
                                //Criar thumbnail e deletar imagem grande
                                base64Thumb = await imgThumbnail(`./temp/${MD5(File)}.jpeg`, imgOptions);
                                fs.writeFileSync(`./temp/${MD5(File)}`, base64Thumb);
                            }
                            try {
                                fs.unlinkSync(`./temp/${MD5(File)}.jpeg`);
                            } catch (error) {
                                console.log(error);
                            }
                            resolv(base64Thumb);
                        } catch (error) {
                            sys.errLog(error);
                            resolv(null);
                        }
                    });
                } else {
                    resolv(null);
                }
            }
        } else {
            resolv(null);
        }
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
                fs.stat("./temp/" + file, function (err, stat) {
                    let endTime, now;
                    if (err) {
                        return console.error(err);
                    }
                    now = new Date().getTime();
                    //console.log(stat.mtimeMs);
                    endTime = new Date(stat.mtimeMs).getTime() + 28000000;
                    if (now > endTime) {
                        //console.log(file);
                        fs.unlinkSync(`./temp/${file}`);
                    }
                });
            });
        });
    },
    log: (data) => {
        console.log(data);
    }
}

p2pt.start();


setInterval(() => {
    //p2pt.requestMorePeers();
}, 5000);


function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
}
function MD5(d) { return rstr2hex(binl2rstr(binl_md5(rstr2binl(d), 8 * d.length))) } function rstr2hex(d) { for (var _, m = "0123456789ABCDEF", f = "", r = 0; r < d.length; r++)_ = d.charCodeAt(r), f += m.charAt(_ >>> 4 & 15) + m.charAt(15 & _); return f } function rstr2binl(d) { for (var _ = Array(d.length >> 2), m = 0; m < _.length; m++)_[m] = 0; for (m = 0; m < 8 * d.length; m += 8)_[m >> 5] |= (255 & d.charCodeAt(m / 8)) << m % 32; return _ } function binl2rstr(d) { for (var _ = "", m = 0; m < 32 * d.length; m += 8)_ += String.fromCharCode(d[m >> 5] >>> m % 32 & 255); return _ } function binl_md5(d, _) { d[_ >> 5] |= 128 << _ % 32, d[14 + (_ + 64 >>> 9 << 4)] = _; for (var m = 1732584193, f = -271733879, r = -1732584194, i = 271733878, n = 0; n < d.length; n += 16) { var h = m, t = f, g = r, e = i; f = md5_ii(f = md5_ii(f = md5_ii(f = md5_ii(f = md5_hh(f = md5_hh(f = md5_hh(f = md5_hh(f = md5_gg(f = md5_gg(f = md5_gg(f = md5_gg(f = md5_ff(f = md5_ff(f = md5_ff(f = md5_ff(f, r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 0], 7, -680876936), f, r, d[n + 1], 12, -389564586), m, f, d[n + 2], 17, 606105819), i, m, d[n + 3], 22, -1044525330), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 4], 7, -176418897), f, r, d[n + 5], 12, 1200080426), m, f, d[n + 6], 17, -1473231341), i, m, d[n + 7], 22, -45705983), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 8], 7, 1770035416), f, r, d[n + 9], 12, -1958414417), m, f, d[n + 10], 17, -42063), i, m, d[n + 11], 22, -1990404162), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 12], 7, 1804603682), f, r, d[n + 13], 12, -40341101), m, f, d[n + 14], 17, -1502002290), i, m, d[n + 15], 22, 1236535329), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 1], 5, -165796510), f, r, d[n + 6], 9, -1069501632), m, f, d[n + 11], 14, 643717713), i, m, d[n + 0], 20, -373897302), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 5], 5, -701558691), f, r, d[n + 10], 9, 38016083), m, f, d[n + 15], 14, -660478335), i, m, d[n + 4], 20, -405537848), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 9], 5, 568446438), f, r, d[n + 14], 9, -1019803690), m, f, d[n + 3], 14, -187363961), i, m, d[n + 8], 20, 1163531501), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 13], 5, -1444681467), f, r, d[n + 2], 9, -51403784), m, f, d[n + 7], 14, 1735328473), i, m, d[n + 12], 20, -1926607734), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 5], 4, -378558), f, r, d[n + 8], 11, -2022574463), m, f, d[n + 11], 16, 1839030562), i, m, d[n + 14], 23, -35309556), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 1], 4, -1530992060), f, r, d[n + 4], 11, 1272893353), m, f, d[n + 7], 16, -155497632), i, m, d[n + 10], 23, -1094730640), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 13], 4, 681279174), f, r, d[n + 0], 11, -358537222), m, f, d[n + 3], 16, -722521979), i, m, d[n + 6], 23, 76029189), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 9], 4, -640364487), f, r, d[n + 12], 11, -421815835), m, f, d[n + 15], 16, 530742520), i, m, d[n + 2], 23, -995338651), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 0], 6, -198630844), f, r, d[n + 7], 10, 1126891415), m, f, d[n + 14], 15, -1416354905), i, m, d[n + 5], 21, -57434055), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 12], 6, 1700485571), f, r, d[n + 3], 10, -1894986606), m, f, d[n + 10], 15, -1051523), i, m, d[n + 1], 21, -2054922799), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 8], 6, 1873313359), f, r, d[n + 15], 10, -30611744), m, f, d[n + 6], 15, -1560198380), i, m, d[n + 13], 21, 1309151649), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 4], 6, -145523070), f, r, d[n + 11], 10, -1120210379), m, f, d[n + 2], 15, 718787259), i, m, d[n + 9], 21, -343485551), m = safe_add(m, h), f = safe_add(f, t), r = safe_add(r, g), i = safe_add(i, e) } return Array(m, f, r, i) } function md5_cmn(d, _, m, f, r, i) { return safe_add(bit_rol(safe_add(safe_add(_, d), safe_add(f, i)), r), m) } function md5_ff(d, _, m, f, r, i, n) { return md5_cmn(_ & m | ~_ & f, d, _, r, i, n) } function md5_gg(d, _, m, f, r, i, n) { return md5_cmn(_ & f | m & ~f, d, _, r, i, n) } function md5_hh(d, _, m, f, r, i, n) { return md5_cmn(_ ^ m ^ f, d, _, r, i, n) } function md5_ii(d, _, m, f, r, i, n) { return md5_cmn(m ^ (_ | ~f), d, _, r, i, n) } function safe_add(d, _) { var m = (65535 & d) + (65535 & _); return (d >> 16) + (_ >> 16) + (m >> 16) << 16 | 65535 & m } function bit_rol(d, _) { return d << _ | d >>> 32 - _ }
