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

// Función para obtener mensajes
const getMessages = async (callback) => {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("timestamp", { ascending: true });

    if (error) throw error;
    callback(null, data);
  } catch (error) {
    console.error("Error al recuperar mensajes:", error.message);
    callback(error, null);
  }
};

// Función para guardar mensajes
const saveMessage = async (username, message, callback) => {
  try {
    const { data, error } = await supabase
      .from("messages")
      .insert([
        {
          username,
          message,
          timestamp: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;
    callback(null, data);
  } catch (error) {
    console.error("Error al guardar el mensaje:", error.message);
    callback(error);
  }
};

module.exports = { getMessages, saveMessage };
