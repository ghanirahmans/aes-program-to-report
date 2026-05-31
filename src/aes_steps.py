import time

from aes_constants import MIX_COLUMNS_MATRIX, RCON, S_BOX
from report import (
    Pt,
    add_bold_paragraph,
    add_calculation_paragraph,
    add_constant_matrix_to_doc,
    add_matrix_to_doc,
    add_poly_text_to_paragraph,
    add_single_term_to_para,
    start_two_column_section,
)
from terminal_style import Fore


def print_matrix(label, hex_string):
    print(f"\n{Fore.CYAN + label}")
    bytes_array = [hex_string[i : i + 2] for i in range(0, len(hex_string), 2)]
    for r in range(4):
        print(f"| {' | '.join(bytes_array[c * 4 + r] for c in range(4)).upper()} |")


def print_constant_matrix(label, matrix):
    print(f"\n{Fore.CYAN + label}")
    for r in range(4):
        print(f"| {' | '.join(f'{val:02X}' for val in matrix[r])} |")


def print_interim_matrix(label, data_bytes, cols_filled):
    print(f"\n{Fore.CYAN + label}")
    for r in range(4):
        items = [f"{data_bytes[c * 4 + r]:02X}" if c < cols_filled else "XX" for c in range(4)]
        print(f"| {' | '.join(items)} |")


def byte_to_poly_str(poly_val):
    if poly_val == 0:
        return "0"
    terms = []
    for i in range(poly_val.bit_length()):
        if (poly_val >> i) & 1:
            if i == 0:
                terms.append("1")
            elif i == 1:
                terms.append("x")
            else:
                terms.append(f"x^{i}")
    return " + ".join(reversed(terms))


def poly_multiply(poly1, poly2):
    res = 0
    for i in range(8):
        if (poly2 >> i) & 1:
            term = poly1 << i
            res ^= term
    return res


def poly_reduce(poly):
    aes_poly = 0x11B
    aes_poly_for_exp = aes_poly & 0xFF

    if poly < 0x100:
        return poly, []

    highest_power_term = byte_to_poly_str(1 << (poly.bit_length() - 1))
    explanations = [
        {"type": "info", "text": f"{highest_power_term} perlu direduksi dengan {byte_to_poly_str(aes_poly_for_exp)}"}
    ]

    while poly >= 0x100:
        highest_bit_pos = poly.bit_length() - 1
        shift_amount = highest_bit_pos - 8
        reducer = aes_poly << shift_amount

        poly_display_str = byte_to_poly_str(poly ^ (1 << highest_bit_pos))
        reducer_display_str = byte_to_poly_str(reducer ^ (1 << highest_bit_pos))

        explanations.append({
            "type": "strikethrough_xor",
            "poly1_str": poly_display_str,
            "poly2_str": reducer_display_str,
        })

        poly ^= reducer
        explanations.append({"type": "result", "text": f"= {byte_to_poly_str(poly)}"})

    return poly, explanations


def explain_gmul_poly(a, b, doc):
    indent_prefix = "  "

    poly_a_str = byte_to_poly_str(a)
    poly_b_str = byte_to_poly_str(b)

    header_line1 = f"{a:02X} = {a:08b} = {poly_a_str}"
    header_line2 = f"{b:02X} = {b:08b} = {poly_b_str}"
    header_line3 = f"{a:02X} * {b:02X} = ({poly_a_str}) * ({poly_b_str})"
    print(f"      {Fore.CYAN}{header_line1}")
    print(f"      {Fore.CYAN}{header_line2}")
    if doc:
        p_header = doc.add_paragraph()
        add_poly_text_to_paragraph(p_header, header_line1 + "\n" + header_line2 + "\n" + header_line3)

    raw_product = poly_multiply(a, b)
    product_str = byte_to_poly_str(raw_product)

    mult_result_text = f"= {product_str}"
    print(f"      {mult_result_text}")
    if doc:
        p_mult = doc.add_paragraph()
        add_poly_text_to_paragraph(p_mult, mult_result_text)

    final_result, reduction_explanations = poly_reduce(raw_product)

    if reduction_explanations:
        for exp_item in reduction_explanations:
            console_text = ""
            p_exp = None
            if doc:
                p_exp = doc.add_paragraph()
                p_exp.paragraph_format.left_indent = Pt(18)

            if exp_item["type"] == "info" or exp_item["type"] == "result":
                console_text = exp_item["text"]
                if doc:
                    add_poly_text_to_paragraph(p_exp, console_text)

            elif exp_item["type"] == "strikethrough_xor":
                poly1_str = exp_item["poly1_str"]
                poly2_str = exp_item["poly2_str"]
                console_text = f"({poly1_str}) \u2295 ({poly2_str})"
                if doc:
                    terms1 = poly1_str.split(" + ")
                    terms2 = poly2_str.split(" + ")
                    duplicates = set(terms1) & set(terms2)

                    for i, term in enumerate(terms1):
                        add_single_term_to_para(p_exp, term, term in duplicates)
                        if i < len(terms1) - 1:
                            p_exp.add_run(" + ")

                    p_exp.add_run(" + ")

                    for i, term in enumerate(terms2):
                        add_single_term_to_para(p_exp, term, term in duplicates)
                        if i < len(terms2) - 1:
                            p_exp.add_run(" + ")

            print(f"      {Fore.YELLOW}{indent_prefix}{console_text.strip()}")

    final_result_str = byte_to_poly_str(final_result)
    final_text = f"= {final_result_str} ({final_result:08b}) (Heks: {final_result:02X})"
    print(f"      {Fore.GREEN}{indent_prefix}{final_text}\n")
    if doc:
        p_final = doc.add_paragraph()
        p_final.paragraph_format.left_indent = Pt(18)
        add_poly_text_to_paragraph(p_final, final_text)

    time.sleep(0.01)
    return final_result


