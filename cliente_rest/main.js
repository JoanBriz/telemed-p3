var seccionActual = "acceso";
var idGestorActual = null;
var idRecursoActual = null;
var conexionWS = null;

var listaModelos = [];
var listaCategorias = [];
var listaUbicaciones = [];
//P3
var URL_MINISTERIO = "https://undefined.ua.es/telemedicina/api/datos";
var ID_AREA = 3; // Cardiología

function cambiarSeccion(seccion){ 
    document.getElementById(seccionActual).style.display = "none";
    document.getElementById(seccion).style.display = "block";
    seccionActual = seccion;
}

function salir() {
    if (conexionWS) {
        conexionWS.close();
        conexionWS = null;
    }
    rest.token = null;       // P3: quitamos la "pulsera"
    idGestorActual = null;
    cambiarSeccion('acceso');
}

function getNombreModelo(id) {
    for (var i = 0; i < listaModelos.length; i++) {
        if (listaModelos[i].id == id) return listaModelos[i].nombre;
    }
    return id;
}

function getNombreCategoria(id) {
    for (var i = 0; i < listaCategorias.length; i++) {
        if (listaCategorias[i].id == id) return listaCategorias[i].nombre;
    }
    return id;
}

function getNombreUbicacion(id) {
    for (var i = 0; i < listaUbicaciones.length; i++) {
        if (listaUbicaciones[i].id == id) return listaUbicaciones[i].nombre;
    }
    return id;
}

function getNombreEstado(val) {
    if (val == 0) return "Operativo";
    if (val == 1) return "De baja o defectuoso";
    if (val == 2) return "En mantenimiento";
    return val;
}

function cargarListados() {
    rest.get("/api/modelos", function(estado, respuesta) {
        if (estado == 200) listaModelos = respuesta;
    });
    rest.get("/api/categorias", function(estado, respuesta) {
        if (estado == 200) listaCategorias = respuesta;
    });
    rest.get("/api/ubicaciones", function(estado, respuesta) {
        if (estado == 200) listaUbicaciones = respuesta;
    });
}

function login() {
    var gestor = {
        usuario: document.getElementById("usuario").value,
        contraseña: document.getElementById("contraseña").value
    };

    rest.post("/api/gestores/login", gestor, function(estado, respuesta) {
        if(estado == 200) {
            idGestorActual = respuesta.id;   // P3: el servidor ahora devuelve { id, token }
            rest.token = respuesta.token;    // P3: a partir de aquí, rest.js lo añade a cada petición
            cargarListados();
            cambiarSeccion('home');
            obtenerDatosYBienvenida(idGestorActual);
            cargarRanking(); //P3
            seccionActual = 'home';
        } else {
            alert("Credenciales incorrectas.");
        }
    });
}

function obtenerDatosYBienvenida(id) {
    rest.get("/api/gestores/" + id, function(estado, respuesta) {
        if (estado == 200) {
            var nombreCompleto = respuesta.nombre + " " + respuesta.apellidos;
            document.getElementById("texto_bienvenida").innerHTML = "Bienvenido/a " + nombreCompleto;

            conexionWS = new WebSocket("ws://localhost:4445", "avisos");
            conexionWS.addEventListener("open", function() {
                conexionWS.send(JSON.stringify({
                    operacion: "identificar",
                    rol: "gestor",
                    id: idGestorActual,
                    nombre: nombreCompleto
                }));
            });

            conexionWS.addEventListener("message", function(msg) {
                var aviso = JSON.parse(msg.data);
                var tbody = document.getElementById("tbody_avisos");
                var fila = "<tr>"
                    + "<td style='background-color:" + aviso.color + ";'>" + new Date(aviso.fecha).toLocaleString() + "</td>"
                    + "<td style='background-color:" + aviso.color + ";'>" + aviso.origen + "</td>"
                    + "<td style='background-color:" + aviso.color + ";'>" + aviso.texto + "</td>"
                    + "</tr>";
                tbody.innerHTML += fila;
            });
        } 
    });
}

