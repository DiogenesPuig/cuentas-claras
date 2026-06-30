"""Tests de la heurística pura de comprobantes (FR-14), sobre texto fijo.

Los textos imitan lo que devuelve el OCR/PDF de comprobantes reales (anonimizados):
un ticket de compra de comercio y un comprobante de transferencia.
"""

from __future__ import annotations

import pytest

from app.parsing.receipts import (
    detect_subtype,
    extract_amount,
    extract_bank,
    extract_dest,
    extract_from_text,
    extract_origin,
    parse_amount,
)

TICKET = """SUPERMERCADO LA ECONOMIA
Av. Siempre Viva 123 - CUIT 30-12345678-9
Factura B 0001-00012345
Fecha 21/05/2026  Hora 14:32
Leche x2            1.500,00
Pan                   850,50
SUBTOTAL            2.350,50
TOTAL  $          2.350,50
Gracias por su compra
"""

TRANSFER = """Comprobante de transferencia
Banco de la Nacion
Fecha y hora: 05/06/2026 00:56
Nº de operacion: 123456789
Origen: Juan Perez - CBU 0110599520000012345678
Destino: Maria Lopez
CBU destino: 0720000720000098765432
Importe: $ 15.000,00
Concepto: Alquiler
"""


@pytest.mark.parametrize(
    "token,expected",
    [
        ("1.234,56", 1234.56),
        ("2.350,50", 2350.50),
        ("15.000,00", 15000.0),
        ("1234,56", 1234.56),
        ("1234.56", 1234.56),
        ("999", 999.0),
        ("15.000", 15000.0),  # punto = miles (convención AR), no decimal
        ("1.234.567", 1234567.0),
        ("0,00", None),
        ("abc", None),
    ],
)
def test_parse_amount(token: str, expected: float | None) -> None:
    assert parse_amount(token) == expected


TRANSFER_CON_CBU = """Comprobante de transferencia
Banco de la Nacion
Fecha: 05/06/2026
Nº de operación: 123456789012
Origen CBU 0110599520000012345678
Destino: Maria Lopez
CBU destino: 0720000720000098765432
Importe $ 15.000,00
"""


def test_transfer_no_confunde_cbu_con_monto() -> None:
    # El CBU (22 dígitos) y el nº de operación NO deben ganar como monto.
    res = extract_from_text(TRANSFER_CON_CBU)
    assert res.amount == 15000.0


def test_amount_ignora_identificadores_largos() -> None:
    # Aunque no se reconozca la etiqueta, gana el monto con centavos, no el CBU.
    text = "Destino CBU 0720000720000098765432\nTotal abonado: 2.500,00\n"
    assert extract_amount(text, "transfer") == 2500.0


# --- F2-12 A.1: monto conservador (mata el bug del año-como-monto) ---------


def test_amount_ignora_anio_de_fecha_en_linea_etiquetada() -> None:
    # El año de una fecha en la MISMA línea que la etiqueta no debe ganar como monto.
    assert extract_amount("Importe del 05/06/2026: 1.000,00\n", "transfer") == 1000.0


def test_amount_etiquetado_entero_sin_centavos_se_respeta() -> None:
    # Un monto ETIQUETADO sin centavos (ej. $2000 redondo) SÍ se carga: la etiqueta
    # alcanza como señal. Solo se descartan los enteros sueltos SIN etiqueta.
    assert extract_amount("Importe: 2000\n", "transfer") == 2000.0


def test_amount_sin_etiqueta_ni_centavos_da_none() -> None:
    # Enteros sueltos sin etiqueta ni centavos → vacío (no se inventa un monto).
    assert extract_amount("Transferencia recibida\n1500\nOperacion 778899\n", "transfer") is None


def test_detect_subtype() -> None:
    assert detect_subtype(TRANSFER) == "transfer"
    assert detect_subtype(TICKET) == "purchase"


