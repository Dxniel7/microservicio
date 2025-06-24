const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');
const winston = require('winston');
const fs = require('fs');
const path = require('path');

const app = express();

// Azure App Service nos da el puerto a través de una variable de entorno
const port = process.env.PORT || 3000;

// Asegurar que exista la carpeta "logs"
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Logger con Winston
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/errores.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/todo.log' })
    ]
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined', {
    stream: {
        write: (message) => logger.info(message.trim())
    }
}));

// Obtenemos las URLs de los microservicios desde las variables de entorno
const peliculasServiceUrl = process.env.PELICULAS_SERVICE_URL;
const ventasServiceUrl = process.env.VENTAS_SERVICE_URL;
const comprasServiceUrl = process.env.COMPRAS_SERVICE_URL;

// Ruta: Películas
app.get('/api/peliculas', async (req, res) => {
    if (!peliculasServiceUrl) {
        logger.error('URL del servicio de películas no configurada (PELICULAS_SERVICE_URL)');
        return res.status(500).send('Error de configuración del servidor');
    }
    try {
        const response = await axios.get(`${peliculasServiceUrl}/peliculas`);
        logger.info('Consulta de películas realizada');
        res.json(response.data);
    } catch (err) {
        logger.error('Error en /api/peliculas: ' + err.message);
        res.status(500).send('Error al obtener películas');
    }
});

// Ruta: Ventas
app.get('/api/ventas', async (req, res) => {
    if (!ventasServiceUrl) {
        logger.error('URL del servicio de ventas no configurada (VENTAS_SERVICE_URL)');
        return res.status(500).send('Error de configuración del servidor');
    }
    try {
        const response = await axios.get(`${ventasServiceUrl}/ventas`);
        logger.info('Consulta de ventas realizada');
        res.json(response.data);
    } catch (err) {
        logger.error('Error en /api/ventas: ' + err.message);
        res.status(500).send('Error al obtener ventas');
    }
});

// Ruta: Compras
app.post('/api/compras', async (req, res) => {
    if (!comprasServiceUrl) {
        logger.error('URL del servicio de compras no configurada (COMPRAS_SERVICE_URL)');
        return res.status(500).send('Error de configuración del servidor');
    }
    try {
        const response = await axios.post(`${comprasServiceUrl}/comprar`, req.body);
        logger.info(`Compra realizada por ${req.body.nombre_cliente}`);
        res.json(response.data);
    } catch (err) {
        // Si el error viene de axios, reenviamos el status y el cuerpo del error
        if (err.response) {
            logger.error(`Error del servicio de compras: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
            res.status(err.response.status).json(err.response.data);
        } else {
            logger.error('Error en /api/compras: ' + err.message);
            res.status(500).send('Error al realizar la compra');
        }
    }
});

// Inicio
app.listen(port, () => {
    logger.info(`API Gateway escuchando en el puerto ${port}`);
});
