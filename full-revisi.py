import time
from datetime import datetime
import re

# --- Inisialisasi Pustaka ---
try:
    from colorama import Fore, Style, init
    init(autoreset=True)
except ImportError:
    print("Peringatan: library 'colorama' tidak ditemukan. Output tidak akan berwarna.")
    class Fore: YELLOW = GREEN = MAGENTA = CYAN = BLUE = RED = WHITE = ""
    class Style: RESET_ALL = ""

try:
    import docx
    from docx.shared import Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False
    docx = Pt = WD_ALIGN_PARAGRAPH = RGBColor = None

# --- Konstanta Inti AES ---
S_BOX = (
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
)
RCON = (0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36)
MIX_COLUMNS_MATRIX = [[2, 3, 1, 1], [1, 2, 3, 1], [1, 1, 2, 3], [3, 1, 1, 2]]

# --- Fungsi Pembantu untuk Output & Laporan ---
def add_bold_paragraph(doc, text):
    if doc: p = doc.add_paragraph(); p.add_run(text).bold = True

def add_calculation_paragraph(doc, text, indent=False):
    if doc:
        p = doc.add_paragraph()
        if indent:
            p.paragraph_format.left_indent = Pt(18)
        run = p.add_run(text.strip())
        font = run.font; font.name = 'Times New Roman'; font.size = Pt(12); font.color.rgb = RGBColor(0,0,0)

def add_poly_text_to_paragraph(p, text):
    parts = re.split(r'(x\^\d+)', text)
    for part in parts:
        if part.startswith('x^'):
            base, exponent = part.split('^')
            run = p.add_run(base)
            run.font.name = 'Times New Roman'; run.font.size = Pt(12); run.font.color.rgb = RGBColor(0,0,0)
            run_sup = p.add_run(exponent)
            run_sup.font.superscript = True
            run_sup.font.name = 'Times New Roman'; run_sup.font.size = Pt(12); run_sup.font.color.rgb = RGBColor(0,0,0)
        else:
            run = p.add_run(part)
            run.font.name = 'Times New Roman'; run.font.size = Pt(12); run.font.color.rgb = RGBColor(0,0,0)

def add_single_term_to_para(p, term, is_duplicate):
    font_attrs = {'name': 'Times New Roman', 'size': Pt(12), 'color': {'rgb': RGBColor(0,0,0)}}
    
    if "^" in term:
        base, exponent = term.split('^', 1)
        run = p.add_run(base)
        run.font.name, run.font.size, run.font.color.rgb = font_attrs['name'], font_attrs['size'], font_attrs['color']['rgb']
        run.font.strike = is_duplicate
        run.font.bold = is_duplicate

        run_sup = p.add_run(exponent)
        run_sup.font.superscript = True
        run_sup.font.name, run_sup.font.size, run_sup.font.color.rgb = font_attrs['name'], font_attrs['size'], font_attrs['color']['rgb']
        run_sup.font.strike = is_duplicate
        run_sup.font.bold = is_duplicate
    else:
        run = p.add_run(term)
        run.font.name, run.font.size, run.font.color.rgb = font_attrs['name'], font_attrs['size'], font_attrs['color']['rgb']
        run.font.strike = is_duplicate
        run.font.bold = is_duplicate

def add_matrix_to_doc(doc, label, hex_string):
    if doc:
        p = doc.add_paragraph(); p.add_run(label).italic = True; font=p.runs[0].font; font.name='Times New Roman'; font.size=Pt(12)
        table = doc.add_table(rows=4, cols=4); table.style = 'Table Grid'
        bytes_array = [hex_string[i:i+2] for i in range(0, len(hex_string), 2)]
        for r in range(4):
            for c in range(4):
                cell = table.cell(r, c); run = cell.paragraphs[0].add_run(bytes_array[c*4+r].upper()); run.font.name = 'Times New Roman'; run.font.size = Pt(12); run.font.color.rgb = RGBColor(0,0,0); cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        doc.add_paragraph()

