const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Array para almacenar los mensajes en memoria
const messages = [];

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Manejar conexión de usuarios con Socket.IO
io.on('connection', (socket) => {
    console.log('Un usuario se conectó');

    // Enviar historial de mensajes al usuario conectado
    socket.emit('chat history', messages);

    // Escuchar mensajes nuevos
    socket.on('chat message', (data) => {
        const { username, message } = data;
        if (username && message) {
            const newMessage = { username, message, timestamp: new Date() };
            // Guardar mensaje en el array
            messages.push(newMessage);
            // Enviar el mensaje a todos los usuarios conectados
            io.emit('chat message', newMessage);
        }
    });

    // Manejar desconexión
    socket.on('disconnect', () => {
        console.log('Un usuario se desconectó');
    });
});

// Iniciar el servidor
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
