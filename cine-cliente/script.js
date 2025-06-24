let boletosDisponibles = 30;
let ventas = [];
const peliculas = [];

// Función para obtener las películas
function obtenerPeliculas() {
    fetch('https://app-apigateway-gnabbzdfd8h8g4hd.canadacentral-01.azurewebsites.net/api/peliculas')
        .then(response => response.json())
        .then(peliculasData => {
            peliculas.length = 0; // Limpiar el array de películas
            const selectPelicula = document.getElementById("peliculaSeleccionada");
            selectPelicula.innerHTML = '<option value="">Selecciona una película</option>'; // Limpiar antes de añadir
            peliculasData.forEach(pelicula => {
                peliculas.push(pelicula);
                const option = document.createElement("option");
                option.value = pelicula.nombre;
                option.textContent = `${pelicula.nombre} - Stock: ${pelicula.stock}`;
                selectPelicula.appendChild(option);
            });
        })
        .catch(error => console.error('Error al obtener las películas', error));
}

// Función para obtener las ventas realizadas
function obtenerVentas() {
    fetch('https://app-apigateway-gnabbzdfd8h8g4hd.canadacentral-01.azurewebsites.net/api/ventas') // Obtener ventas desde el backend
        .then(response => response.json())
        .then(ventasData => {
            ventas = ventasData; // Guardar las ventas en el array
            actualizarVentas(); // Actualizar la interfaz con las ventas obtenidas
        })
        .catch(error => console.error('Error al obtener las ventas', error));
}

// Función para comprar boletos
function comprarBoletos() {
    const nombre = document.getElementById("nombreCliente").value.trim();
    const cantidad = parseInt(document.getElementById("cantidadBoletos").value);
    const pelicula = document.getElementById("peliculaSeleccionada").value;

    // Validar los datos antes de enviar la solicitud
    if (!nombre || isNaN(cantidad) || cantidad <= 0 || !pelicula) {
        mostrarMensaje("Por favor, ingresa tu nombre, selecciona una película y una cantidad válida.", true);
        return;
    }

    // Enviar la compra a la API
    fetch('https://app-apigateway-gnabbzdfd8h8g4hd.canadacentral-01.azurewebsites.net/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_cliente: nombre, cantidad: cantidad, pelicula })
    })
        .then(response => response.json())
        .then(data => {
            // Verifica si la compra fue exitosa
            if (data.success) {
                // No actualizamos el stock en el frontend directamente.
                // Llamamos a obtenerPeliculas() para obtener el stock real desde la fuente de verdad (la DB).
                obtenerPeliculas(); 
                obtenerVentas(); // Volver a obtener las ventas actualizadas
                mostrarMensaje(`Compra exitosa de ${cantidad} boleto(s) para la película ${pelicula}.`);
            } else {
                mostrarMensaje(data.error || 'Ocurrió un error en la compra.', true); // Mostrar error si la compra falla
            }
        })
        .catch(error => {
            mostrarMensaje("Hubo un problema al procesar la compra.", true);
            console.error("Error en fetch de compra:", error);
        });
}

// Actualiza las películas en el select
function actualizarPeliculas() {
    const selectPelicula = document.getElementById("peliculaSeleccionada");
    selectPelicula.innerHTML = '<option value="">Selecciona una película</option>'; // Limpiar las opciones
    peliculas.forEach(pelicula => {
        const option = document.createElement("option");
        option.value = pelicula.nombre;
        option.textContent = `${pelicula.nombre} - Stock: ${pelicula.stock}`;
        selectPelicula.appendChild(option);
    });
}

// Actualiza la lista de ventas
function actualizarVentas() {
    const lista = document.getElementById("listaVentas");
    lista.innerHTML = ""; // Limpiar la lista de ventas antes de actualizarla
    ventas.forEach(venta => {
        const item = document.createElement("li");
        item.textContent = `${venta.nombre_cliente} compró ${venta.cantidad} boleto(s) para la película ${venta.pelicula}`;
        lista.appendChild(item);
    });
}

// Mostrar mensaje al usuario
function mostrarMensaje(mensaje, error = false) {
    const mensajeEl = document.getElementById("mensaje");
    mensajeEl.textContent = mensaje;
    mensajeEl.style.color = error ? "red" : "green";
}

// Llamar a obtenerPeliculas y obtenerVentas cada 10 segundos para actualizar el stock y las ventas
// setInterval(obtenerVentas, 10000); // Esto puede ser muy frecuente, lo comentamos por ahora.
obtenerPeliculas(); // Llamada inicial para obtener las películas
obtenerVentas(); // Llamada inicial para obtener las ventas

// Se elimina el listener duplicado, el de abajo es el correcto.

// --- NUEVO CÓDIGO PARA REGISTRAR EL SERVICE WORKER (PARA PWA) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registrado con éxito con el scope: ', registration.scope);
            })
            .catch(error => {
                console.error('Fallo el registro del Service Worker: ', error);
            });
    });
}
