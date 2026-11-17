// Configuración común de pruebas de la app.

// Reanimated/Worklets no tienen módulo nativo en Jest (y su mock oficial inicializa el módulo
// real en esta versión): mock mínimo que renderiza sin animar.
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock no admite import.
  const { View } = require('react-native');
  const builder = (): unknown => new Proxy({}, { get: () => () => builder() });
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedProps: () => ({}),
    withTiming: (v: unknown) => v,
    withSequence: (...v: unknown[]) => v[v.length - 1],
    withRepeat: (v: unknown) => v,
    cancelAnimation: () => {},
    useReducedMotion: () => true,
    FadeIn: builder(),
    FadeInDown: builder(),
    LinearTransition: builder(),
  };
});
