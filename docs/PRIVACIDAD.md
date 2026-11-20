# Privacidad de Nebula

La versión publicada está en `public/privacidad.html`
(https://echostrokes08.github.io/nebula/privacidad.html), junto a las condiciones del servicio en
`public/terminos.html`. Esa página es la que vale: este archivo resume el comportamiento técnico.

Nebula guarda el perfil, las preferencias y las actividades que introduces: hábitos, tareas,
metas, agenda, sesiones de enfoque, diario, relaciones y retos. Supabase gestiona la cuenta,
la base de datos y los avatares. El email no forma parte del perfil público.

Las cuentas nuevas tienen perfil privado. La actividad social que compartes se muestra a
los participantes correspondientes. Los resultados de retos pueden conservarse sin tu
identificador cuando eliminas la cuenta, para mantener el historial de otras personas.

La IA es opcional. Al activarla y enviar una petición, el servidor comparte esa petición y un
resumen numérico de actividad con Groq o el proveedor configurado. El diario y los datos de
amigos no forman parte de ese contexto. El servicio de reconocimiento de voz del sistema
procesa el dictado cuando decides usarlo; puedes escribir sin dar permiso de micrófono.

Los calendarios solo se leen tras conceder permiso. Importar crea una copia en Nebula y no
modifica el calendario original. El avatar se selecciona explícitamente; no se solicita cámara.
Las notificaciones se pueden desactivar por tipo y limitar por horario y cantidad.

El dispositivo conserva una caché de actividad para lectura sin conexión y una cola de
registros pendientes. La sesión se guarda con SecureStore en Android o con el almacén
cifrado del sistema en escritorio. Sin llavero de escritorio la sesión permanece en memoria.
La caché no contiene las claves del proveedor de IA. Cerrar sesión borra la caché de lectura;
los registros aún no enviados permanecen aislados por cuenta hasta volver a entrar.

En Configuración puedes exportar los datos personales en JSON o eliminar la cuenta mediante
una confirmación escrita y un segundo diálogo. El borrado elimina los avatares y la cuenta,
y la base de datos aplica las cascadas de datos privados. La eliminación en copias de seguridad
y registros operativos depende de la configuración de los servicios del despliegue.