def key_schedule_explain(initial_key_hex, doc):
    print(f"\n{Fore.YELLOW}===== PROSES KEY SCHEDULE (Ekspansi Kunci) =====")
    if doc:
        start_two_column_section(doc)
        doc.add_heading("Proses Key Schedule (Ekspansi Kunci)", level=2)
    initial_key_bytes = bytearray.fromhex(initial_key_hex)
    round_keys_bytes = [initial_key_bytes]
    print_matrix("Kunci Awal (Round 0)", initial_key_hex)
    add_matrix_to_doc(doc, "Kunci Awal (Round 0)", initial_key_hex)
    time.sleep(0.1)
    for round_num in range(1, 11):
        print(f"\n{Fore.MAGENTA}=== Proses Membuat Kunci Round {round_num} ===")
        if doc:
            doc.add_paragraph()
            doc.add_heading(f"Membuat Kunci Round {round_num}", level=3)
        prev_key = round_keys_bytes[-1]

        title = "--- 1: Membuat Word Sementara ---"
        print(f"\n{Fore.CYAN}{title}")
        if doc:
            add_bold_paragraph(doc, title.strip(" -"))

        temp_word = prev_key[12:16]
        text_doc = f"- Kolom terakhir Kunci Round {round_num - 1}: {' '.join(f'{b:02X}' for b in temp_word)}"
        print("  " + text_doc)
        add_calculation_paragraph(doc, text_doc)
        temp_word = temp_word[1:] + temp_word[:1]
        text_doc = f"- RotWord: {' '.join(f'{b:02X}' for b in temp_word)}"
        print("  " + text_doc)
        add_calculation_paragraph(doc, text_doc)
        temp_word = bytearray(S_BOX[b] for b in temp_word)
        text_doc = f"- SubWord (dengan S-BOX): {' '.join(f'{b:02X}' for b in temp_word)}"
        print("  " + text_doc)
        add_calculation_paragraph(doc, text_doc)

        rcon_word = bytearray([RCON[round_num], 0, 0, 0])

        transformed_word = bytearray(temp_word)
        for i in range(4):
            temp_word[i] ^= rcon_word[i]

        t1_combined = f"   Word sblm XOR : {' '.join(f'{b:02X}' for b in transformed_word)} ({' '.join(f'{b:08b}' for b in transformed_word)})"
        print(f"     {Fore.GREEN}{t1_combined}")
        add_calculation_paragraph(doc, t1_combined)
        t2_combined = f"   Rcon Word[{round_num}]      : {' '.join(f'{b:02X}' for b in rcon_word)} ({' '.join(f'{b:08b}' for b in rcon_word)})"
        print(f"     {Fore.RED}{t2_combined}")
        add_calculation_paragraph(doc, t2_combined)
        print("     ----------------------------------------------- (XOR)")
        doc.add_paragraph("   ----------------------------------------------- (XOR)")
        t3_combined = f"   Hasil: {' '.join(f'{b:02X}' for b in temp_word)} ({' '.join(f'{b:08b}' for b in temp_word)})"
        print(f"     {Fore.YELLOW}{t3_combined}")
        add_calculation_paragraph(doc, t3_combined)

        new_key = bytearray(16)
        print(f"\n{Fore.CYAN}--- 2: Menghitung Kolom-Kolom Kunci Baru ---")
        if doc:
            add_bold_paragraph(doc, "\n2: Menghitung Kolom-Kolom Kunci Baru")
        for col in range(4):
            col_desc = f"Menghitung Kolom {col}"
            print(f"\n{Fore.BLUE}{col_desc}:")
            if doc:
                add_bold_paragraph(doc, col_desc)
            for i in range(4):
                if col == 0:
                    val1, val2 = prev_key[i], temp_word[i]
                else:
                    idx, prev_new_idx = col * 4 + i, (col - 1) * 4 + i
                    val1, val2 = prev_key[idx], new_key[prev_new_idx]
                res = val1 ^ val2
                new_key[col * 4 + i] = res

                combined_text = f"Baris {i}: {val1:02X} \u2295 {val2:02X} = {res:02X} ({val1:08b} \u2295 {val2:08b} = {res:08b})"
                print(f"  {Fore.GREEN}{combined_text}")
                add_calculation_paragraph(doc, combined_text)
            if col < 3:
                print_interim_matrix("Kunci Sementara", new_key, col + 1)
                interim_hex = "".join(f"{b:02x}" for b in new_key[: (col + 1) * 4]) + "XX" * (12 - col * 4)
                add_matrix_to_doc(doc, "Kunci Sementara", interim_hex)
        round_keys_bytes.append(new_key)
        print_matrix(f"Kunci Round {round_num}", new_key.hex())
        add_matrix_to_doc(doc, f"Kunci Round {round_num}", new_key.hex())
        time.sleep(0.1)
    return [key.hex() for key in round_keys_bytes]


