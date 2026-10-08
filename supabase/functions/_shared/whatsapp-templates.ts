// Contract for the UTILITY templates registered in Meta's WhatsApp
// Manager. Keep this in sync with whatever is actually approved there —
// if the registered body text, variable order, or button labels change,
// update this file so the code sending bodyParams/buttonPayloads matches.

export const TEMPLATE_LANGUAGE = 'es_MX'

export const NUEVA_LLAMADA_TEMPLATE = {
  name: 'nueva_llamada',
  // Body variables in order: {{1}} nombre del cliente, {{2}} resumen,
  // {{3}} teléfono, {{4}} dirección, {{5}} horario preferido.
  bodyParamCount: 5,
  buttons: ['Confirmar cita', 'Lo llamo yo'] as const,
}

export const COTIZACION_ACEPTADA_TEMPLATE = {
  name: 'cotizacion_aceptada',
  // {{1}} nombre del cliente, {{2}} monto (ej. "$9,500").
  bodyParamCount: 2,
}

export const SEGUIMIENTO_ENVIADO_TEMPLATE = {
  name: 'seguimiento_enviado',
  // {{1}} nombre del cliente, {{2}} número de cotización (ej. "Q-0001"),
  // {{3}} monto.
  bodyParamCount: 3,
}

export const REPORTE_SEMANAL_TEMPLATE = {
  name: 'reporte_semanal',
  // {{1}} nombre del negocio, {{2}} llamadas contestadas, {{3}} llamadas
  // urgentes, {{4}} cotizaciones enviadas, {{5}} cotizaciones aceptadas,
  // {{6}} monto aceptado.
  bodyParamCount: 6,
}
