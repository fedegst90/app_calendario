# Mi Calendario

Agenda personal para estudiantes: te permite organizar las materias que cursas, tu horario semanal (clases y consultas) y los eventos del mes (evaluaciones, entregas), todo a mano y en un solo lugar.

## Por qué esta app

Cursando varias materias a la vez se hace difícil llevar el registro de qué pasa cada día y a qué hora: qué clase toca hoy, cuándo es un parcial, cuándo se entrega un trabajo. Esta app nació para tener todo eso siempre a mano, en cualquier dispositivo, y que cada quien tenga su propia agenda.

## Tecnología

- **Frontend**: HTML5, CSS y JavaScript vanilla con [Bootstrap 5](https://getbootstrap.com/) para la interfaz.
- **Autenticación**: [Firebase Authentication](https://firebase.google.com/docs/auth) con login de Google, para identificar a cada usuario.
- **Datos**: [Firebase Realtime Database](https://firebase.google.com/docs/database), que sincroniza en la nube la configuración y la agenda de cada usuario (materias, horarios y eventos) de forma individual.