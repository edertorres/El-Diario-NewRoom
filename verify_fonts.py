
def map_font(font_name: str) -> str:
    if not font_name:
        return "Liberation Serif"
    name = font_name.lower()
    if "austin" in name:
        return "Austin"
    if "dingbats" in name:
        return "Zapf Dingbats"
    if "klavika" in name:
        return "Klavika"
    return "Liberation Serif"

test_names = ["ZapfDingbats", "Zapf Dingbats", "ZapfDingbats-Regular", "Zapf Dingbats Regular"]
for name in test_names:
    print(f"'{name}' -> '{map_font(name)}'")
