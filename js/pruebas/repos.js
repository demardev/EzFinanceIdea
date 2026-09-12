/* Pruebas del repo base — escritas antes que la implementación.
   Los catálogos se piden en cada navegación y casi nunca cambian: se guardan
   en memoria mientras dure la sesión, y se tiran al primer cambio propio. */

import { describir, igual } from './marco.js';
import { crearRepo } from '../repos/base.js';

function clienteFalso() {
  const registro = { seleccionar: 0, insertar: 0 };
  return {
    registro,
    seleccionar: async () => { registro.seleccionar += 1; return [{ id: 'a' }]; },
    insertar: async () => { registro.insertar += 1; return [{ id: 'b' }]; },
    actualizar: async () => [{ id: 'a' }],
    eliminar: async () => true,
  };
}

describir('repo base — caché de catálogos', (caso) => {
  caso('sin caché, cada listado pide de nuevo', async () => {
    const cliente = clienteFalso();
    const repo = crearRepo(cliente, 'movimientos', {});
    await repo.listar(); await repo.listar();
    igual(cliente.registro.seleccionar, 2);
  });

  caso('con caché, el segundo listado no pide nada', async () => {
    const cliente = clienteFalso();
    const repo = crearRepo(cliente, 'cuentas', { cachear: true });
    await repo.listar(); await repo.listar();
    igual(cliente.registro.seleccionar, 1);
  });

  caso('filtros distintos son listados distintos', async () => {
    const cliente = clienteFalso();
    const repo = crearRepo(cliente, 'cuentas', { cachear: true });
    await repo.listar(); await repo.listar({ archivada: 'eq.false' });
    igual(cliente.registro.seleccionar, 2);
  });

  caso('al escribir se tira el caché', async () => {
    const cliente = clienteFalso();
    const repo = crearRepo(cliente, 'cuentas', { cachear: true });
    await repo.listar();
    await repo.crear({ nombre: 'x' });
    await repo.listar();
    igual(cliente.registro.seleccionar, 2);
  });

  caso('olvidar() también lo tira: lo usa el importar respaldo', async () => {
    const cliente = clienteFalso();
    const repo = crearRepo(cliente, 'cuentas', { cachear: true });
    await repo.listar();
    repo.olvidar();
    await repo.listar();
    igual(cliente.registro.seleccionar, 2);
  });

  caso('lo que devuelve es una copia: quien la ordene no rompe el caché', async () => {
    const cliente = clienteFalso();
    const repo = crearRepo(cliente, 'cuentas', { cachear: true });
    const una = await repo.listar();
    una.push({ id: 'intruso' });
    igual((await repo.listar()).length, 1);
  });
});
