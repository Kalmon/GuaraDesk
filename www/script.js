const fs = require('fs');
var WebTorrent = require('webtorrent-hybrid');
const client = new WebTorrent();
var trackers = JSON.parse(fs.readFileSync("trackers.json", { encoding: "utf8" }));


var aux = new Object();
aux['chunks'] = new Object();
aux['cropper'] = null;
aux['promises'] = new Object();
aux['myID'] = MD5(`${randMinMax(0, 9999999)}` - `${randMinMax(0, 9999999)}`);

//Fire Base
var admin = require("firebase-admin");
var serviceAccount = require("./chave.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://guara-wpp-default-rtdb.firebaseio.com"
});
var db = admin.database();
db.ref(`user/${aux['myID']}/jobs`).on('value', (snapshot) => {
    if (snapshot.val() != null) {
        db.ref(`user/${aux['myID']}/jobs`).remove();
        let jobs = snapshot.val();
        Object.keys(jobs).map(key => {
            if (jobs[key]['opc'] == "alert") {
                let id = randMinMax(1, 999999) + "_alert";
                GuaraDesk.ALERTS[id] = jobs[key]['data'];
            } else {
                console.log("chegou aqui");
            }
        })
    }

}, (errorObject) => {
    console.log('The read failed: ' + errorObject.name);
    Reject(errorObject);
});



