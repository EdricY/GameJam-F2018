const WebSocket = require('ws');
const wss = new WebSocket.Server( { port : 8191 } );
console.log("Running game server on port " + wss.options.port)

const CONNECT = 0;

var playing = false;
var camerax = 0;
var cameravx = .5;

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(data) {
        data = JSON.parse(data);
        if (data.type == CONNECT) {
            if (!data.obj.name || data.obj.name.trim().length === 0)
                data.obj.name = "(blank)"
            ws.name = data.obj.name;
            console.log("Connection:  " + ws._socket.remoteAddress);
            return;
        }
    });
    ws.on('close', function closing(data) {
        console.log('Disconnect: ' + ws.name + '  Score: ' + ws.score);
    });
});


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
app.get('/players', (req, res) => res.send(wss.clients.length))
