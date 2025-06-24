const express = require('express');
const { Sequelize, DataTypes } = require('sequelize'); // Importamos Sequelize y DataTypes
const cors = require('cors'); // <--- ¡Línea corregida!
const morgan = require('morgan');
const winston = require('winston');

const app = express();
const port = 3003; // Puerto en el que escucha este microservicio

// Middleware
app.use(cors());
app.use(express.json());

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

// Logging HTTP con Morgan + Winston
app.use(morgan('combined', {
    stream: {
        write: (message) => logger.info(message.trim())
    }
}));

// --- Configuración de la Conexión a la Base de Datos con Sequelize ---
const sequelize = new Sequelize('cineboletos', 'root', 'root', { // Base de datos, Usuario, Contraseña
    host: 'localhost',
    dialect: 'mysql', // Tipo de base de datos
    logging: msg => logger.info(msg), // Mostrar logs de Sequelize
    define: {
        timestamps: false // Deshabilita las columnas createdAt y updatedAt por defecto en todos los modelos
    }
});

// --- Definición del Modelo Pelicula (para interacciones de stock) ---
const Pelicula = sequelize.define('Pelicula', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    nombre: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
}, {
    tableName: 'peliculas', // Asegura que se mapee a la tabla 'peliculas'
    timestamps: false
});

// --- Definición del Modelo Venta (para registrar compras) ---
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
    // Puedes añadir una columna para la fecha de la venta si lo deseas, por ejemplo:
    // fecha_venta: {
    //     type: DataTypes.DATE,
    //     defaultValue: DataTypes.NOW
    // }
}, {
    tableName: 'ventas', // Asegura que se mapee a la tabla 'ventas'
    timestamps: false
});

// --- Sincronización de la Base de Datos y los Modelos ---
// Intentará conectar a MySQL y, si tiene éxito, creará/actualizará las tablas.
sequelize.authenticate()
    .then(() => {
        logger.info('Compras: Conectado a MySQL con Sequelize.');
        // Sincroniza AMBAS tablas que este servicio va a usar
        return sequelize.sync({ alter: true }); // <--- ¡Crea/actualiza tablas 'peliculas' y 'ventas'!
    })
    .then(() => {
        logger.info('Compras: Tablas "peliculas" y "ventas" sincronizadas (creadas/actualizadas) correctamente.');

        // Opcional: Asegurar datos iniciales para la tabla 'peliculas'
        // Esto es útil si este servicio es el primero en arrancar o el único que maneja el stock inicial.
        // Si peliculas-service ya hace esto, podrías considerar omitir esta parte aquí
        return Pelicula.count();
    })
    .then(count => {
        if (count === 0) {
            logger.info('Insertando datos iniciales de películas para asegurar stock...');
            return Pelicula.bulkCreate([
                { nombre: 'Spiderman: De Regreso a Casa', stock: 50 },
                { nombre: 'Doctor Strange en el Multiverso de la Locura', stock: 40 },
                { nombre: 'Guardianes de la la Galaxia Vol. 3', stock: 60 },
                { nombre: 'Avatar: El Sentido del Agua', stock: 35 }
            ]);
        }
    })
    .then(() => {
        logger.info('Datos iniciales de películas asegurados para el servicio de compras.');
        // Iniciar el servidor Express solo después de que la DB y tablas estén listas
        app.listen(port, () => {
            logger.info(`Microservicio de compras escuchando en http://localhost:${port}`);
        });
    })
    .catch(err => {
        logger.error('Error al conectar/sincronizar la base de datos con Sequelize: ' + err.message);
        process.exit(1); // Salir de la aplicación si hay un problema crítico con la DB
    });


// --- POST /comprar ---
// Adaptado para usar Sequelize
app.post('/comprar', async (req, res) => { // Usamos async para poder usar await
    const { nombre_cliente, cantidad, pelicula } = req.body;

    if (!nombre_cliente || !cantidad || !pelicula) {
        logger.warn('Compra fallida: faltan datos');
        return res.status(400).json({ error: 'Faltan datos necesarios' });
    }

    try {
        // 1. Verificar stock
        const peliculaEncontrada = await Pelicula.findOne({
            where: { nombre: pelicula }
        });

        if (!peliculaEncontrada) {
            logger.info(`Compra rechazada: Película "${pelicula}" no encontrada.`);
            return res.status(404).json({ error: 'Película no encontrada' });
        }

        const stockDisponible = peliculaEncontrada.stock;

        if (stockDisponible < cantidad) {
            logger.info(`Compra rechazada por stock insuficiente: ${pelicula}, solicitado: ${cantidad}, disponible: ${stockDisponible}`);
            return res.status(400).json({ error: 'No hay suficientes boletos disponibles' });
        }

        // 2. Actualizar stock
        // Sequelize maneja transacciones automáticamente para estas operaciones si están bien definidas,
        // pero para operaciones separadas como esta, podríamos necesitar una transacción explícita si la integridad es crítica.
        // Para este ejemplo, haremos las operaciones secuencialmente.
        await Pelicula.update(
            { stock: stockDisponible - cantidad },
            { where: { nombre: pelicula } }
        );
        logger.info(`Stock actualizado para ${pelicula}: Nuevo stock = ${stockDisponible - cantidad}`);


        // 3. Registrar venta
        await Venta.create({
            nombre_cliente,
            cantidad,
            pelicula
        });
        logger.info(`Venta realizada: ${nombre_cliente} compró ${cantidad} boletos de ${pelicula}`);

        res.status(200).json({ success: true });

    } catch (err) {
        // Manejo centralizado de errores para las operaciones de DB
        logger.error('Error en el proceso de compra: ' + err.message);
        res.status(500).send('Error interno al procesar la compra.');
    }
});