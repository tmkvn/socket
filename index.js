const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { getMessages, saveMessage } = require('./database'); // Importar funciones de la base de datos

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Manejar conexión de usuarios con Socket.IO
io.on('connection', (socket) => {
    console.log('Un usuario se conectó');

    // Enviar historial de mensajes al usuario conectado
    getMessages((err, rows) => {
        if (err) {
            console.error('Error al enviar historial de mensajes:', err.message);
        } else {
            socket.emit('chat history', rows);
        }
    });

    // Escuchar mensajes nuevos
    socket.on('chat message', (data) => {
        const { username, message } = data;
        if (username && message) {
            // Guardar mensaje en la base de datos
            saveMessage(username, message, (err, newMessage) => {
                if (err) {
                    console.error('Error al guardar el mensaje:', err.message);
                } else {
                    // Enviar el mensaje a todos los usuarios conectados
                    io.emit('chat message', newMessage);
                }
            });
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
