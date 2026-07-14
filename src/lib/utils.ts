import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatCNPJ(cnpj: string): string {
  return cnpj
    .replace(/\D/g, "")
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatCPF(cpf: string): string {
  return cpf
    .replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2");
}

// Padrão do app: (XX) XXXXX.XXXX (celular) ou (XX) XXXX.XXXX (fixo).
// Formata progressivamente durante a digitação.
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}.${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}.${d.slice(7)}`;
}

// Padrão do app: XX.XXX.XXX-X(X). Aceita o dígito verificador "X".
export function formatRG(rg: string): string {
  const d = rg
    .replace(/[^\dxX]/g, "")
    .toUpperCase()
    .slice(0, 10);
  return d
    .replace(/^(\w{2})(\w)/, "$1.$2")
    .replace(/^(\w{2})\.(\w{3})(\w)/, "$1.$2.$3")
    .replace(/^(\w{2})\.(\w{3})\.(\w{3})(\w)/, "$1.$2.$3-$4");
}

// Campo "CNPJ ou CPF": escolhe o formato pelo tamanho (até 11 dígitos = CPF).
export function formatDoc(doc: string): string {
  const d = doc.replace(/\D/g, "");
  return d.length <= 11 ? formatCPF(doc) : formatCNPJ(doc);
}

export function formatCEP(cep: string): string {
  return cep.replace(/\D/g, "").replace(/(\d{5})(\d)/, "$1-$2");
}

export async function fetchAddressByCEP(cep: string) {
  const cleaned = cep.replace(/\D/g, "");
  if (cleaned.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return {
      rua: data.logradouro,
      bairro: data.bairro,
      cidade: data.localidade,
      estado: data.uf,
    };
  } catch {
    return null;
  }
}

export function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
