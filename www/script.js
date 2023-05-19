var p2pt, temp = new Array();
var aux = new Object();
aux['chunks'] = new Object();
var mainVUE = Vue.createApp({
    data() {
        return {
            screen: 'key',
            INPUT_key: "",
            peerConnect: null,
            currentDIR: "",
            peerHost: null,
            peerFiles: new Array(),
            peerDir: "",

            //Modal Video -IMG
            MODAL_name: "VAZIO",
            MODAL_base64: "",
            MODAL_type: "",

            MOUSE_filesSelect: new Array(),
            MOUSE_menuTop: 0,
            MOUSE_menuLeft: 0,
            MOUSE_menuView: false,

            PROGRESS_netWork: 0,
        }
    },
    async mounted() {
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
        const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))

        document.querySelector("#INPUT_files").addEventListener("change", async (ev) => {
            const files = ev.target.files;
            if (!files || !files[0]) return alert('File upload not supported');
            let chucksFiles = new Array();
            console.log(files);
            for (let cont = 0; cont < files.length; cont++) {
                chucksFiles.push({
                    name: files[cont].name,
                    chucks: await readFile(files[cont])
                });
            }
            temp = chucksFiles;
            for (let cont = 0; cont < chucksFiles.length; cont++) {
                console.log(`File N°${cont}`);
                await p2pt.send(mainVUE.peerHost, {
                    opc: "writeFile",
                    data: {
                        name: chucksFiles[cont].name,
                        dir: mainVUE.peerDir,
                        base64: chucksFiles[cont]['chucks']
                    }
                })
            }

            mainVUE.ls();
        });

    },
    methods: {
        formatBytes: (bytes, decimals = 2)=>{
            if (!+bytes) return '0 Bytes'
        
            const k = 1024
            const dm = decimals < 0 ? 0 : decimals
            const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
        
            const i = Math.floor(Math.log(bytes) / Math.log(k))
        
            return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
        },
        deletFilesSelect: async () => {
            await p2pt.send(mainVUE.peerHost, {
                opc: "deletFiles",
                data: mainVUE.MOUSE_filesSelect
            })

            await sleep(500);
            mainVUE.ls();
        },
        mouseMenu: (event) => {
            event.preventDefault();
            //Right click
            console.log(event);
            if (event.which == 3) {
                console.log("show");
                mainVUE.MOUSE_menuTop = (event.clientY) + "px";
                mainVUE.MOUSE_menuLeft = (event.clientX) + "px";
                mainVUE.MOUSE_menuView = true;
            } else {
                mainVUE.MOUSE_menuView = false;
            }
        },

        mouseFDselect: (filename) => {
            //Caso ja tenha remove
            if (mainVUE.MOUSE_filesSelect.includes(`${mainVUE.peerDir}${filename}`)) {
                mainVUE.MOUSE_filesSelect.splice(
                    mainVUE.MOUSE_filesSelect.indexOf(`${mainVUE.peerDir}${filename}`),
                    1
                )
            } else {
                mainVUE.MOUSE_filesSelect.push(`${mainVUE.peerDir}${filename}`);
            }

        },
        newFolder: () => {
            bootbox.prompt({
                title: 'Nome da pasta?',
                inputType: 'text',
                callback: async function (result) {
                    if (result == null) {
                        return null;
                    }
                    if (result.includes(".")) {
                        alert("Não e permitido pontos.");
                    } else {
                        await p2pt.send(mainVUE.peerHost, {
                            opc: "mkdir",
                            data: {
                                dir: mainVUE.peerDir,
                                newFolder: result
                            }
                        })

                        await sleep(500);
                        mainVUE.ls();
                    }
                }
            });
        },
        uploadFile: () => {
            $("#INPUT_files").click();
        },
        backDir: () => {
            //Limpar seleção
            mainVUE.MOUSE_filesSelect = new Array();

            if ((mainVUE.peerDir).split("\\").length <= 1) {
                alert("Não e possivel voltar mais...");
            } else {
                let temp = (mainVUE.peerDir).split("\\");
                temp.pop();
                temp.pop();
                mainVUE.peerDir = temp.join("\\");
                mainVUE.ls();
            }

        },
        typeFile: (fileName, forceFile = null) => {
            if (fileName.includes(".") || (forceFile != null && forceFile == false)) {
                //Tem extenção
                fileName = fileName.split(".");
                fileName = fileName[fileName.length - 1];
                if (['png', 'jpg', 'jpge', 'jpeg', 'gif'].includes(fileName.toLowerCase())) {
                    return {
                        type: "img",
                        icon: "https://img.icons8.com/fluency/100/image.png"
                    };
                } else if (['mp4', 'mkv', 'avi'].includes(fileName.toLowerCase())) {
                    return {
                        type: "video",
                        icon: "https://img.icons8.com/fluency/48/video.png"
                    };
                } else if (['pdf'].includes(fileName.toLowerCase())) {
                    //Arquivo desconhecido
                    return {
                        type: "pdf",
                        icon: "https://img.icons8.com/color/100/pdf.png"
                    };
                } else {
                    //Arquivo desconhecido
                    return {
                        type: "file",
                        icon: "https://img.icons8.com/cute-clipart/100/file.png"
                    };
                }
            } else {
                return {
                    type: "pasta",
                    icon: "https://img.icons8.com/office/100/folder-invoices--v1.png"
                };
            }

        },
        ls: async (myDir = true) => {
            //Limpar seleção
            mainVUE.MOUSE_filesSelect = new Array();

            if (mainVUE.peerDir[mainVUE.peerDir.length - 1] != "\\") {
                console.log("Dir sem \\, corrigido!lll");
                mainVUE.peerDir = mainVUE.peerDir + "\\";
            }
            if (myDir) {
                await p2pt.send(mainVUE.peerHost, {
                    opc: "ls",
                    data: mainVUE.peerDir
                })
            } else {
                await p2pt.send(mainVUE.peerHost, {
                    opc: "ls",
                    data: null
                })
            }
        },
        openFD: async (fileName) => {
            if (fileName.isDir) {
                //Pasta
                console.log("open dir");
                mainVUE.peerDir = `${mainVUE.peerDir}${fileName.name}`;
                mainVUE.ls();
            } else {
                mainVUE.MODAL_type = mainVUE.typeFile(mainVUE.MODAL_name)['type'];
                mainVUE.MODAL_name = fileName.name;
                aux['chunks'][MD5(`${mainVUE.peerDir}\\${fileName.name}`)] = new Array();

                //Arquivo
                await p2pt.send(mainVUE.peerHost, {
                    opc: "getFile",
                    data: `${mainVUE.peerDir}\\${fileName.name}`
                });
            }

        },
        connectP2PT: () => {
            p2pt = new P2PT([
                "wss://tracker.openwebtorrent.com",
                "wss://tracker.btorrent.xyz"

            ], "guara-hos-files");
            p2pt.on('trackerconnect', (tracker) => {
                //console.log('TRACKET-CONNECT', tracker)
            })

            p2pt.on('trackerwarning', (tracker) => {
                //console.log('TRACKET-WARNING', tracker)
            })

            p2pt.on('peerconnect', (peer) => {
                console.log('PEER-CONNECT', peer)

            })

            //Uint8Array
            p2pt.on('data', (peer, data) => {
                console.log('Data', peer);
                console.log(data);
                mainVUE.PROGRESS_netWork += data.length;
            })

            p2pt.on('msg', async (peer, msg) => {
                console.log(msg);
                if (msg['type'] == "Buffer") {
                    temp.push(msg.data);
                } else {
                    if (msg['opc'] == "host") {
                        if (msg['data']) {
                            mainVUE.peerHost = peer;
                            mainVUE.screen = "ok";
                            await p2pt.send(peer, {
                                opc: "ls",
                                data: null
                            })
                        }
                    } else if (msg['opc'] == "ls") {
                        mainVUE.peerDir = msg['data']['dir'];
                        mainVUE.peerFiles = msg['data']['files'];
                    } else if (msg['opc'] == "getFile") {
                        console.log("arquivos recebidos!");
                        let tyope = mainVUE.typeFile(
                            (msg['data']['name']).split("\\")[(msg['data']['name']).split("\\").length - 1]
                        );
                        console.log("Tipo arquivo: " + tyope.type);
                        $("#MODAL_vidImg").modal("show")
                        //!FALTA convert buffer em base64
                        if (tyope.type == "video") {
                            console.log("video....");
                            $("#MODAL_video").attr("src",
                                `data:video/mp4;base64, ${msg['data']['base64']}`
                            )
                        } else if (tyope.type == "img") {
                            console.log("img....");
                            $("#MODAL_img").attr("src",
                                `data:image/png;base64, ${msg['data']['base64']}`
                            )
                            //window.URL.createObjectURL(new Blob(msg['data']))
                        } else if (tyope.type == "pdf") {
                            $("#MODAL_pdf").attr("src",
                                `data:application/pdf;base64, ${msg['data']['base64']}`
                            )
                            //window.URL.createObjectURL(new Blob(msg['data']))
                        } else {

                        }
                    }
                }
                //Evitar promissas
                return peer.respond('Bye');
            });

            console.log('P2PT started. My peer id : ' + p2pt._peerId)
            p2pt.start()
            setInterval(() => {
                if (mainVUE.peerHost == null) {
                    p2pt.requestMorePeers();
                }
            }, 5000);
            setInterval(() => {
                mainVUE.PROGRESS_netWork = 0;
            }, 1000);
        }
    }
}).mount('#mainAPP')

