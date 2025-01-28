require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const {
  getMessages,
  saveMessage,
  updateUserStatus,
  getRooms,
  getPrivateMessages,
  savePrivateMessage,
  getOrCreateUser,
} = require("./database");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// Manejar conexión de usuarios con Socket.IO
io.on("connection", (socket) => {
  // Login simplificado
  socket.on("login", async (username) => {
    try {
      console.log("Un usuario se conectó");
      const user = await getOrCreateUser(username);
      socket.user = user;
      socket.emit("login_success", user);

      // Notificar a otros usuarios
      socket.broadcast.emit("user_connected", {
        id: user.id,
        username: user.username,
        status: "online",
      });

      // Cargar datos iniciales
      const rooms = await getRooms();
      socket.emit("rooms_list", rooms);

      // Unirse a la sala general por defecto y cargar mensajes
      socket.join("General");
      const messages = await getMessages("General");
      socket.emit("chat history", messages);
    } catch (error) {
      console.error("Error en login:", error);
      socket.emit("login_error", { message: "Error al iniciar sesión" });
    }
  });

  // Unirse a una sala
  socket.on("join_room", async (roomName) => {
    try {
      // Obtener los mensajes antes de unirse a la sala
      const messages = await getMessages(roomName);

      // Unirse a la nueva sala
      socket.join(roomName);

      // Enviar el historial de mensajes
      socket.emit("chat history", messages);
    } catch (error) {
      console.error("Error al unirse a la sala:", error);
      socket.emit("error", { message: "Error al unirse a la sala" });
    }
  });

  // Dejar una sala
  socket.on("leave_room", (roomId) => {
    socket.leave(roomId);
  });

  // Obtener salas
  socket.on("get_rooms", async () => {
    try {
      const rooms = await getRooms();
      socket.emit("rooms_list", rooms);
    } catch (error) {
      console.error("Error al obtener salas:", error);
      socket.emit("error", { message: "Error al obtener salas" });
    }
  });

  // Obtener usuarios en línea
  socket.on("get_online_users", async () => {
    try {
      const sockets = await io.fetchSockets();
      const onlineUsers = sockets
        .filter((s) => s.user)
        .map((s) => ({
          id: s.user.id,
          username: s.user.username,
          status: "online",
        }));
      socket.emit("online_users", onlineUsers);
    } catch (error) {
      console.error("Error al obtener usuarios en línea:", error);
      socket.emit("error", { message: "Error al obtener usuarios" });
    }
  });

  // Mensajes públicos
  socket.on("chat_message", async ({ room, message }) => {
    try {
      if (!socket.user) return;

      const savedMessage = await saveMessage(socket.user.id, room, message);

      // Emitir a todos en la sala, incluyendo el emisor
      io.in(room).emit("chat_message", {
        username: socket.user.username,
        message: savedMessage.message,
        timestamp: savedMessage.timestamp,
        room: room,
        senderId: socket.user.id,
      });
    } catch (error) {
      console.error("Error al enviar mensaje:", error);
      socket.emit("error", { message: "Error al enviar mensaje" });
    }
  });

  // Mensajes privados
  socket.on("private_message", async ({ receiverId, message }) => {
    try {
      if (!socket.user) {
        throw new Error("Usuario no autenticado");
      }

      // Validar que el receptor existe
      const savedMessage = await savePrivateMessage(
        socket.user.id,
        receiverId,
        message
      );

      if (!savedMessage) {
        throw new Error("No se pudo guardar el mensaje");
      }

      // Encontrar el socket del receptor
      const receiverSocket = Array.from(io.sockets.sockets.values()).find(
        (s) => s.user && s.user.id === receiverId
      );

      // Emitir el mensaje al remitente y al destinatario
      const messageData = {
        id: savedMessage.id,
        content: savedMessage.content,
        timestamp: savedMessage.created_at,
        sender: savedMessage.sender,
        receiver: savedMessage.receiver,
      };

      // Enviar al remitente
      socket.emit("private_message", messageData);

      // Enviar al destinatario si está conectado
      if (receiverSocket) {
        receiverSocket.emit("private_message", messageData);
      }
    } catch (error) {
      console.error("Error detallado al enviar mensaje privado:", {
        error: error.message,
        stack: error.stack,
        userId: socket.user?.id,
        receiverId,
      });
      socket.emit("error", {
        message: "Error al enviar mensaje privado",
        details: error.message,
      });
    }
  });

  // Obtener historial de mensajes privados
  socket.on("get_private_messages", async (otherUserId) => {
    try {
      if (!socket.user) return;

      const messages = await getPrivateMessages(socket.user.id, otherUserId);
      socket.emit("private_messages_history", messages);
    } catch (error) {
      console.error("Error al obtener mensajes privados:", error);
      socket.emit("error", { message: "Error al obtener mensajes privados" });
    }
  });

  // Indicador de escritura
  socket.on("typing", ({ room, isTyping }) => {
    if (!socket.user) return;

    socket.to(room).emit("user_typing", {
      username: socket.user.username,
      isTyping,
    });
  });

  // Desconexión
  socket.on("disconnect", async () => {
    console.log("Un usuario se desconectó");
    if (socket.user) {
      try {
        await updateUserStatus(socket.user.id, "offline");
        io.emit("user_disconnected", socket.user.id);
      } catch (error) {
        console.error("Error al actualizar estado de desconexión:", error);
      }
    }
  });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
