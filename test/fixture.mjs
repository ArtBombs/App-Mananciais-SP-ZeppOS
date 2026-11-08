// Valores reais da API em 04/11/2026 (resumo geral e represas). Séries de 30 dias interpoladas.
export const DATA = '2026-11-04'
export const geral = [
  [64, 52.52035, 0.28731, 0, 15.45, 149.6], [65, 60.47928, -0.02815, 0.04, 6.52, 116.6], [66, 89.76726, -1.58861, 0, 3, 124.24],
  [67, 102.65261, -0.16139, 0, 3, 123.25], [68, 96.20149, -0.78254, 0, 0.8, 134.73], [69, 60.74333, -0.28021, 0, 0, 191.25],
  [71, 102.65261, -0.16139, 0, 3, 123.25], [72, 74.23, -0.8, 0, 1, 140], [74, 101.27, 0, 0, 1, 130], [75, 62.08649, -0.0891, null, null, null],
].map(([id, v, dv, ch, chm, chh]) => ({ idSistema: id, date: DATA + 'T00:00:00', volumeUtilArmazenadoPorcentagem: v, variacaoVolumeUtil: dv,
  volumeUtilArmazenadoHm3: id === 75 ? 1207.42 : 100, chuva: ch, chuvaAcumuladaNoMes: chm, chuvaMediaHistorica: chh,
  vazaoNatural: 10, vazaoCaptada: 5, vazaoJusante: id === 75 ? null : 1, vazaoProduzida: 5 }))
export const nomes = { 1: 'Jaguari/Jacareí', 3: 'Cachoeira', 4: 'Atibainha', 5: 'Paiva Castro', 6: 'Águas Claras', 35: 'Represa Jaguari (PBS)',
  15: 'Guarapiranga', 16: 'Capivari', 17: 'Billings', 10: 'Paraitinga', 11: 'Ponte Nova', 12: 'Biritiba', 13: 'Jundiaí', 14: 'Taiaçupeba', 21: 'Ribeirão do Campo', 18: 'Pedro Beicht', 19: 'Cachoeira da Graça', 20: 'Rio Grande', 33: 'Cachoeira do França' }
const el = (id, p, value) => ({ idElemento: id, idParametro: p, value })
export const elementos = {
  66: [el(15, 2, 735.959), el(15, 684, 89.767), el(16, 2, 742.152), el(16, 684, 100.076), el(17, 2, 746.32), el(17, 684, 70.01), el(66, 684, 89.77), el(342, 2, 735.96)],
  64: [el(1, 2, 835.29), el(1, 684, 52.49), el(3, 684, 68.71), el(4, 684, 42.05), el(5, 684, 38.26), el(6, 684, 83.01), el(35, 684, 78.72), el(64, 684, 52.52), el(313, 2, 835.29)],
  // Alto Tietê: valores do site em 07/11/2026
  65: [el(10, 684, 83.9), el(11, 684, 50.2), el(12, 684, 68.7), el(13, 684, 72.7), el(14, 684, 76.2), el(65, 684, 60.48)],
  67: [el(18, 684, 102.4), el(19, 684, 102.8), el(67, 684, 102.65)],
  68: [el(20, 684, 94.8), el(68, 684, 96.2)],
  72: [el(33, 684, 73.3), el(72, 684, 74.23)],
  69: [el(21, 684, 59.0), el(69, 684, 60.74)],
  75: [64, 65, 66, 67, 68, 69, 72].map((s) => el(s, 684, geral.find((g) => g.idSistema === s).volumeUtilArmazenadoPorcentagem)).concat([el(75, 684, 62.09)]),
}
export const diario = (id) => {
  const g = geral.find((x) => x.idSistema === id)
  return Array.from({ length: 30 }, (_, i) => i === 29 ? g : { date: `2026-10-${String(6 + i).padStart(2, '0')}T00:00:00`.replace('2026-10-3', '2026-10-3'),
    volumeUtilArmazenadoPorcentagem: g.volumeUtilArmazenadoPorcentagem + (29 - i) * 0.15, chuva: g.chuva === null ? null : (i % 6 ? 0 : 8) })
}
