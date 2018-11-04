const WebSocket = require('ws');
const wss = new WebSocket.Server( { port : 8193 } );
console.log("Running game server on port " + wss.options.port)

const SERVER_PLAYING = -4
const SERVER_FULL = -3
const PLAYERLIST = -2;
const READY = -1;
const CONNECT = 0;
const TICK = 1;
const EXPLODE = 2;
const DEATH = 3;
const AMMO = 4;
const POWERUP = 5;
const DEAD = 6;

const HURT_SOUND = 8;

var playing = false;
var camerax = 0;
var cameravx = .5;
var difficulty = 0;

var ammoTimer = 100;
var powerupTimer = 100;
const AW = 32;
const AH = 32;
const PW = 49;
const PH = 32;


var f_ord = [];
var players = [];
var bombs = [];
var ammos = [];
var powerups = [];


var W = 768
var H = 512


wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(data) {
        data = JSON.parse(data);
        // console.log(data)
        if (data.type == CONNECT) {
            if (playing){
                console.log("Connection refused - already playing");
                ws.send(newPacket(SERVER_PLAYING, null))
                ws.close();
                return;
            } else if (wss.clients.size > 4){
                console.log("Connection refused - server full");
                ws.send(newPacket(SERVER_FULL, null))
                ws.close();
                return;
            }

            ws.id = wss.clients.size - 1;
            if (wss.clients.size);
            
            if (!data.obj.name || data.obj.name.trim().length === 0)
                data.obj.name = "(blank)"
            ws.name = data.obj.name;
            console.log("Connection:  " + ws._socket.remoteAddress);
            broadcastPlayerReadyList()
            return;
        } else if (data.type == READY) {
            ws.ready = data.obj;
            broadcastPlayerReadyList();
            
            if (allReady()){
                console.log("game start")
                playing = true;
                f_ord = generateFrameOrder();
                wss.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                        let startinfo = {
                            id: client.id,
                            f_ord: f_ord,
                            x: 100 + client.id * 150,
                            num: wss.clients.size
                        }
                        client.send(newPacket(READY, startinfo));
                        client.timealive = Date.now();
                        client.living = true;
                    }
                });
                return
            }
        } else if (data.type == TICK) {
            players[ws.id] = data.obj.p;
            players[ws.id].n = ws.name;
            bombs[ws.id] = data.obj.b;
        } else if (data.type == EXPLODE) {
            sendToAll(EXPLODE, data.obj)
        } else if (data.type == DEATH) {
            sendToAll(DEATH, data.obj)
        } else if (data.type == DEAD) { //loses all lives
            ws.timealive = Date.now() - ws.timealive;
            ws.living = false;
            if (allDead()) {
                sendToAll(DEAD, getScorelist())
            }
        } else if (data.type == HURT_SOUND) {
            sendToAll(HURT_SOUND, data.obj)
        }
    });
    ws.on('close', function closing(data) {
        console.log('Disconnect: ' + ws.name);
        players[ws.id] = null;
        bombs[ws.id] = null;
        count = 0;
        wss.clients.forEach(client => {
            client.id = count;
            count++;
        });
        if (wss.clients.size <= 0) {
            resetServer()
        }
    });
});

function resetServer() {
    playing = false;
    camerax = 0;
    bombs = [];
    players = [];
    difficulty = 0;
}

function generateFrameOrder() {
    let frameChoices = 28;
    let order = []
    order.push(1)
    // for (let i = 0; i < 28; i++) {
    //     order.push(i)
    // }
    for (let i = 0; i < 30; i++) {
        order.push(Math.floor(Math.random() * frameChoices))
    }
    return order;
}

function broadcastPlayerReadyList() {
    let playerlist = []
    wss.clients.forEach(function each(client) {
      playerlist.push({name:client.name, ready:client.ready, id: client.id})
    });
    sendToAll(PLAYERLIST, {playerlist: playerlist})
}

function sendToAll(type, obj) {
    let packet = newPacket(type, obj)
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(packet);
        }
    });
}

function allDead() {
    let res = true;
    wss.clients.forEach(function each(client) {
        if (client.living) {
            res = false;
        }
    });
    return res;
}

function getScorelist() {
    let scorelist = []
    wss.clients.forEach(function each(client) {
        scorelist.push({
            name: client.name,
            score: Math.floor(client.timealive/100) / 10
        })
        scorelist.sort((a,b) => (a.score > b.score) ? -1 : ((b.score > a.score) ? 1 : 0)); 
    });
    return scorelist;

}

function newPacket(type, obj){
	return JSON.stringify({'type': type, 'obj': obj});
}


function allReady() {
    let goodtogo = true;
    if (wss.clients.size <= 0) return false;
    wss.clients.forEach(function each(client){
        if (!client.ready) {
            goodtogo = false;
        }
    });
    return goodtogo;
}


function Packet(type, obj) {
    this.type = type;
    this.obj = obj;
}

function tick() {
    if (playing) {
        difficulty += .0001
        camerax += cameravx;
        cameravx = .5+difficulty;
        sendToAll(TICK, {
            cx: camerax,
            p: players,
            b: bombs,
            a: ammos,
            pows: powerups,
        })

        for (let i in ammos) {
            let ammo = ammos[i];
            if (ammo.x < camerax - 30) {
                ammos.splice(i--, 1)
                continue
            }
            for (let j in players) {
                let p = players[j]
                if (p && rectRectCollision(p.x, p.y, PW, PH, ammo.x, ammo.y, AW, AH)) {
                    sendAmmo(j);
                    ammos.splice(i--, 1);
                    continue
                }
            }
        }

        for (let i in powerups) {
            let pow = powerups[i];
            if (pow.x < camerax - 30) {
                powerups.splice(i--, 1)
                continue
            }
            for (let j in players) {
                let p = players[j]
                if (p && rectRectCollision(p.x, p.y, PW, PH, pow.x, pow.y, AW, AH)) {
                    sendPowerup(j);
                    powerups.splice(i--, 1);
                    continue
                }   
            }
        }

        ammoTimer--;
        if (ammoTimer <= 0) {
            let newa = {
                x: Math.floor(camerax + W + (Math.random() * W)),
                y: 32 + Math.floor(Math.random() * (H-32))
            }
            ammos.push(newa)
            ammoTimer = 150 + Math.floor(100 * Math.random())
        }
        powerupTimer--;
        if (powerupTimer <= 0) {
            let newp = {
                x: Math.floor(camerax + W + (Math.random() * W)),
                y: 32 + Math.floor(Math.random() * (H-32))
            }
            powerups.push(newp)
            powerupTimer = 100 + Math.floor(100 * Math.random())
        }
    }
}

function sendAmmo(id){
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN && client.id == id) {
            client.send(newPacket(AMMO, null));
        }
    });
    return null;
}

function sendPowerup(id){
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN && client.id == id) {
            client.send(newPacket(POWERUP, null));
        }
    });
    return null;
}

function rectRectCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
    if (x1 < x2 + w2 && x1 + w1 > x2 &&
        y1 < y2 + h2 && y1 + h1 > y2) {
        return true;
    }
    return false;

}

setInterval(tick, 10);

