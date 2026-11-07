"""
Gera assets/dados.js a partir da planilha Dividas.xlsx.

Uso:
    python gerar_dados.py              (lê Dividas.xlsx na mesma pasta)
    python gerar_dados.py caminho.xlsx

Requer: pip install openpyxl

Colunas esperadas (linha 1 = cabeçalho):
DATA | LOCAL | DESCRIÇÃO | VALOR | DESC CONTA | CLASSIFICAÇÃO | PACOTE | RESPONSÁVEL
Todos os valores são tratados como positivos (o sinal é ignorado).
"""
import json
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

import openpyxl

AQUI = Path(__file__).resolve().parent

# Classificação da planilha -> categoria exibida na página
CATEGORIAS = {
    "DESP CASA": "Contas da Casa",
    "DESP OBRA": "Obra da Garagem",
    "RECEITAS FINANCEIRAS": "Empréstimos",
    "DESP EVENTUAL": "Compras e Eventuais",
    "DESP ROLÊS/LAZER": "Lazer e Ingressos",
    "DESP INVESTIMENTO": "Livros e Assinaturas",
    "DESP INTERNET": "Telefone e Streaming",
    "DESP STREAMING": "Telefone e Streaming",
    "DESP MOTO": "Moto",
    "DESP DOAÇÃO": "Doações",
}


def norm(txt):
    txt = unicodedata.normalize("NFKD", str(txt or "")).encode("ascii", "ignore").decode()
    return txt.strip().upper()


def main():
    origem = Path(sys.argv[1]) if len(sys.argv) > 1 else AQUI / "Dividas.xlsx"
    ws = openpyxl.load_workbook(origem, data_only=True).active
    linhas = list(ws.iter_rows(values_only=True))
    cab = [norm(c) for c in linhas[0]]
    idx = {nome: cab.index(nome) for nome in
           ["DATA", "LOCAL", "DESCRICAO", "VALOR", "CLASSIFICACAO", "RESPONSAVEL"]}

    itens = []
    for n, r in enumerate(linhas[1:], start=1):
        if not r or r[idx["VALOR"]] in (None, "") or not r[idx["RESPONSAVEL"]]:
            continue
        data = r[idx["DATA"]]
        if isinstance(data, str):
            data = datetime.strptime(data[:10], "%d/%m/%Y" if "/" in data else "%Y-%m-%d")
        classif = str(r[idx["CLASSIFICACAO"]] or "").strip().upper()
        itens.append({
            "id": n,
            "mes": data.strftime("%Y-%m"),
            "pessoa": str(r[idx["RESPONSAVEL"]]).strip().upper(),
            "local": str(r[idx["LOCAL"]] or "").strip(),
            "descricao": str(r[idx["DESCRICAO"]] or "").strip(),
            "valor": round(abs(float(r[idx["VALOR"]])), 2),
            "categoria": CATEGORIAS.get(classif, classif.title().replace("Desp ", "") or "Outros"),
        })

    destino = AQUI / "assets" / "dados.js"
    destino.write_text(
        "// Gerado automaticamente por gerar_dados.py em "
        + datetime.now().strftime("%d/%m/%Y %H:%M") + "\n"
        + "window.DIVIDAS = " + json.dumps(itens, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8",
    )
    pessoas = sorted({i["pessoa"] for i in itens})
    print(f"{len(itens)} lançamentos de {len(pessoas)} pessoas -> {destino}")
    print("Pessoas:", ", ".join(pessoas))


if __name__ == "__main__":
    main()
