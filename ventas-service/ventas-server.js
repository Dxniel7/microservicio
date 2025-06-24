const express_ventas = require('express');
const { Sequelize: Sequelize_ventas, DataTypes: DataTypes_ventas } = require('sequelize');
const cors_ventas = require('cors');
const morgan_ventas = require('morgan');
const winston_ventas = require('winston');

const app_ventas = express_ventas();
const port_ventas = process.env.PORT || 3002;

app_ventas.use(cors_ventas());
app_ventas.use(express_ventas.json());

const logger_ventas = winston_ventas.createLogger({
    level: 'info',
    format: winston_ventas.format.combine(
        winston_ventas.format.timestamp(),
        winston_ventas.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [ new winston_ventas.transports.Console() ]
});

app_ventas.use(morgan_ventas('combined', { stream: { write: (message) => logger_ventas.info(message.trim()) } }));

const sequelize_ventas = new Sequelize_ventas(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: msg => logger_ventas.info(msg),
        define: { timestamps: false },
        dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
    }
);

const Venta_Model = sequelize_ventas.define('Venta', {
    id: { type: DataTypes_ventas.INTEGER, autoIncrement: true, primaryKey: true },
    nombre_cliente: { type: DataTypes_ventas.STRING(255), allowNull: false },
    cantidad: { type: DataTypes_ventas.INTEGER, allowNull: false },
    pelicula: { type: DataTypes_ventas.STRING(255), allowNull: false }
}, { tableName: 'ventas', timestamps: false });

sequelize_ventas.authenticate()
    .then(() => {
        logger_ventas.info('Ventas: Conectado a MySQL con Sequelize.');
        return sequelize_ventas.sync({ alter: true });
    })
    .then(() => {
        logger_ventas.info('Ventas: Tabla sincronizada.');
        app_ventas.listen(port_ventas, () => {
            logger_ventas.info(`Ventas escuchando en el puerto ${port_ventas}`);
        });
    })
    .catch(err => {
        logger_ventas.error('Error al conectar/sincronizar la DB: ' + err.message);
        process.exit(1);
    });

app_ventas.get('/ventas', async (req, res) => {
    try {
        const ventas = await Venta_Model.findAll();
        res.json(ventas);
    } catch (err) {
        logger_ventas.error('Error al obtener ventas: ' + err.message);
        res.status(500).send('Error');
    }
});