function registrarUsuario() {
    var gestor = {
        nombre: document.getElementById("reg_nombre").value,
        apellidos: document.getElementById("reg_apellidos").value,
        usuario: document.getElementById("reg_usuario").value,
        contraseña: document.getElementById("reg_contraseña").value
    }
    rest.post("/api/gestores", gestor, function (estado, respuesta) {
        if (estado == 201) {
            alert("Gestor añadido correctamente a la base de datos.");
            cambiarSeccion('acceso');
            seccionActual = 'acceso';
        } else {
            alert("Error al introducir gestor en la base de datos.")
        }
    });
}

function editarDatos(){
    cambiarSeccion('editarDatos');
    seccionActual = "editarDatos";
}

function modificarUsuario() {
    var gestor = {
        id: idGestorActual,
        nombre: document.getElementById("mod_nombre").value,
        apellidos: document.getElementById("mod_apellidos").value,
        usuario: document.getElementById("mod_usuario").value,
        contraseña: document.getElementById("mod_contraseña").value
    }
    rest.put("/api/gestores/" + idGestorActual, gestor, function(estado, respuesta) {
        if (estado == 201) {
            alert("Se han actualizado correctamente los datos.");
            cambiarSeccion('home');
        } else {
            alert("No se han actualizado los datos del gestor.")
        } 
    });
}

function mostrarRecursos() {
    var categoria = document.getElementById("home_categoria").value;
    var modelo = document.getElementById("home_modelo").value;
    var ubicacion = document.getElementById("home_ubicacion").value;
    var estadoVal = document.getElementById("home_estado").value;

    var url = "/api/recursos?";
    if (categoria != "0") url += "categoria=" + categoria + "&";
    if (modelo != "0") url += "modelo=" + modelo + "&";
    if (ubicacion != "0") url += "ubicacion=" + ubicacion + "&";
    if (estadoVal != "-1") url += "estado=" + estadoVal + "&";

    rest.get(url, function(estado, respuesta) {
        if (estado == 200) {
            var tbody = document.querySelector("#home table tbody");
            tbody.innerHTML = "";
            for (var i = 0; i < respuesta.length; i++) {
                var r = respuesta[i];
                var fila = "<tr>"
                    + "<td>" + r.numero_serie + "</td>"
                    + "<td>" + getNombreCategoria(r.categoria) + "</td>"
                    + "<td>" + getNombreModelo(r.modelo) + "</td>"
                    + "<td>" + getNombreUbicacion(r.ubicacion) + "</td>"
                    + "<td>" + getNombreEstado(r.estado) + "</td>"
                    + "<td>"
                    + "<button onclick=\"abrirRecursoConDatos(" + r.numero_serie + ")\">Abrir</button>"
                    + "<button onclick=\"borrarRecurso(" + r.numero_serie + ", this)\">X</button>"
                    + "</td>"
                    + "</tr>";
                tbody.innerHTML += fila;
            }
        } else {
            alert("No se han podido cargar los recursos.");
        }
    });
}

function añadirRecurso() {
    var recurso = {
        modelo: document.getElementById("rec_modelo").value,
        ubicacion: document.getElementById("rec_ubicacion").value,
        numero_serie: document.getElementById("rec_num_serie").value,
        estado: document.getElementById("rec_estado").value
    }

    //id= al de html
    // si no hace falta getElementId podmeos poner como gestor por ejemplo idRecursoActual
    //pero abria que poner idRecursoActual = recurso.id en abrirRecursoConDatos;

    rest.post("/api/recursos", recurso, function(estado, respuesta) {
        if(estado == 201) {
            alert("Recurso añadido correctamente a la base de datos.");
            //"/api/recursos/"+ idRecursoActual + "/X"

            var selectCategoria = document.getElementById("rec_categoria");
            var selectModelo = document.getElementById("rec_modelo");
            var selectUbicacion = document.getElementById("rec_ubicacion");
            var selectEstado = document.getElementById("rec_estado");

            var textoCategoria = selectCategoria.options[selectCategoria.selectedIndex].text;
            var textoModelo = selectModelo.options[selectModelo.selectedIndex].text;
            var textoUbicacion = selectUbicacion.options[selectUbicacion.selectedIndex].text;
            var textoEstado = selectEstado.options[selectEstado.selectedIndex].text;
            var numSerie = document.getElementById("rec_num_serie").value;

            if (conexionWS) {
                conexionWS.send(JSON.stringify({
                    operacion: "recursoCreado",
                    nombreCategoria: textoCategoria,
                    nombreModelo: textoModelo,
                    numeroSerie: numSerie
                }));
            }

            var tbody = document.querySelector("#home table tbody");
            var nuevaFila = "<tr>"
                + "<td>" + numSerie + "</td>"
                + "<td>" + textoCategoria + "</td>"
                + "<td>" + textoModelo + "</td>"
                + "<td>" + textoUbicacion + "</td>"
                + "<td>" + textoEstado + "</td>"
                + "<td>"
                + "<button onclick=\"abrirRecursoConDatos(" + numSerie + ")\">Abrir</button>"
                + "<button onclick=\"borrarRecurso(" + numSerie + ", this)\">X</button>"
                + "</td>"
                + "</tr>";
            tbody.innerHTML += nuevaFila;

            cambiarSeccion('home');
            seccionActual = 'home';
        } else {
            alert("El recurso no se ha podido añadir correctamente.");
        }
    });
}