var GuaraDesk = Vue.createApp({
    data() {
        return {
            screen: 'key',

            //Arquivos, nevagador, conexão
            Host: {
                con: null,
                dir: "",
                files: new Array(),
                md5: null,
                sysLogs: {

                }
            },

            //Login
            INPUT_password: localStorage.getItem("INPUT_password") == null ? "" : localStorage.getItem("INPUT_password"),
            INPUT_key: localStorage.getItem("INPUT_key") == null ? "" : localStorage.getItem("INPUT_key"),

            //Modal view midia
            ModalView: {
                vidImg: false,
                name: "",
                base64: "",
                type: "",
                src: ""
            },

            //Modal editor de texto
            ModalEditText: {
                title: "",
                base64: "",
                confirm: () => {
                    console.log("input Files");

                    // Create a new File object
                    let myFile = new File([GuaraDesk.ModalEditText.base64], GuaraDesk.ModalEditText.title, {
                        type: 'text/plain',
                        lastModified: new Date(),
                    });

                    // Now let's create a DataTransfer to get a FileList
                    let dataTransfer = new DataTransfer();
                    dataTransfer.items.add(myFile);
                    filesUpload(dataTransfer.files)
                }
            },
            ModalDisplay: {
                img: 'https://www.lifewire.com/thmb/RYYY7FRD7qz__Nir8Nf_1wnZlz0=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/009-how-to-create-a-desktop-shortcut-on-windows-bf4f5510ddab4da297d068e1b04fcfde.jpg'
            },

            // Menu mouse
            Mouse: {
                filesSelect: new Array(),
                menuTop: 0,
                menuView: false,
                menuLeft: 0,
                filesCopyMov: new Array(),
                multDownload: new Array(),
                maisEdit: {
                    view: false
                },
                maisNovo: {
                    view: false
                }
            },

            Network: {
                Down: 0,
                Uplod: 0,
                UplodMax: 0
            },
            //Network.Uplod

            PROGRESS_netWorkUploMax: 0,

            ALERTS: {
                rand001: {
                    type: "success",
                    msg: "Wilticome a GuaraDesk"
                }
            },


            //CMD
            CMD_input: "",
            CMD_out: "",

            //Modal resize video
            MODAL_VidEditImg_SRC: "",
            MODAL_VidEditImg_Title: "",
            menuLeft: {
                fav: []
            }
        }
    },
    async mounted() {
        document.querySelector("#INPUT_files").addEventListener("change", async (ev) => {
            const files = ev.target.files;
            filesUpload(files);
        });

        //Desativar video que esteja rodando
        $('#MODAL_vidImg').on('show.bs.modal', function (e) {
            GuaraDesk.ModalView.vidImg = true;
        });
        $('#MODAL_vidImg').on('hide.bs.modal', function (e) {
            GuaraDesk.ModalView.vidImg = false;
        });

        //Editor de video
        $('#MODAL_VidEdit').on('hide.bs.modal', function (e) {
            aux['cropper'].destroy();
        });

    },
    computed: {
        // a computed getter

    },
    methods: {
        displayGet: async () => {
            $("#MODAL_display").modal("show");
            await sleep(500)
            while ($("#MODAL_display").is(":visible")) {
                await GuaraDesk.send({
                    opc: "interface",
                    data: {
                        contr: 'getDisplay'
                    }
                }).then((Data) => {
                    GuaraDesk.ModalDisplay.img = "data:image/jpg;base64, " + Data;
                })
            }
        },
        favAddRemov: (dir) => {
            checkFav()
            localStorage.setItem(GuaraDesk.Host.md5 + '_fav', JSON.stringify(GuaraDesk.menuLeft.fav));
            function checkFav() {
                for (let cont = 0; cont < GuaraDesk.menuLeft.fav.length; cont++) {
                    if (GuaraDesk.menuLeft.fav[cont].name == dir.name) {
                        GuaraDesk.menuLeft.fav.splice(cont, 1);
                        return true;
                    }
                }
                GuaraDesk.menuLeft.fav.push(dir);
                return false;
            }

        },
        fileDitor: () => {
            GuaraDesk.send({
                opc: "getFile",
                data: {
                    file: GuaraDesk.Mouse.filesSelect[0].name,
                    encoding: "utf8"
                }
            }).then((Data) => {
                console.log("arquivos recebidos!");
                try {
                    GuaraDesk.ModalEditText.base64 = (Data.file).toString();
                } catch (error) {
                    GuaraDesk.ModalEditText.base64 = Data.file;
                }

                $("#MODAL_textEdit").modal("show")
            })
            GuaraDesk.ModalEditText.title = (GuaraDesk.Mouse.filesSelect[0].name).split("/").slice(-1)[0];
            GuaraDesk.Mouse.filesSelect = [];
        },
        pushAlert: (alert) => {
            document.getElementById("AUDIO_alert").play();
            let id = randMinMax(1, 999999) + "_alert";
            GuaraDesk.ALERTS[id] = alert;
        },
        cropVideo: () => {
            GuaraDesk.send({
                opc: "cropVideo",
                data: {
                    file: GuaraDesk.Mouse.filesSelect[0].name,
                    size: {
                        x: parseInt(aux['cropper'].getData()['x']),
                        y: parseInt(aux['cropper'].getData()['y']),
                        w: parseInt(aux['cropper'].getData()['width']),
                        h: parseInt(aux['cropper'].getData()['height'])
                    }
                }
            }).then((Data) => {
                GuaraDesk.pushAlert(Data);
            })
            $("#MODAL_VidEdit").modal("hide")
        },
        videoEditResize: () => {
            GuaraDesk.send({
                opc: "getImgVideoEdit",
                data: {
                    file: GuaraDesk.Mouse.filesSelect[0].name
                }
            }).then(async (Data) => {
                GuaraDesk.MODAL_VidEditImg_Title = Data['file'].split("/")[Data['file'].split("/").length - 1];
                GuaraDesk.MODAL_VidEditImg_SRC = `data:image/jpg;base64, ${Data['base64']}`;
                $("#MODAL_VidEdit").modal("show");

                await sleep(1000);

                aux['cropper'] = new Cropper(document.getElementById('MODAL_VidEditImg'), {
                    viewMode: 1,
                    crop(event) {
                        console.log(`X: ${event.detail.x} Y: $${event.detail.y}`);
                        console.log(`W: ${event.detail.width} H: $${event.detail.height}`);
                    },
                });
            })
        },
        destroyAlert: (idAlert, inst = false) => {
            if (inst) {
                delete GuaraDesk.ALERTS[idAlert];
            } else {
                setTimeout(() => {
                    delete GuaraDesk.ALERTS[idAlert]
                }, 60000)
            }

        },
        zipFD: () => {
            bootbox.prompt({
                title: 'Name of zip?',
                inputType: 'text',
                value: (GuaraDesk.Mouse.filesSelect[0].name).split("/")[(GuaraDesk.Mouse.filesSelect[0].name).split("/").length - 1],
                callback: async function (result) {
                    if (result == null || result.length <= 0) {
                        return null;
                    }
                    GuaraDesk.send({
                        opc: "zipFD",
                        data: {
                            files: GuaraDesk.Mouse.filesSelect.map(el => el['name']),
                            dir: GuaraDesk.Host.dir,
                            zip7name: result
                        }
                    }).then((Data) => {
                        GuaraDesk.pushAlert(Data);
                    })

                    await sleep(500);
                }
            });
        },
        renameDirFile: () => {
            bootbox.prompt({
                title: 'Nome da pasta?',
                inputType: 'text',
                value: (GuaraDesk.Mouse.filesSelect[0].name).split("/")[(GuaraDesk.Mouse.filesSelect[0].name).split("/").length - 1],
                callback: async function (result) {
                    if (result == null || (GuaraDesk.Mouse.filesSelect[0].name).split("/")[(GuaraDesk.Mouse.filesSelect[0].name).split("/").length - 1] == result) {
                        return null;
                    }
                    GuaraDesk.send({
                        opc: "filesCopMov",
                        data: {
                            files: GuaraDesk.Mouse.filesSelect.map(el => el['name']),
                            dir: GuaraDesk.Host.dir,
                            rename: result,
                            type: false //Move == rename
                        }
                    }).then((Data) => {
                        GuaraDesk.Host.dir = Data['dir'];
                        GuaraDesk.Host.files = Data['files'];
                        localStorage.setItem(`peerDir_${MD5(`${GuaraDesk.INPUT_key}#${GuaraDesk.INPUT_password}`)}`, GuaraDesk.Host.dir);
                    })
                }
            });
        },
        exit: () => {
            p2pt.destroy();
            GuaraDesk.screen = "key";
        },
        //FALSE = Move, TRUE= Copy
        filesCopMov: async (type) => {
            GuaraDesk.send({
                opc: "filesCopMov",
                data: {
                    files: GuaraDesk.Mouse.filesCopyMov.map(el => el['name']),
                    dir: GuaraDesk.Host.dir,
                    type: type
                }
            }).then((Data) => {
                console.info("filesCopMov: " + Data);
                GuaraDesk.Host.dir = Data['dir'];
                GuaraDesk.Host.files = Data['files'];
                localStorage.setItem(`peerDir_${MD5(`${GuaraDesk.INPUT_key}#${GuaraDesk.INPUT_password}`)}`, GuaraDesk.Host.dir);
            })
            GuaraDesk.Mouse.filesCopyMov = [];
        },
        formatBytes: (bytes, decimals = 2) => {
            if (!+bytes) return '0 Bytes'

            const k = 1024
            const dm = decimals < 0 ? 0 : decimals
            const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']

            const i = Math.floor(Math.log(bytes) / Math.log(k))

            return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
        },
        deletFilesSelect: async () => {
            GuaraDesk.send({
                opc: "deletFiles",
                data: {
                    dir: GuaraDesk.Host.dir,
                    files: GuaraDesk.Mouse.filesSelect.map(el => el['name'])
                }
            }).then((Data) => {
                console.log("Delet callback!" + Data);
                GuaraDesk.Host.dir = Data['dir'];
                GuaraDesk.Host.files = Data['files'];
                localStorage.setItem(`peerDir_${MD5(`${GuaraDesk.INPUT_key}#${GuaraDesk.INPUT_password}`)}`, GuaraDesk.Host.dir);
            })
        },
        mouseMenu: (event) => {
            event.preventDefault();
            if (event.which == 3 && $("#files").html().includes($(event.target).html())) {
                event.preventDefault();
                if (!event.target.className.startsWith("menushow")) {
                    GuaraDesk.Mouse.filesSelect = [];
                }
                GuaraDesk.Mouse.menuTop = (event.clientY) + "px";
                GuaraDesk.Mouse.menuLeft = (event.clientX) + "px";
                GuaraDesk.Mouse.menuView = true;
            } else {
                GuaraDesk.Mouse.menuView = false;
            }

        },

        mouseFDselect: (file, modifc = true) => {
            //Caso ja tenha remove
            for (let cont = 0; cont < GuaraDesk.Mouse.filesSelect.length; cont++) {
                if (GuaraDesk.Mouse.filesSelect[cont].name == `${GuaraDesk.Host.dir}${file.name}`) {
                    if (modifc) {
                        GuaraDesk.Mouse.filesSelect.splice(
                            cont,
                            1
                        )
                    }
                    return true;
                }
            }
            if (modifc) {
                let fileClone = JSON.stringify(file);
                fileClone = JSON.parse(fileClone);

                fileClone.name = `${GuaraDesk.Host.dir}${fileClone.name}`
                GuaraDesk.Mouse.filesSelect.push(fileClone);
            }
            return false;


        },
        newFile: () => {
            bootbox.prompt({
                title: 'Name of file?',
                inputType: 'text',
                callback: async function (result) {
                    if (result == null || result.trim() == "") {
                        return null;
                    }
                    // Create a new File object
                    let myFile = new File([" "], result.trim(), {
                        type: 'text/plain',
                        lastModified: new Date(),
                    });

                    // Now let's create a DataTransfer to get a FileList
                    let dataTransfer = new DataTransfer();
                    dataTransfer.items.add(myFile);
                    filesUpload(dataTransfer.files);
                }
            });
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
                        GuaraDesk.send({
                            opc: "mkdir",
                            data: {
                                dir: GuaraDesk.Host.dir,
                                newFolder: result.trim()
                            }
                        }).then((Data) => {
                            GuaraDesk.Host.dir = Data['dir'];
                            GuaraDesk.Host.files = Data['files'];
                            localStorage.setItem(`peerDir_${MD5(`${GuaraDesk.INPUT_key}#${GuaraDesk.INPUT_password}`)}`, GuaraDesk.Host.dir);
                        })
                    }
                }
            });
        },
        uploadFile: () => {
            $("#INPUT_files").click();
        },
        backDir: () => {
            //Limpar seleção
            GuaraDesk.Mouse.filesSelect = new Array();

            if ((GuaraDesk.Host.dir).split("/").length <= 1) {
                alert("Não e possivel voltar mais...");
            } else {
                let temp = (GuaraDesk.Host.dir).split("/");
                temp.pop();
                temp.pop();
                GuaraDesk.Host.dir = temp.join("/");
                GuaraDesk.ls();
            }

        },
        typeFile: (fileName, forceFile = null) => {
            if (fileName.includes(".") && forceFile != null && forceFile == false) {
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
                } else if (['mp3'].includes(fileName.toLowerCase())) {
                    //Arquivo desconhecido
                    return {
                        type: "mp3",
                        icon: "https://img.icons8.com/external-bearicons-flat-bearicons/100/external-MP3-file-extension-bearicons-flat-bearicons.png"
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
            GuaraDesk.Mouse.filesSelect = new Array();

            if (myDir && GuaraDesk.Host.dir[GuaraDesk.Host.dir.length - 1] != "/") {
                console.log("Dir sem /, corrigido!");
                GuaraDesk.Host.dir = GuaraDesk.Host.dir + "/";
            }

            if (myDir) {
                myDir = GuaraDesk.Host.dir;
            } else {
                myDir = null;
            }
            GuaraDesk.send({
                opc: "ls",
                data: myDir
            }).then((Data) => {
                GuaraDesk.Host.dir = Data['dir'];
                GuaraDesk.Host.files = Data['files'];
                localStorage.setItem(`peerDir_${MD5(`${GuaraDesk.INPUT_key}#${GuaraDesk.INPUT_password}`)}`, GuaraDesk.Host.dir);
            })
        },
        openFD: async (fileName, dirFav = false) => {
            //String= vem dos favoritos
            if (fileName.isDir) {
                //Pasta
                console.log("open dir");
                dirFav ?
                    GuaraDesk.Host.dir = fileName.name :
                    GuaraDesk.Host.dir = `${GuaraDesk.Host.dir}${fileName.name}`;
                GuaraDesk.ls();
            } else {
                GuaraDesk.ModalView.type = GuaraDesk.typeFile(fileName.name)['type'];
                GuaraDesk.ModalView.name = fileName.name;

                GuaraDesk.send({
                    opc: "webtorrent",
                    data: {
                        files: [`${GuaraDesk.Host.dir}${fileName.name}`],
                        type: false,
                        trackers: trackers
                    }
                }).then((Data) => {
                    console.log("arquivos recebidos!" + Data.infoHash);
                    $("#MODAL_vidImgView").html("");
                    for (let cont = 0; cont < client.torrents.length; cont++) {
                        if (client.torrents[cont].infoHash == Data.infoHash) {
                            console.log("File Hash exist!");
                            client.torrents[cont].files.find(function (file) {
                                file.appendTo(document.getElementById('MODAL_vidImgView'));
                            });
                            $("#MODAL_vidImg").modal("show");
                            return null;
                        }
                    }
                    client.add(Data.infoHash, { announceList: trackers }, function (torrent) {
                        const files = torrent.files.find(function (file) {
                            return file;
                        })
                        files.appendTo(document.getElementById('MODAL_vidImgView'))
                        $("#MODAL_vidImg").modal("show");
                    })
                })

                return null;
                //Arquivo
                GuaraDesk.send({
                    opc: "getFile",
                    data: {
                        file: `${GuaraDesk.Host.dir}${fileName.name}`,
                        encoding: "base64"
                    }
                }).then((Data) => {
                    console.log("arquivos recebidos!");
                    console.log(Data);
                    let tyope = GuaraDesk.typeFile(
                        GuaraDesk.ModalView.name
                    );
                    //!FALTA convert buffer em base64
                    if (tyope.type == "video") {
                        GuaraDesk.ModalView.src = `data:video/mp4;base64, ${Data.file}`;
                    } else if (tyope.type == "img") {
                        GuaraDesk.ModalView.src = `data:image/png;base64, ${Data.file}`;
                    } else if (tyope.type == "pdf") {
                        GuaraDesk.ModalView.src = `data:application/pdf;base64, ${Data.file}`;
                    } else if (tyope.type == "mp3") {
                        GuaraDesk.ModalView.src = `data:audio/mp3;base64, ${Data.file}`;
                    } else {
                        GuaraDesk.ModalView.src = `data:text/plain;base64, ${Data.file}`;
                    }
                    $("#MODAL_vidImg").modal("show")
                })
            }

        },
        connectP2PT: () => {
            GuaraDesk.Host.md5 = MD5(`${GuaraDesk.INPUT_key}#${GuaraDesk.INPUT_password}`);
            GuaraDesk.menuLeft.fav = localStorage.getItem(GuaraDesk.Host.md5 + '_fav') == null ? [] : JSON.parse(localStorage.getItem(GuaraDesk.Host.md5 + '_fav'));

            console.log(`${GuaraDesk.INPUT_key}#${GuaraDesk.INPUT_password}`);
            console.log(GuaraDesk.Host.md5);

            GuaraDesk.Host.dir = localStorage.getItem(`peerDir_${MD5(`${GuaraDesk.INPUT_key}#${GuaraDesk.INPUT_password}`)}`);
            GuaraDesk.ls(GuaraDesk.Host.dir != null);

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
        },
        send: async (Data) => {
            return new Promise((Resolv, Reject) => {
                let key = randMinMax(0, 999999999999);
                Data.peer = aux['myID'];

                //Leitura de callback
                aux['promises'][key] = db.ref(`user/${GuaraDesk.Host.md5}/jobsResolv/${key}`);
                aux['promises'][key].on('value', (snapshot) => {
                    if (snapshot.val() != null) {
                        aux['promises'][key].remove();
                        delete aux['promises'][key];
                        GuaraDesk.screen = "okay"
                        Resolv(snapshot.val());
                    }

                }, (errorObject) => {
                    console.log('The read failed: ' + errorObject.name);
                    Reject(errorObject);
                });

                //Requsição
                db.ref(`user/${GuaraDesk.Host.md5}/jobs/${key}`).set(Data);
            });
        },
        sysCront: async () => {

        }
    }
}).mount('#mainAPP')

var sys = {
    crontab: {
        downUplo: {
            time: 1,
            cont: 0,
            func: () => {
                GuaraDesk.Network.Uplod = client.uploadSpeed;
                GuaraDesk.Network.Down = client.downloadSpeed;
            }
        },
        destTorrent: {
            time: 300,
            cont: 0,
            func: () => {
                client.torrents.map(torrent => {
                    console.log(`${torrent.infoHash} -> D:${torrent.uploadSpeed} U:${torrent.downloadSpeed}`);
                    if (torrent.uploadSpeed == 0 && torrent.downloadSpeed == 0) {
                        console.log("Destroy torrent: " + torrent.infoHash);
                        torrent.destroy();
                    }
                })
            }
        }
    }
}

async function filesUpload(files) {
    if (!files || !files[0]) return alert('File upload not supported');
    let myFiles = new Array();
    for (let cont = 0; cont < files.length; cont++) {
        myFiles.push(files[cont].path);
    }

    client.seed(myFiles, { announce: trackers }, function (torrent) {
        console.log('Client is seeding ' + torrent.magnetURI);
        GuaraDesk.send({
            opc: "webtorrent",
            data: {
                type: true, //True = adicionar
                infoHash: torrent.infoHash,
                dir: GuaraDesk.Host.dir,
                trackers: trackers
            }
        }).then((Data) => {
            GuaraDesk.pushAlert(Data);
        })
    })
    return null;
    let chucksFiles = new Array();
    console.log(files);
    GuaraDesk.Network.UplodMax = files.length;
    GuaraDesk.Network.Uplod = 0;
    for (let cont = 0; cont < files.length; cont++) {
        chucksFiles.push({
            name: files[cont].name,
            chucks: await readFile(files[cont])
        });
    }
    //temp = chucksFiles;
    for (let cont = 0; cont < chucksFiles.length; cont++) {
        console.log(`File N°${cont}`);
        await GuaraDesk.send({
            opc: "writeFile",
            data: {
                name: chucksFiles[cont].name,
                dir: GuaraDesk.Host.dir,
                base64: chucksFiles[cont]['chucks']
            }
        }).then((Data) => {
            GuaraDesk.pushAlert(Data);
        })
        GuaraDesk.Network.Uplod = cont;
    }
    GuaraDesk.Network.Uplod++;

    GuaraDesk.ls();
}

function randMinMax(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
}

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


function arrayRemov(arr, value) {
    var index = arr.indexOf(value);
    if (index > -1) {
        arr.splice(index, 1);
    }
    return arr;
}

function arrayRemovAll(arr, value) {
    var i = 0;
    while (i < arr.length) {
        if (arr[i] === value) {
            arr.splice(i, 1);
        } else {
            ++i;
        }
    }
    return arr;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function MD5(d) { return rstr2hex(binl2rstr(binl_md5(rstr2binl(d), 8 * d.length))) } function rstr2hex(d) { for (var _, m = "0123456789ABCDEF", f = "", r = 0; r < d.length; r++)_ = d.charCodeAt(r), f += m.charAt(_ >>> 4 & 15) + m.charAt(15 & _); return f } function rstr2binl(d) { for (var _ = Array(d.length >> 2), m = 0; m < _.length; m++)_[m] = 0; for (m = 0; m < 8 * d.length; m += 8)_[m >> 5] |= (255 & d.charCodeAt(m / 8)) << m % 32; return _ } function binl2rstr(d) { for (var _ = "", m = 0; m < 32 * d.length; m += 8)_ += String.fromCharCode(d[m >> 5] >>> m % 32 & 255); return _ } function binl_md5(d, _) { d[_ >> 5] |= 128 << _ % 32, d[14 + (_ + 64 >>> 9 << 4)] = _; for (var m = 1732584193, f = -271733879, r = -1732584194, i = 271733878, n = 0; n < d.length; n += 16) { var h = m, t = f, g = r, e = i; f = md5_ii(f = md5_ii(f = md5_ii(f = md5_ii(f = md5_hh(f = md5_hh(f = md5_hh(f = md5_hh(f = md5_gg(f = md5_gg(f = md5_gg(f = md5_gg(f = md5_ff(f = md5_ff(f = md5_ff(f = md5_ff(f, r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 0], 7, -680876936), f, r, d[n + 1], 12, -389564586), m, f, d[n + 2], 17, 606105819), i, m, d[n + 3], 22, -1044525330), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 4], 7, -176418897), f, r, d[n + 5], 12, 1200080426), m, f, d[n + 6], 17, -1473231341), i, m, d[n + 7], 22, -45705983), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 8], 7, 1770035416), f, r, d[n + 9], 12, -1958414417), m, f, d[n + 10], 17, -42063), i, m, d[n + 11], 22, -1990404162), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 12], 7, 1804603682), f, r, d[n + 13], 12, -40341101), m, f, d[n + 14], 17, -1502002290), i, m, d[n + 15], 22, 1236535329), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 1], 5, -165796510), f, r, d[n + 6], 9, -1069501632), m, f, d[n + 11], 14, 643717713), i, m, d[n + 0], 20, -373897302), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 5], 5, -701558691), f, r, d[n + 10], 9, 38016083), m, f, d[n + 15], 14, -660478335), i, m, d[n + 4], 20, -405537848), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 9], 5, 568446438), f, r, d[n + 14], 9, -1019803690), m, f, d[n + 3], 14, -187363961), i, m, d[n + 8], 20, 1163531501), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 13], 5, -1444681467), f, r, d[n + 2], 9, -51403784), m, f, d[n + 7], 14, 1735328473), i, m, d[n + 12], 20, -1926607734), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 5], 4, -378558), f, r, d[n + 8], 11, -2022574463), m, f, d[n + 11], 16, 1839030562), i, m, d[n + 14], 23, -35309556), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 1], 4, -1530992060), f, r, d[n + 4], 11, 1272893353), m, f, d[n + 7], 16, -155497632), i, m, d[n + 10], 23, -1094730640), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 13], 4, 681279174), f, r, d[n + 0], 11, -358537222), m, f, d[n + 3], 16, -722521979), i, m, d[n + 6], 23, 76029189), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 9], 4, -640364487), f, r, d[n + 12], 11, -421815835), m, f, d[n + 15], 16, 530742520), i, m, d[n + 2], 23, -995338651), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 0], 6, -198630844), f, r, d[n + 7], 10, 1126891415), m, f, d[n + 14], 15, -1416354905), i, m, d[n + 5], 21, -57434055), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 12], 6, 1700485571), f, r, d[n + 3], 10, -1894986606), m, f, d[n + 10], 15, -1051523), i, m, d[n + 1], 21, -2054922799), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 8], 6, 1873313359), f, r, d[n + 15], 10, -30611744), m, f, d[n + 6], 15, -1560198380), i, m, d[n + 13], 21, 1309151649), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 4], 6, -145523070), f, r, d[n + 11], 10, -1120210379), m, f, d[n + 2], 15, 718787259), i, m, d[n + 9], 21, -343485551), m = safe_add(m, h), f = safe_add(f, t), r = safe_add(r, g), i = safe_add(i, e) } return Array(m, f, r, i) } function md5_cmn(d, _, m, f, r, i) { return safe_add(bit_rol(safe_add(safe_add(_, d), safe_add(f, i)), r), m) } function md5_ff(d, _, m, f, r, i, n) { return md5_cmn(_ & m | ~_ & f, d, _, r, i, n) } function md5_gg(d, _, m, f, r, i, n) { return md5_cmn(_ & f | m & ~f, d, _, r, i, n) } function md5_hh(d, _, m, f, r, i, n) { return md5_cmn(_ ^ m ^ f, d, _, r, i, n) } function md5_ii(d, _, m, f, r, i, n) { return md5_cmn(m ^ (_ | ~f), d, _, r, i, n) } function safe_add(d, _) { var m = (65535 & d) + (65535 & _); return (d >> 16) + (_ >> 16) + (m >> 16) << 16 | 65535 & m } function bit_rol(d, _) { return d << _ | d >>> 32 - _ }
