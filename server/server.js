const WebSocket = require('ws');
const wss = new WebSocket.Server( { port : 8191 } );
console.log("Running game server on port " + wss.options.port)

const PLAYERLIST = -2;
const READY = -1;
const CONNECT = 0;
const TICK = 1;
const BOMB = 2;

var playing = false;
var camerax = 0;
var cameravx = .5;

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(data) {
        data = JSON.parse(data);
        console.log(data)
        if (data.type == CONNECT) {
            ws.id = wss.clients.size;
            if (wss.clients.size);
            
            if (!data.obj.name || data.obj.name.trim().length === 0)
                data.obj.name = "(blank)"
            ws.name = data.obj.name;
            console.log("Connection:  " + ws._socket.remoteAddress);
            broadcastPlayerReadyList()
            return;
        } else if (data.type == READY) {
            ws.ready = data.obj;
            broadcastPlayerReadyList()
            if (allReady()){
                console.log("game start")
                playing = true;
                sendToAll(READY, null);
                return
            }
        }
    });
    ws.on('close', function closing(data) {
        console.log('Disconnect: ' + ws.name);
    });
});


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
    camerax += cameravx
}

setInterval(tick, 10);



/// API server
var express = require('express')
var app = express()
var port = 8192;
app.listen(port, () => console.log(`API Server listening on port ${port}`))

app.get('/playing', (req, res) => res.send(playing))
app.get('/players', (req, res) => res.send(wss.clients.size.toString()))
