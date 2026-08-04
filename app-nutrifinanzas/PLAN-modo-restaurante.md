# Plan — Modo Restaurante (Nutrifinanzas)

> Documento de trabajo para bajar la idea a algo construible y, de paso, servir de base
> al punto 1 y 2 de la memoria del TFG. No es código: es la especificación antes de tocar nada.

## 1. Problema que resuelve

Cuando alguien con objetivos nutricionales sale a comer fuera, la carta no da información de
macros y decidir "qué pido" a ojo suele romper el objetivo del día (o generar ansiedad por
no saber si lo rompe). Hoy Nutrifinanzas ayuda a controlar lo que compras y cocinas, pero no
te acompaña en el momento de pedir en un restaurante — que es donde más se suele desviar
alguien de su objetivo.

**Alcance de esta primera versión:** solo nutrición (macros/kcal). El precio de los platos
**no** se tiene en cuenta todavía — se deja como mejora futura (ver §7), para no meter dos
variables nuevas a la vez y llegar antes a algo que funcione y se pueda medir.

## 2. Flujo de usuario

### Modo Sencillo
1. Usuario en un restaurante, abre "Foto del restaurante" (nueva entrada, junto a "Escanear").
2. Hace una foto a la carta (o sube una captura de pantalla).
3. La app analiza la carta y devuelve un plato recomendado + 1-2 alternativas, con una frase
   corta explicando por qué es la opción más saludable.
4. No hay opción de registrar macros exactos (en modo sencillo no hay objetivos de macros,
   así que no tendría sentido).

### Modo Control Total
1. Mismos pasos 1-2.
2. La app analiza la carta **y** consulta cuánto le queda hoy de kcal/proteína/hidratos/grasa
   (ya disponible en `resumen` de `DiarioContext`).
3. Devuelve el plato que mejor encaja en ese margen restante (no necesariamente "el más sano"
   en abstracto — el más sano *para lo que le queda hoy*), con macros estimados por plato.
4. Botón **"Registrar este plato"**: lo añade al Diario de hoy (a la comida que corresponda),
   reutilizando el flujo ya existente de `RegistrarComida`/`agregarRegistros`. Así la
   recomendación no queda suelta: cierra el círculo con el resto de la app.

## 3. Diseño técnico

### 3.1 Pantallas nuevas
Reutilizar el patrón que ya existe para tickets (`Escanear.jsx` → `ConfirmarEscaneo.jsx`):

- `AnalizarCarta.jsx` — cámara/subida de foto, spinner mientras se analiza.
- `ConfirmarCarta.jsx` — muestra los platos detectados, cuál está recomendado y por qué;
  en modo completo, botón para registrar el elegido (reutiliza lógica de `RegistrarComida.jsx`).

### 3.2 Backend: 4º modo de `analizar-imagen`
Mismo edge function, mismo patrón de los otros 3 modos (`ticket` / `producto` / `nutricion`),
añadiendo `modo === 'carta'`. Nuevo parámetro opcional en el body: `objetivoRestante` (solo se
manda en modo completo, con los macros restantes del día — se calcula en el cliente a partir
de `resumen`, no hace falta tocar el backend para leerlo de la base de datos).

**Prompt (borrador):**
```
Eres un asistente que analiza fotos de cartas de restaurante.
Identifica los platos legibles y estima sus macros aproximados a partir del nombre/
descripción y del conocimiento general de cocina española/internacional.

Devuelve SOLO un JSON:
{
  "platos": [
    {
      "nombre": "...",
      "kcal_estimado": numero_o_null,
      "proteinas_estimado": numero_o_null,
      "hidratos_estimado": numero_o_null,
      "grasas_estimado": numero_o_null,
      "confianza": "alta" | "media" | "baja"
    }
  ],
  "recomendado_indice": indice_del_plato_recomendado,
  "motivo": "frase corta explicando la recomendación"
}

Si se proporciona objetivoRestante, la recomendación debe priorizar el plato que mejor
encaje en ese margen (sin pasarse de kcal, priorizando proteína si sobra margen).
Si NO se proporciona, recomienda el plato objetivamente más saludable (más proteína/verdura,
menos frito/procesado, ración razonable).
Dejar "confianza": "baja" en platos con descripción muy ambigua — no inventar datos.
```

### 3.3 Base de datos
`registros_diarios.origen` hoy acepta `'despensa' | 'catalogo' | 'manual'`. Para poder
distinguir después (métricas del TFG incluidas) cuántas comidas vienen de esta función,
añadir un cuarto valor: `'restaurante'`. Es una migración pequeña (ajustar el check
constraint en `supabase/schema.sql` + una migración nueva), no rompe nada existente.

## 4. Qué NO entra en esta primera versión

- Precio / coste del plato (§1).
- Guardar el restaurante o la carta para futuras visitas.
- Historial de recomendaciones pasadas.

Dejarlo fuera es intencionado: cuanto antes tengas una versión end-to-end funcionando, antes
puedes empezar a recoger las métricas de validación que pide el punto 3 de la memoria.

## 5. Métricas para el TFG (punto 3: Implementación y Validación)

Para tener evidencia "antes/después" con una app personal, la forma más realista es probarla
tú (e idealmente 2-3 personas más) durante 1-2 semanas y comparar:

- **Tiempo en decidir qué pedir** (con la función vs. a ojo, estimado).
- **% de comidas fuera de casa que se quedan dentro del margen de macros del día**, con y sin
  usar la función.
- **Nº de veces que se acepta la recomendación** vs. se ignora (para saber si de verdad ayuda
  o solo es un adorno).
- Capturas del antes/después: una carta real analizada + el registro resultante en el Diario.

## 6. Orden de construcción propuesto

1. Migración BD: añadir `'restaurante'` a `origen`.
2. Extender `analizar-imagen` con el modo `carta` (backend, sin UI todavía — probarlo con
   Postman/curl).
3. `AnalizarCarta.jsx` (cámara/subida, reutilizando lo que ya hace `Escanear.jsx`).
4. `ConfirmarCarta.jsx` (resultado + recomendación).
5. Conectar el botón "Registrar" con `agregarRegistros` del `DiarioContext`.
6. Entrada visible en la navegación (junto a "Escanear" o dentro de Diario).
7. Probar con cartas reales (mínimo 5-10 fotos distintas) y empezar a recoger las métricas
   del §5.

## 7. Futuro (punto 5 de la memoria: proyección)

- Añadir el precio de los platos (cruce nutrición + finanzas, el diferencial real de la app).
- Guardar restaurantes frecuentes para no tener que fotografiar la carta cada vez.
- Conectar con "Recetas" (ya tiene el placeholder "Próximamente" en el código) para sugerir
  qué cocinar en casa con lo que sobra de macros tras comer fuera.
