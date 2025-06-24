const express = require('express');
const { Sequelize, DataTypes } = require('sequelize'); // Importamos Sequelize y DataTypes
const cors = require('cors');
const morgan = require('morgan');
const winston = require('winston');

const app = express();
const port = 3002; // Puerto en el que escucha este microservicio

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
const sequelize = new Sequelize('cineboletos', 'root', 'root', { // Base de datos, Usuario, Contraseña
    host: 'localhost',
    dialect: 'mysql', // Tipo de base de datos
    logging: msg => logger.info(msg), // Mostrar logs de Sequelize en la consola (o false para deshabilitar)
    define: {
        timestamps: false // Deshabilita las columnas createdAt y updatedAt por defecto en todos los modelos
    }
});

// --- Definición del Modelo Venta (dentro del mismo archivo) ---
const Venta = sequelize.define('Venta', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    nombre_cliente: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    cantidad: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    pelicula: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    // Opcional: podrías añadir una columna para la fecha de la venta
    // fecha_venta: {
    //     type: DataTypes.DATE,
    //     defaultValue: DataTypes.NOW
    // }
}, {
    tableName: 'ventas', // Asegura que la tabla en la DB se llame 'ventas'
    timestamps: false // No crear columnas 'createdAt' y 'updatedAt' automáticamente
});


// --- Sincronización de la Base de Datos y el Modelo ---
// Esto intentará conectar a MySQL y, si tiene éxito, creará/actualizará la tabla 'ventas'.
sequelize.authenticate()
    .then(() => {
        logger.info('Ventas: Conectado a MySQL con Sequelize.');
        return sequelize.sync({ alter: true }); // <--- ¡Aquí se crea/actualiza la tabla!
    })
    .then(() => {
        logger.info('Ventas: Tabla "ventas" sincronizada (creada/actualizada) correctamente.');

        // Opcional: Insertar algunos datos de ejemplo si la tabla está vacía
        // Comenta o elimina esto si no quieres que inserte datos cada vez en desarrollo.
        return Venta.count();
    })
    .then(count => {
        if (count === 0) {
            logger.info('Insertando datos iniciales en la tabla ventas...');
            return Venta.bulkCreate([
                { nombre_cliente: 'Ana Lopez', cantidad: 2, pelicula: 'Spiderman: De Regreso a Casa' },
                { nombre_cliente: 'Juan Perez', cantidad: 1, pelicula: 'Doctor Strange en el Multiverso de la Locura' },
                { nombre_cliente: 'Maria Garcia', cantidad: 3, pelicula: 'Guardianes de la la Galaxia Vol. 3' }
            ]);
        }
    })
    .then(() => {
        logger.info('Datos iniciales de ventas asegurados.');

        // Iniciar el servidor Express solo después de que la DB esté lista
        app.listen(port, () => {
            logger.info(`Ventas escuchando en http://localhost:${port}`);
        });
    })
    .catch(err => {
        logger.error('Error al conectar/sincronizar la base de datos con Sequelize: ' + err.message);
        process.exit(1); // Salir de la aplicación si hay un problema crítico con la DB
    });


// --- Ruta GET /ventas ---
// Esta ruta devuelve todas las ventas de la base de datos usando el modelo Venta
app.get('/ventas', (req, res) => {
    Venta.findAll() // Equivalente a SELECT * FROM ventas
        .then(ventas => {
            logger.info('Ventas consultadas correctamente');
            res.json(ventas);
        })
        .catch(err => {
            logger.error('Error al obtener ventas con Sequelize: ' + err.message);
            res.status(500).send('Error');
        });
});

// --- Ruta DELETE /limpiarVentas ---
// Esta ruta elimina todas las ventas de la base de datos usando el modelo Venta
app.delete('/limpiarVentas', (req, res) => {
    Venta.destroy({
        truncate: true // Borra todos los registros de la tabla y resetea auto-increment
    })
        .then(() => {
            logger.info('Ventas eliminadas correctamente');
            res.send('Historial de ventas limpio');
        })
        .catch(err => {
            logger.error('Error al limpiar ventas con Sequelize: ' + err.message);
            res.status(500).send('Error');
        });
});

// El `app.listen` se ha movido dentro del .then() de la sincronización de la DB
// para asegurar que el servidor no inicie hasta que la conexión y tabla estén listas.