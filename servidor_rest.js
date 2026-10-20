var express = require("express");
var app = express();

// P3 - Parte 3: conexión con Supabase
// 1. Importar el cliente de Supabase
const { createClient } = require("@supabase/supabase-js");

// 2. Configurar con la URL del proyecto y la clave pública (Publishable / anon key)
const supabaseUrl = "https://sqlvoquirrbgmwqoqvsh.supabase.co";   // <--- Pega aquí tu Project URL
const supabaseKey = "sb_publishable_QkfYB_yyBDeQ4xg2SVfaWw__OaMM7DD";                  // <--- Pega aquí tu Publishable key (o anon key)
const supabase = createClient(supabaseUrl, supabaseKey);

// P3 - Parte 2: JWT
var jwt = require("jwt-simple");
var clave = "miSecretoMasOscuro";   // clave secreta para firmar y comprobar los tokens

app.use("/appCliente", express.static("cliente_rest"));
app.use(express.json());

// ============================================================
// SERVICIOS PÚBLICOS (no necesitan token)
// ============================================================

// Login: si las credenciales son correctas, devuelve el id del gestor y un token
app.post("/api/gestores/login", async (req, res) => {
    const { data, error } = await supabase
        .from("gestores")
        .select("id")
        .eq("usuario", req.body.usuario)
        .eq("contraseña", req.body.contraseña);

    if (error) {
        console.log("Error al consultar gestores", error);
        return res.status(500).json("Error al realizar la consulta");
    }
    if (data.length === 1) {
        // Crear el token
        var contenido = {
            usuario: data[0].id,
            expira: Date.now() + 60 * 60 * 1000   // caduca dentro de 1 hora (en ms)
        };
        var token = jwt.encode(contenido, clave);
        res.status(200).json({ id: data[0].id, token: token });
    } else {
        res.status(403).json("Credenciales incorrectas.");
    }
});