function actualizarRecurso() {
    var numSerieRecurso = document.getElementById("añadir_num_serie").value;

    var recurso = {
        categoria: document.getElementById("añadir_categoria").options[document.getElementById("añadir_categoria").selectedIndex].text,
        modelo: document.getElementById("añadir_modelo").options[document.getElementById("añadir_modelo").selectedIndex].text,
        ubicacion: document.getElementById("añadir_ubicacion").options[document.getElementById("añadir_ubicacion").selectedIndex].text,
        estado: document.getElementById("añadir_estado").options[document.getElementById("añadir_estado").selectedIndex].text,
        id_modelo: document.getElementById("añadir_modelo").value,
        id_ubicacion: document.getElementById("añadir_ubicacion").value,
        id_estado: document.getElementById("añadir_estado").value
    }

    rest.put("/api/recursos/" + numSerieRecurso, {
        modelo: recurso.id_modelo,
        ubicacion: recurso.id_ubicacion,
        estado: recurso.id_estado
    }, function(estado, respuesta) {
        if(estado == 200) {
            alert("Recurso actualizado en la base de datos.");
            var filas = document.querySelectorAll("#home table tbody tr");
            filas.forEach(function(fila) {
                if (fila.cells[0].innerText == numSerieRecurso) {
                    fila.cells[1].innerText = recurso.categoria;
                    fila.cells[2].innerText = recurso.modelo;
                    fila.cells[3].innerText = recurso.ubicacion;
                    fila.cells[4].innerText = recurso.estado;
                }
            });
            cambiarSeccion('home');
        } else {
            alert("El recurso no se ha actualizado.");
        }
    });
}

function borrarRecurso(numSerie, boton) {
    if (confirm("¿Estás seguro de que deseas eliminar el recurso con Nº Serie: " + numSerie + "?")) {
        rest.delete("/api/recursos/" + numSerie, function(estado, respuesta) {
            if (estado == 200) {
                alert(respuesta);
                var fila = boton.parentNode.parentNode;
                fila.parentNode.removeChild(fila);
                cambiarSeccion('home');
                seccionActual = 'home';
            } else {
                alert("Error al borrar el recurso.");
            }
        });
    }
}

function abrirRecursoConDatos(numSerie) {
    rest.get("/api/recursos/" + numSerie, function(estado, recurso) {
        if (estado == 200) {
            document.getElementById("añadir_num_serie").value = recurso.numero_serie;
            document.getElementById("añadir_modelo").value = recurso.modelo;
            document.getElementById("añadir_ubicacion").value = recurso.ubicacion;
            document.getElementById("añadir_estado").value = recurso.estado.toString();
            cargarTablaReservas(recurso.id);
            cargarTablaResenyas(recurso.id);
            
            cambiarSeccion('actualizarRecurso');
        } else {
            alert("Error al cargar el recurso. El servidor no lo encuentra.");
        }
    });
}
// cargarTablaX(idRecursoActual); si crearamos una tabla post
//  y document.getElementById("X").value = ""

