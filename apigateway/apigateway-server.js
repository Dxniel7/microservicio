const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');
const winston = require('winston');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

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

// Ruta: Películas
app.get('/api/peliculas', async (req, res) => {
    try {
        const response = await axios.get('http://localhost:3001/peliculas');
        logger.info('Consulta de películas realizada');
        res.json(response.data);
    } catch (err) {
        logger.error('Error en /api/peliculas: ' + err.message);
        res.status(500).send('Error al obtener películas');
    }
});

// Ruta: Ventas
app.get('/api/ventas', async (req, res) => {
    try {
        const response = await axios.get('http://localhost:3002/ventas');
        logger.info('Consulta de ventas realizada');
        res.json(response.data);
    } catch (err) {
        logger.error('Error en /api/ventas: ' + err.message);
        res.status(500).send('Error al obtener ventas');
    }
});

// Ruta: Compras
app.post('/api/compras', async (req, res) => {
    try {
        const response = await axios.post('http://localhost:3003/comprar', req.body);
        logger.info(`Compra realizada por ${req.body.nombre_cliente}`);
        res.json(response.data);
    } catch (err) {
        logger.error('Error en /api/compras: ' + err.message);
        res.status(500).send('Error al realizar la compra');
    }
});

// Inicio
app.listen(port, () => {
    logger.info(`API Gateway escuchando en http://localhost:${port}`);
});
