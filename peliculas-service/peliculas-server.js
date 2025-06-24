const express = require('express');
const { Sequelize, DataTypes } = require('sequelize'); // Importamos Sequelize y DataTypes
const cors = require('cors');
const morgan = require('morgan');
const winston = require('winston');

const app = express();
const port = 3001; // Puerto en el que escucha este microservicio

// Habilitar CORS para permitir solicitudes desde el frontend
app.use(cors());
// Habilitar el parsing de JSON en las solicitudes
app.use(express.json());

// Configuración del Logger (Winston)
const logger = winston.createLogger({
    level: 'info', // Nivel mínimo de logs a guardar
    format: winston.format.combine(
        winston.format.timestamp(), // Añadir fecha y hora al log
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(), // Mostrar logs en la consola
        new winston.transports.File({ filename: 'logs/errores.log', level: 'error' }), // Guardar errores en un archivo
        new winston.transports.File({ filename: 'logs/todo.log' }) // Guardar todos los logs en otro archivo
    ]
});

// Middleware para logs de solicitudes HTTP (Morgan)
app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) } // Redirigir logs de Morgan a Winston
}));

// --- Configuración de la Conexión a la Base de Datos con Sequelize ---
// --- Configuración de la Conexión a la Base de Datos con Sequelize ---
const sequelize = new Sequelize(
    process.env.DB_NAME,    // Nombre de la base de datos
    process.env.DB_USER,    // Usuario
    process.env.DB_PASS,    // Contraseña
    {
        host: process.env.DB_HOST, // Host del servidor de base de datos
        dialect: 'mysql',
        logging: msg => logger.info(msg),
        define: {
            timestamps: false
        },
        dialectOptions: { // <-- AÑADIR ESTA SECCIÓN IMPORTANTE
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
    }
);

// --- Definición del Modelo Pelicula (dentro del mismo archivo) ---
const Pelicula = sequelize.define('Pelicula', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    nombre: {
        type: DataTypes.STRING(255), // VARCHAR(255) en SQL
        allowNull: false // NOT NULL en SQL
    },
    stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0 // DEFAULT 0 en SQL
    }
}, {
    tableName: 'peliculas', // Asegura que la tabla en la DB se llame 'peliculas'
    timestamps: false // Deshabilita las columnas createdAt y updatedAt solo para este modelo
});

// --- Sincronización de la Base de Datos y el Modelo ---
// Esto intentará conectar a MySQL y, si tiene éxito, creará/actualizará la tabla 'peliculas'.
sequelize.authenticate()
    .then(() => {
        logger.info('Películas: Conectado a MySQL con Sequelize.');
        return sequelize.sync({ alter: true }); // <--- ¡Aquí se crea/actualiza la tabla!
    })
    .then(() => {
        logger.info('Películas: Tabla "peliculas" sincronizada (creada/actualizada) correctamente.');

        // Opcional: Insertar datos iniciales si la tabla está vacía
        return Pelicula.count(); // Contamos cuántas películas hay
    })
    .then(count => {
        if (count === 0) {
            logger.info('Insertando datos iniciales en la tabla peliculas...');
            return Pelicula.bulkCreate([
                { nombre: 'Spiderman: De Regreso a Casa', stock: 50 },
                { nombre: 'Doctor Strange en el Multiverso de la Locura', stock: 40 },
                { nombre: 'Guardianes de la la Galaxia Vol. 3', stock: 60 },
                { nombre: 'Avatar: El Sentido del Agua', stock: 35 }
            ]);
        }
    })
    .then(() => {
        logger.info('Datos iniciales de películas asegurados.');

        // Iniciar el servidor Express solo después de que la DB esté lista
        app.listen(port, () => {
            logger.info(`Películas escuchando en http://localhost:${port}`);
        });
    })
    .catch(err => {
        logger.error('Error al conectar/sincronizar la base de datos con Sequelize: ' + err.message);
        process.exit(1); // Salir de la aplicación si hay un problema crítico con la DB
    });


// --- Ruta GET /peliculas ---
// Ahora usamos el modelo Pelicula de Sequelize para consultar los datos
app.get('/peliculas', (req, res) => {
    Pelicula.findAll() // Equivalente a SELECT * FROM peliculas
        .then(peliculas => {
            logger.info('Películas consultadas correctamente');
            res.json(peliculas);
        })
        .catch(err => {
            logger.error('Error al obtener películas con Sequelize: ' + err.message);
            res.status(500).send('Error');
        });
});

// El `app.listen` se ha movido dentro del .then() de la sincronización de la DB
// para asegurar que el servidor no inicie hasta que la conexión y tabla estén listas.