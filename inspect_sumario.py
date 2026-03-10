
import zipfile
import xml.etree.ElementTree as ET

def inspect_sumario(idml_path):
    with zipfile.ZipFile(idml_path, 'r') as z:
        spreads = [n for n in z.namelist() if n.startswith('Spreads/')]
        for spread_name in spreads:
            with z.open(spread_name) as f:
                root = ET.parse(f).getroot()
                for tf in root.findall('.//TextFrame'):
                    label = tf.find('.//Label/KeyValuePair[@Key="Label"]')
                    if label is not None and label.attrib.get('Value') == 'SUMARIO':
                        story_id = tf.attrib.get('ParentStory')
                        print(f"SUMARIO Frame found in {spread_name}, Story ID: {story_id}")
                        # Look for character style overrides or specific properties here if needed
                        story_file = f"Stories/Story_{story_id}.xml"
                        if story_file in z.namelist():
                            with z.open(story_file) as sf:
                                story_root = ET.parse(sf).getroot()
                                # Print paragraphs and character style ranges
                                for i, psr in enumerate(story_root.findall('.//ParagraphStyleRange')):
                                    print(f"  Paragraph {i}: Style={psr.attrib.get('AppliedParagraphStyle')}")
                                    for j, csr in enumerate(psr.findall('.//CharacterStyleRange')):
                                        content = "".join([c.text for c in csr.findall('Content') if c.text])
                                        font = csr.attrib.get('AppliedFont')
                                        props = csr.find('Properties')
                                        if props is not None:
                                            font_node = props.find('AppliedFont')
                                            if font_node is not None:
                                                font = font_node.text
                                        print(f"    Range {j}: Style={csr.attrib.get('AppliedCharacterStyle')}, Font={font}, Content='{content}'")

if __name__ == "__main__":
    inspect_sumario('1.idml')
