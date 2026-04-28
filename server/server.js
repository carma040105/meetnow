const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.get('/health', (req, res) => res.send('OK'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

const rooms = {};

io.on('connection', socket => {
  socket.on('join-room', roomId => {
    if (!rooms[roomId]) rooms[roomId] = [];
    if (rooms[roomId].length >= 10) { socket.emit('room-full'); return; }
    rooms[roomId].push(socket.id);
    socket.join(roomId);
    socket.roomId = roomId;
    const others = rooms[roomId].filter(id => id !== socket.id);
    socket.emit('room-users', others);
    socket.to(roomId).emit('user-joined', socket.id);
  });

  socket.on('offer',  ({to, offer, name})  => io.to(to).emit('offer',  {from: socket.id, offer, name}));
  socket.on('answer', ({to, answer})       => io.to(to).emit('answer', {from: socket.id, answer}));
  socket.on('ice',    ({to, candidate})    => io.to(to).emit('ice',    {from: socket.id, candidate}));

  // 채팅 메시지 중계
  socket.on('chat-message', ({roomId, name, text}) => {
    socket.to(roomId).emit('chat-message', {name, text});
  });

  socket.on('disconnect', () => {
    if (socket.roomId && rooms[socket.roomId]) {
      rooms[socket.roomId] = rooms[socket.roomId].filter(id => id !== socket.id);
      socket.to(socket.roomId).emit('user-left', socket.id);
      if (rooms[socket.roomId].length === 0) delete rooms[socket.roomId];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`서버 실행 중: ${PORT}포트`));