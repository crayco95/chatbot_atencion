import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import pkg from "pg";
import fs from "fs/promises";
import twilio from "twilio";

dotenv.config();
const { Pool } = pkg;

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

// Middleware
app.use(cors());
app.use(express.json());


// 🔹 Función para cargar información del archivo
async function cargarInformacion() {
    try {
        const data = await fs.readFile("ferreteria.txt", "utf-8");
        return data.trim().length > 0 ? data : null;
    } catch (error) {
        console.error("❌ Error al leer el archivo:", error);
        return null;
    }
}

// 🔹 Función para buscar en la BD
async function buscarEnBD(pregunta) {
    try {
        const query = "SELECT answer FROM faqs WHERE question ILIKE '%' || $1 || '%' LIMIT 1";
        const { rows } = await pool.query(query, [pregunta]);
        return rows.length ? rows[0].answer : null;
    } catch (error) {
        console.error("❌ Error al consultar la BD:", error);
        return null;
    }
}

// 🔹 Función para guardar en la BD
async function guardarEnBD(pregunta, respuesta) {
    try {
        const query = "INSERT INTO faqs (question, answer) VALUES ($1, $2) ON CONFLICT (question) DO NOTHING";
        await pool.query(query, [pregunta, respuesta]);
    } catch (error) {
        console.error("❌ Error al guardar en la BD:", error);
    }
}

// 🔹 Endpoint del chatbot web
app.post("/api/chat", async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: "El mensaje es requerido." });
    }

    try {
        // 1️⃣ Buscar en la base de datos primero
        const respuestaBD = await buscarEnBD(message);
        if (respuestaBD) {
            return res.json({ reply: respuestaBD });
        }
        // Cargar información desde el archivo
        const info = await cargarInformacion();
        // 2️⃣ Si no está en la BD, preguntar a Groq
        const systemMessage = {
            role: "system",
            content: `Utiliza la siguiente información para responder:\n\n${info}`
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
                temperature: 0.2
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "Error en la API de Groq.");
        }

        const data = await response.json();
        const respuestaIA = data.choices?.[0]?.message?.content || "No tengo esa información en este momento.";

        // 3️⃣ Guardar en la base de datos la nueva respuesta
        await guardarEnBD(message, respuestaIA);

        res.json({ reply: respuestaIA });

    } catch (error) {
        console.error("Error en la solicitud:", error.message);
        res.status(500).json({ error: "Error al procesar la solicitud." });
    }
});

// Configuración de Twilio
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
// 🔹 Endpoint del chatbot whatsapp
app.post("/api/whatsapp", async (req, res) => {
    const { Body, From } = req.body; // 📩 Mensaje recibido y número del usuario

    if (!Body) {
        return res.status(400).send("El mensaje es requerido.");
    }

    try {
        // 1️⃣ Buscar en la base de datos primero
        const respuestaBD = await buscarEnBD(Body);
        if (respuestaBD) {
            await twilioClient.messages.create({
                body: respuestaBD,
                from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
                to: From
            });
            return res.status(200).send("Mensaje enviado desde la BD");
        }

        // 2️⃣ Si no está en la BD, cargar información del archivo
        const info = await cargarInformacion();

        // 3️⃣ Consultar la IA con la información del documento
        const systemMessage = {
            role: "system",
            content: `Utiliza la siguiente información para responder:\n\n${info}`
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
                max_tokens: 100
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "Error en la API de Groq.");
        }

        const data = await response.json();
        const respuestaIA = data.choices?.[0]?.message?.content || "No tengo esa información en este momento.";

        // 4️⃣ Guardar la nueva respuesta en la BD
        await guardarEnBD(Body, respuestaIA);

        // 5️⃣ Enviar la respuesta al usuario vía WhatsApp
        await twilioClient.messages.create({
            body: respuestaIA,
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to: From
        });

        res.status(200).send("Mensaje enviado desde la IA y guardado en la BD");

    } catch (error) {
        console.error("❌ Error en WhatsApp:", error);
        res.status(500).send("Error interno en el chatbot");
    }
});
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