def add_constant_matrix_to_doc(doc, label, matrix):
    if doc:
        p = doc.add_paragraph(); p.add_run(label).italic = True; font=p.runs[0].font; font.name='Times New Roman'; font.size=Pt(12)
        table = doc.add_table(rows=4, cols=4); table.style = 'Table Grid'
        for r in range(4):
            for c in range(4):
                cell = table.cell(r, c)
                run = cell.paragraphs[0].add_run(f"{matrix[r][c]:02X}")
                run.font.name = 'Times New Roman'; run.font.size = Pt(12); run.font.color.rgb = RGBColor(0,0,0)
                cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        doc.add_paragraph()

def print_matrix(label, hex_string):
    print(f"\n{Fore.CYAN + label}"); bytes_array = [hex_string[i:i+2] for i in range(0, len(hex_string), 2)];
    for r in range(4): print(f"| {' | '.join(bytes_array[c*4+r] for c in range(4)).upper()} |")

def print_constant_matrix(label, matrix):
    print(f"\n{Fore.CYAN + label}")
    for r in range(4):
        print(f"| {' | '.join(f'{val:02X}' for val in matrix[r])} |")

def print_interim_matrix(label, data_bytes, cols_filled):
    print(f"\n{Fore.CYAN + label}");
    for r in range(4): items = [f"{data_bytes[c*4+r]:02X}" if c<cols_filled else "XX" for c in range(4)]; print(f"| {' | '.join(items)} |")

# --- Fungsi-fungsi Representasi Polinomial ---
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
            "poly2_str": reducer_display_str
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
                poly1_str = exp_item['poly1_str']
                poly2_str = exp_item['poly2_str']
                console_text = f"({poly1_str}) \u2295 ({poly2_str})"
                if doc:
                    terms1 = poly1_str.split(' + ')
                    terms2 = poly2_str.split(' + ')
                    duplicates = set(terms1) & set(terms2)
                    
                    for i, term in enumerate(terms1):
                        add_single_term_to_para(p_exp, term, term in duplicates)
                        if i < len(terms1) - 1: p_exp.add_run(" + ")
                    
                    p_exp.add_run(" + ")
                    
                    for i, term in enumerate(terms2):
                        add_single_term_to_para(p_exp, term, term in duplicates)
                        if i < len(terms2) - 1: p_exp.add_run(" + ")
            
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

