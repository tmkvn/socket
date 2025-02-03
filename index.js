require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const emoji = require("node-emoji");
const {
  getMessages,
  saveMessage,
  updateUserStatus,
  getRooms,
  getPrivateMessages,
  savePrivateMessage,
  getOrCreateUser,
} = require("./database");
const { supabase } = require("./supabase");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// Agregar la función de conversión de emojis después de la configuración inicial
function convertirConEmojis(text) {
  text = text.replace(/:\)/g, "🙂");
  text = text.replace(/:D/g, "😁");
  text = text.replace(/:P/g, "😛");
  text = text.replace(/:O/g, "😲");
  text = text.replace(/;\)/g, "😉");
  text = text.replace(/:\(/g, "😢");

  text = emoji.emojify(text);
  return text;
}

// Manejar conexión de usuarios con Socket.IO
io.on("connection", (socket) => {
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
      const { data: allUsers } = await supabase
        .from("users")
        .select("*")
        .order("status", { ascending: false })
        .order("username", { ascending: true });

      socket.emit("online_users", allUsers);
    } catch (error) {
      console.error("Error al obtener usuarios:", error);
      socket.emit("error", { message: "Error al obtener usuarios" });
    }
  });

  // Mensajes públicos
  socket.on("chat_message", async ({ room, message }) => {
    try {
      if (!socket.user) return;

      const mensajeConEmojis = convertirConEmojis(message);
      const savedMessage = await saveMessage(
        socket.user.id,
        room,
        mensajeConEmojis
      );

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
      if (!socket.user) return;

      const mensajeConEmojis = convertirConEmojis(message);
      const savedMessage = await savePrivateMessage(
        socket.user.id,
        receiverId,
        mensajeConEmojis
      );

      // Enviar mensaje al remitente y al destinatario
      const receiverSocket = Array.from(io.sockets.sockets.values()).find(
        (s) => s.user && s.user.id === receiverId
      );

      const messageData = {
        senderId: socket.user.id,
        senderUsername: socket.user.username,
        message: mensajeConEmojis,
        timestamp: savedMessage.created_at,
      };

      socket.emit("private_message", messageData);
      if (receiverSocket) {
        receiverSocket.emit("private_message", messageData);
      }
    } catch (error) {
      console.error("Error al enviar mensaje privado:", error);
      socket.emit("error", { message: "Error al enviar mensaje privado" });
    }
  });

  // Obtener mensajes privados
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
        io.emit("user_disconnected", {
          userId: socket.user.id,
          username: socket.user.username,
          lastSeen: new Date().toISOString(),
        });
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
