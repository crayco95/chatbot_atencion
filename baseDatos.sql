-- Tabla principal de negocios
CREATE TABLE negocios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo_negocio VARCHAR(50) NOT NULL,
    direccion VARCHAR(200) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(100) UNIQUE,
    politicas_devoluciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de horarios
CREATE TABLE horarios (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER REFERENCES negocios(id),
    dia_semana INTEGER CHECK (dia_semana BETWEEN 0 AND 7),
    hora_apertura TIME NOT NULL,
    hora_cierre TIME NOT NULL
);

-- Tabla de productos y servicios
CREATE TABLE productos_servicios (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER REFERENCES negocios(id),
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50) CHECK (tipo IN ('producto', 'servicio'))
);

-- Tabla de métodos de pago
CREATE TABLE metodos_pago (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER REFERENCES negocios(id),
    metodo VARCHAR(50) NOT NULL
);

-- Tabla de promociones
CREATE TABLE promociones (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER REFERENCES negocios(id),
    descripcion TEXT NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE
);

-- Tabla de redes sociales
CREATE TABLE redes_sociales (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER REFERENCES negocios(id),
    plataforma VARCHAR(50) NOT NULL,
    url VARCHAR(200) NOT NULL
);

-- Tabla de FAQs (preguntas frecuentes)
CREATE TABLE faqs (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER REFERENCES negocios(id),
    pregunta TEXT NOT NULL,
    respuesta TEXT NOT NULL,
    categoria VARCHAR(50),
    UNIQUE(negocio_id, pregunta)
);

CREATE TABLE whatsapp_sessions (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(50) NOT NULL UNIQUE,
    negocio_id INTEGER NOT NULL,
    last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id)
);

CREATE TABLE IF NOT EXISTS telegram_sessions (
    chat_id BIGINT PRIMARY KEY,
    negocio_id INTEGER REFERENCES negocios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar búsquedas
CREATE INDEX idx_negocios_tipo ON negocios(tipo_negocio);
CREATE INDEX idx_faqs_negocio ON faqs(negocio_id);
CREATE INDEX idx_productos_negocio ON productos_servicios(negocio_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_negocios_updated_at
    BEFORE UPDATE ON negocios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
	
	
-- Insertar datos de la ferretería
INSERT INTO negocios (id, nombre, tipo_negocio, direccion, telefono, email, politicas_devoluciones)
VALUES (1, 'Ferretería Ejemplo', 'Ferretería', 'Calle 123, Ciudad Ejemplo', '+123 456 7890', 'contacto@ferreteriaejemplo.com',
'Se aceptan devoluciones dentro de los primeros 7 días con la factura de compra.');

-- Insertar horarios de la ferretería
INSERT INTO horarios (negocio_id, dia_semana, hora_apertura, hora_cierre) VALUES
(1, 1, '08:00', '19:00'), -- Lunes
(1, 2, '08:00', '19:00'), -- Martes
(1, 3, '08:00', '19:00'), -- Miércoles
(1, 4, '08:00', '19:00'), -- Jueves
(1, 5, '08:00', '19:00'), -- Viernes
(1, 6, '08:00', '17:00'); -- Sábado

-- Insertar productos y servicios de la ferretería
INSERT INTO productos_servicios (negocio_id, nombre, descripcion, tipo) VALUES
(1, 'Martillos', 'Herramientas manuales para construcción', 'producto'),
(1, 'Taladros', 'Herramientas eléctricas para perforación', 'producto'),
(1, 'Cemento', 'Material de construcción', 'producto'),
(1, 'Corte de madera', 'Servicio de corte a medida', 'servicio'),
(1, 'Asesoría técnica', 'Consultoría en proyectos', 'servicio');

-- Insertar métodos de pago de la ferretería
INSERT INTO metodos_pago (negocio_id, metodo) VALUES
(1, 'Efectivo'),
(1, 'Tarjetas de crédito y débito'),
(1, 'Transferencias bancarias'),
(1, 'Pagos en línea');

-- Insertar promociones de la ferretería
INSERT INTO promociones (negocio_id, descripcion, fecha_inicio, fecha_fin) VALUES
(1, '10% de descuento en primera compra', '2024-01-01', '2024-12-31'),
(1, 'Descuentos en herramientas eléctricas fines de semana', '2024-01-01', '2024-12-31');

-- Insertar redes sociales de la ferretería
INSERT INTO redes_sociales (negocio_id, plataforma, url) VALUES
(1, 'Facebook', 'facebook.com/ferreteriaejemplo'),
(1, 'Instagram', '@ferreteriaejemplo'),
(1, 'WhatsApp', '+123 456 7890');
