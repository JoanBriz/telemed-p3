var express = require("express");
var app = express();
var conexion = require("./conexion_mysql.js");

// P3 - Parte 2: JWT
var jwt = require("jwt-simple");
var clave = "miSecretoMasOscuro";   // clave secreta para firmar y comprobar los tokens

app.use("/appCliente", express.static("cliente_rest"));
app.use(express.json());

// ============================================================
// SERVICIOS PÚBLICOS (no necesitan token)
// ============================================================

// Login: si las credenciales son correctas, devuelve el id del gestor y un token
app.post("/api/gestores/login", (req, res) => {
    var sql = "SELECT id FROM gestores WHERE usuario = ? AND contraseña = ?";
    conexion.query(sql, [req.body.usuario, req.body.contraseña], function (err, filas) {
        if (err) {
            console.log("Error al consultar gestores", err);
            res.status(500).json("Error al realizar la consulta");
        } else if (filas.length === 1) {
            // Crear el token
            var contenido = {
                usuario: filas[0].id,
                expira: Date.now() + 60 * 60 * 1000   // caduca dentro de 1 hora (en ms)
            };
            var token = jwt.encode(contenido, clave);
            res.status(200).json({ id: filas[0].id, token: token });
        } else {
            res.status(403).json("Credenciales incorrectas.");
        }
    });
});

// Registro de un gestor nuevo (público: si aún no tiene cuenta, no puede tener token)
app.post("/api/gestores", function (req, res) {
    var sql = "INSERT INTO gestores (nombre, apellidos, usuario, contraseña) VALUES (?, ?, ?, ?)";
    var valores = [req.body.nombre, req.body.apellidos, req.body.usuario, req.body.contraseña];
    conexion.query(sql, valores, function (err, resultado) {
        if (err) {
            console.log("Error al crear gestor", err);
            res.status(500).json("Error al insertar el gestor");
        } else {
            res.status(201).json("Gestor añadido correctamente a la base de datos.");
        }
    });
});

// ============================================================
// PORTERO: a partir de aquí, todos los servicios /api necesitan un token válido
// ============================================================
app.use("/api", function (req, res, next) {
    var token = req.query.token;   // viene en la URL: /api/recursos?token=XXXX
    if (!token) {
        res.status(401).json("No se ha encontrado token");
        return;
    }

    // Decodificar el token (si alguien lo ha modificado, la firma no coincide y da error)
    try {
        var contenidoToken = jwt.decode(token, clave);
    } catch (error) {
        res.status(401).json("El token es incorrecto");
        return;
    }
    console.log("El contenido del token es:", contenidoToken);

    // Validar el formato
    if (!contenidoToken || !contenidoToken.expira || !contenidoToken.usuario) {
        res.status(401).json("El formato del token no es adecuado");
        return;
    }

    // Comprobar la caducidad
    if (contenidoToken.expira < Date.now()) {
        res.status(401).json("El token ha expirado");
        return;
    }

    next();   // todo correcto: dejamos pasar la petición a su ruta
});

// ============================================================
// SERVICIOS PRIVADOS (necesitan token)
// ============================================================

