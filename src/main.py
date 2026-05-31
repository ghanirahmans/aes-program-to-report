import time
from datetime import datetime
from pathlib import Path

from aes_steps import (
    add_round_key_explain,
    key_schedule_explain,
    mix_columns_poly_explain,
    print_matrix,
    shift_rows_explain,
    sub_bytes_explain,
)
from input_utils import parse_aes_block_input, sanitize_filename
from report import (
    DOCX_AVAILABLE,
    Pt,
    RGBColor,
    add_matrix_to_doc,
    clear_document_metadata,
    convert_docx_to_pdf,
    docx,
    set_narrow_margins,
    strip_docx_metadata,
)
from terminal_style import Fore, Style


def setup_document_styles(doc):
    style = doc.styles["Normal"]
    font = style.font
    font.name = "Times New Roman"
    font.size = Pt(12)
    font.color.rgb = RGBColor(0, 0, 0)

    for i in range(1, 4):
        style = doc.styles[f"Heading {i}"]
        font = style.font
        font.name = "Times New Roman"
        font.color.rgb = RGBColor(0, 0, 0)


def create_output_paths(plaintext_txt):
    today_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    output_name = f"Enkripsi_AES_{sanitize_filename(plaintext_txt)}_{today_str}"
    output_dir = Path(output_name)
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir, output_dir / f"{output_name}.docx"


def add_input_summary(doc, plaintext_txt, plaintext_hex, kunci_txt, kunci_hex):
    doc.add_heading(f"Tugas Enkripsi AES {plaintext_txt}", level=1)
    p = doc.add_paragraph()
    p.add_run("///\nPlaintext: ").bold = True
    run_p = p.add_run(f"{plaintext_txt} ({plaintext_hex.upper()})")
    run_p.font.name = "Times New Roman"
    run_p.font.size = Pt(12)
    p.add_run("\nKunci: ").bold = True
    run_k = p.add_run(f"{kunci_txt} ({kunci_hex.upper()})\n///")
    run_k.font.name = "Times New Roman"
    run_k.font.size = Pt(12)


def save_report(doc, docx_path, output_dir):
    clear_document_metadata(doc)
    doc.save(docx_path)
    strip_docx_metadata(docx_path)
    return convert_docx_to_pdf(docx_path, output_dir)


def aes_full_process():
    if not DOCX_AVAILABLE:
        print(f"{Fore.RED}ERROR: Library 'python-docx' tidak ditemukan.\n{Fore.YELLOW}Silakan instal dengan menjalankan: pip install python-docx")
        return

    try:
        plaintext_input = input("Masukkan plaintext (teks 16 karakter atau hex 32 digit): ")
        plaintext_txt, plaintext_hex = parse_aes_block_input(plaintext_input, "Plaintext")
        kunci_input = input("Masukkan Kunci Utama (teks 16 karakter atau hex 32 digit): ")
        kunci_txt, kunci_hex = parse_aes_block_input(kunci_input, "Kunci")

        doc = docx.Document()
        set_narrow_margins(doc)
        setup_document_styles(doc)
        output_dir, docx_path = create_output_paths(plaintext_txt)
        add_input_summary(doc, plaintext_txt, plaintext_hex, kunci_txt, kunci_hex)

        print(f"\n{Fore.CYAN}--- Verifikasi Input ---")
        print(f"Plaintext '{plaintext_txt}' dikonversi menjadi Heks: {Fore.YELLOW}{plaintext_hex.upper()}")
        print(f"Kunci '{kunci_txt}' dikonversi menjadi Heks: {Fore.YELLOW}{kunci_hex.upper()}")
        time.sleep(1)

        round_keys = key_schedule_explain(kunci_hex, doc)

        doc.add_paragraph()
        doc.add_heading("Ekspansi Round Key", level=2)
        print(f"\n{Fore.YELLOW}===== RINGKASAN SEMUA ROUND KEY YANG DIHASILKAN =====")
        for i, key_hex in enumerate(round_keys):
            print_matrix(f"Round Key {i}", key_hex)
            add_matrix_to_doc(doc, f"Round Key {i}", key_hex)
            time.sleep(0.1)

        doc.add_paragraph()
        doc.add_heading("Proses Enkripsi Block", level=2)
        print(f"\n{Fore.YELLOW}===== MEMULAI PROSES ENKRIPSI =====")
        state = plaintext_hex

        doc.add_paragraph()
        doc.add_heading("Initial Round (Pre-Round)", level=2)
        state = add_round_key_explain(state, round_keys[0], 0, doc)

        for i in range(1, 10):
            doc.add_paragraph()
            doc.add_heading(f"RONDE {i}", level=2)
            print(f"\n{Fore.YELLOW}===== RONDE {i} =====")
            state = sub_bytes_explain(state, doc)
            state = shift_rows_explain(state, doc)
            state = mix_columns_poly_explain(state, doc)
            state = add_round_key_explain(state, round_keys[i], i, doc)

        doc.add_paragraph()
        doc.add_heading("RONDE 10 (Final)", level=2)
        print(f"\n{Fore.YELLOW}===== RONDE 10 (Final) =====")
        state = sub_bytes_explain(state, doc)
        state = shift_rows_explain(state, doc)
        text_skip = "Langkah: MixColumns (DILEWATI PADA RONDE FINAL)"
        print(f"\n{Fore.MAGENTA}--- {text_skip} ---")
        doc.add_heading(text_skip, level=3)
        state = add_round_key_explain(state, round_keys[10], 10, doc)

        doc.add_paragraph()
        doc.add_heading("Hasil Akhir", level=1)
        print(f"\n{Fore.GREEN}===== PROSES SELESAI =====")
        print_matrix("Ciphertext Akhir", state)
        add_matrix_to_doc(doc, "Ciphertext Akhir", state)

        final_bytes = bytearray.fromhex(state)
        final_binary_str = " ".join(f"{b:08b}" for b in final_bytes)

        print(f"\n{Fore.CYAN}Ringkasan Hasil Akhir:")
        print(f"  {Style.RESET_ALL}Ciphertext (Hex): {Fore.YELLOW}{state.upper()}")
        print(f"  {Style.RESET_ALL}Biner               : {Fore.YELLOW}{final_binary_str}")

        doc.add_paragraph()
        p = doc.add_paragraph()
        p.add_run("Ciphertext (Heksadesimal): ").bold = True
        p.add_run(state.upper()).font.name = "Times New Roman"
        p = doc.add_paragraph()
        p.add_run("Representasi Biner: ").bold = True
        p.add_run(final_binary_str).font.name = "Times New Roman"

        pdf_path = save_report(doc, docx_path, output_dir)
        print(f"\n{Fore.GREEN}Folder hasil dibuat: '{output_dir}'")
        print(f"{Fore.GREEN}DOCX: '{docx_path}'")
        print(f"{Fore.GREEN}PDF : '{pdf_path}'")

    except ValueError as e:
        print(f"\n{Fore.RED}Error: {e}")
    except Exception as e:
        print(f"\n{Fore.RED}Terjadi kesalahan tak terduga: {e}")


if __name__ == "__main__":
    aes_full_process()
