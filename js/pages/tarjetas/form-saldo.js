/* Los campos del saldo pendiente con que arranca la tarjeta, y la línea que
   dice qué va a hacer con la deuda mientras se escribe. Aquí solo se pinta:
   el efecto lo calcula calc/desglose-tarjeta.js por medio de quien llama. */

import { campoTexto, campoMonto, datosDe } from '../../ui/campos.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha } from '../../calc/fechas.js';

export function camposSaldoInicial(t) {
  return `
    ${campoMonto({
      nombre: 'saldo_inicial', etiqueta: 'Saldo pendiente al empezar',
      valor: t.saldo_inicial ?? 0,
      ayuda: 'Lo que ya debías antes de registrar esta tarjeta aquí. Déjalo en $0.00 si empezaste en ceros.',
    })}
    ${campoTexto({
      nombre: 'fecha_saldo_inicial', etiqueta: '¿A qué fecha lo debías?', tipo: 'date',
      valor: t.fecha_saldo_inicial ?? '', requerido: false,
      ayuda: 'La del corte de tu estado de cuenta en que aparece ese saldo.',
    })}
    <p class="warn" id="efecto-saldo" style="font-size:12.5px;margin-top:6px" hidden></p>`;
}

function textoEfecto(monto, e) {
  return `Suma ${textoMonto(monto)} al corte del ${formatearFecha(e.corte)}. `
    + `Deuda total: ${textoMonto(e.antes)} → ${textoMonto(e.despues)}.`;
}

/** Repinta la línea del efecto con cada tecla, y al cambiar fecha o corte. */
export function conectarEfecto(form, simular) {
  const linea = form.querySelector('#efecto-saldo');
  const actualizar = () => {
    const datos = datosDe(form);
    const monto = Number(datos.saldo_inicial) || 0;
    if (monto <= 0) { linea.hidden = true; return; }
    linea.hidden = false;
    linea.textContent = datos.fecha_saldo_inicial
      ? textoEfecto(monto, simular(datos))
      : 'Pon la fecha para ver en qué corte cae.';
  };
  form.addEventListener('input', actualizar);
  form.addEventListener('change', actualizar);
  actualizar();
}
