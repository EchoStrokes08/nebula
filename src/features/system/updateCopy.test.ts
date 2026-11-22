import { updateCopy } from './updateCopy';

const offer = { current: '1.4.1', notes: 'Mejoras' };

describe('textos del aviso de actualización', () => {
  it('detectada: muestra las novedades y permite actualizar o posponer', () => {
    expect(updateCopy('available', 'android', offer)).toMatchObject({ body: 'Mejoras', action: 'Actualizar', hideLabel: 'Más tarde' });
    expect(updateCopy('available', 'android', { current: '1.4.1', notes: '' }).body).toContain('1.4.1');
  });

  it('descargando: no pide nada', () => {
    expect(updateCopy('downloading', 'linux', offer).action).toBeNull();
  });

  it('lista en escritorio: dice cuándo se aplica según el sistema', () => {
    expect(updateCopy('ready', 'windows', offer).body).toContain('al cerrar Nebula');
    expect(updateCopy('ready', 'linux', offer).body).toContain('próxima vez');
    expect(updateCopy('ready', 'linux', offer).action).toBe('Reiniciar ahora');
  });

  it('Android: silenciosa al salir, o una confirmación la primera vez', () => {
    expect(updateCopy('readySilent', 'android', offer)).toMatchObject({ action: 'Instalar ahora', hideLabel: 'Ocultar' });
    expect(updateCopy('readySilent', 'android', offer).body).toContain('cuando salgas');
    expect(updateCopy('readyConfirm', 'android', offer).body).toContain('una vez');
  });

  it('instalando: no se puede ocultar ni pulsar nada', () => {
    expect(updateCopy('installing', 'android', offer)).toMatchObject({ action: null, canHide: false });
    expect(updateCopy('installing', 'windows', offer).body).toContain('reiniciará');
  });
});