# --- Fungsi Langkah-Langkah Inti AES ---
# --- FUNGSI YANG DIUBAH ---
def key_schedule_explain(initial_key_hex, doc):
    print(f"\n{Fore.YELLOW}===== PROSES KEY SCHEDULE (Ekspansi Kunci) =====");
    if doc: doc.add_heading("Proses Key Schedule (Ekspansi Kunci)", level=2)
    initial_key_bytes = bytearray.fromhex(initial_key_hex); round_keys_bytes = [initial_key_bytes]
    print_matrix("Kunci Awal (Round 0)", initial_key_hex); add_matrix_to_doc(doc, "Kunci Awal (Round 0)", initial_key_hex)
    time.sleep(0.1)
    for round_num in range(1, 11):
        print(f"\n{Fore.MAGENTA}=== Proses Membuat Kunci Round {round_num} ===");
        if doc: doc.add_paragraph(); doc.add_heading(f"Membuat Kunci Round {round_num}", level=3)
        prev_key = round_keys_bytes[-1]
        
        title = f"--- 1: Membuat Word Sementara ---"
        print(f"\n{Fore.CYAN}{title}");
        if doc: add_bold_paragraph(doc, title.strip(" -"))

        temp_word = prev_key[12:16]; text_doc = f"- Kolom terakhir Kunci Round {round_num-1}: {' '.join(f'{b:02X}' for b in temp_word)}"; print("  "+text_doc); add_calculation_paragraph(doc, text_doc)
        temp_word = temp_word[1:] + temp_word[:1]; text_doc = f"- RotWord: {' '.join(f'{b:02X}' for b in temp_word)}"; print("  "+text_doc); add_calculation_paragraph(doc, text_doc)
        temp_word = bytearray(S_BOX[b] for b in temp_word); text_doc = f"- SubWord (dengan S-BOX): {' '.join(f'{b:02X}' for b in temp_word)}"; print("  "+text_doc); add_calculation_paragraph(doc, text_doc)
        
        # PENGEMBANGAN: Menambahkan penjelasan Rcon
        rcon_word = bytearray([RCON[round_num], 0, 0, 0])
        # rcon_line = f"Rcon[Round {round_num}]: [{', '.join(f'{b:02X}' for b in rcon_word)}]"
        # print(f"      {Fore.MAGENTA}{rcon_line}")
        # if doc: add_calculation_paragraph(doc, rcon_line, indent=True)
        # --- Akhir Pengembangan ---
        
        transformed_word = bytearray(temp_word)
        for i in range(4): temp_word[i] ^= rcon_word[i]
        
        # xor_title = f"- XOR dengan Rcon Word [R{round_num}]: {' '.join(f'{b:02X}' for b in rcon_word)}"; print("  "+xor_title); add_calculation_paragraph(doc, xor_title)
        t1_combined = f"   Word sblm XOR : {' '.join(f'{b:02X}' for b in transformed_word)} ({' '.join(f'{b:08b}' for b in transformed_word)})"
        print(f"     {Fore.GREEN}{t1_combined}"); add_calculation_paragraph(doc, t1_combined)
        t2_combined = f"   Rcon Word[{round_num}]      : {' '.join(f'{b:02X}' for b in rcon_word)} ({' '.join(f'{b:08b}' for b in rcon_word)})"
        print(f"     {Fore.RED}{t2_combined}"); add_calculation_paragraph(doc, t2_combined)
        print("     ----------------------------------------------- (XOR)"); doc.add_paragraph("   ----------------------------------------------- (XOR)")
        t3_combined = f"   Hasil: {' '.join(f'{b:02X}' for b in temp_word)} ({' '.join(f'{b:08b}' for b in temp_word)})"
        print(f"     {Fore.YELLOW}{t3_combined}"); add_calculation_paragraph(doc, t3_combined)

        new_key = bytearray(16)
        print(f"\n{Fore.CYAN}--- 2: Menghitung Kolom-Kolom Kunci Baru ---");
        if doc: add_bold_paragraph(doc, "\n2: Menghitung Kolom-Kolom Kunci Baru")
        for col in range(4):
            col_desc = f"Menghitung Kolom {col}"; print(f"\n{Fore.BLUE}{col_desc}:");
            if doc: add_bold_paragraph(doc, col_desc)
            for i in range(4):
                if col == 0: val1, val2 = prev_key[i], temp_word[i]
                else: idx, prev_new_idx = col*4+i, (col-1)*4+i; val1, val2 = prev_key[idx], new_key[prev_new_idx]
                res = val1 ^ val2; new_key[col*4+i] = res
                
                combined_text = f"Baris {i}: {val1:02X} \u2295 {val2:02X} = {res:02X} ({val1:08b} \u2295 {val2:08b} = {res:08b})"
                print(f"  {Fore.GREEN}{combined_text}")
                add_calculation_paragraph(doc, combined_text)
            if col < 3: print_interim_matrix("Kunci Sementara", new_key, col + 1); interim_hex = ''.join(f'{b:02x}' for b in new_key[:(col+1)*4])+'XX'*(12-col*4); add_matrix_to_doc(doc, "Kunci Sementara", interim_hex)
        round_keys_bytes.append(new_key)
        print_matrix(f"Kunci Round {round_num}", new_key.hex()); add_matrix_to_doc(doc, f"Kunci Round {round_num}", new_key.hex())
        time.sleep(0.1)
    return [key.hex() for key in round_keys_bytes]

def sub_bytes_explain(state_hex, doc):
    print(f"\n{Fore.MAGENTA}--- Langkah: SubBytes ---");
    if doc: doc.add_heading("Langkah: SubBytes", level=3)
    state_bytes = bytearray.fromhex(state_hex)
    for i in range(16):
        old_val, new_val = state_bytes[i], S_BOX[state_bytes[i]]; state_bytes[i] = new_val
        text_doc = f"Byte {i:2d}: nilai tabel S-BOX pada indeks[{old_val:02X}] menjadi {new_val:02X}"; print(f"  {text_doc}"); add_calculation_paragraph(doc, text_doc); time.sleep(0.01)
    result_hex = state_bytes.hex()
    print_matrix("Hasil SubBytes", result_hex); add_matrix_to_doc(doc, "Hasil SubBytes", result_hex);
    return result_hex

