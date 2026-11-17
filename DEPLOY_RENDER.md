# Subir a Render (paso a paso)

El proyecto ya trae `render.yaml`: crea **un servicio web** (API + interfaz) y **una base PostgreSQL**, ambos en plan gratuito.

## 1. Sube el proyecto a GitHub
```bash
cd pos-voz
git init
git add .
git commit -m "POS por voz listo para Render"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/pos-voz.git
git push -u origin main
```
(`.env` y `node_modules` ya están en `.gitignore`, no se suben.)

## 2. Crea el Blueprint en Render
1. Entra a https://dashboard.render.com → **New +** → **Blueprint**.
2. Conecta tu GitHub y elige el repositorio `pos-voz`.
3. Render leerá `render.yaml` y te pedirá dos valores:
   - `ADMIN_PASSWORD` → contraseña del administrador
   - `VENDEDOR_PASSWORD` → contraseña del vendedor
   (mínimo 8 caracteres, con letras y números)
4. Pulsa **Apply / Deploy**. La primera vez tarda unos minutos.

En el primer arranque el sistema crea solo las tablas, el catálogo demo (120 productos) y los dos usuarios.
En los siguientes arranques **no borra nada**.

## 3. Entra
Abre la URL que te da Render (algo como `https://pos-voz.onrender.com`) e inicia sesión:

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@posvoz.com` | la que pusiste en `ADMIN_PASSWORD` |
| Vendedor | `vendedor@posvoz.com` | la que pusiste en `VENDEDOR_PASSWORD` |

## Notas
- **Olvidé la contraseña:** en Render → servicio `pos-voz` → *Environment*, cambia `ADMIN_PASSWORD`/`VENDEDOR_PASSWORD`, agrega `RESET_PASSWORDS=true`, guarda (se redespliega) y luego borra `RESET_PASSWORDS`.
- **Plan gratis:** el servicio "se duerme" tras 15 min sin uso (la primera carga tarda ~1 min) y la base gratuita de Render caduca a los 30 días; para uso real cambia a un plan de pago.
- **Voz:** Render da HTTPS, así que el micrófono funciona en Chrome/Edge.
- Más usuarios se crean desde la app: *Usuarios* (con la cuenta de administrador).
