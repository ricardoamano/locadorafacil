// Política de preços: o valor da diária é a base; semana/quinzena/mês são
// calculados como (diária × dias do período) com desconto percentual sobre o total.
export interface PoliticaPrecos {
  diasSemana: number;
  diasQuinzena: number;
  diasMes: number;
  descontoSemana: number;
  descontoQuinzena: number;
  descontoMes: number;
}

export const POLITICA_PADRAO: PoliticaPrecos = {
  diasSemana: 7,
  diasQuinzena: 15,
  diasMes: 30,
  descontoSemana: 0,
  descontoQuinzena: 0,
  descontoMes: 0,
};

function periodo(diaria: number, dias: number, descontoPct: number) {
  const bruto = diaria * dias;
  const valor = Math.round(bruto * (1 - descontoPct / 100) * 100) / 100;
  return { bruto, valor };
}

export function calcularPrecos(diaria: number, p: PoliticaPrecos) {
  const semana = periodo(diaria, p.diasSemana, p.descontoSemana);
  const quinzena = periodo(diaria, p.diasQuinzena, p.descontoQuinzena);
  const mes = periodo(diaria, p.diasMes, p.descontoMes);
  return {
    valorSemana: semana.valor,
    valorQuinzena: quinzena.valor,
    valorMes: mes.valor,
    memoria: {
      semana: `${p.diasSemana} × diária = ${semana.bruto.toFixed(2)} − ${p.descontoSemana}% = ${semana.valor.toFixed(2)}`,
      quinzena: `${p.diasQuinzena} × diária = ${quinzena.bruto.toFixed(2)} − ${p.descontoQuinzena}% = ${quinzena.valor.toFixed(2)}`,
      mes: `${p.diasMes} × diária = ${mes.bruto.toFixed(2)} − ${p.descontoMes}% = ${mes.valor.toFixed(2)}`,
    },
  };
}
