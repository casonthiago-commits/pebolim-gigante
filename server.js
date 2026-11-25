const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static('public'));

let salas = {};

function novaSala() {
  return {
    jogadores: {},
    bola: { x: 400, y: 250, vx: 3, vy: 2 },
    placar: { azul: 0, vermelho: 0 },
    barras: {
      azul: [200, 350, 500, 650],
      vermelho: [150, 300, 450, 600]
    }
  };
}

io.on('connection', socket => {
  socket.on('entrar', ({ codigo, nome, personagem, time }) => {
    if (!salas[codigo]) salas[codigo] = novaSala();
    let sala = salas[codigo];
    sala.jogadores[socket.id] = { nome, personagem: personagem || '🐸', time, pronto: true };
    socket.join(codigo);
    socket.data.codigo = codigo;
    io.to(codigo).emit('estado', sala);
  });

  socket.on('mover', (y) => {
    let sala = salas[socket.data.codigo];
    if (!sala) return;
    let j = sala.jogadores[socket.id];
    if (!j) return;
    // move as 4 barras do time dele
    sala.barras[j.time] = sala.barras[j.time].map(() => y);
    io.to(socket.data.codigo).emit('estado', sala);
  });

  socket.on('disconnect', () => {
    let sala = salas[socket.data.codigo];
    if (sala) delete sala.jogadores[socket.id];
  });
});

// Física da bola - roda a cada 16ms
setInterval(() => {
  for (let codigo in salas) {
    let s = salas[codigo];
    if (Object.keys(s.jogadores).length === 0) continue;
    s.bola.x += s.bola.vx;
    s.bola.y += s.bola.vy;
    if (s.bola.y < 20 || s.bola.y > 480) s.bola.vy *= -1;
    // Gol
    if (s.bola.x < 0) { s.placar.vermelho++; s.bola = { x: 400, y: 250, vx: 3, vy: 2 }; }
    if (s.bola.x > 800) { s.placar.azul++; s.bola = { x: 400, y: 250, vx: -3, vy: 2 }; }
    // Rebate simples nas barras
    for (let time of ['azul', 'vermelho']) {
      for (let bx of s.barras[time]) {
        if (Math.abs(s.bola.x - bx) < 12 && Math.abs(s.bola.y - 250) < 120) {
          s.bola.vx *= -1.05;
          s.bola.vy += (Math.random() - 0.5) * 2;
        }
      }
    }
    io.to(codigo).emit('estado', s);
  }
}, 16);

server.listen(process.env.PORT || 3000);