app.get("/api/ubicaciones", (req, res) => {
    conexion.query("SELECT * FROM ubicaciones", function (err, filas) {
        if (err) {
            console.log("Error al consultar ubicaciones", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            res.status(200).json(filas);
        }
    });
});

app.get("/api/categorias", (req, res) => {
    conexion.query("SELECT * FROM categorias", function (err, filas) {
        if (err) {
            console.log("Error al consultar categorias", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            res.status(200).json(filas);
        }
    });
});

app.get("/api/modelos", (req, res) => {
    conexion.query("SELECT * FROM modelos", function (err, filas) {
        if (err) {
            console.log("Error al consultar modelos", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            res.status(200).json(filas);
        }
    });
});

app.put("/api/gestores/:id", function (req, res) {
    var idGestor = parseInt(req.params.id);

    var sqlDuplicado = "SELECT id FROM gestores WHERE usuario = ? AND id != ?";
    conexion.query(sqlDuplicado, [req.body.usuario, idGestor], function (err, filas) {
        if (err) {
            console.log("Error al comprobar login duplicado", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        if (filas.length > 0) {
            return res.status(404).json("El login ya existe");
        }

        var sqlUpdate = "UPDATE gestores SET nombre = ?, apellidos = ?, usuario = ?, contraseña = ? WHERE id = ?";
        var valores = [req.body.nombre, req.body.apellidos, req.body.usuario, req.body.contraseña, idGestor];
        conexion.query(sqlUpdate, valores, function (err, resultado) {
            if (err) {
                console.log("Error al actualizar gestor", err);
                return res.status(500).json("Error al actualizar los datos");
            }
            if (resultado.affectedRows === 0) {
                res.status(404).json("El usuario que está intentando modificar no se encuentra en la base de datos");
            } else {
                res.status(201).json("Se han actualizado correctamente los datos.");
            }
        });
    });
});

app.get("/api/gestores/:id", function (req, res) {
    var sql = "SELECT id, nombre, apellidos, usuario FROM gestores WHERE id = ?";
    conexion.query(sql, [req.params.id], function (err, filas) {
        if (err) {
            console.log("Error al consultar gestor", err);
            res.status(500).json("Error al realizar la consulta");
        } else if (filas.length === 1) {
            res.status(200).json(filas[0]);
        } else {
            res.status(404).json("Gestor no encontrado.");
        }
    });
});

app.get("/api/sanitarios/:id", function (req, res) {
    var sql = "SELECT id, nombre, apellidos, usuario FROM sanitarios WHERE id = ?";
    conexion.query(sql, [req.params.id], function (err, filas) {
        if (err) {
            console.log("Error al consultar sanitario", err);
            res.status(500).json("Error al realizar la consulta");
        } else if (filas.length === 1) {
            res.status(200).json(filas[0]);
        } else {
            res.status(404).json("Sanitario no encontrado.");
        }
    });
});

app.get("/api/recursos", function (req, res) {
    var condiciones = [];
    var valores = [];

    if (req.query.categoria) {
        condiciones.push("categoria = ?");
        valores.push(req.query.categoria);
    }
    if (req.query.modelo) {
        condiciones.push("modelo = ?");
        valores.push(req.query.modelo);
    }
    if (req.query.ubicacion) {
        condiciones.push("ubicacion = ?");
        valores.push(req.query.ubicacion);
    }
    if (req.query.estado !== undefined && req.query.estado !== "" && req.query.estado !== "-1") {
        condiciones.push("estado = ?");
        valores.push(req.query.estado);
    }

    var sql = "SELECT * FROM recursos";
    if (condiciones.length > 0) {
        sql += " WHERE " + condiciones.join(" AND ");
    }

    conexion.query(sql, valores, function (err, filas) {
        if (err) {
            console.log("Error al consultar recursos", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            res.status(200).json(filas);
        }
    });
});

app.get("/api/recursos/:id", function (req, res) {
    var idBusqueda = parseInt(req.params.id);
    var sql = "SELECT * FROM recursos WHERE numero_serie = ? OR id = ?";
    conexion.query(sql, [idBusqueda, idBusqueda], function (err, filas) {
        if (err) {
            console.log("Error al consultar recurso", err);
            res.status(500).json("Error al realizar la consulta");
        } else if (filas.length >= 1) {
            res.status(200).json(filas[0]);
        } else {
            res.status(404).json("Recurso no encontrado.");
        }
    });
});

app.post("/api/recursos", function (req, res) {
    // La categoría no viene del formulario: la deducimos del modelo elegido,
    // porque la columna recursos.categoria es NOT NULL en la base de datos.
    var sqlModelo = "SELECT categoria FROM modelos WHERE id = ?";
    conexion.query(sqlModelo, [req.body.modelo], function (err, filasModelo) {
        if (err || filasModelo.length === 0) {
            console.log("Error al determinar la categoria del modelo", err);
            return res.status(500).json("No se ha podido determinar la categoría del modelo.");
        }
        var categoria = filasModelo[0].categoria;

        var sql = "INSERT INTO recursos (categoria, modelo, ubicacion, numero_serie, estado) VALUES (?, ?, ?, ?, ?)";
        var valores = [categoria, req.body.modelo, req.body.ubicacion, parseInt(req.body.numero_serie), req.body.estado];
        conexion.query(sql, valores, function (err, resultado) {
            if (err) {
                console.log("Error al crear recurso", err);
                res.status(500).json("Error al crear el recurso");
            } else {
                res.status(201).json("Recurso añadido correctamente a la base de datos.");
            }
        });
    });
});

app.put("/api/recursos/:id", function (req, res) {
    var num_serie = parseInt(req.params.id);

    var sqlModelo = "SELECT categoria FROM modelos WHERE id = ?";
    conexion.query(sqlModelo, [req.body.modelo], function (err, filasModelo) {
        if (err || filasModelo.length === 0) {
            console.log("Error al determinar la categoria del modelo", err);
            return res.status(500).json("No se ha podido determinar la categoría del modelo.");
        }
        var categoria = filasModelo[0].categoria;

        var sqlUpdate = "UPDATE recursos SET categoria = ?, modelo = ?, ubicacion = ?, estado = ? WHERE numero_serie = ?";
        var valores = [categoria, req.body.modelo, req.body.ubicacion, req.body.estado, num_serie];
        conexion.query(sqlUpdate, valores, function (err, resultado) {
            if (err) {
                console.log("Error al actualizar recurso", err);
                return res.status(500).json("Error actualizando el recurso.");
            }
            if (resultado.affectedRows === 0) {
                res.status(404).json("Error actualizando el recurso.");
            } else {
                res.status(200).json("El recurso se ha actualizado en la base de datos.");
            }
        });
    });
});
// muy buen ejemplo
app.get("/api/recursos/:id/reservas", function (req, res) {
    var sql = "SELECT * FROM reservas WHERE recurso = ?";
    conexion.query(sql, [req.params.id], function (err, filas) {
        if (err) {
            console.log("Error al consultar reservas", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            res.status(200).json(filas);
        }
    });
});

app.get("/api/recursos/:id/resenyas", function (req, res) {
    // Alias descripción -> descripcion para no tener que tocar el cliente
    var sql = "SELECT id, recurso, sanitario, fecha, valor, descripción AS descripcion FROM `reseñas` WHERE recurso = ?";
    conexion.query(sql, [req.params.id], function (err, filas) {
        if (err) {
            console.log("Error al consultar reseñas", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            res.status(200).json(filas);
        }
    });
});

app.delete("/api/recursos/:id", function (req, res) {
    var idRecursoOSerie = parseInt(req.params.id);
    var sql = "DELETE FROM recursos WHERE numero_serie = ? OR id = ?";
    conexion.query(sql, [idRecursoOSerie, idRecursoOSerie], function (err, resultado) {
        if (err) {
            if (err.code === "ER_ROW_IS_REFERENCED_2" || err.errno === 1451) {
                console.log("No se puede borrar: el recurso tiene reservas asociadas", err);
                return res.status(409).json("No se puede eliminar: este recurso tiene reservas asociadas.");
            }
            console.log("Error al borrar recurso", err);
            return res.status(500).json("Error al realizar el borrado");
        }
        if (resultado.affectedRows === 0) {
            res.status(404).json("No se ha encontrado el recurso para eliminar.");
        } else {
            res.status(200).json("Recurso eliminado correctamente.");
        }
    });
});

app.listen(3000, () => {
    console.log('Servidor en http://localhost:3000');
});