def shift_rows_explain(state_hex, doc):
    print(f"\n{Fore.MAGENTA}--- Langkah: ShiftRows ---");
    if doc: doc.add_heading("Langkah: ShiftRows", level=3)
    s = bytearray.fromhex(state_hex)
    print_matrix("State Sebelum ShiftRows", state_hex); add_matrix_to_doc(doc, "State Sebelum ShiftRows", state_hex)
    time.sleep(0.1)
    final_s = bytearray(s)
    final_s[1],final_s[5],final_s[9],final_s[13] = s[5],s[9],s[13],s[1]; final_s[2],final_s[6],final_s[10],final_s[14] = s[10],s[14],s[2],s[6]; final_s[3],final_s[7],final_s[11],final_s[15] = s[15],s[3],s[7],s[11]
    print(f"\n{Fore.BLUE}Penjelasan pergeseran per baris:")
    if doc: doc.add_paragraph("Penjelasan pergeseran per baris:")
    for r in range(4):
        before = [s[c*4+r] for c in range(4)]; after = [final_s[c*4+r] for c in range(4)]
        text_doc = f"- Baris {r}: {'Tidak bergeser' if r==0 else f'Digeser {r} byte ke kiri'}: {' '.join(f'{b:02X}' for b in before)} menjadi {' '.join(f'{b:02X}' for b in after)}"
        print(f"  {text_doc}"); add_calculation_paragraph(doc, text_doc); time.sleep(0.1)
    result_hex = final_s.hex()
    print_matrix("Hasil Akhir ShiftRows", result_hex); add_matrix_to_doc(doc, "Hasil Akhir ShiftRows", result_hex)
    return result_hex

# --- FUNGSI YANG DIUBAH ---
def mix_columns_poly_explain(state_hex, doc):
    print(f"\n{Fore.MAGENTA}--- Langkah: MixColumns (Polinomial) ---");
    if doc:
        doc.add_heading("Langkah: MixColumns (Polinomial)", level=3)
        add_constant_matrix_to_doc(doc, "Matriks Konstan yang Digunakan:", MIX_COLUMNS_MATRIX)
    print_constant_matrix("Matriks Konstan yang Digunakan:", MIX_COLUMNS_MATRIX)

    state_bytes = bytearray.fromhex(state_hex);
    new_state_bytes = bytearray(16)
    
    for c in range(4):
        print(f"\n{Fore.BLUE}==================== Mencampur Kolom {c} ====================")
        if doc: doc.add_paragraph().add_run(f"\nMencampur Kolom {c}:").bold = True
        
        s_col = state_bytes[c*4 : c*4+4]
        
        res_col_bytes = bytearray(4)

        for r in range(4):
            m_row = MIX_COLUMNS_MATRIX[r]
            print(f"\n{Fore.CYAN}--- Perhitungan untuk Elemen Baru di Baris {r} ---")
            if doc: add_bold_paragraph(doc, f"Perhitungan untuk Elemen Baru di Baris {r}:")
            
            # PENGEMBANGAN: Menambahkan ringkasan operasi dan matriks konstan
            summary_parts = [f"({s_col[i]:02X} * {m_row[i]:02X})" for i in range(4)]
            summary_line = f"" + " \u2295 ".join(summary_parts)
            # matrix_line = f"Matriks Konstan[Baris {r}]: [{', '.join(f'{b:02X}' for b in m_row)}]"
            
            print(f"      {Fore.MAGENTA}{summary_line}")
            # print(f"      {Fore.MAGENTA}{matrix_line}")
            if doc:
                add_calculation_paragraph(doc, summary_line)
                # add_calculation_paragraph(doc, matrix_line)
            # --- Akhir Pengembangan ---
            
            gmul_results = []
            for i in range(4):
                s_val = s_col[i]
                m_val = m_row[i]
                
                print(f"\n  Langkah {i+1}: Perkalian {s_val:02X} dengan {m_val:02X}")
                if doc: add_bold_paragraph(doc, f"Langkah {i+1}: Perkalian {s_val:02X} dengan {m_val:02X}")
                
                result_byte = explain_gmul_poly(s_val, m_val, doc)
                gmul_results.append(result_byte)

            final_byte = gmul_results[0] ^ gmul_results[1] ^ gmul_results[2] ^ gmul_results[3]
            res_col_bytes[r] = final_byte

            print(f"\n{Fore.CYAN}--- Penjumlahan (XOR) Semua Hasil untuk Elemen Baru di Baris {r} ---")
            sum_parts_bin = [f"({val:08b})" for val in gmul_results]
            sum_str = f"" + " \u2295 ".join(sum_parts_bin)
            
            # PERUBAHAN: Menghilangkan format polinomial dari `result_sum_str`
            result_sum_str = f"Hasil Akhir Elemen [Kolom:{r}, Baris:{c}] = {final_byte:08b} (Heks: {final_byte:02X})"
            print(f"      {Fore.YELLOW}{sum_str}")
            print(f"      {Fore.GREEN}{result_sum_str}")

            if doc:
                add_bold_paragraph(doc, "Penjumlahan Hasil (XOR)")
                p_sum = doc.add_paragraph()
                add_poly_text_to_paragraph(p_sum, sum_str)
                p_res_sum = doc.add_paragraph()
                add_poly_text_to_paragraph(p_res_sum, result_sum_str)
            
        for i in range(4): new_state_bytes[c*4+i] = res_col_bytes[i]

    result_hex = new_state_bytes.hex()
    print_matrix("Hasil Akhir MixColumns", result_hex); add_matrix_to_doc(doc, "Hasil Akhir MixColumns", result_hex)
    return result_hex
