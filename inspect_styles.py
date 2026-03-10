import zipfile
import xml.etree.ElementTree as ET
import sys

def list_styles(idml_path):
    print(f"Inspecting styles in {idml_path}...")
    try:
        with zipfile.ZipFile(idml_path, "r") as z:
            with z.open("Resources/Styles.xml") as f:
                root = ET.parse(f).getroot()
                print("\n--- Paragraph Styles ---")
                for style in root.findall(".//ParagraphStyle"):
                    self_attr = style.attrib.get("Self", "")
                    name_attr = style.attrib.get("Name", "")
                    print(f"Self: {self_attr} | Name: {name_attr}")
    except Exception as e:
        print(f"Error reading {idml_path}: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        for path in sys.argv[1:]:
            list_styles(path)
    else:
        # Default to checking common files found in file list
        list_styles("test.idml")
        list_styles("1.idml")
