/* Por confirmar con el negocio activado: un egreso puede ser un pago de
   recibo. Se pregunta igual que en el botón +, y si es pago se abre su
   formulario con monto, día y cuenta del aviso, y el mensaje en la nota
   para llenar lo demás. Al registrarlo sale de la bandeja. */

import { abrirRegistro, elegirMovimientoOPago } from '../../movimientos/registrar.js';
import { borradorDePago } from '../../calc/avisos/juntar.js';
import { avisoError } from '../../ui/toast.js';

/** ¿Hay que preguntar? Solo con negocio y si sale dinero hacia alguien más. */
export const puedeSerPago = (contexto, borrador) =>
  Boolean(contexto.perfil?.negocio) && borrador.tipo === 'egreso';

async function abrirComoPago(contexto, entrada, borrador, alCambiar) {
  const [cuentas, categorias, { abrirPagoRecibo }] = await Promise.all([
    contexto.cuentas.listarActivas(), contexto.categorias.listarActivas(),
    import('../negocio/registrar.js'),
  ]);
  const quitar = async () => {
    for (const parte of entrada.partes ?? [entrada]) await contexto.bandeja.eliminar(parte.id);
  };
  await abrirPagoRecibo(contexto, borradorDePago(entrada, borrador), { cuentas, categorias },
                        alCambiar, { alRegistrar: quitar });
}

/** @param alRegistrar el de bandeja-aprender.js, para cuando es movimiento */
export function elegirYAbrir(contexto, entrada, borrador, alCambiar, alRegistrar) {
  const conError = (fn) => () => fn().catch(avisoError);
  elegirMovimientoOPago(
    conError(() => abrirRegistro(contexto, borrador, alCambiar, undefined, { alRegistrar })),
    conError(() => abrirComoPago(contexto, entrada, borrador, alCambiar)),
  );
}
