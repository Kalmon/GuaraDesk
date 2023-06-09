var P2PT = require("p2pt");
const fs = require('fs');
const process = require('process');
const imgThumbnail = require('image-thumbnail');
let imgOptions = { percentage: 25, responseType: 'base64' }
const { spawn } = require('node:child_process');
const { rejects } = require("assert");
//const dragDrop = require('drag-drop')

//WebTorrent-hybrid
var WebTorrent = require('webtorrent-hybrid')
const client = new WebTorrent()

//Fire Base
var admin = require("firebase-admin");
var serviceAccount = require("./chave.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://guara-wpp-default-rtdb.firebaseio.com"
});
var db = admin.database();

//Config system
var aux = new Object();
aux['chunks'] = new Object();
aux['MAX_DIFF_KEY'] = 3;
aux['opc'] = new Object();
aux['webTorrent'] = new Object();


//Config ID and password
aux['config'] = JSON.parse(fs.readFileSync("config.json", { encoding: "utf8" }));
if (aux['config']['key'] == "") {
    aux['config']['key'] = [...Array(aux['MAX_DIFF_KEY'])].map(() => {
        let key = "000" + randMinMax(0, 9999);
        key = (key).slice(key.length - 4, key.length)
        return key;
    })
    fs.writeFileSync("config.json", JSON.stringify(aux['config']));
}
console.log(MD5(`${aux['config']['key'].join("")}#${aux['config']['password']}`));
db.ref(`user/${MD5(`${aux['config']['key'].join("")}#${aux['config']['password']}`)}/jobs`).on("value", function (snapshot) {
    if (snapshot.val() != null) {
        db.ref(`user/${MD5(`${aux['config']['key'].join("")}#${aux['config']['password']}`)}/jobs`).remove();
        let jobs = snapshot.val();
        Object.keys(jobs).map(key => {
            aux['opc'][jobs[key]['opc']](jobs[key]['peer'], jobs[key]['data']).then(res => {
                db.ref(`user/${MD5(`${aux['config']['key'].join("")}#${aux['config']['password']}`)}/jobsResolv/${key}`).set(res);
            })
        })
    }
});

log = msg => {
    if (typeof msg == 'object') {
        console.log((JSON && JSON.stringify ? JSON.stringify(msg, undefined, 2) : msg));
    } else {
        console.log(msg);
    }
}

/*
// If message received from peer
p2pt.on('msg', async (peer, msg) => {
    if (typeof aux['opc'][msg['opc']] === 'undefined') {
        p2pt.send(peer, {
            opc: "alert",
            data: {
                type: "warning",
                msg: "Funcion not exist!"
            }
        });
        return peer.respond(null);
    }
    try {
        console.log(msg['opc']);
        aux['opc'][msg['opc']](peer, msg['data']).then(peer.respond)
    } catch (error) {
        p2pt.send(peer, {
            opc: "alert",
            data: {
                type: "warning",
                msg: error
            }
        });
    }
});
p2pt.start();
*/


async function getThumbnail(File, qualityFull = false) {
    return await new Promise(async (resolv, reject) => {
        if (!fs.lstatSync(File).isDirectory()) {
            if (fs.existsSync(`temp/${MD5(File + "_" + fs.statSync(File).mtimeMs)}`) && qualityFull == false) {
                resolv(fs.readFileSync(`temp/${MD5(File + "_" + fs.statSync(File).mtimeMs)}`, { encoding: 'utf8' }));
            } else {
                let exten = File.split(".")[File.split(".").length - 1]
                if (['png', 'jpeg', 'jpg'].includes(exten)) {
                    try {
                        let base64Thumb = await imgThumbnail(File, imgOptions);
                        fs.writeFileSync(`temp/${MD5(File + "_" + fs.statSync(File).mtimeMs)}`, base64Thumb);
                        resolv(base64Thumb);
                    } catch (error) {
                        resolv(null);
                    }

                } else if (['mp4'].includes(exten)) {
                    var ls;
                    ls = spawn(sys.bin.ffmpeg, ['-y', '-i', File, '-ss', '00:00:01.000', '-vframes', '1', `./temp/${MD5(File + "_" + fs.statSync(File).mtimeMs)}.jpeg`]);
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
                                base64Thumb = fs.readFileSync(`./temp/${MD5(File + "_" + fs.statSync(File).mtimeMs)}.jpeg`, { encoding: "base64" });

                            } else {
                                //Criar thumbnail e deletar imagem grande
                                base64Thumb = await imgThumbnail(`./temp/${MD5(File + "_" + fs.statSync(File).mtimeMs)}.jpeg`, imgOptions);
                                fs.writeFileSync(`./temp/${MD5(File + "_" + fs.statSync(File).mtimeMs)}`, base64Thumb);
                            }
                            try {
                                fs.unlinkSync(`./temp/${MD5(File + "_" + fs.statSync(File).mtimeMs)}.jpeg`);
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
                    endTime = new Date(stat.mtimeMs).getTime() + (2 * 85000000); //48hs
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
    },
    bin: process.platform == "win32" ? {
        //Windows 64
        ffmpeg: './bin/ffmpeg-win64/bin/ffmpeg.exe',
        zip: './bin/7zip/7za.exe'
    } : process.arch == "arm64" ? {
        //Linux arm64
        ffmpeg: './bin/ffmpeg-linuxarm64/bin/ffmpeg',
        zip: './bin/7zip/7za-arm64'
    } : {

    },
    crontab: {
        destTorrent: {
            time: 300,
            cont: 0,
            func: () => {
                client.torrents.map(torrent => {
                    if (torrent.uploadSpeed == 0 && torrent.downloadSpeed == 0) {
                        console.log("Destroy torrent: " + torrent.infoHash);
                        torrent.destroy();
                    }
                })
            }
        }
    }
}



setInterval(() => {
    Object.keys(sys.crontab).map(job => {
        if (sys.crontab[job].time == sys.crontab[job].cont) {
            sys.crontab[job].cont = 0;
            sys.crontab[job].func();
        } else {
            sys.crontab[job].cont++;
        }
    })
}, 1000);


// -------------------  FUNCTIONS SERVER
/*
aux['opc']['cropVideo'] = (Peer,Data)=>{
    return new Promise(async (Resolv,Reject)=>{

    })
}
*/
aux['opc']['webtorrent'] = (Peer, Data) => {
    return new Promise(async (Resolv, Reject) => {
        if (Data.type) {
            try {
                client.add(Data.infoHash, { path: Data.dir, announce: Data.trackers }, function (torrent) {
                    aux['webTorrent'][torrent.infoHash] = {
                        torrent: torrent,
                        peer: Peer
                    };
                    torrent.on('done', function () {
                        db.ref(`user/${aux['webTorrent'][torrent.infoHash].peer}/jobs/${randMinMax(0, 999999)}`).set({
                            opc: "alert",
                            data: {
                                type: "success",
                                msg: "Download completo!"
                            }
                        });
                        delete aux['webTorrent'][torrent.infoHash];
                        torrent.destroy();
                    })
                })
                Resolv({
                    type: "success",
                    msg: "Upload iniciado..."
                });
            } catch (error) {
                Resolv({
                    type: "warning",
                    msg: error
                });
            }

        } else {
            client.seed(Data.files, { announceList: Data.trackers }, function (torrent) {
                aux['webTorrent'][torrent.infoHash] = {
                    torrent: torrent,
                    peer: "???"
                };
                Resolv({
                    infoHash: torrent.infoHash,
                });
            })
        }
    })
}

//Corta video
aux['opc']['cropVideo'] = (Peer, Data) => {
    return new Promise(async (Resolv, Reject) => {
        try {
            let output = Data['file'].split("/");
            ls = spawn(sys.bin.ffmpeg, ['-y', '-i', Data['file'], '-vf', `crop=${Data['size'].w}:${Data['size'].h}:${Data['size'].x}:${Data['size'].y}`, `./temp/${output[output.length - 1]}`]);
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
                try {
                    console.log("Finalizado CROP...");
                    fs.unlinkSync(output.join("/"));
                    fs.renameSync(`./temp/${output[output.length - 1]}`, output.join("/"))
                } catch (error) {
                    Reject(error);
                }
                Resolv({
                    type: "success",
                    msg: "Successfully, video resized!"
                });
            });
        } catch (error) {
            Reject(error);
        }

    })
}

//Zipar arquivos
aux['opc']['zipFD'] = (Peer, Data) => {
    return new Promise(async (Resolv, Reject) => {
        try {
            let zip7;
            zip7 = spawn(sys.bin.zip, ['a', '-t7z', `${Data['dir']}${Data['zip7name']}.7z`].concat(Data['files']));
            zip7.stdout.on('data', (data) => {
                //console.log(`stdout: ${data}`);
            });

            zip7.stderr.on('data', (dataerr) => {
                //console.error(`stderr: ${data}`);
                //resolv(null);
                //sys.errLog(data);
                Reject(dataerr);
            });

            zip7.on('close', async (code) => {
                Resolv({
                    type: "success",
                    msg: "Successfully compressed file!"
                });
            });
        } catch (error) {
            Reject(error);
        }
    })
}

//Deletar arquivos
aux['opc']['deletFiles'] = (Peer, Data) => {
    return new Promise(async (Resolv, Reject) => {
        try {
            for (let cont = 0; cont < Data['files'].length; cont++) {
                if (fs.lstatSync(Data['files'][cont]).isDirectory()) {
                    fs.rmSync(Data['files'][cont], { recursive: true, force: true });
                } else {
                    fs.unlinkSync(Data['files'][cont]);
                }
            }
            Resolv(await aux['opc']['ls'](null, Data['dir']));
        } catch (error) {
            Reject(error);
        }
    })
}

//Upload arquivo
aux['opc']['writeFile'] = (Peer, Data) => {
    return new Promise(async (Resolv, Reject) => {
        console.log("arquivos recebidos!");
        try {
            fs.writeFileSync(`${Data['dir']}${Data['name']}`, Data['base64'], { encoding: "base64" });

        } catch (error) {
            Reject(error);
        }

        //Remover thumbnail anterior caso tenha...
        try {
            fs.unlinkSync(`./temp/${MD5(`${Data['dir']}${Data['name']}`)}`);
        } catch (error) {
            //Arquivo não existe, fodasi
        }
        Resolv({
            type: "success",
            msg: `Successfully upload file! <br> ${Data['dir']}${Data['name']}`
        });
    })
}

//Obter image video para edição
aux['opc']['getImgVideoEdit'] = (Peer, Data) => {
    return new Promise(async (Resolv, Reject) => {
        try {
            Resolv({
                file: Data['file'],
                base64: await getThumbnail(Data['file'], true)
            })
        } catch (error) {
            Reject(error);
        }
    })
}

//Copiar e mover arquivos
aux['opc']['filesCopMov'] = (Peer, Data) => {
    return new Promise(async (Resolv, Reject) => {
        for (let cont = 0, fileDest; cont < Data['files'].length; cont++) {
            fileDest = Data['files'][cont].split("/");
            //Is a folder? /media/files/
            if (fileDest[fileDest.length - 1] == "") {
                fileDest = fileDest[fileDest.length - 2]; //Name dir
            } else {
                fileDest = fileDest[fileDest.length - 1]; //Name file
            }

            try {
                //FALSE = Move, TRUE= Copy
                if (Data['type']) {
                    fs.copyFileSync(Data['files'][cont], `${Data['dir']}${fileDest}`);
                } else {
                    //If Data['rename']==null? Então vamos mover : renomar
                    fs.renameSync(Data['files'][cont], `${Data['dir']}${Data['rename'] == undefined ? fileDest : Data['rename']}`)
                }
            } catch (error) {
                Reject(error);
            }
        };
        Resolv(await aux['opc']['ls'](null, Data['dir']));
    })
}

//Ler arquivo
aux['opc']['getFile'] = (Peer, Data) => {
    return new Promise((Resolv, Reject) => {
        try {
            let reader = fs.readFileSync(Data.file, { encoding: Data.encoding });
            Resolv({ file: reader });
        } catch (error) {
            Reject(error);
        }

    })
}

//Criar pasta
aux['opc']['mkdir'] = async (Peer, Data) => {
    return new Promise(async (Resolv, Reject) => {
        try {
            //Criar diretorio
            if (!fs.existsSync(`${Data['dir']}${Data['newFolder']}`)) {
                fs.mkdirSync(`${Data['dir']}${Data['newFolder']}`);
            } else {
                Reject({
                    opc: "alert",
                    data: {
                        type: "warning",
                        msg: "Folder already exists with that name!"
                    }
                })
            }
            Resolv(await aux['opc']['ls'](null, Data['dir']));
        } catch (error) {
            Reject(error);
        }
    })

}

//Lista arquivos no diretorio
aux['opc']['ls'] = (Peer, Data) => {
    return new Promise(async (Resolv, Reject) => {
        try {
            sys.clearTemporario();
            //Lista diretorio
            if (Data == undefined || Data == null || Data == "") {
                Data = __dirname + "/";
                Data = (Data).split("\\").join("/")
            }
            let files,
                filesSize = new Array();
            try {
                files = fs.readdirSync(Data);
            } catch (error) {
                Data = (__dirname).split("\\").join("/") + "/";
                files = fs.readdirSync(Data);
            }
            for (let cont = 0; cont < files.length; cont++) {
                filesSize.push({
                    name: files[cont],
                    isDir: fs.lstatSync(Data + '/' + files[cont]).isDirectory(),
                    size: fs.lstatSync(Data + '/' + files[cont]).isDirectory() ? 0 : fs.statSync(Data + '/' + files[cont]).size,
                    thumbnail: await getThumbnail(`${Data}${files[cont]}`)
                });
            }
            Resolv({
                dir: Data,
                files: filesSize
            });
        } catch (error) {
            Reject(error);
        }
    })
}






















function randMinMax(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
}
function MD5(d) { return rstr2hex(binl2rstr(binl_md5(rstr2binl(d), 8 * d.length))) } function rstr2hex(d) { for (var _, m = "0123456789ABCDEF", f = "", r = 0; r < d.length; r++)_ = d.charCodeAt(r), f += m.charAt(_ >>> 4 & 15) + m.charAt(15 & _); return f } function rstr2binl(d) { for (var _ = Array(d.length >> 2), m = 0; m < _.length; m++)_[m] = 0; for (m = 0; m < 8 * d.length; m += 8)_[m >> 5] |= (255 & d.charCodeAt(m / 8)) << m % 32; return _ } function binl2rstr(d) { for (var _ = "", m = 0; m < 32 * d.length; m += 8)_ += String.fromCharCode(d[m >> 5] >>> m % 32 & 255); return _ } function binl_md5(d, _) { d[_ >> 5] |= 128 << _ % 32, d[14 + (_ + 64 >>> 9 << 4)] = _; for (var m = 1732584193, f = -271733879, r = -1732584194, i = 271733878, n = 0; n < d.length; n += 16) { var h = m, t = f, g = r, e = i; f = md5_ii(f = md5_ii(f = md5_ii(f = md5_ii(f = md5_hh(f = md5_hh(f = md5_hh(f = md5_hh(f = md5_gg(f = md5_gg(f = md5_gg(f = md5_gg(f = md5_ff(f = md5_ff(f = md5_ff(f = md5_ff(f, r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 0], 7, -680876936), f, r, d[n + 1], 12, -389564586), m, f, d[n + 2], 17, 606105819), i, m, d[n + 3], 22, -1044525330), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 4], 7, -176418897), f, r, d[n + 5], 12, 1200080426), m, f, d[n + 6], 17, -1473231341), i, m, d[n + 7], 22, -45705983), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 8], 7, 1770035416), f, r, d[n + 9], 12, -1958414417), m, f, d[n + 10], 17, -42063), i, m, d[n + 11], 22, -1990404162), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 12], 7, 1804603682), f, r, d[n + 13], 12, -40341101), m, f, d[n + 14], 17, -1502002290), i, m, d[n + 15], 22, 1236535329), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 1], 5, -165796510), f, r, d[n + 6], 9, -1069501632), m, f, d[n + 11], 14, 643717713), i, m, d[n + 0], 20, -373897302), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 5], 5, -701558691), f, r, d[n + 10], 9, 38016083), m, f, d[n + 15], 14, -660478335), i, m, d[n + 4], 20, -405537848), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 9], 5, 568446438), f, r, d[n + 14], 9, -1019803690), m, f, d[n + 3], 14, -187363961), i, m, d[n + 8], 20, 1163531501), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 13], 5, -1444681467), f, r, d[n + 2], 9, -51403784), m, f, d[n + 7], 14, 1735328473), i, m, d[n + 12], 20, -1926607734), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 5], 4, -378558), f, r, d[n + 8], 11, -2022574463), m, f, d[n + 11], 16, 1839030562), i, m, d[n + 14], 23, -35309556), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 1], 4, -1530992060), f, r, d[n + 4], 11, 1272893353), m, f, d[n + 7], 16, -155497632), i, m, d[n + 10], 23, -1094730640), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 13], 4, 681279174), f, r, d[n + 0], 11, -358537222), m, f, d[n + 3], 16, -722521979), i, m, d[n + 6], 23, 76029189), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 9], 4, -640364487), f, r, d[n + 12], 11, -421815835), m, f, d[n + 15], 16, 530742520), i, m, d[n + 2], 23, -995338651), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 0], 6, -198630844), f, r, d[n + 7], 10, 1126891415), m, f, d[n + 14], 15, -1416354905), i, m, d[n + 5], 21, -57434055), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 12], 6, 1700485571), f, r, d[n + 3], 10, -1894986606), m, f, d[n + 10], 15, -1051523), i, m, d[n + 1], 21, -2054922799), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 8], 6, 1873313359), f, r, d[n + 15], 10, -30611744), m, f, d[n + 6], 15, -1560198380), i, m, d[n + 13], 21, 1309151649), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 4], 6, -145523070), f, r, d[n + 11], 10, -1120210379), m, f, d[n + 2], 15, 718787259), i, m, d[n + 9], 21, -343485551), m = safe_add(m, h), f = safe_add(f, t), r = safe_add(r, g), i = safe_add(i, e) } return Array(m, f, r, i) } function md5_cmn(d, _, m, f, r, i) { return safe_add(bit_rol(safe_add(safe_add(_, d), safe_add(f, i)), r), m) } function md5_ff(d, _, m, f, r, i, n) { return md5_cmn(_ & m | ~_ & f, d, _, r, i, n) } function md5_gg(d, _, m, f, r, i, n) { return md5_cmn(_ & f | m & ~f, d, _, r, i, n) } function md5_hh(d, _, m, f, r, i, n) { return md5_cmn(_ ^ m ^ f, d, _, r, i, n) } function md5_ii(d, _, m, f, r, i, n) { return md5_cmn(m ^ (_ | ~f), d, _, r, i, n) } function safe_add(d, _) { var m = (65535 & d) + (65535 & _); return (d >> 16) + (_ >> 16) + (m >> 16) << 16 | 65535 & m } function bit_rol(d, _) { return d << _ | d >>> 32 - _ }