# ------------------------------

def add_round_key_explain(state_hex, key_hex, round_num, doc):
    print(f"\n{Fore.MAGENTA}--- Langkah: AddRoundKey (Round {round_num}) ---")
    if doc: doc.add_heading(f"Langkah: AddRoundKey (Round {round_num})", level=3)
    state_bytes, key_bytes = bytearray.fromhex(state_hex), bytearray.fromhex(key_hex)
    print_matrix("State Sebelum", state_hex); add_matrix_to_doc(doc, "State Sebelum", state_hex)
    print_matrix("Kunci Round", key_hex); add_matrix_to_doc(doc, "Kunci Round", key_hex)
    print(f"\n{Fore.BLUE}Proses XOR per byte:")
    if doc: doc.add_paragraph("Proses XOR per byte:")
    result_bytes = bytearray(16)
    for i in range(16):
        res = state_bytes[i] ^ key_bytes[i]; result_bytes[i] = res
        text_doc = f"Byte {i:2d}: {state_bytes[i]:02X} \u2295 {key_bytes[i]:02X} = {res:02X} ({state_bytes[i]:08b} \u2295 {key_bytes[i]:08b} = {res:08b})"
        print(f"  {Fore.GREEN}{text_doc}");add_calculation_paragraph(doc,text_doc);time.sleep(0.05)
    result_hex = result_bytes.hex()
    print_matrix(f"Hasil AddRoundKey Round {round_num}", result_hex); add_matrix_to_doc(doc, f"Hasil AddRoundKey Round {round_num}", result_hex)
    return result_hex