def sub_bytes_explain(state_hex, doc):
    print(f"\n{Fore.MAGENTA}--- Langkah: SubBytes ---")
    if doc:
        doc.add_heading("Langkah: SubBytes", level=3)
    state_bytes = bytearray.fromhex(state_hex)
    for i in range(16):
        old_val, new_val = state_bytes[i], S_BOX[state_bytes[i]]
        state_bytes[i] = new_val
        text_doc = f"Byte {i:2d}: nilai tabel S-BOX pada indeks[{old_val:02X}] menjadi {new_val:02X}"
        print(f"  {text_doc}")
        add_calculation_paragraph(doc, text_doc)
        time.sleep(0.01)
    result_hex = state_bytes.hex()
    print_matrix("Hasil SubBytes", result_hex)
    add_matrix_to_doc(doc, "Hasil SubBytes", result_hex)
    return result_hex


def shift_rows_explain(state_hex, doc):
    print(f"\n{Fore.MAGENTA}--- Langkah: ShiftRows ---")
    if doc:
        doc.add_heading("Langkah: ShiftRows", level=3)
    s = bytearray.fromhex(state_hex)
    print_matrix("State Sebelum ShiftRows", state_hex)
    add_matrix_to_doc(doc, "State Sebelum ShiftRows", state_hex)
    time.sleep(0.1)
    final_s = bytearray(s)
    final_s[1], final_s[5], final_s[9], final_s[13] = s[5], s[9], s[13], s[1]
    final_s[2], final_s[6], final_s[10], final_s[14] = s[10], s[14], s[2], s[6]
    final_s[3], final_s[7], final_s[11], final_s[15] = s[15], s[3], s[7], s[11]
    print(f"\n{Fore.BLUE}Penjelasan pergeseran per baris:")
    if doc:
        doc.add_paragraph("Penjelasan pergeseran per baris:")
    for r in range(4):
        before = [s[c * 4 + r] for c in range(4)]
        after = [final_s[c * 4 + r] for c in range(4)]
        text_doc = f"- Baris {r}: {'Tidak bergeser' if r == 0 else f'Digeser {r} byte ke kiri'}: {' '.join(f'{b:02X}' for b in before)} menjadi {' '.join(f'{b:02X}' for b in after)}"
        print(f"  {text_doc}")
        add_calculation_paragraph(doc, text_doc)
        time.sleep(0.1)
    result_hex = final_s.hex()
    print_matrix("Hasil Akhir ShiftRows", result_hex)
    add_matrix_to_doc(doc, "Hasil Akhir ShiftRows", result_hex)
    return result_hex


