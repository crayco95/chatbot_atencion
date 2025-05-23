import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import pkg from "pg";
import fs from "fs/promises";
import twilio from "twilio";
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import NodeCache from 'node-cache';
import winston from 'winston';
import TelegramBot from 'node-telegram-bot-api';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Configuración inicial
dotenv.config();
const { Pool } = pkg;

// Validación de variables de entorno críticas
const requiredEnvVars = [
    'DB_USER',
    'DB_HOST',
    'DB_NAME',
    'DB_PASS',
    'DB_PORT',
    'GROQ_API_KEY',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_WHATSAPP_NUMBER',
    'TELEGRAM_BOT_TOKEN',
    'JWT_SECRET'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Variable de entorno ${envVar} no está definida`);
        process.exit(1);
    }
}

// Configuración del logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

// Configuración de rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100 // límite de 100 solicitudes por ventana
});

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT
});

// Configuración de Twilio
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Configuración del bot de Telegram
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Middleware
app.use(cors());
app.use(express.json());
app.use(limiter);

// Cache setup
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutos de TTL

// Funciones auxiliares
async function cargarInformacion() {
    try {
        const data = await fs.readFile("ferreteria.txt", "utf-8");
        return data.trim().length > 0 ? data : null;
    } catch (error) {
        logger.error("❌ Error al leer el archivo:", error);
        return null;
    }
}

async function buscarEnBD(pregunta, negocioId) {
    const cacheKey = `faq_${negocioId}_${pregunta}`;
    const cachedResponse = cache.get(cacheKey);
    
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const query = `
            SELECT f.respuesta as answer
            FROM faqs f
            JOIN negocios n ON n.id = f.negocio_id
            WHERE n.id = $1 AND f.pregunta ILIKE '%' || $2 || '%'
            LIMIT 1
        `;
        const { rows } = await pool.query(query, [negocioId, pregunta]);
        const result = rows.length ? rows[0].answer : null;
        
        if (result) {
            cache.set(cacheKey, result);
        }
        return result;
    } catch (error) {
        logger.error("❌ Error al consultar la BD:", error);
        return null;
    }
}

async function guardarEnBD(pregunta, respuesta, negocioId) {
    try {
        const query = "INSERT INTO faqs (pregunta, respuesta, negocio_id) VALUES ($1, $2, $3) ON CONFLICT (pregunta, negocio_id) DO NOTHING";
        await pool.query(query, [pregunta, respuesta, negocioId]);
    } catch (error) {
        logger.error("❌ Error al guardar en la BD:", error);
    }
}

async function obtenerInfoNegocio(businessId) {
    try {
        const query = `
            SELECT 
                n.*,
                (SELECT json_agg(json_build_object(
                    'dia_semana', h.dia_semana,
                    'hora_apertura', h.hora_apertura::text,
                    'hora_cierre', h.hora_cierre::text
                )) FROM horarios h WHERE h.negocio_id = n.id) as horarios,
                (SELECT json_agg(json_build_object(
                    'nombre', ps.nombre,
                    'descripcion', ps.descripcion,
                    'tipo', ps.tipo
                )) FROM productos_servicios ps WHERE ps.negocio_id = n.id) as productos_servicios,
                (SELECT json_agg(mp.metodo) FROM metodos_pago mp WHERE mp.negocio_id = n.id) as metodos_pago,
                (SELECT json_agg(json_build_object(
                    'descripcion', p.descripcion,
                    'fecha_inicio', p.fecha_inicio::text,
                    'fecha_fin', p.fecha_fin::text
                )) FROM promociones p WHERE p.negocio_id = n.id) as promociones,
                (SELECT json_agg(json_build_object(
                    'plataforma', rs.plataforma,
                    'url', rs.url
                )) FROM redes_sociales rs WHERE rs.negocio_id = n.id) as redes_sociales,
                (SELECT json_agg(json_build_object(
                    'pregunta', f.pregunta,
                    'respuesta', f.respuesta,
                    'categoria', f.categoria
                )) FROM faqs f WHERE f.negocio_id = n.id) as faqs
            FROM negocios n
            WHERE n.id = $1
        `;
        const result = await pool.query(query, [businessId]);
        
        if (!result.rows[0]) {
            throw new Error("Negocio no encontrado");
        }
        
        // Convertir nulls a arrays vacíos
        const negocio = result.rows[0];
        negocio.horarios = negocio.horarios || [];
        negocio.productos_servicios = negocio.productos_servicios || [];
        negocio.metodos_pago = negocio.metodos_pago || [];
        negocio.promociones = negocio.promociones || [];
        negocio.redes_sociales = negocio.redes_sociales || [];
        negocio.faqs = negocio.faqs || [];
        
        return negocio;
    } catch (error) {
        logger.error("Error al obtener info del negocio:", error);
        return null;
    }
}

async function obtenerNegocioPorNumero(phoneNumber) {
    try {
        const query = `
            SELECT negocio_id 
            FROM whatsapp_sessions 
            WHERE phone_number = $1
        `;
        const result = await pool.query(query, [phoneNumber]);
        
        if (result.rows.length > 0) {
            await pool.query(
                "UPDATE whatsapp_sessions SET last_interaction = CURRENT_TIMESTAMP WHERE phone_number = $1",
                [phoneNumber]
            );
            return result.rows[0].negocio_id;
        }
        return null;
    } catch (error) {
        logger.error("Error al obtener negocio por número:", error);
        return null;
    }
}

async function manejarSeleccionNegocio(phoneNumber, mensaje) {
    const opcion = parseInt(mensaje);
    if (isNaN(opcion) || opcion < 1 || opcion > 3) {
        return null;
    }

    try {
        const query = `
            INSERT INTO whatsapp_sessions (phone_number, negocio_id)
            VALUES ($1, $2)
            ON CONFLICT (phone_number) 
            DO UPDATE SET negocio_id = $2, last_interaction = CURRENT_TIMESTAMP
            RETURNING negocio_id
        `;
        const result = await pool.query(query, [phoneNumber, opcion]);
        return result.rows[0].negocio_id;
    } catch (error) {
        logger.error("Error al guardar selección de negocio:", error);
        return null;
    }
}

async function obtenerNegocioPorChatId(chatId) {
    try {
        const query = `
            SELECT negocio_id 
            FROM telegram_sessions 
            WHERE chat_id = $1
        `;
        const result = await pool.query(query, [chatId]);
        
        if (result.rows.length > 0) {
            await pool.query(
                "UPDATE telegram_sessions SET last_interaction = CURRENT_TIMESTAMP WHERE chat_id = $1",
                [chatId]
            );
            return result.rows[0].negocio_id;
        }
        return null;
    } catch (error) {
        logger.error("Error al obtener negocio por chat ID:", error);
        return null;
    }
}

async function manejarSeleccionNegocioTelegram(chatId, mensaje) {
    const opcion = parseInt(mensaje);
    if (isNaN(opcion) || opcion < 1 || opcion > 3) {
        return null;
    }

    try {
        const query = `
            INSERT INTO telegram_sessions (chat_id, negocio_id)
            VALUES ($1, $2)
            ON CONFLICT (chat_id) 
            DO UPDATE SET negocio_id = $2, last_interaction = CURRENT_TIMESTAMP
            RETURNING negocio_id
        `;
        const result = await pool.query(query, [chatId, opcion]);
        return result.rows[0].negocio_id;
    } catch (error) {
        logger.error("Error al guardar selección de negocio en Telegram:", error);
        return null;
    }
}

// Endpoints
app.post("/api/chat", [
    body('message').trim().notEmpty().withMessage('El mensaje no puede estar vacío'),
    body('businessId').isInt().withMessage('ID de negocio inválido')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { message, businessId } = req.body;

    if (!message || !businessId) {
        return res.status(400).json({ error: "El mensaje y el ID del negocio son requeridos." });
    }

    try {
        const respuestaBD = await buscarEnBD(message, businessId);
        if (respuestaBD) {
            return res.json({ reply: respuestaBD });
        }

        const negocioInfo = await obtenerInfoNegocio(businessId);
        if (!negocioInfo) {
            throw new Error("Negocio no encontrado");
        }

        const systemMessage = {
            role: "system",
            content: `Eres un asistente de atención al cliente de ${negocioInfo.nombre}. ${negocioInfo.tipo_negocio}. Responde de manera directa y concisa.`
        };

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    systemMessage,
                    { role: "user", content: message }
                ],
                temperature: 0.2,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "Error en la API de Groq.");
        }

        const data = await response.json();
        const respuestaIA = data.choices?.[0]?.message?.content || "No tengo esa información en este momento.";

        await guardarEnBD(message, respuestaIA, businessId);
        res.json({ reply: respuestaIA });
    } catch (error) {
        logger.error("Error en la solicitud:", error);
        res.status(500).json({ error: "Error al procesar la solicitud." });
    }
});

app.post("/api/whatsapp", async (req, res) => {
    const { Body, From } = req.body;

    if (!Body) {
        return res.status(400).send("El mensaje es requerido.");
    }

    try {
        let negocioId = await obtenerNegocioPorNumero(From);
        
        if (!negocioId) {
            negocioId = await manejarSeleccionNegocio(From, Body);
            
            if (!negocioId) {
                await twilioClient.messages.create({
                    body: "Por favor, selecciona un negocio respondiendo con su número:\n1. Ferretería\n2. Panadería\n3. Librería",
                    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
                    to: From
                });
                return res.status(200).send("Solicitud de selección de negocio enviada");
            }
        }

        const negocioInfo = await obtenerInfoNegocio(negocioId);
        const respuestaBD = await buscarEnBD(Body, negocioId);
        
        if (respuestaBD) {
            await twilioClient.messages.create({
                body: respuestaBD,
                from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
                to: From
            });
            return res.status(200).send("Mensaje enviado desde la BD");
        }

        const systemMessage = {
            role: "system",
            content: `Eres un asistente de atención al cliente de ${negocioInfo.nombre}. ${negocioInfo.tipo_negocio}. Responde de manera directa y concisa.`
        };

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    systemMessage,
                    { role: "user", content: Body }
                ],
                temperature: 0,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "Error en la API de Groq.");
        }

        const data = await response.json();
        const respuestaIA = data.choices?.[0]?.message?.content || "No tengo esa información en este momento.";

        await guardarEnBD(Body, respuestaIA, negocioId);

        await twilioClient.messages.create({
            body: respuestaIA,
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to: From
        });

        res.status(200).send("Mensaje enviado desde la IA y guardado en la BD");
    } catch (error) {
        logger.error("❌ Error en WhatsApp:", error);
        res.status(500).send("Error interno en el chatbot");
    }
});

// Manejador de mensajes de Telegram
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;

    try {
        let negocioId = await obtenerNegocioPorChatId(chatId);
        
        if (!negocioId) {
            negocioId = await manejarSeleccionNegocioTelegram(chatId, userMessage);
            
            if (!negocioId) {
                await bot.sendMessage(chatId, "Por favor, selecciona un negocio respondiendo con su número:\n1. Ferretería\n2. Panadería\n3. Librería");
                return;
            }
        }

        const negocioInfo = await obtenerInfoNegocio(negocioId);
        const respuestaBD = await buscarEnBD(userMessage, negocioId);
        
        if (respuestaBD) {
            await bot.sendMessage(chatId, respuestaBD);
            return;
        }

        const systemMessage = {
            role: "system",
            content: `Eres un asistente de atención al cliente de ${negocioInfo.nombre}. 
            Tipo de negocio: ${negocioInfo.tipo_negocio}
            Dirección: ${negocioInfo.direccion}
            Teléfono: ${negocioInfo.telefono}
            Email: ${negocioInfo.email}
            
            Horarios de atención:
            ${negocioInfo.horarios.map(h => 
                `Día ${h.dia_semana}: ${h.hora_apertura} - ${h.hora_cierre}`
            ).join('\n')}
            
            Métodos de pago aceptados: ${negocioInfo.metodos_pago.join(', ')}
            
            Políticas de devolución:
            ${negocioInfo.politicas_devoluciones}
            
            Redes sociales:
            ${negocioInfo.redes_sociales.map(rs => 
                `${rs.plataforma}: ${rs.url}`
            ).join('\n')}
            
            Responde de manera directa y concisa utilizando esta información cuando sea relevante.`
        };

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    systemMessage,
                    { role: "user", content: userMessage }
                ],
                temperature: 0,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "Error en la API de Groq.");
        }

        const data = await response.json();
        const respuestaIA = data.choices?.[0]?.message?.content || "No tengo esa información en este momento.";

        await guardarEnBD(userMessage, respuestaIA, negocioId);
        await bot.sendMessage(chatId, respuestaIA);
    } catch (error) {
        logger.error('Error al procesar mensaje de Telegram:', error);
        await bot.sendMessage(chatId, "Lo siento, ha ocurrido un error al procesar tu mensaje.");
    }
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
    logger.error('Error no manejado:', err);
    res.status(500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Error interno del servidor'
            : err.message
    });
});

// Iniciar el servidor
app.listen(PORT, () => {
    logger.info(`Servidor corriendo en http://localhost:${PORT}`);
});

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Se requiere autenticación" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Token inválido" });
        }
        req.user = user;
        next();
    });
};

