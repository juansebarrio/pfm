import * as Haptics from "expo-haptics";

// El feedback háptico es la parte más fácil de arruinar: si vibra todo, no
// significa nada. Acá se decide una sola vez qué se siente y qué no.
//
// - `guardado` / `error`: confirmaciones de plata. Es lo único que merece el
//   motor completo — cerrar un gasto tiene que sentirse cerrado.
// - `toque`: interacciones del teclado numérico. Liviano, nunca "éxito".
//
// No vibra en el simulador (no tiene motor háptico): se verifica en un equipo.

export const tacto = {
  guardado: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  toque: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
};
