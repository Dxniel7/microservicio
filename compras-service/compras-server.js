const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const cors = require('cors');
const morgan = require('morgan');
const winston = require('winston');

const app = express();
// Azure nos da el puerto a través de la variable de entorno PORT
const port = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [ new winston.transports.Console() ]
});

app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// --- Configuración de la Conexión a la Base de Datos con Sequelize (CORREGIDO) ---
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: msg => logger.info(msg),
        define: { timestamps: false },
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
    }
);

// --- Definición de Modelos ---
const Pelicula = sequelize.define('Pelicula', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    nombre: { type: DataTypes.STRING(255), allowNull: false },
    stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, { tableName: 'peliculas', timestamps: false });

const Venta = sequelize.define('Venta', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    nombre_cliente: { type: DataTypes.STRING(255), allowNull: false },
    cantidad: { type: DataTypes.INTEGER, allowNull: false },
    pelicula: { type: DataTypes.STRING(255), allowNull: false }
}, { tableName: 'ventas', timestamps: false });

// --- Sincronización e Inicio del Servidor ---
sequelize.authenticate()
    .then(() => {
        logger.info('Compras: Conectado a MySQL con Sequelize.');
        return sequelize.sync({ alter: true });
    })
    .then(() => {
        logger.info('Compras: Tablas "peliculas" y "ventas" sincronizadas.');
        app.listen(port, () => {
            logger.info(`Microservicio de compras escuchando en el puerto ${port}`);
        });
    })
    .catch(err => {
        logger.error('Error al conectar/sincronizar la DB: ' + err.message);
        process.exit(1);
    });

// --- Ruta POST /comprar ---
app.post('/comprar', async (req, res) => {
    const { nombre_cliente, cantidad, pelicula } = req.body;
    if (!nombre_cliente || !cantidad || !pelicula) {
        logger.warn('Compra fallida: faltan datos');
        return res.status(400).json({ error: 'Faltan datos necesarios' });
    }
    try {
        const peliculaEncontrada = await Pelicula.findOne({ where: { nombre: pelicula } });
        if (!peliculaEncontrada) {
            return res.status(404).json({ error: 'Película no encontrada' });
        }
        if (peliculaEncontrada.stock < cantidad) {
            return res.status(400).json({ error: 'No hay suficientes boletos disponibles' });
        }
        await Pelicula.update({ stock: peliculaEncontrada.stock - cantidad }, { where: { nombre: pelicula } });
        await Venta.create({ nombre_cliente, cantidad, pelicula });
        logger.info(`Venta registrada para ${nombre_cliente}`);
        res.status(200).json({ success: true, message: 'Compra realizada con éxito' });
    } catch (err) {
        logger.error('Error en el proceso de compra: ' + err.message);
        res.status(500).json({error: 'Error interno al procesar la compra.'});
    }
});

