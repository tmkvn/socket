const sqlite3 = require('sqlite3').verbose();

// Conectar a la base de datos
const db = new sqlite3.Database('chat.db', (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite.');
    }
});

// Crear la tabla si no existe
db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
        if (err) {
            console.error('Error al crear la tabla:', err.message);
        }
    });
});

// Exportar funciones para operaciones con la base de datos
const getMessages = (callback) => {
    db.all('SELECT * FROM messages ORDER BY timestamp ASC', [], (err, rows) => {
        if (err) {
            console.error('Error al recuperar mensajes:', err.message);
            callback(err, null);
        } else {
            callback(null, rows);
        }
    });
};

const saveMessage = (username, message, callback) => {
    db.run(
        `INSERT INTO messages (username, message) VALUES (?, ?)`,
        [username, message],
        function (err) {
            if (err) {
                console.error('Error al guardar el mensaje:', err.message);
                callback(err);
            } else {
                callback(null, {
                    id: this.lastID,
                    username,
                    message,
                    timestamp: new Date().toISOString(),
                });
            }
        }
    );
};

module.exports = { getMessages, saveMessage };