# --- ALUR PROSES UTAMA ---
def aes_full_process():
    if not DOCX_AVAILABLE:
        print(f"{Fore.RED}ERROR: Library 'python-docx' tidak ditemukan.\n{Fore.YELLOW}Silakan instal dengan menjalankan: pip install python-docx")
        return
    try:
        plaintext_txt = input("Masukkan plaintext (teks 16 karakter): ")
        if len(plaintext_txt) != 16: raise ValueError("Plaintext harus tepat 16 karakter")
        kunci_txt = input("Masukkan Kunci Utama (teks 16 karakter): ")
        if len(kunci_txt) != 16: raise ValueError("Kunci harus tepat 16 karakter")
        
        today_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        nama_file_laporan = f'Enkripsi_AES_{plaintext_txt.replace(" ", "_")}_{today_str}.docx'
        
        doc = docx.Document()
        style = doc.styles['Normal']; font = style.font; font.name = 'Times New Roman'; font.size = Pt(12)
        font.color.rgb = RGBColor(0,0,0)
        for i in range(1, 4):
            style = doc.styles[f'Heading {i}']; font = style.font; font.name = 'Times New Roman'; font.color.rgb = RGBColor(0,0,0)

        plaintext_hex, kunci_hex = plaintext_txt.encode('utf-8').hex(), kunci_txt.encode('utf-8').hex()

        doc.add_heading(f'Tugas Enkripsi AES {plaintext_txt}', level=1)
        p = doc.add_paragraph(); p.add_run('///\nPlaintext: ').bold = True; run_p = p.add_run(f"{plaintext_txt} ({plaintext_hex.upper()})"); run_p.font.name = 'Times New Roman'; run_p.font.size = Pt(12)
        p.add_run('\nKunci: ').bold = True; run_k = p.add_run(f"{kunci_txt} ({kunci_hex.upper()})\n///"); run_k.font.name = 'Times New Roman'; run_k.font.size = Pt(12)


        print(f"\n{Fore.CYAN}--- Verifikasi Input ---")
        print(f"Plaintext '{plaintext_txt}' dikonversi menjadi Heks: {Fore.YELLOW}{plaintext_hex.upper()}")
        print(f"Kunci '{kunci_txt}' dikonversi menjadi Heks: {Fore.YELLOW}{kunci_hex.upper()}")
        time.sleep(1)
        
        round_keys = key_schedule_explain(kunci_hex, doc)
        
        if doc: doc.add_paragraph(); doc.add_heading("Ekspansi Round Key", level=2)
        print(f"\n{Fore.YELLOW}===== RINGKASAN SEMUA ROUND KEY YANG DIHASILKAN =====")
        for i, key_hex in enumerate(round_keys):
            print_matrix(f"Round Key {i}", key_hex); add_matrix_to_doc(doc, f"Round Key {i}", key_hex); time.sleep(0.1)
        
        if doc: doc.add_paragraph(); doc.add_heading("Proses Enkripsi Block", level=2)
        print(f"\n{Fore.YELLOW}===== MEMULAI PROSES ENKRIPSI =====")
        state = plaintext_hex

        if doc: doc.add_paragraph(); doc.add_heading("Initial Round (Pre-Round)", level=2)
        state = add_round_key_explain(state, round_keys[0], 0, doc)
        
        for i in range(1, 10):
            if doc: doc.add_paragraph(); doc.add_heading(f"RONDE {i}", level=2)
            print(f"\n{Fore.YELLOW}===== RONDE {i} =====")
            state = sub_bytes_explain(state, doc)
            state = shift_rows_explain(state, doc)
            state = mix_columns_poly_explain(state, doc)
            state = add_round_key_explain(state, round_keys[i], i, doc)
            
        if doc: doc.add_paragraph(); doc.add_heading("RONDE 10 (Final)", level=2)
        print(f"\n{Fore.YELLOW}===== RONDE 10 (Final) =====")
        state = sub_bytes_explain(state, doc)
        state = shift_rows_explain(state, doc)
        text_skip = "Langkah: MixColumns (DILEWATI PADA RONDE FINAL)"; print(f"\n{Fore.MAGENTA}--- {text_skip} ---")
        if doc: doc.add_heading(text_skip, level=3)
        state = add_round_key_explain(state, round_keys[10], 10, doc)
        
        if doc: doc.add_paragraph(); doc.add_heading("Hasil Akhir", level=1)
        print(f"\n{Fore.GREEN}===== PROSES SELESAI =====")
        print_matrix("Ciphertext Akhir", state); add_matrix_to_doc(doc, "Ciphertext Akhir", state)
        
        final_bytes = bytearray.fromhex(state)
        final_binary_str = ' '.join(f'{b:08b}' for b in final_bytes)
        
        print(f"\n{Fore.CYAN}Ringkasan Hasil Akhir:")
        print(f"  {Style.RESET_ALL}Ciphertext (Hex): {Fore.YELLOW}{state.upper()}")
        print(f"  {Style.RESET_ALL}Biner               : {Fore.YELLOW}{final_binary_str}")
        
        if doc:
            doc.add_paragraph()
            p = doc.add_paragraph(); p.add_run('Ciphertext (Heksadesimal): ').bold = True
            p.add_run(state.upper()).font.name = 'Times New Roman'
            p = doc.add_paragraph(); p.add_run('Representasi Biner: ').bold = True
            p.add_run(final_binary_str).font.name = 'Times New Roman'
            
        doc.save(nama_file_laporan)
        print(f"\n{Fore.GREEN}Laporan berhasil dibuat dan disimpan sebagai '{nama_file_laporan}'")

    except ValueError as e: print(f"\n{Fore.RED}Error: {e}")
    except Exception as e: print(f"\n{Fore.RED}Terjadi kesalahan tak terduga: {e}")

if __name__ == "__main__":
    aes_full_process()