function cargarTablaReservas(idRecurso) {
    rest.get("/api/recursos/" + idRecurso + "/reservas", function(estado, reservas) {
        var tbody = document.getElementById("tabla_reservas_body");
        tbody.innerHTML = "";
        if (estado == 200) {
            reservas.forEach(function(r) {
                rest.get("/api/sanitarios/" + r.sanitario, function(st, san) {
                    var nombre = (st == 200) ? (san.nombre + " " + san.apellidos) : "ID: " + r.sanitario;
                    var colorFondo;
                    if (r.fecha_fin) {
                        colorFondo = "#ffffff";
                    } else if (r.fecha_inicio) {
                        var inicio = new Date(r.fecha_inicio);
                        var ahora = new Date();
                        var horasTranscurridas = (ahora - inicio) / (1000 * 60 * 60);
                        if (horasTranscurridas > r.horas_estimadas) {
                            colorFondo = "#fecaca";
                        } else {
                            colorFondo = "#bfdbfe";
                        }
                    } else {
                        colorFondo = "#d9f99d";
                    }
                    //tabla normal
                    var fila = "<tr>"
                        + "<td style='background-color:" + colorFondo + ";'>" + nombre + "</td>"
                        + "<td style='background-color:" + colorFondo + ";'>" + r.horas_estimadas + "</td>"
                        + "<td style='background-color:" + colorFondo + ";'>" + new Date(r.fecha_peticion).toLocaleDateString() + "</td>"
                        + "<td style='background-color:" + colorFondo + ";'>" + (r.fecha_inicio ? new Date(r.fecha_inicio).toLocaleDateString() : "-") + "</td>"
                        + "<td style='background-color:" + colorFondo + ";'>" + (r.fecha_fin ? new Date(r.fecha_fin).toLocaleDateString() : "-") + "</td>"
                        + "</tr>";
                    tbody.innerHTML += fila;
                });
            });
        }
    });
}

function cargarTablaResenyas(idRecurso) {
    rest.get("/api/recursos/" + idRecurso + "/resenyas", function(estado, resenyas) {
        var tbody = document.getElementById("tabla_resenas_body");
        tbody.innerHTML = "";
        if (estado == 200) {
            resenyas.forEach(function(r) { //hasta aqui jenerico 
                rest.get("/api/sanitarios/" + r.sanitario, function(st, san) {
                    var nombre = (st == 200) ? (san.nombre + " " + san.apellidos) : "ID: " + r.sanitario;
                    var fila = "<tr><td>"+new Date(r.fecha).toLocaleDateString()+"</td><td>"+nombre+"</td><td>"+r.valor+"</td><td>"+r.descripcion+"</td></tr>";
                    tbody.innerHTML += fila;
                });
            });
        }
    });
}

// ============================================================
// PRÁCTICA 3 - PARTE 1: integración con el Ministerio
// ============================================================

// Convierte una fecha a texto "YYYY-MM-DD". Si no hay fecha (null), devuelve null.
function fechaYMD(fecha) {
    if (!fecha) return null;
    var d = new Date(fecha);
    var mes = String(d.getMonth() + 1).padStart(2, "0");
    var dia = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mes + "-" + dia;
}

// Recoge TODAS las reservas de nuestra BD y monta el objeto que pide el Ministerio.
// Usa peticiones SÍNCRONAS (rest.get sin callback): cada una espera a su respuesta.
// Devuelve el objeto envio, o null si alguna petición falla.
function construirEnvio() {
    var envio = {
        id_area: ID_AREA,
        fecha: fechaYMD(new Date()),   // hoy
        datos: []
    };

    // 1) Todos los recursos
    var resp = rest.get("/api/recursos");
    if (resp.status != 200) return null;
    var recursos = resp.response;

    for (var i = 0; i < recursos.length; i++) {
        var recurso = recursos[i];

        // 2) Las reservas de este recurso
        var respReservas = rest.get("/api/recursos/" + recurso.id + "/reservas");
        if (respReservas.status != 200) return null;
        var reservas = respReservas.response;

        for (var j = 0; j < reservas.length; j++) {
            var reserva = reservas[j];

            // 3) El sanitario que hizo esta reserva
            var respSan = rest.get("/api/sanitarios/" + reserva.sanitario);
            if (respSan.status != 200) return null;
            var san = respSan.response;

            envio.datos.push({
                nombre: san.nombre,
                apellidos: san.apellidos,
                categoria: getNombreCategoria(recurso.categoria),
                horas_estimadas: reserva.horas_estimadas,
                fec_pet: fechaYMD(reserva.fecha_peticion),
                fec_ini: fechaYMD(reserva.fecha_inicio),
                fecha_fin: fechaYMD(reserva.fecha_fin)
            });
        }
    }
    return envio;
}

