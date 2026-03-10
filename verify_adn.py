import zipfile
import xml.etree.ElementTree as ET
import sys
import re

def get_local_name(tag):
    return tag.split('}')[-1] if '}' in tag else tag

def inspect_adn(idml_path):
    print(f"=== Inspecting ADN in {idml_path} ===\n")
    try:
        with zipfile.ZipFile(idml_path, "r") as z:
            story_files = [f for f in z.namelist() if f.startswith("Stories/") and f.endswith(".xml")]
            if not story_files:
                print("No stories found.")
                return

            found_any = False
            for story_file in story_files:
                with z.open(story_file) as f:
                    content = f.read().decode('utf-8')
                    root = ET.fromstring(content)
                    
                    p_ranges = root.findall(".//ParagraphStyleRange")
                    for p in p_ranges:
                        attributes = ['PointSize', 'Leading', 'Justification', 'LeftIndent', 'FirstLineIndent']
                        overrides = {}
                        for attr in attributes:
                            val = p.attrib.get(attr)
                            if val: overrides[attr] = val
                            
                        props = p.find("Properties")
                        if props is not None:
                            for attr in attributes:
                                prop_elem = props.find(attr)
                                if prop_elem is not None: overrides[attr] = prop_elem.text

                        if overrides:
                            found_any = True
                            print(f"Story: {story_file} | Style: {p.attrib.get('AppliedParagraphStyle')}")
                            for k, v in overrides.items():
                                print(f"  P-Override: {k} = {v}")
                            
                            # Content preview
                            content_txt = "".join([c.text for c in p.findall(".//Content") if c.text])
                            if content_txt:
                                print(f"  Text: {content_txt[:60]}...")
            
            if not found_any:
                print("No specific overrides found in any story.")

    except Exception as e:
        print(f"Error: {e}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        for path in sys.argv[1:]:
            inspect_adn(path)
    else:
        inspect_adn("1.idml")
