const WebSocket = require('ws');
const wss = new WebSocket.Server( { port : 8191 } );
console.log("Running game server on port " + wss.options.port)

const SERVER_PLAYING = -4
const SERVER_FULL = -3
const PLAYERLIST = -2;
const READY = -1;
const CONNECT = 0;
const TICK = 1;
const EXPLODE = 2;

var playing = false;
var camerax = 0;
var cameravx = 0;

var f_ord = [];
var players = [];
var bombs = [];

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
                        }
                        client.send(newPacket(READY, startinfo));
                    }
                });
                return
            }
        } else if (data.type == TICK) {
            players[ws.id] = data.obj;
        } else if (data.type == EXPLODE) {
            sendToAll(EXPLODE, data.obj)
        }
    });
    ws.on('close', function closing(data) {
        console.log('Disconnect: ' + ws.name);
        if (wss.clients.size <= 0) {
            playing = false;
            resetServer()
        }
    });
});

function resetServer() {

}

function generateFrameOrder() {
    let numFrames = 6;
    let order = []
    order.push(0)
    for (let i = 0; i < 1; i++) {
        order.push(Math.floor(Math.random() * numFrames))
    }
    return order;
}

function broadcastPlayerReadyList() {
    let playerlist = []
    wss.clients.forEach(function each(client) {
      playerlist.push({name:client.name, ready:client.ready})
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
        camerax += cameravx;

        sendToAll(TICK, {
            cx: camerax,
            p: players,
            b: bombs
        })
    }

}

setInterval(tick, 10);



/// API server
var express = require('express')
var app = express()
var port = 8192;
app.listen(port, () => console.log(`API Server listening on port ${port}`))

app.get('/playing', (req, res) => res.send(playing))
app.get('/players', (req, res) => res.send(wss.clients.size.toString()))
