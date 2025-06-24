const express_peliculas = require('express');
const { Sequelize: Sequelize_peliculas, DataTypes: DataTypes_peliculas } = require('sequelize');
const cors_peliculas = require('cors');
const morgan_peliculas = require('morgan');
const winston_peliculas = require('winston');

const app_peliculas = express_peliculas();
const port_peliculas = process.env.PORT || 3001;

app_peliculas.use(cors_peliculas());
app_peliculas.use(express_peliculas.json());

const logger_peliculas = winston_peliculas.createLogger({
    level: 'info',
    format: winston_peliculas.format.combine(
        winston_peliculas.format.timestamp(),
        winston_peliculas.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [ new winston_peliculas.transports.Console() ]
});

app_peliculas.use(morgan_peliculas('combined', { stream: { write: (message) => logger_peliculas.info(message.trim()) } }));

const sequelize_peliculas = new Sequelize_peliculas(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: msg => logger_peliculas.info(msg),
        define: { timestamps: false },
        dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
    }
);

const Pelicula_Model = sequelize_peliculas.define('Pelicula', {
    id: { type: DataTypes_peliculas.INTEGER, autoIncrement: true, primaryKey: true },
    nombre: { type: DataTypes_peliculas.STRING(255), allowNull: false },
    stock: { type: DataTypes_peliculas.INTEGER, allowNull: false, defaultValue: 0 }
}, { tableName: 'peliculas', timestamps: false });

sequelize_peliculas.authenticate()
    .then(() => {
        logger_peliculas.info('Películas: Conectado a MySQL con Sequelize.');
        return sequelize_peliculas.sync({ alter: true });
    })
    .then(() => Pelicula_Model.count())
    .then(count => {
        if (count === 0) {
            logger_peliculas.info('Insertando datos iniciales de películas...');
            return Pelicula_Model.bulkCreate([
                { nombre: 'Spiderman: De Regreso a Casa', stock: 50 },
                { nombre: 'Doctor Strange en el Multiverso de la Locura', stock: 40 },
                { nombre: 'Guardianes de la la Galaxia Vol. 3', stock: 60 },
                { nombre: 'Avatar: El Sentido del Agua', stock: 35 }
            ]);
        }
    })
    .then(() => {
        logger_peliculas.info('Películas: Tabla sincronizada y datos asegurados.');
        app_peliculas.listen(port_peliculas, () => {
            logger_peliculas.info(`Películas escuchando en el puerto ${port_peliculas}`);
        });
    })
    .catch(err => {
        logger_peliculas.error('Error al conectar/sincronizar la DB: ' + err.message);
        process.exit(1);
    });

app_peliculas.get('/peliculas', async (req, res) => {
    try {
        const peliculas = await Pelicula_Model.findAll();
        res.json(peliculas);
    } catch (err) {
        logger_peliculas.error('Error al obtener películas: ' + err.message);
        res.status(500).send('Error');
    }
});
