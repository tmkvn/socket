const { createClient } = require("@supabase/supabase-js");

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Las variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY son requeridas"
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Funciones para usuarios
const createUser = async (username) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .insert([{ username, status: "online" }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error al crear usuario:", error.message);
    throw error;
  }
};

const updateUserStatus = async (userId, status) => {
  try {
    const { error } = await supabase
      .from("users")
      .update({
        status,
        last_seen: status === "offline" ? new Date().toISOString() : null,
      })
      .eq("id", userId);

    if (error) throw error;
  } catch (error) {
    console.error("Error al actualizar estado del usuario:", error.message);
    throw error;
  }
};

// Funciones para mensajes públicos
const getMessages = async (roomName) => {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select(
        `
        id,
        message,
        timestamp,
        user_id,
        room_id,
        users (
          username
        ),
        rooms (
          name
        )
      `
      )
      .eq("rooms.name", roomName)
      .order("timestamp", { ascending: true })
      .limit(50);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error al recuperar mensajes:", error.message);
    throw error;
  }
};

const saveMessage = async (userId, roomName, message) => {
  try {
    // Primero obtenemos el room_id basado en el roomName
    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("id")
      .eq("name", roomName)
      .single();

    if (roomError) throw roomError;

    // Luego guardamos el mensaje
    const { data, error } = await supabase
      .from("messages")
      .insert([
        {
          user_id: userId,
          room_id: roomData.id,
          message,
          timestamp: new Date().toISOString(),
        },
      ])
      .select(
        `
        *,
        users (
          username
        ),
        rooms (
          name
        )
      `
      )
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error al guardar el mensaje:", error.message);
    throw error;
  }
};

// Funciones para mensajes privados
const savePrivateMessage = async (senderId, receiverId, content) => {
  try {
    const { data, error } = await supabase
      .from("private_messages")
      .insert([
        {
          sender_id: senderId,
          receiver_id: receiverId,
          content,
          created_at: new Date().toISOString(), // Asegurarnos de incluir timestamp
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error al guardar mensaje privado:", error.message);
    throw error;
  }
};

const getPrivateMessages = async (userId1, userId2) => {
  try {
    const { data, error } = await supabase
      .from("private_messages")
      .select("*")
      .or(`sender_id.eq.${userId1},receiver_id.eq.${userId1}`)
      .or(`sender_id.eq.${userId2},receiver_id.eq.${userId2}`)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error al recuperar mensajes privados:", error.message);
    throw error;
  }
};

// Funciones para salas
const getRooms = async () => {
  try {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error al recuperar salas:", error.message);
    throw error;
  }
};

const createRoom = async (name, description) => {
  try {
    const { data, error } = await supabase
      .from("rooms")
      .insert([{ name, description }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error al crear sala:", error.message);
    throw error;
  }
};

// Función para obtener un usuario por nombre de usuario
const getUserByUsername = async (username) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error al buscar usuario:", error.message);
    throw error;
  }
};

// Función para obtener o crear usuario
const getOrCreateUser = async (username) => {
  try {
    // Primero intentamos obtener el usuario
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    // Si el error es PGRST116, significa que el usuario no existe
    if (error && error.code === "PGRST116") {
      // Creamos el nuevo usuario
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert([{ username, status: "online" }])
        .select()
        .single();

      if (createError) throw createError;
      return newUser;
    } else if (error) {
      throw error;
    }

    // Si el usuario existe, actualizamos su estado
    const { error: updateError } = await supabase
      .from("users")
      .update({ status: "online", last_seen: null })
      .eq("id", user.id);

    if (updateError) throw updateError;
    return { ...user, status: "online" };
  } catch (error) {
    console.error("Error en getOrCreateUser:", error.message);
    throw error;
  }
};

module.exports = {
  getMessages,
  saveMessage,
  createUser,
  updateUserStatus,
  savePrivateMessage,
  getPrivateMessages,
  getRooms,
  createRoom,
  getUserByUsername,
  getOrCreateUser,
};
