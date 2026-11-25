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
  socket.on('entrar', ({ codigo, nome, time }) => {
    if (!salas[codigo]) salas[codigo] = novaSala();
    let sala = salas[codigo];
    // Conta quantos já tem nesse time
    let qtdTime = Object.values(sala.jogadores).filter(j => j.time === time).length;
    // 0 = Defesa (barras 0 e 1), 1 = Ataque (barras 2 e 3)
    let papel = qtdTime === 0 ? 'DEFESA' : 'ATAQUE';
    let minhasBarras = papel === 'DEFESA' ? [0,1] : [2,3];

    sala.jogadores[socket.id] = { nome, time, papel, minhasBarras };
    socket.join(codigo);
    socket.data.codigo = codigo;
    io.to(codigo).emit('estado', sala);
    socket.emit('meuPapel', papel);
  });

  socket.on('mover', (y) => {
    let sala = salas[socket.data.codigo];
    if (!sala) return;
    let j = sala.jogadores[socket.id];
    if (!j) return;
    // Só move AS SUAS barras, não as do parceiro
    j.minhasBarras.forEach(idx => {
      sala.barras[j.time][idx] = y;
    });
    io.to(socket.data.codigo).emit('estado', sala);
  });

  socket.on('disconnect', () => {
    let sala = salas[socket.data.codigo];
    if (sala) delete sala.jogadores[socket.id];
  });
});

setInterval(() => {
  for (let codigo in salas) {
    let s = salas[codigo];
    if (Object.keys(s.jogadores).length === 0) continue;
    s.bola.x += s.bola.vx;
    s.bola.y += s.bola.vy;
    if (s.bola.y < 20 || s.bola.y > 480) s.bola.vy *= -1;
    if (s.bola.x < 0) { s.placar.vermelho++; s.bola = { x: 400, y: 250, vx: 3, vy: 2 }; }
    if (s.bola.x > 800) { s.placar.azul++; s.bola = { x: 400, y: 250, vx: -3, vy: 2 }; }
    io.to(codigo).emit('estado', s);
  }
}, 16);

server.listen(process.env.PORT || 3000);