def test_ticket_extraction() -> None:
    res = extract_from_text(TICKET)
    assert res.amount == 2350.50  # de la línea TOTAL, no SUBTOTAL ni los ítems
    assert res.currency == "ARS"
    assert res.date == "2026-05-21"
    assert res.merchant == "SUPERMERCADO LA ECONOMIA"
    assert res.confidence == 1.0


def test_transfer_extraction() -> None:
    res = extract_from_text(TRANSFER)
    assert res.amount == 15000.0  # de la línea Importe
    assert res.currency == "ARS"
    assert res.date == "2026-06-05"
    assert res.merchant == "Maria Lopez"  # contraparte (Destino)
    assert res.confidence == 1.0


def test_total_beats_subtotal_and_items() -> None:
    # Aunque un ítem sea mayor, gana la línea TOTAL.
    text = "Item caro 9.999,00\nSUBTOTAL 9.999,00\nTOTAL 100,00\n"
    assert extract_amount(text, "purchase") == 100.0


def test_empty_text_zero_confidence() -> None:
    res = extract_from_text("")
    assert res.confidence == 0.0
    assert res.amount is None
    assert res.merchant is None


def test_usd_currency() -> None:
    res = extract_from_text("TIENDA\nFecha 01/01/2026\nTOTAL U$S 50,00\n")
    assert res.currency == "USD"
    assert res.amount == 50.0


# --- F2-8: origen/destino/banco de transferencias --------------------------

# Formato "clave: valor en la misma línea" (TRANSFER ya cubre orden directo).
TRANSFER_ORDEN_INVERTIDO = """Comprobante de transferencia
Banco Ejemplo
Fecha y hora: 10/06/2026 09:00
Nº de operacion: 555000111
Ordenante: Lopez, Ana
Banco origen: Banco Ejemplo
Beneficiario: Perez Juan
Banco destino: Banco Otro
Importe: $ 5.000,00
"""

# Formato real de comprobante bancario: etiqueta sola, nombre/cuenta en líneas
# siguientes (imita BANCOPATAGONIA transferencia, con datos inventados).
TRANSFER_MULTILINEA = """Banco Ejemplo
Transferencia
Fecha y Hora
10/06/2026 09:30:00
Nº de transacción
1234567890
Origen
Gomez Carlos, Roberto
CA $ 100-100001111-000
Destino
Fernandez Maria Laura
CUIT / CUIL / DNI: 20111222333
CBU / CVU: 0070000000000000000000
Banco Otro
Importe
$ 7.500,00
Concepto
Varios
"""

TRANSFER_SIN_BANCO = """Comprobante de transferencia
Fecha: 11/06/2026
Origen: Diaz Pedro
Destino: Romero Sofia
Importe: $ 1.000,00
"""


def test_transfer_origen_destino_orden_invertido() -> None:
    assert extract_origin(TRANSFER_ORDEN_INVERTIDO) == "Lopez, Ana"
    assert extract_dest(TRANSFER_ORDEN_INVERTIDO) == "Perez Juan"
    assert extract_bank(TRANSFER_ORDEN_INVERTIDO, "origin") == "Banco Ejemplo"
    assert extract_bank(TRANSFER_ORDEN_INVERTIDO, "dest") == "Banco Otro"


def test_transfer_multilinea_estilo_comprobante_bancario() -> None:
    assert extract_origin(TRANSFER_MULTILINEA) == "Gomez Carlos, Roberto"
    assert extract_dest(TRANSFER_MULTILINEA) == "Fernandez Maria Laura"
    # El "Banco Otro" sin calificar, dentro del bloque Destino, es el banco destino.
    assert extract_bank(TRANSFER_MULTILINEA, "dest") == "Otro"
    # Sin etiqueta de banco en el bloque Origen: no hay dato (no se infiere del header).
    assert extract_bank(TRANSFER_MULTILINEA, "origin") is None


def test_transfer_sin_banco_da_none() -> None:
    res = extract_from_text(TRANSFER_SIN_BANCO)
    assert res.origin_holder == "Diaz Pedro"
    assert res.dest_holder == "Romero Sofia"
    assert res.origin_bank is None
    assert res.dest_bank is None