// Botón "Enviar reservas al Ministerio"
// Recoge las reservas de nuestra BD y las envía al Ministerio con un POST.
function enviarReservasMinisterio() {
    var msg = document.getElementById("msg_ministerio");

    // 1) Montar el objeto con nuestras reservas
    var envio = construirEnvio();
    if (envio == null) {
        msg.textContent = "Error al leer las reservas de nuestra base de datos.";
        return;
    }
    if (envio.datos.length == 0) {
        msg.textContent = "No hay reservas para enviar.";
        return;
    }

    // 2) Enviarlo al Ministerio (POST síncrono: espera la respuesta)
    var resp = rest.post(URL_MINISTERIO, envio);
    console.log("Respuesta del Ministerio:", resp.status, resp.response);

    // 3) Mostrar el resultado al gestor
    if (resp.status >= 200 && resp.status < 300) {
        msg.textContent = "Enviadas " + envio.datos.length + " reservas al Ministerio correctamente.";
        cargarRanking();
    } else {
        msg.textContent = "Error al enviar al Ministerio (código " + resp.status + ").";
    }
}

// Nombres de las áreas médicas (según el enunciado de la práctica)
var NOMBRES_AREAS = {
    1: "Alergología", 2: "Anestesiología", 3: "Cardiología", 4: "Cirugía General",
    5: "Dermatología", 6: "Aparato Digestivo", 7: "Endocrinología", 8: "Ginecología",
    9: "Hematología", 10: "Medicina Interna", 11: "Neumología", 12: "Neurología",
    13: "Oftalmología", 14: "Oncología", 15: "Pediatría", 16: "Psiquiatría",
    17: "Traumatología", 18: "Urología"
};

// Descarga todos los envíos del Ministerio y pinta el ranking de reservas por área.
function cargarRanking() {
    var tbody = document.getElementById("tbody_ranking");

    // 1) GET al Ministerio (síncrono)
    var resp = rest.get(URL_MINISTERIO);
    if (resp.status != 200 || !Array.isArray(resp.response)) {
        tbody.innerHTML = "<tr><td colspan='3'>No se han podido cargar los datos del Ministerio.</td></tr>";
        return;
    }
    var envios = resp.response;

    var conteo = {};   // { id_area: número de reservas }   ej: { 3: 7, 14: 6 }
    var vistas = {};   // reservas ya contadas, para no contar las repetidas

    for (var i = 0; i < envios.length; i++) {
        var envio = envios[i];

        // 2) Validar el envío: si algo está mal, lo saltamos (continue)
        if (!envio || typeof envio != "object") continue;      // no es un objeto
        var area = Number(envio.id_area);
        if (!NOMBRES_AREAS[area]) continue;                     // área que no existe (0, 25, "hola", null...)
        if (!Array.isArray(envio.datos)) continue;              // "datos" no es una lista

        for (var j = 0; j < envio.datos.length; j++) {
            var reserva = envio.datos[j];

            // Validar la reserva
            if (!reserva || typeof reserva != "object") continue;
            if (!reserva.nombre) continue;                      // reserva vacía o sin sanitario

            // 3) Quitar repetidas: la "clave" es el área + la reserva entera en texto
            var clave = area + "|" + JSON.stringify(reserva);
            if (vistas[clave]) continue;                        // ya la habíamos contado
            vistas[clave] = true;

            // 4) Contarla en su área
            if (conteo[area]) {
                conteo[area]++;
            } else {
                conteo[area] = 1;
            }
        }
    }

    // 5) Pasar el conteo a una lista y ordenarla de mayor a menor
    var ranking = [];
    for (var idArea in conteo) {
        ranking.push({ area: idArea, total: conteo[idArea] });
    }
    ranking.sort(function (a, b) { return b.total - a.total; });

    // Pintar la tabla
    tbody.innerHTML = "";
    for (var k = 0; k < ranking.length; k++) {
        var fila = "<tr>"
            + "<td>" + (k + 1) + "</td>"
            + "<td>" + NOMBRES_AREAS[ranking[k].area] + "</td>"
            + "<td>" + ranking[k].total + "</td>"
            + "</tr>";
        tbody.innerHTML += fila;
    }
}