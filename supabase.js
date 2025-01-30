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

module.exports = { supabase };
