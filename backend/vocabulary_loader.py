import os
import re
import zipfile
import xml.etree.ElementTree as ET


VOCABULARY_DIR_NAME = "Từ Vựng Topik Hàn Việt"

TOPIC_LABELS = {
    "Part 2 Xa Hoi Van Hoa Moi Truong": "Xã hội - Văn hóa - Môi trường",
    "Part 3 Khoa Hoc Cong Nghe Y Te": "Khoa học - Công nghệ - Y tế",
    "Part 4 Cao Cap 6 Cau 54": "TOPIK cao cấp - Câu 54",
    "Part 5 Triet Hoc Tam Ly Kinh Te Vi Mo": "Triết học - Tâm lý - Kinh tế vi mô",
    "Part 6 Thanh Ngu Dong Trai Nghia": "Thành ngữ - Đồng/trái nghĩa",
    "Thuc Chien Han Viet": "Thực chiến Hán Việt",
}


def topic_from_filename(filename: str) -> str:
    name = os.path.splitext(os.path.basename(filename))[0]
    name = re.sub(r"^Bo_Tu_Vung_Forecast_TOPIK_", "", name)
    name = re.sub(r"\s*\(\d+\)$", "", name)
    name = name.replace("_", " ").strip()
    return TOPIC_LABELS.get(name, name or "Forecast TOPIK")


def _cell_value(cell, shared_strings, ns):
    value = cell.find("a:v", ns)
    if value is not None and value.text is not None:
        text = value.text
        if cell.get("t") == "s":
            return shared_strings[int(text)]
        return text
    inline = cell.find("a:is", ns)
    if inline is not None:
        return "".join(t.text or "" for t in inline.findall(".//a:t", ns))
    return ""


def read_xlsx_rows(path: str):
    ns = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(path) as archive:
        shared_strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("a:si", ns):
                shared_strings.append("".join(t.text or "" for t in item.findall(".//a:t", ns)))

        sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        for row in sheet.findall(".//a:row", ns):
            values = [_cell_value(cell, shared_strings, ns).strip() for cell in row.findall("a:c", ns)]
            if any(values):
                yield values


def iter_forecast_vocabulary(data_dir: str):
    vocab_dir = os.path.join(data_dir, VOCABULARY_DIR_NAME)
    if not os.path.isdir(vocab_dir):
        return

    seen = set()
    for filename in sorted(os.listdir(vocab_dir)):
        if not filename.lower().endswith(".xlsx") or filename.startswith("~$"):
            continue
        topic = topic_from_filename(filename)
        path = os.path.join(vocab_dir, filename)
        for index, row in enumerate(read_xlsx_rows(path)):
            if index == 0 and row and "Từ Vựng" in row[0]:
                continue
            korean = row[0] if len(row) > 0 else ""
            han_viet = row[1] if len(row) > 1 else ""
            meaning = row[2] if len(row) > 2 else ""
            example = row[3] if len(row) > 3 else ""
            key = (korean, meaning, topic)
            if not korean or key in seen:
                continue
            seen.add(key)
            yield {
                "korean": korean,
                "han_viet": han_viet,
                "meaning": meaning,
                "example": example,
                "topic": topic,
                "source": filename,
            }
