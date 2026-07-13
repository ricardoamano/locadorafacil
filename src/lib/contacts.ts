// Saneamento dos dados de contato vindos do formulário: grava apenas os campos
// válidos, ignorando id, _count, timestamps, companyId, bubbleId etc. (que o
// formulário carrega junto e o Prisma rejeita).

/* eslint-disable @typescript-eslint/no-explicit-any */

export function dadosContato(body: any) {
  return {
    type: body.type === "FORNECEDOR" ? "FORNECEDOR" : "CLIENTE",
    razaoSocial: body.razaoSocial || "",
    nomeFantasia: body.nomeFantasia || "",
    cnpj: body.cnpj || null,
    inscricaoEstadual: body.inscricaoEstadual || null,
    inscricaoMunicipal: body.inscricaoMunicipal || null,
    cep: body.cep || null,
    rua: body.rua || null,
    numero: body.numero || null,
    semNumero: !!body.semNumero,
    bairro: body.bairro || null,
    complemento: body.complemento || null,
    cidade: body.cidade || null,
    estado: body.estado || null,
    perfil: body.perfil || null,
    isPostoServico: !!body.isPostoServico,
  };
}

export function dadosSubContatos(subContacts: any[] | undefined) {
  return (subContacts || [])
    .filter((s: any) => s && (s.nome?.trim() || s.telefone?.trim() || s.email?.trim()))
    .map((s: any) => ({
      nome: s.nome || "",
      telefone: s.telefone || null,
      email: s.email || null,
      cargo: s.cargo || null,
    }));
}
