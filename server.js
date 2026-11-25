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
    bola: { x: 400, y: 250, vx: 4, vy: 3 },
    placar: { azul: 0, vermelho: 0 },
    barras: { azul: [200, 350, 500, 650], vermelho: [150, 300, 450, 600] }
  };
}

function resetBola(direcao) {
  return { x: 400, y: 250, vx: 4 * direcao, vy: 3 };
}

io.on('connection', socket => {
  socket.on('entrar', ({ codigo, nome, time }) => {
    if (!salas[codigo]) salas[codigo] = novaSala();
    let sala = salas[codigo];
    let qtdTime = Object.values(sala.jogadores).filter(j => j.time === time).length;
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
    // Trava a barra pra não sair da mesa
 y = Math.max(90, Math.min(410, y));
    j.minhasBarras.forEach(idx => { sala.barras[j.time][idx] = y; });
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

    // 1. BATE NA PAREDE DE CIMA E DE BAIXO E VOLTA
    if (s.bola.y < 15) { s.bola.y = 15; s.bola.vy *= -1; }
    if (s.bola.y > 485) { s.bola.y = 485; s.bola.vy *= -1; }

    // 2. GOL - só entra se estiver no meio (gol de 150px)
    let noGol = s.bola.y > 175 && s.bola.y < 325;

    // Gol do VERMELHO (bola saiu pela esquerda)
    if (s.bola.x < 10) {
      if (noGol) { s.placar.vermelho++; s.bola = resetBola(1); }
      else { s.bola.x = 10; s.bola.vx *= -1; } // BATE NA PAREDE E VOLTA
    }
    // Gol do AZUL (bola saiu pela direita)
    if (s.bola.x > 790) {
      if (noGol) { s.placar.azul++; s.bola = resetBola(-1); }
      else { s.bola.x = 790; s.bola.vx *= -1; } // BATE NA PAREDE E VOLTA
    }

    // 3. BATE NOS BONECOS E VOLTA
    for (let time of ['azul','vermelho']) {
      for (let bx of s.barras[time]) {
        // Procura a barra mais perto
        if (Math.abs(s.bola.x - bx) < 14) {
          // A barra está nessa altura? usa o valor da barra como centro
          let centroBarra = s.barras[time].find(v => v === bx);
          // Se a bola estiver perto de algum boneco dessa barra
          if (Math.abs(s.bola.y - centroBarra) < 130) {
            s.bola.vx *= -1.05;
            s.bola.vy += (Math.random() - 0.5) * 3;
            s.bola.x += s.bola.vx > 0 ? 5 : -5; // empurra pra fora
          }
        }
      }
    }

    io.to(codigo).emit('estado', s);
  }
}, 16);

server.listen(process.env.PORT || 3000);
