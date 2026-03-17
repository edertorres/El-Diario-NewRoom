import os
import subprocess
import signal
import time

def cleanup():
    print("Iniciando limpieza de procesos Scribus y Xvfb...")
    
    # Matar Scribus
    subprocess.run(["pkill", "-9", "scribus"], capture_output=True)
    
    # Matar Xvfb si quedó alguno
    subprocess.run(["pkill", "-9", "Xvfb"], capture_output=True)
    
    # Matar xvfb-run
    subprocess.run(["pkill", "-9", "xvfb-run"], capture_output=True)
    
    print("Limpieza completada.")

if __name__ == "__main__":
    cleanup()