# Comprobante con el banco emisor en el ENCABEZADO (logo/título), sin etiqueta "Banco:".
# El OCR pega "BANCO" al nombre ("BANCOPATAGONIA"), igual que en los comprobantes reales.
TRANSFER_HEADER_BANCO = """BANCOPATAGONIA
TRANSFERENCIA
Fecha y Hora
05/06/2026 00:56:07
Origen
Gomez Carlos
CA $ 282-282002772-000
Destino
Fernandez Maria
CBU / CVU: 0110000000000000000000
Importe
$ 7.500,00
"""

# Encabezado con DOS bancos conocidos: ambiguo → no se infiere (mejor vacío que mal).
TRANSFER_HEADER_AMBIGUO = """Banco Patagonia Banco Galicia
Origen
Gomez Carlos
Destino
Fernandez Maria
Importe
$ 1.000,00
"""


def test_transfer_banco_origen_inferido_del_header() -> None:
    # Origen sin "Banco:" → se infiere el emisor conocido del encabezado.
    assert extract_bank(TRANSFER_HEADER_BANCO, "origin") == "Banco Patagonia"
    # Destino NO se infiere del header (el emisor es el origen, no el destinatario).
    assert extract_bank(TRANSFER_HEADER_BANCO, "dest") is None
    res = extract_from_text(TRANSFER_HEADER_BANCO)
    assert res.origin_bank == "Banco Patagonia"
    assert res.dest_bank is None


def test_transfer_header_banco_desconocido_no_se_infiere() -> None:
    # "Banco Ejemplo" no está en la lista de conocidos → no se infiere (sigue None).
    assert extract_bank(TRANSFER_MULTILINEA, "origin") is None


def test_transfer_header_ambiguo_no_infiere() -> None:
    assert extract_bank(TRANSFER_HEADER_AMBIGUO, "origin") is None


def test_purchase_no_pobla_campos_de_transferencia() -> None:
    res = extract_from_text(TICKET)
    assert res.origin_holder is None
    assert res.origin_bank is None
    assert res.dest_holder is None
    assert res.dest_bank is None
    assert res.merchant == "SUPERMERCADO LA ECONOMIA"  # retrocompatible


def test_transfer_extraction_pobla_origen_y_destino() -> None:
    res = extract_from_text(TRANSFER)
    assert res.origin_holder == "Juan Perez"
    assert res.dest_holder == "Maria Lopez"
    assert res.confidence == 1.0  # ya estaba en el tope; el boost no lo pasa de 1.0


# --- F2-12 A.2: vocabulario por proveedor + fechas en español --------------
#
# Fixtures ANONIMIZADOS (nombres/CBU/CUIL inventados) que preservan el LAYOUT real de
# cada comprobante (etiquetas, formato de fecha, orden de campos) — que es lo que parsea
# la heurística. Inline, siguiendo la convención de este archivo. Cubren los 5
# proveedores con muestra al 2026-06-24: Patagonia (ya cubierto arriba), Naranja X, BNA,
# Ualá y Mercado Pago.

# Naranja X: monto "Enviaste" sin centavos en la línea siguiente; fecha con mes
# abreviado (22/JUN/2026); etiquetas "Cuenta origen/destino".
TRANSFER_NARANJA = """NaranjaX
Comprobante de transferencia
Enviaste
$35.000

22/JUN/2026 - 22:19 h
Cuenta origen
NX Ana Beatriz Gomez
Naranja X
CBU
0000000000000000000000
CUIL
20-11111111-1
Cuenta destino
Carlos Daniel Ruiz
Mercado Pago
CVU
0000000000000000000001
"""

# BNA: monto "Monto" con centavos en la línea siguiente; etiqueta "Destinatario".
TRANSFER_BNA = """3 Transferencia
BNA
Destinatario
Carlos Daniel Ruiz
CUIT
20222222222
Monto
$1.652,44
CBU
0000000000000000000000
Banco
Motivo
Varios
Fecha
03/04/2026 15:10:46
"""

