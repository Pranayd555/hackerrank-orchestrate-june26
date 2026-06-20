import subprocess
import sys
import os

def main():
    # Resolve the directory of code/main.py to execute the command correctly
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    # Run the TypeScript entry point using npx tsx
    result = subprocess.run(
        ["npx", "tsx", "src/main.ts"], 
        cwd=script_dir, 
        capture_output=False, 
        shell=True
    )
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()