// Registro de un gestor nuevo (público: si aún no tiene cuenta, no puede tener token)
app.post("/api/gestores", async (req, res) => {
    const { error } = await supabase
        .from("gestores")
        .insert({
            nombre: req.body.nombre,
            apellidos: req.body.apellidos,
            usuario: req.body.usuario,
            contraseña: req.body.contraseña
        });

    if (error) {
        console.log("Error al crear gestor", error);
        res.status(500).json("Error al insertar el gestor");
    } else {
        res.status(201).json("Gestor añadido correctamente a la base de datos.");
    }
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

app.get("/api/ubicaciones", async (req, res) => {
    const { data, error } = await supabase.from("ubicaciones").select("*").order("id");
    if (error) {
        console.log("Error al consultar ubicaciones", error);
        res.status(500).json("Error al realizar la consulta");
    } else {
        res.status(200).json(data);
    }
});

app.get("/api/categorias", async (req, res) => {
    const { data, error } = await supabase.from("categorias").select("*").order("id");
    if (error) {
        console.log("Error al consultar categorias", error);
        res.status(500).json("Error al realizar la consulta");
    } else {
        res.status(200).json(data);
    }
});

app.get("/api/modelos", async (req, res) => {
    const { data, error } = await supabase.from("modelos").select("*").order("id");
    if (error) {
        console.log("Error al consultar modelos", error);
        res.status(500).json("Error al realizar la consulta");
    } else {
        res.status(200).json(data);
    }
});

app.put("/api/gestores/:id", async (req, res) => {
    var idGestor = parseInt(req.params.id);

    // ¿Hay OTRO gestor (id distinto) con el mismo login?
    const { data: duplicados, error: errorDuplicado } = await supabase
        .from("gestores")
        .select("id")
        .eq("usuario", req.body.usuario)
        .neq("id", idGestor);

    if (errorDuplicado) {
        console.log("Error al comprobar login duplicado", errorDuplicado);
        return res.status(500).json("Error al realizar la consulta");
    }
    if (duplicados.length > 0) {
        return res.status(404).json("El login ya existe");
    }

    // .select() al final hace que nos devuelva las filas modificadas (para saber si ha cambiado alguna)
    const { data, error } = await supabase
        .from("gestores")
        .update({
            nombre: req.body.nombre,
            apellidos: req.body.apellidos,
            usuario: req.body.usuario,
            contraseña: req.body.contraseña
        })
        .eq("id", idGestor)
        .select();

    if (error) {
        console.log("Error al actualizar gestor", error);
        return res.status(500).json("Error al actualizar los datos");
    }
    if (data.length === 0) {
        res.status(404).json("El usuario que está intentando modificar no se encuentra en la base de datos");
    } else {
        res.status(201).json("Se han actualizado correctamente los datos.");
    }
});

app.get("/api/gestores/:id", async (req, res) => {
    const { data, error } = await supabase
        .from("gestores")
        .select("id, nombre, apellidos, usuario")
        .eq("id", req.params.id);

    if (error) {
        console.log("Error al consultar gestor", error);
        res.status(500).json("Error al realizar la consulta");
    } else if (data.length === 1) {
        res.status(200).json(data[0]);
    } else {
        res.status(404).json("Gestor no encontrado.");
    }
});

app.get("/api/sanitarios/:id", async (req, res) => {
    const { data, error } = await supabase
        .from("sanitarios")
        .select("id, nombre, apellidos, usuario")
        .eq("id", req.params.id);

    if (error) {
        console.log("Error al consultar sanitario", error);
        res.status(500).json("Error al realizar la consulta");
    } else if (data.length === 1) {
        res.status(200).json(data[0]);
    } else {
        res.status(404).json("Sanitario no encontrado.");
    }
});

app.get("/api/recursos", async (req, res) => {
    // Empezamos con "todos los recursos" y vamos añadiendo un filtro .eq() por cada campo elegido
    var consulta = supabase.from("recursos").select("*").order("id");

    if (req.query.categoria) {
        consulta = consulta.eq("categoria", req.query.categoria);
    }
    if (req.query.modelo) {
        consulta = consulta.eq("modelo", req.query.modelo);
    }
    if (req.query.ubicacion) {
        consulta = consulta.eq("ubicacion", req.query.ubicacion);
    }
    if (req.query.estado !== undefined && req.query.estado !== "" && req.query.estado !== "-1") {
        consulta = consulta.eq("estado", req.query.estado);
    }

    const { data, error } = await consulta;
    if (error) {
        console.log("Error al consultar recursos", error);
        res.status(500).json("Error al realizar la consulta");
    } else {
        res.status(200).json(data);
    }
});

app.get("/api/recursos/:id", async (req, res) => {
    var idBusqueda = parseInt(req.params.id);
    // .or() = "numero_serie = X  O  id = X"
    const { data, error } = await supabase
        .from("recursos")
        .select("*")
        .or("numero_serie.eq." + idBusqueda + ",id.eq." + idBusqueda);

    if (error) {
        console.log("Error al consultar recurso", error);
        res.status(500).json("Error al realizar la consulta");
    } else if (data.length >= 1) {
        res.status(200).json(data[0]);
    } else {
        res.status(404).json("Recurso no encontrado.");
    }
});

app.post("/api/recursos", async (req, res) => {
    // La categoría no viene del formulario: la deducimos del modelo elegido,
    // porque la columna recursos.categoria es NOT NULL en la base de datos.
    const { data: modelos, error: errorModelo } = await supabase
        .from("modelos")
        .select("categoria")
        .eq("id", req.body.modelo);

    if (errorModelo || modelos.length === 0) {
        console.log("Error al determinar la categoria del modelo", errorModelo);
        return res.status(500).json("No se ha podido determinar la categoría del modelo.");
    }

    const { error } = await supabase
        .from("recursos")
        .insert({
            categoria: modelos[0].categoria,
            modelo: req.body.modelo,
            ubicacion: req.body.ubicacion,
            numero_serie: parseInt(req.body.numero_serie),
            estado: req.body.estado
        });

    if (error) {
        console.log("Error al crear recurso", error);
        res.status(500).json("Error al crear el recurso");
    } else {
        res.status(201).json("Recurso añadido correctamente a la base de datos.");
    }
});

app.put("/api/recursos/:id", async (req, res) => {
    var num_serie = parseInt(req.params.id);

    const { data: modelos, error: errorModelo } = await supabase
        .from("modelos")
        .select("categoria")
        .eq("id", req.body.modelo);

    if (errorModelo || modelos.length === 0) {
        console.log("Error al determinar la categoria del modelo", errorModelo);
        return res.status(500).json("No se ha podido determinar la categoría del modelo.");
    }

    const { data, error } = await supabase
        .from("recursos")
        .update({
            categoria: modelos[0].categoria,
            modelo: req.body.modelo,
            ubicacion: req.body.ubicacion,
            estado: req.body.estado
        })
        .eq("numero_serie", num_serie)
        .select();

    if (error) {
        console.log("Error al actualizar recurso", error);
        return res.status(500).json("Error actualizando el recurso.");
    }
    if (data.length === 0) {
        res.status(404).json("Error actualizando el recurso.");
    } else {
        res.status(200).json("El recurso se ha actualizado en la base de datos.");
    }
});

app.get("/api/recursos/:id/reservas", async (req, res) => {
    const { data, error } = await supabase
        .from("reservas")
        .select("*")
        .eq("recurso", req.params.id)
        .order("id");

    if (error) {
        console.log("Error al consultar reservas", error);
        res.status(500).json("Error al realizar la consulta");
    } else {
        res.status(200).json(data);
    }
});

app.get("/api/recursos/:id/resenyas", async (req, res) => {
    // "descripcion:descripción" = renombrar la columna descripción a descripcion (para no tocar el cliente)
    const { data, error } = await supabase
        .from("reseñas")
        .select("id, recurso, sanitario, fecha, valor, descripcion:descripción")
        .eq("recurso", req.params.id)
        .order("id");

    if (error) {
        console.log("Error al consultar reseñas", error);
        res.status(500).json("Error al realizar la consulta");
    } else {
        res.status(200).json(data);
    }
});

app.delete("/api/recursos/:id", async (req, res) => {
    var idRecursoOSerie = parseInt(req.params.id);
    const { data, error } = await supabase
        .from("recursos")
        .delete()
        .or("numero_serie.eq." + idRecursoOSerie + ",id.eq." + idRecursoOSerie)
        .select();

    if (error) {
        if (error.code === "23503") {   // código de PostgreSQL para "violación de clave foránea"
            console.log("No se puede borrar: el recurso tiene reservas asociadas", error);
            return res.status(409).json("No se puede eliminar: este recurso tiene reservas asociadas.");
        }
        console.log("Error al borrar recurso", error);
        return res.status(500).json("Error al realizar el borrado");
    }
    if (data.length === 0) {
        res.status(404).json("No se ha encontrado el recurso para eliminar.");
    } else {
        res.status(200).json("Recurso eliminado correctamente.");
    }
});

// P3 - Parte 3: Render nos da el puerto en la variable de entorno PORT. En local usamos el 3000.
var puerto = process.env.PORT || 3000;
app.listen(puerto, () => {
    console.log("Servidor en http://localhost:" + puerto);
});