# Ualá: clave-valor en una línea; "Monto debitado", "Cuenta destino". El PDF apila la
# etiqueta "Nombre remitente" y el OCR la parte: "Nombre <valor>" + "remitente" solo.
TRANSFER_UALA = """Ualá Comprobante de transferencia
Fecha y hora 23/06/2026 14:05 hs
Monto debitado $1,00
Cuenta destino Carlos Daniel Ruiz
CBU destino 0000000000000000000000
CUIT destino 20222222222
Nombre Ana Beatriz Gomez
remitente
Concepto VAR
Id Op. ABC123
"""

# Mercado Pago: monto $1 SIN etiqueta (queda en None, principio rector); fecha textual
# "23 de junio de 2026"; etiquetas "De"/"Para" con bullet del OCR ("o De"/"o Para").
TRANSFER_MP = """mercado pago
Comprobante de transferencia
Martes, 23 de junio de 2026 a las 14:04 hs
$1
Motivo: Varios
o De
Ana Beatriz Gomez
CUIT/CUIL: 20-11111111-1
Mercado Pago
CVU: 0000000000000000000000
o Para
Carlos Daniel Ruiz
CUIT/CUIL: 20-22222222-2
Uala Bank S.A.U
CBU: 0000000000000000000001
"""


def test_transfer_naranja_x() -> None:
    res = extract_from_text(TRANSFER_NARANJA)
    assert res.amount == 35000.0  # "Enviaste" etiqueta el monto de la línea siguiente
    assert res.date == "2026-06-22"  # mes abreviado 22/JUN/2026
    # El prefijo "NX" del logo es ruido de OCR conocido: se limpiará en la fase por
    # proveedor (el enfoque genérico no puede distinguirlo del nombre).
    assert res.origin_holder == "NX Ana Beatriz Gomez"
    assert res.dest_holder == "Carlos Daniel Ruiz"


def test_transfer_bna() -> None:
    res = extract_from_text(TRANSFER_BNA)
    assert res.amount == 1652.44  # "Monto" etiqueta el monto de la línea siguiente
    assert res.date == "2026-04-03"
    assert res.dest_holder == "Carlos Daniel Ruiz"
    assert res.origin_holder is None  # el comprobante no muestra origen


def test_transfer_uala() -> None:
    res = extract_from_text(TRANSFER_UALA)
    assert res.amount == 1.0  # "Monto debitado $1,00" (con centavos)
    assert res.date == "2026-06-23"
    assert res.origin_holder == "Ana Beatriz Gomez"  # "Nombre remitente"
    assert res.dest_holder == "Carlos Daniel Ruiz"  # "Cuenta destino"


def test_transfer_mercado_pago() -> None:
    res = extract_from_text(TRANSFER_MP)
    # $1 sin etiqueta ni centavos → vacío (principio rector: mejor manual que el año).
    assert res.amount is None
    assert res.date == "2026-06-23"  # fecha textual "23 de junio de 2026"
    assert res.origin_holder == "Ana Beatriz Gomez"  # "o De" (bullet del OCR)
    assert res.dest_holder == "Carlos Daniel Ruiz"  # "o Para"


def test_party_no_agarra_otro_campo_como_nombre() -> None:
    # Etiqueta sola seguida de OTRO campo (Concepto) → None, no carga "Concepto VAR".
    text = "Comprobante de transferencia\nremitente\nConcepto Varios\nCBU 0000\n"
    assert extract_origin(text) is None


def test_fecha_mes_textual_y_abreviado() -> None:
    from app.parsing.receipts import extract_date

    assert extract_date("Fecha 22/JUN/2026") == "2026-06-22"
    assert extract_date("el 5 de marzo de 2026") == "2026-03-05"
    assert extract_date("1-dic-26") == "2026-12-01"
    assert extract_date("sin fecha valida") is None