// Middleware para verificar rol de administrador
const isAdmin = (req, res, next) => {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ error: "Acceso denegado" });
    }
    next();
};

// Endpoints de autenticación
app.post("/api/auth/register", [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('rol').optional().isIn(['admin', 'usuario']).withMessage('Rol inválido')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password, rol = 'usuario' } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await pool.query(
            'INSERT INTO usuarios (email, password, rol) VALUES ($1, $2, $3) RETURNING id, email, rol',
            [email, hashedPassword, rol]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Error de duplicado
            return res.status(400).json({ error: "El email ya está registrado" });
        }
        logger.error("Error en registro:", error);
        res.status(500).json({ error: "Error al registrar usuario" });
    }
});

app.post("/api/auth/login", [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').notEmpty().withMessage('La contraseña es requerida')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password } = req.body;
        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, rol: user.rol },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, user: { id: user.id, email: user.email, rol: user.rol } });
    } catch (error) {
        logger.error("Error en login:", error);
        res.status(500).json({ error: "Error al iniciar sesión" });
    }
});

// Proteger rutas administrativas
app.get("/api/admin/stats", authenticateToken, isAdmin, async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                COUNT(DISTINCT n.id) as total_negocios,
                (SELECT COUNT(*) FROM faqs) as total_faqs,
                (SELECT COUNT(*) FROM whatsapp_sessions) as total_usuarios_whatsapp,
                (SELECT COUNT(*) FROM telegram_sessions) as total_usuarios_telegram
            FROM negocios n
        `);
        res.json(stats.rows[0]);
    } catch (error) {
        logger.error("Error al obtener estadísticas:", error);
        res.status(500).json({ error: "Error al obtener estadísticas" });
    }
});

app.get("/api/admin/conversations", authenticateToken, isAdmin, async (req, res) => {
    try {
        const conversations = await pool.query(`
            SELECT 
                f.id,
                f.pregunta,
                f.respuesta,
                f.created_at,
                n.nombre as negocio_nombre
            FROM faqs f
            JOIN negocios n ON n.id = f.negocio_id
            ORDER BY f.created_at DESC
            LIMIT 100
        `);
        res.json(conversations.rows);
    } catch (error) {
        logger.error("Error al obtener conversaciones:", error);
        res.status(500).json({ error: "Error al obtener conversaciones" });
    }
});

app.get("/api/admin/negocios", authenticateToken, isAdmin, async (req, res) => {
    try {
        const negocios = await pool.query(`
            SELECT 
                n.*,
                COUNT(f.id) as total_faqs,
                COUNT(DISTINCT ws.phone_number) as usuarios_whatsapp,
                COUNT(DISTINCT ts.chat_id) as usuarios_telegram
            FROM negocios n
            LEFT JOIN faqs f ON f.negocio_id = n.id
            LEFT JOIN whatsapp_sessions ws ON ws.negocio_id = n.id
            LEFT JOIN telegram_sessions ts ON ts.negocio_id = n.id
            GROUP BY n.id
        `);
        res.json(negocios.rows);
    } catch (error) {
        logger.error("Error al obtener negocios:", error);
        res.status(500).json({ error: "Error al obtener negocios" });
    }
});

app.post("/api/admin/faqs", [
    body('pregunta').trim().notEmpty().withMessage('La pregunta no puede estar vacía'),
    body('respuesta').trim().notEmpty().withMessage('La respuesta no puede estar vacía'),
    body('negocioId').isInt().withMessage('ID de negocio inválido')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { pregunta, respuesta, negocioId } = req.body;

    try {
        const result = await pool.query(`
            INSERT INTO faqs (pregunta, respuesta, negocio_id)
            VALUES ($1, $2, $3)
            RETURNING id
        `, [pregunta, respuesta, negocioId]);
        
        res.status(201).json({ id: result.rows[0].id, message: "FAQ creada exitosamente" });
    } catch (error) {
        logger.error("Error al crear FAQ:", error);
        res.status(500).json({ error: "Error al crear FAQ" });
    }
});