def mix_columns_poly_explain(state_hex, doc):
    print(f"\n{Fore.MAGENTA}--- Langkah: MixColumns (Polinomial) ---")
    if doc:
        doc.add_heading("Langkah: MixColumns (Polinomial)", level=3)
        add_constant_matrix_to_doc(doc, "Matriks Konstan yang Digunakan:", MIX_COLUMNS_MATRIX)
    print_constant_matrix("Matriks Konstan yang Digunakan:", MIX_COLUMNS_MATRIX)

    state_bytes = bytearray.fromhex(state_hex)
    new_state_bytes = bytearray(16)

    for c in range(4):
        print(f"\n{Fore.BLUE}==================== Mencampur Kolom {c} ====================")
        if doc:
            doc.add_paragraph().add_run(f"\nMencampur Kolom {c}:").bold = True

        s_col = state_bytes[c * 4 : c * 4 + 4]
        res_col_bytes = bytearray(4)

        for r in range(4):
            m_row = MIX_COLUMNS_MATRIX[r]
            print(f"\n{Fore.CYAN}--- Perhitungan untuk Elemen Baru di Baris {r} ---")
            if doc:
                add_bold_paragraph(doc, f"Perhitungan untuk Elemen Baru di Baris {r}:")

            summary_parts = [f"({s_col[i]:02X} * {m_row[i]:02X})" for i in range(4)]
            summary_line = " \u2295 ".join(summary_parts)

            print(f"      {Fore.MAGENTA}{summary_line}")
            if doc:
                add_calculation_paragraph(doc, summary_line)

            gmul_results = []
            for i in range(4):
                s_val = s_col[i]
                m_val = m_row[i]

                print(f"\n  Langkah {i + 1}: Perkalian {s_val:02X} dengan {m_val:02X}")
                if doc:
                    add_bold_paragraph(doc, f"Langkah {i + 1}: Perkalian {s_val:02X} dengan {m_val:02X}")

                result_byte = explain_gmul_poly(s_val, m_val, doc)
                gmul_results.append(result_byte)

            final_byte = gmul_results[0] ^ gmul_results[1] ^ gmul_results[2] ^ gmul_results[3]
            res_col_bytes[r] = final_byte

            print(f"\n{Fore.CYAN}--- Penjumlahan (XOR) Semua Hasil untuk Elemen Baru di Baris {r} ---")
            sum_parts_bin = [f"({val:08b})" for val in gmul_results]
            sum_str = " \u2295 ".join(sum_parts_bin)
            result_sum_str = f"Hasil Akhir Elemen [Kolom:{r}, Baris:{c}] = {final_byte:08b} (Heks: {final_byte:02X})"
            print(f"      {Fore.YELLOW}{sum_str}")
            print(f"      {Fore.GREEN}{result_sum_str}")

            if doc:
                add_bold_paragraph(doc, "Penjumlahan Hasil (XOR)")
                p_sum = doc.add_paragraph()
                add_poly_text_to_paragraph(p_sum, sum_str)
                p_res_sum = doc.add_paragraph()
                add_poly_text_to_paragraph(p_res_sum, result_sum_str)

        for i in range(4):
            new_state_bytes[c * 4 + i] = res_col_bytes[i]

    result_hex = new_state_bytes.hex()
    print_matrix("Hasil Akhir MixColumns", result_hex)
    add_matrix_to_doc(doc, "Hasil Akhir MixColumns", result_hex)
    return result_hex


def add_round_key_explain(state_hex, key_hex, round_num, doc):
    print(f"\n{Fore.MAGENTA}--- Langkah: AddRoundKey (Round {round_num}) ---")
    if doc:
        doc.add_heading(f"Langkah: AddRoundKey (Round {round_num})", level=3)
    state_bytes, key_bytes = bytearray.fromhex(state_hex), bytearray.fromhex(key_hex)
    print_matrix("State Sebelum", state_hex)
    add_matrix_to_doc(doc, "State Sebelum", state_hex)
    print_matrix("Kunci Round", key_hex)
    add_matrix_to_doc(doc, "Kunci Round", key_hex)
    print(f"\n{Fore.BLUE}Proses XOR per byte:")
    if doc:
        doc.add_paragraph("Proses XOR per byte:")
    result_bytes = bytearray(16)
    for i in range(16):
        res = state_bytes[i] ^ key_bytes[i]
        result_bytes[i] = res
        text_doc = f"Byte {i:2d}: {state_bytes[i]:02X} \u2295 {key_bytes[i]:02X} = {res:02X} ({state_bytes[i]:08b} \u2295 {key_bytes[i]:08b} = {res:08b})"
        print(f"  {Fore.GREEN}{text_doc}")
        add_calculation_paragraph(doc, text_doc)
        time.sleep(0.05)
    result_hex = result_bytes.hex()
    print_matrix(f"Hasil AddRoundKey Round {round_num}", result_hex)
    add_matrix_to_doc(doc, f"Hasil AddRoundKey Round {round_num}", result_hex)
    return result_hex
