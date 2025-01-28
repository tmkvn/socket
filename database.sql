-- Eliminar tablas existentes si es necesario (en orden inverso por las dependencias)
DROP TABLE IF EXISTS public.private_messages;
DROP TABLE IF EXISTS public.messages;
DROP TABLE IF EXISTS public.rooms;
DROP TABLE IF EXISTS public.users;

-- Crear tabla de usuarios
CREATE TABLE public.users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    username text NOT NULL UNIQUE,
    status text CHECK (status IN ('online', 'offline')) DEFAULT 'offline',
    last_seen timestamptz DEFAULT NULL,
    created_at timestamptz DEFAULT now()
);

-- Crear tabla de salas
CREATE TABLE public.rooms (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    description text,
    created_at timestamptz DEFAULT now()
);

-- Crear tabla de mensajes públicos
CREATE TABLE public.messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id uuid REFERENCES public.rooms(id),
    user_id uuid REFERENCES public.users(id),
    message text NOT NULL,
    timestamp timestamptz DEFAULT now()
);

-- Crear tabla de mensajes privados
CREATE TABLE public.private_messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id uuid REFERENCES public.users(id),
    receiver_id uuid REFERENCES public.users(id),
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Configurar políticas de seguridad para users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura de usuarios a todos" ON public.users
    FOR SELECT TO anon USING (true);

CREATE POLICY "Permitir inserción de usuarios a todos" ON public.users
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Permitir actualización de estado propio" ON public.users
    FOR UPDATE TO anon USING (true);

-- Configurar políticas de seguridad para rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura de salas a todos" ON public.rooms
    FOR SELECT TO anon USING (true);

CREATE POLICY "Permitir creación de salas a todos" ON public.rooms
    FOR INSERT TO anon WITH CHECK (true);

-- Configurar políticas de seguridad para messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura de mensajes a todos" ON public.messages
    FOR SELECT TO anon USING (true);

CREATE POLICY "Permitir inserción de mensajes a todos" ON public.messages
    FOR INSERT TO anon WITH CHECK (true);

-- Configurar políticas de seguridad para private_messages
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura de mensajes privados a participantes" ON public.private_messages
    FOR SELECT TO anon 
    USING (auth.uid() IN (SELECT id FROM users WHERE id = sender_id OR id = receiver_id));

CREATE POLICY "Permitir envío de mensajes privados" ON public.private_messages
    FOR INSERT TO anon 
    WITH CHECK (true);

-- Habilitar la extensión uuid-ossp si no está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear algunos datos de ejemplo para las salas
INSERT INTO public.rooms (name, description) VALUES
    ('General', 'Sala general para todos los usuarios'),
    ('Anuncios', 'Sala para anuncios importantes'),
    ('Casual', 'Sala para charlas casuales');

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_messages_room_id ON public.messages(room_id);
CREATE INDEX idx_messages_user_id ON public.messages(user_id);
CREATE INDEX idx_private_messages_sender ON public.private_messages(sender_id);
CREATE INDEX idx_private_messages_receiver ON public.private_messages(receiver_id);
CREATE INDEX idx_users_username ON public.users(username); 