async function readFile(file) {
    return new Promise((resolv, reject) => {
        if (!file || !file) return;
        const FR = new FileReader();
        FR.addEventListener("load", function (evt) {
            //console.log(evt.target.result);
            let temp = (evt.target.result).split(",");
            resolv(temp[temp.length - 1]);
        });
        FR.readAsDataURL(file);
    })
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function MD5(d) { return rstr2hex(binl2rstr(binl_md5(rstr2binl(d), 8 * d.length))) } function rstr2hex(d) { for (var _, m = "0123456789ABCDEF", f = "", r = 0; r < d.length; r++)_ = d.charCodeAt(r), f += m.charAt(_ >>> 4 & 15) + m.charAt(15 & _); return f } function rstr2binl(d) { for (var _ = Array(d.length >> 2), m = 0; m < _.length; m++)_[m] = 0; for (m = 0; m < 8 * d.length; m += 8)_[m >> 5] |= (255 & d.charCodeAt(m / 8)) << m % 32; return _ } function binl2rstr(d) { for (var _ = "", m = 0; m < 32 * d.length; m += 8)_ += String.fromCharCode(d[m >> 5] >>> m % 32 & 255); return _ } function binl_md5(d, _) { d[_ >> 5] |= 128 << _ % 32, d[14 + (_ + 64 >>> 9 << 4)] = _; for (var m = 1732584193, f = -271733879, r = -1732584194, i = 271733878, n = 0; n < d.length; n += 16) { var h = m, t = f, g = r, e = i; f = md5_ii(f = md5_ii(f = md5_ii(f = md5_ii(f = md5_hh(f = md5_hh(f = md5_hh(f = md5_hh(f = md5_gg(f = md5_gg(f = md5_gg(f = md5_gg(f = md5_ff(f = md5_ff(f = md5_ff(f = md5_ff(f, r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 0], 7, -680876936), f, r, d[n + 1], 12, -389564586), m, f, d[n + 2], 17, 606105819), i, m, d[n + 3], 22, -1044525330), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 4], 7, -176418897), f, r, d[n + 5], 12, 1200080426), m, f, d[n + 6], 17, -1473231341), i, m, d[n + 7], 22, -45705983), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 8], 7, 1770035416), f, r, d[n + 9], 12, -1958414417), m, f, d[n + 10], 17, -42063), i, m, d[n + 11], 22, -1990404162), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 12], 7, 1804603682), f, r, d[n + 13], 12, -40341101), m, f, d[n + 14], 17, -1502002290), i, m, d[n + 15], 22, 1236535329), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 1], 5, -165796510), f, r, d[n + 6], 9, -1069501632), m, f, d[n + 11], 14, 643717713), i, m, d[n + 0], 20, -373897302), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 5], 5, -701558691), f, r, d[n + 10], 9, 38016083), m, f, d[n + 15], 14, -660478335), i, m, d[n + 4], 20, -405537848), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 9], 5, 568446438), f, r, d[n + 14], 9, -1019803690), m, f, d[n + 3], 14, -187363961), i, m, d[n + 8], 20, 1163531501), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 13], 5, -1444681467), f, r, d[n + 2], 9, -51403784), m, f, d[n + 7], 14, 1735328473), i, m, d[n + 12], 20, -1926607734), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 5], 4, -378558), f, r, d[n + 8], 11, -2022574463), m, f, d[n + 11], 16, 1839030562), i, m, d[n + 14], 23, -35309556), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 1], 4, -1530992060), f, r, d[n + 4], 11, 1272893353), m, f, d[n + 7], 16, -155497632), i, m, d[n + 10], 23, -1094730640), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 13], 4, 681279174), f, r, d[n + 0], 11, -358537222), m, f, d[n + 3], 16, -722521979), i, m, d[n + 6], 23, 76029189), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 9], 4, -640364487), f, r, d[n + 12], 11, -421815835), m, f, d[n + 15], 16, 530742520), i, m, d[n + 2], 23, -995338651), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 0], 6, -198630844), f, r, d[n + 7], 10, 1126891415), m, f, d[n + 14], 15, -1416354905), i, m, d[n + 5], 21, -57434055), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 12], 6, 1700485571), f, r, d[n + 3], 10, -1894986606), m, f, d[n + 10], 15, -1051523), i, m, d[n + 1], 21, -2054922799), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 8], 6, 1873313359), f, r, d[n + 15], 10, -30611744), m, f, d[n + 6], 15, -1560198380), i, m, d[n + 13], 21, 1309151649), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 4], 6, -145523070), f, r, d[n + 11], 10, -1120210379), m, f, d[n + 2], 15, 718787259), i, m, d[n + 9], 21, -343485551), m = safe_add(m, h), f = safe_add(f, t), r = safe_add(r, g), i = safe_add(i, e) } return Array(m, f, r, i) } function md5_cmn(d, _, m, f, r, i) { return safe_add(bit_rol(safe_add(safe_add(_, d), safe_add(f, i)), r), m) } function md5_ff(d, _, m, f, r, i, n) { return md5_cmn(_ & m | ~_ & f, d, _, r, i, n) } function md5_gg(d, _, m, f, r, i, n) { return md5_cmn(_ & f | m & ~f, d, _, r, i, n) } function md5_hh(d, _, m, f, r, i, n) { return md5_cmn(_ ^ m ^ f, d, _, r, i, n) } function md5_ii(d, _, m, f, r, i, n) { return md5_cmn(m ^ (_ | ~f), d, _, r, i, n) } function safe_add(d, _) { var m = (65535 & d) + (65535 & _); return (d >> 16) + (_ >> 16) + (m >> 16) << 16 | 65535 & m } function bit_rol(d, _) { return d << _ | d >>> 32 - _ }
