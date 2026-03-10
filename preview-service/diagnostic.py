import scribus
import sys
import os

def main():
    print("Scribus Python Diagnostic Started")
    print(f"  DISPLAY={os.environ.get('DISPLAY', '(not set)')}")
    print(f"  QT_QPA_PLATFORM={os.environ.get('QT_QPA_PLATFORM', '(not set)')}")
    
    # Intentamos desactivar el redibujado para mejorar performance
    try:
        scribus.setRedraw(False)
    except:
        pass

    if len(sys.argv) < 2:
        print("Usage: scribus -ns -py diagnostic.py <file.idml|sla>")
        print("NOTA: NO usar -g para IDML (causa hang). Usar Xvfb o QT_QPA_PLATFORM=offscreen.")
        os._exit(0)
        return

    print("Creating a new document test (7 args)...")
    try:
        if scribus.newDoc(scribus.PAPER_A4, (10, 10, 10, 10), scribus.PORTRAIT, 1, scribus.UNIT_POINTS, scribus.NOFACINGPAGES, scribus.FIRSTPAGERIGHT):
            print("New document created successfully")
            scribus.closeDoc()
            print("New document closed")
        else:
            print("Failed to create new document")
    except Exception as e:
        print(f"Error calling newDoc: {str(e)}")

    try:
        fonts = scribus.getFontNames()
        print(f"Scribus has {len(fonts)} fonts available.")
    except Exception as e:
        print(f"Error getting fonts: {str(e)}")

    infile = sys.argv[1]
    print(f"Attempting to open: {infile}")
    
    try:
        success = scribus.openDoc(infile)
        if success:
            print("Document opened successfully!")
            scribus.closeDoc()
            print("Document closed")
        else:
            print("Failed to open document (returned False)")
    except Exception as e:
        print(f"CRASH in openDoc: {str(e)}")
        import traceback
        traceback.print_exc()
    
    print("Diagnostic finished")
    sys.stdout.flush()
    os._exit(0)

if __name__ == "__main__":
    main()
